import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import { ROL } from "../middlewares/role.middleware.js";
import { correoEnUso, generarPasswordTemporal, asegurarRegistrosDeRol } from "./usuarios.service.js";
import { PARENTESCOS } from "./vinculos.service.js";
import { tieneAccesoPortal } from "./accesoPortal.service.js";

// Aprobar una solicitud de inscripción convierte los datos del formulario en cuentas reales:
// el encargado (o se reutiliza la suya si ya tenía), el alumno, el vínculo entre ambos y la matrícula.

const DOMINIO_ALUMNOS = process.env.DOMINIO_CORREO_ALUMNOS || "alumnos.dercas.edu.gt";

const sinAcentos = (texto: string) =>
    texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// Usuario institucional del alumno (no es un buzón real): nombre.apellido[n]@dominio
const generarCorreoAlumno = async (nombres: string, apellidos: string): Promise<string> => {
    const base = `${sinAcentos(nombres.split(/\s+/)[0]) || "alumno"}.${sinAcentos(apellidos.split(/\s+/)[0]) || "dercas"}`;
    for (let n = 1; n < 1000; n++) {
        const email = `${base}${n === 1 ? "" : n}@${DOMINIO_ALUMNOS}`;
        if (!(await correoEnUso(email))) return email;
    }
    throw new ReglaNegocioError("No se pudo generar el usuario del alumno.", 500);
};

const normalizarParentesco = (p: string | null) =>
    PARENTESCOS.find((x) => x.toLowerCase() === (p ?? "").trim().toLowerCase()) ?? "Otro";

// Alumnos ya registrados con el mismo nombre y fecha de nacimiento (doble solicitud, reingreso...)
export const posiblesDuplicados = (nombres: string, apellidos: string, fechaNacimiento: Date) =>
    prisma.alumno.findMany({
        where: {
            fechaNacimiento,
            usuario: {
                nombres: { equals: nombres.trim(), mode: "insensitive" },
                apellidos: { equals: apellidos.trim(), mode: "insensitive" },
            },
        },
        select: {
            alumnoId: true,
            usuario: { select: { nombres: true, apellidos: true, deletedAt: true } },
            seccion: { select: { nombre: true, anioLectivo: true, grado: { select: { nombre: true } }, sede: { select: { nombre: true } } } },
        },
    });

// Cuenta que ya existe con el correo del encargado y qué pasará con ella
export const cuentaExistenteEncargado = async (correo: string) => {
    const usuario = await prisma.usuario.findFirst({
        where: { email: { equals: correo.trim(), mode: "insensitive" } },
        include: { rol: true, rolesAdicionales: { include: { rol: true } }, alumno: { select: { alumnoId: true } } },
    });
    if (!usuario) return null;
    const roles = [usuario.rol.nombre, ...usuario.rolesAdicionales.map((r) => r.rol.nombre)];
    return {
        usuarioId: usuario.usuarioId,
        nombre: `${usuario.nombres} ${usuario.apellidos}`,
        email: usuario.email,
        roles: [...new Set(roles)],
        dadoDeBaja: usuario.deletedAt !== null,
        esAlumno: usuario.alumno !== null,
        yaEsEncargado: roles.includes(ROL.ENCARGADO),
    };
};

export interface OpcionesAprobacion {
    seccionId: number;
    /** null = según el nivel; true/false = excepción */
    accesoPortal?: boolean | null;
    /** El administrador confirmó que no es el mismo alumno que uno ya registrado */
    confirmarDuplicado?: boolean;
}

export const aprobarSolicitud = async (solicitudId: number, opciones: OpcionesAprobacion, actorId: number) => {
    const solicitud = await prisma.solicitud.findUnique({ where: { solicitudId } });
    if (!solicitud) throw new ReglaNegocioError("Solicitud no encontrada.", 404);
    if (solicitud.estado === "APROBADA" || solicitud.alumnoId) throw new ReglaNegocioError("La solicitud ya fue aprobada.", 409);
    if (solicitud.estado === "RECHAZADA") throw new ReglaNegocioError("La solicitud fue rechazada; el encargado debe iniciar una nueva.", 409);

    const seccion = await prisma.seccion.findUnique({
        where: { seccionId: Number(opciones.seccionId) },
        include: { grado: true, sede: true },
    });
    if (!seccion || seccion.deletedAt) throw new ReglaNegocioError("Seleccione una sección válida.", 400);
    if (seccion.anioLectivo < new Date().getFullYear()) {
        throw new ReglaNegocioError(`La sección es del ciclo ${seccion.anioLectivo}, que ya terminó.`, 400);
    }

    if (!opciones.confirmarDuplicado) {
        const duplicados = await posiblesDuplicados(solicitud.alumnoNombres, solicitud.alumnoApellidos, solicitud.alumnoFechaNacimiento);
        if (duplicados.length) {
            throw new ReglaNegocioError(
                "Ya existe un alumno con el mismo nombre y fecha de nacimiento. Revise que no sea el mismo antes de aprobar.",
                409,
            );
        }
    }

    const existente = await cuentaExistenteEncargado(solicitud.encargadoCorreo);
    if (existente?.dadoDeBaja) {
        throw new ReglaNegocioError(`El correo ${existente.email} pertenece a una cuenta dada de baja. Reactívela en Usuarios antes de aprobar.`, 409);
    }
    if (existente?.esAlumno) {
        throw new ReglaNegocioError(`El correo ${existente.email} pertenece a un alumno; el encargado necesita otro correo.`, 409);
    }

    const [rolEncargado, rolAlumno] = await Promise.all([
        prisma.rol.findFirst({ where: { nombre: ROL.ENCARGADO } }),
        prisma.rol.findFirst({ where: { nombre: ROL.ALUMNO } }),
    ]);
    if (!rolEncargado || !rolAlumno) throw new ReglaNegocioError("Faltan los roles Encargado/Alumno en el sistema.", 500);

    const correoAlumno = await generarCorreoAlumno(solicitud.alumnoNombres, solicitud.alumnoApellidos);
    const passwordAlumno = generarPasswordTemporal();
    const passwordEncargado = existente ? null : generarPasswordTemporal();
    const [hashAlumno, hashEncargado] = await Promise.all([
        bcrypt.hash(passwordAlumno, 10),
        passwordEncargado ? bcrypt.hash(passwordEncargado, 10) : Promise.resolve(null),
    ]);
    const parentesco = normalizarParentesco(solicitud.encargadoParentesco);

    const resultado = await prisma.$transaction(async (tx) => {
        // Encargado: se reutiliza la cuenta si ya existe (ej. un catedrático que también es padre)
        let encargadoId: number;
        if (existente) {
            encargadoId = existente.usuarioId;
            if (!existente.yaEsEncargado) {
                await tx.usuarioRol.create({ data: { usuarioId: encargadoId, rolId: rolEncargado.rolId } });
            }
        } else {
            const u = await tx.usuario.create({
                data: {
                    nombres: solicitud.encargadoNombres.trim(),
                    apellidos: solicitud.encargadoApellidos.trim(),
                    email: solicitud.encargadoCorreo.trim().toLowerCase(),
                    passwordHash: hashEncargado!,
                    rolId: rolEncargado.rolId,
                    sedeId: null,
                },
            });
            encargadoId = u.usuarioId;
        }
        await asegurarRegistrosDeRol(tx, encargadoId, [ROL.ENCARGADO], { parentesco });

        const alumnoUsuario = await tx.usuario.create({
            data: {
                nombres: solicitud.alumnoNombres.trim(),
                apellidos: solicitud.alumnoApellidos.trim(),
                email: correoAlumno,
                passwordHash: hashAlumno,
                rolId: rolAlumno.rolId,
                sedeId: seccion.sedeId,
            },
        });
        const alumnoId = alumnoUsuario.usuarioId;
        await tx.alumno.create({
            data: {
                alumnoId,
                seccionId: seccion.seccionId,
                fechaNacimiento: solicitud.alumnoFechaNacimiento,
                accesoPortal: opciones.accesoPortal ?? null,
            },
        });

        // Quien solicitó la inscripción queda como contacto principal y responsable de pagos
        await tx.alumnoEncargado.create({
            data: { alumnoId, encargadoId, parentesco, esPrincipal: true, responsableFinanciero: true },
        });

        await tx.matricula.create({
            data: { alumnoId, seccionId: seccion.seccionId, encargadoId, anioLectivo: seccion.anioLectivo, estado: "Activa" },
        });

        await tx.solicitud.update({
            where: { solicitudId },
            data: { estado: "APROBADA", alumnoId, fechaResolucion: new Date(), sedeId: seccion.sedeId },
        });

        await tx.bitacora.create({
            data: {
                usuarioId: actorId,
                accion: "Inscripción aprobada",
                entidad: "Alumno",
                entidadId: alumnoId,
                detalle: `Solicitud ${solicitud.numero}: inscrito en ${seccion.grado.nombre} ${seccion.nombre} (${seccion.sede.nombre}, ${seccion.anioLectivo}).`,
            },
        });

        return { alumnoId, encargadoId };
    });

    const accesoAlumno = tieneAccesoPortal({ accesoPortal: opciones.accesoPortal ?? null, nivel: seccion.grado.nivel });

    return {
        ...resultado,
        solicitud,
        seccion,
        encargado: {
            usuario: existente?.email ?? solicitud.encargadoCorreo.trim().toLowerCase(),
            passwordTemporal: passwordEncargado,
            cuentaExistente: !!existente,
            nombre: `${solicitud.encargadoNombres} ${solicitud.encargadoApellidos}`,
        },
        alumno: {
            usuario: correoAlumno,
            // Sin acceso al portal la contraseña no se entrega (la asigna el encargado si algún día lo habilitan)
            passwordTemporal: accesoAlumno ? passwordAlumno : null,
            accesoPortal: accesoAlumno,
            nombre: `${solicitud.alumnoNombres} ${solicitud.alumnoApellidos}`,
        },
    };
};
