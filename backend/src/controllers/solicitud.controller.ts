import type { Request, Response } from "express";
import type { Prisma, Solicitud } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { puedeOperarSede, sedeDelAlcance } from "../middlewares/role.middleware.js";
import { sendMail } from "../services/mail.service.js";
import { plantillaInscripcionAprobada, plantillaInscripcionRechazada } from "../templates/mail.templates.js";
import { aprobarSolicitud, cuentaExistenteEncargado, posiblesDuplicados } from "../services/inscripcion.service.js";
import { accesoPorNivel } from "../services/accesoPortal.service.js";

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) {
        return res.status(error.status).json({ status: "error", message: error.message });
    }
    console.error(`»SOLI_CTRL: ${mensaje}`, error);
    return res.status(500).json({ status: "error", message: mensaje });
};

const incluirSede = { sede: { select: { sedeId: true, nombre: true } } } satisfies Prisma.SolicitudInclude;

// Oculta parte de un dato personal: "rosa.pac@gmail.com" -> "ro*****@gmail.com"
const enmascarar = (valor: string, visibles = 2) =>
    valor.length <= visibles ? "*".repeat(valor.length) : valor.slice(0, visibles) + "*".repeat(Math.max(3, valor.length - visibles - 2)) + valor.slice(-2);
const enmascararCorreo = (correo: string) => {
    const [usuario, dominio] = correo.split("@");
    return dominio ? `${usuario.slice(0, 2)}${"*".repeat(Math.max(3, usuario.length - 2))}@${dominio}` : enmascarar(correo);
};

// La consulta pública solo con el número no debe exponer DPI, teléfono ni correo completos
const versionPublica = (s: Solicitud & { sede: { nombre: string } | null }) => ({
    ...s,
    encargadoDpi: enmascarar(s.encargadoDpi, 0).replace(/.{4}$/, s.encargadoDpi.slice(-4)),
    encargadoTelefono: enmascarar(s.encargadoTelefono, 0).replace(/.{2}$/, s.encargadoTelefono.slice(-2)),
    encargadoCorreo: enmascararCorreo(s.encargadoCorreo),
    alumnoId: undefined,
});

// El personal de sede ve las solicitudes de su sede y las que no indicaron sede
const filtroSede = async (req: AuthenticatedRequest): Promise<Prisma.SolicitudWhereInput> => {
    const sedeId = await sedeDelAlcance(req);
    return sedeId === null ? {} : { OR: [{ sedeId }, { sedeId: null }] };
};

const verificarSolicitudDeMiSede = async (req: AuthenticatedRequest, solicitudId: number) => {
    const solicitud = await prisma.solicitud.findUnique({ where: { solicitudId }, include: incluirSede });
    if (!solicitud) throw new ReglaNegocioError(`No se encontró la solicitud con ID: ${solicitudId}.`, 404);
    if (solicitud.sedeId !== null && !(await puedeOperarSede(req, solicitud.sedeId))) {
        throw new ReglaNegocioError("La solicitud pertenece a otra sede.", 403);
    }
    return solicitud;
};

// ---------------------------------------------------------------------------
// Público (formulario de inscripción y consulta del estado)
// ---------------------------------------------------------------------------

export const crearSolicitud = async (req: Request, res: Response) => {
    const { numero, modo, encargado, alumno, documentos, observaciones, fechaSolicitud, fechaLimite } = req.body;

    if (!numero || !encargado || !alumno) {
        return res.status(400).json({ status: "error", message: "Faltan campos obligatorios para registrar la solicitud" });
    }

    try {
        let sedeId: number | null = null;
        if (alumno.sede) {
            const sedeDB = await prisma.sede.findFirst({ where: { nombre: alumno.sede, deletedAt: null } });
            if (sedeDB) sedeId = sedeDB.sedeId;
        }

        const nuevaSoli = await prisma.solicitud.create({
            data: {
                numero,
                modo: modo === "publico" ? "PUBLICO" : "PRESENCIAL",
                encargadoNombres: encargado.nombres,
                encargadoApellidos: encargado.apellidos,
                encargadoDpi: encargado.dpi,
                encargadoTelefono: encargado.telefono,
                encargadoCorreo: String(encargado.correo ?? "").trim().toLowerCase(),
                encargadoParentesco: encargado.parentesco,
                alumnoNombres: alumno.nombres,
                alumnoApellidos: alumno.apellidos,
                alumnoFechaNacimiento: new Date(alumno.fechaNacimiento),
                alumnoNivel: alumno.nivel,
                alumnoCarrera: alumno.carrera || null,
                alumnoAnio: alumno.anio || null,
                alumnoGrado: alumno.grado || null,
                sedeId,
                documentos: documentos || [],
                observaciones: observaciones || null,
                fechaSolicitud: new Date(fechaSolicitud),
                fechaLimite: new Date(fechaLimite),
            },
        });

        return res.status(201).json({ status: "success", data: nuevaSoli });
    } catch (error) {
        if ((error as { code?: string }).code === "P2002") {
            return res.status(409).json({ status: "error", message: "Ya existe una solicitud con ese número. Intente enviarla de nuevo." });
        }
        return responderError(res, error, "No se pudo crear la solicitud");
    }
};

// GET /api/solicitudes/numero?numero=SOL-2026-00001 — con datos personales enmascarados
export const getSolicitudByNumero = async (req: Request, res: Response) => {
    const { numero } = req.query;
    if (!numero) return res.status(400).json({ status: "error", message: "Faltan campos obligatorios." });

    try {
        const solicitud = await prisma.solicitud.findUnique({ where: { numero: String(numero).trim() }, include: incluirSede });
        if (!solicitud) {
            return res.status(404).json({ status: "error", message: `No se encontró ninguna solicitud con número ${numero}` });
        }
        return res.json({ status: "success", data: versionPublica(solicitud) });
    } catch (error) {
        return responderError(res, error, "No se pudo obtener la solicitud.");
    }
};

// GET /api/solicitudes/dpi-correo — quien conoce DPI y correo es el propio encargado: datos completos
export const getSolicitudByDpiCorreo = async (req: Request, res: Response) => {
    const { dpi, correo } = req.query;
    if (!dpi || !correo) return res.status(400).json({ status: "error", message: "Faltan campos obligatorios." });

    try {
        const solicitud = await prisma.solicitud.findFirst({
            where: {
                encargadoDpi: String(dpi).trim(),
                encargadoCorreo: { equals: String(correo).trim(), mode: "insensitive" },
            },
            include: incluirSede,
            orderBy: { createdAt: "desc" },
        });

        if (!solicitud) {
            return res.status(404).json({ status: "error", message: "No se encontró ninguna solicitud con esos datos." });
        }
        return res.json({ status: "success", data: { ...solicitud, alumnoId: undefined } });
    } catch (error) {
        return responderError(res, error, "No se pudo obtener la solicitud con esos parámetros.");
    }
};

// ---------------------------------------------------------------------------
// Administración de la sede
// ---------------------------------------------------------------------------

// GET /api/solicitudes?estado=PENDIENTE&q=texto
export const getSolicitudes = async (req: AuthenticatedRequest, res: Response) => {
    const { estado, q } = req.query;

    try {
        const where: Prisma.SolicitudWhereInput = { AND: [await filtroSede(req)] };
        if (typeof estado === "string" && estado) (where.AND as Prisma.SolicitudWhereInput[]).push({ estado: estado as Solicitud["estado"] });
        if (typeof q === "string" && q.trim()) {
            const texto = { contains: q.trim(), mode: "insensitive" as const };
            (where.AND as Prisma.SolicitudWhereInput[]).push({
                OR: [{ numero: texto }, { alumnoNombres: texto }, { alumnoApellidos: texto }, { encargadoNombres: texto }, { encargadoApellidos: texto }, { encargadoCorreo: texto }],
            });
        }

        const solicitudes = await prisma.solicitud.findMany({
            where,
            include: incluirSede,
            orderBy: [{ fechaSolicitud: "desc" }],
        });

        return res.json({ status: "success", data: solicitudes });
    } catch (error) {
        return responderError(res, error, "No se pudo obtener las solicitudes");
    }
};

// GET /api/solicitudes/:id
export const getSolicitudById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const solicitud = await verificarSolicitudDeMiSede(req, Number(req.params.id));
        return res.json({ status: "success", data: solicitud });
    } catch (error) {
        return responderError(res, error, "No se pudo obtener la solicitud.");
    }
};

const normalizar = (t: string | null | undefined) =>
    (t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// GET /api/solicitudes/:id/opciones — lo que el administrador necesita para decidir:
// secciones abiertas (marcando las del grado pedido), cuenta existente del encargado y posibles duplicados
export const getOpcionesAprobacion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const solicitud = await verificarSolicitudDeMiSede(req, Number(req.params.id));
        const alcance = await sedeDelAlcance(req);

        const [secciones, cuentaEncargado, duplicados] = await Promise.all([
            prisma.seccion.findMany({
                where: {
                    deletedAt: null,
                    anioLectivo: { gte: new Date().getFullYear() },
                    sede: { activo: true, deletedAt: null },
                    ...(alcance !== null ? { sedeId: alcance } : {}),
                },
                include: { grado: true, sede: { select: { sedeId: true, nombre: true } }, _count: { select: { alumnos: true } } },
                orderBy: [{ anioLectivo: "asc" }, { sedeId: "asc" }, { grado: { orden: "asc" } }, { nombre: "asc" }],
            }),
            cuentaExistenteEncargado(solicitud.encargadoCorreo),
            posiblesDuplicados(solicitud.alumnoNombres, solicitud.alumnoApellidos, solicitud.alumnoFechaNacimiento),
        ]);

        const gradoPedido = normalizar(solicitud.alumnoGrado);
        const anioPedido = normalizar(solicitud.alumnoAnio);

        return res.json({
            status: "success",
            data: {
                solicitud,
                vencida: solicitud.estado !== "APROBADA" && solicitud.fechaLimite < new Date(),
                cuentaEncargado,
                duplicados,
                secciones: secciones.map((s) => ({
                    seccionId: s.seccionId,
                    nombre: s.nombre,
                    anioLectivo: s.anioLectivo,
                    alumnos: s._count.alumnos,
                    grado: { gradoId: s.grado.gradoId, nombre: s.grado.nombre, nivel: s.grado.nivel },
                    sede: s.sede,
                    accesoPorNivel: accesoPorNivel(s.grado.nivel),
                    // Sugerida: el grado coincide con lo pedido y está en la sede elegida por el encargado
                    sugerida:
                        (normalizar(s.grado.nombre) === gradoPedido || (!!anioPedido && normalizar(s.grado.nombre).includes(anioPedido)))
                        && (solicitud.sedeId === null || s.sedeId === solicitud.sedeId),
                })),
            },
        });
    } catch (error) {
        return responderError(res, error, "No se pudieron cargar las opciones de aprobación.");
    }
};

// PUT /api/solicitudes/:id/estado { estado: "PENDIENTE" | "REVISION" | "VENCIDA", observaciones? }
// Aprobar y rechazar tienen sus propias rutas (crean cuentas / notifican al encargado)
export const updateEstadoSolicitud = async (req: AuthenticatedRequest, res: Response) => {
    const { estado, observaciones } = req.body;
    const estadosValidos = ["PENDIENTE", "REVISION", "VENCIDA"];

    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ status: "error", message: "Use aprobar o rechazar para resolver la solicitud; aquí solo PENDIENTE, REVISION o VENCIDA." });
    }

    try {
        const solicitud = await verificarSolicitudDeMiSede(req, Number(req.params.id));
        if (solicitud.estado === "APROBADA" || solicitud.estado === "RECHAZADA") {
            throw new ReglaNegocioError("La solicitud ya fue resuelta.", 409);
        }

        const actualizada = await prisma.solicitud.update({
            where: { solicitudId: solicitud.solicitudId },
            data: { estado, ...(observaciones !== undefined && { observaciones }) },
            include: incluirSede,
        });
        return res.json({ status: "success", data: actualizada });
    } catch (error) {
        return responderError(res, error, "No se pudo actualizar el estado de la solicitud.");
    }
};

// POST /api/solicitudes/:id/aprobar { seccionId, accesoPortal?, confirmarDuplicado? }
export const aprobar = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const solicitud = await verificarSolicitudDeMiSede(req, Number(req.params.id));
        const { seccionId, accesoPortal, confirmarDuplicado } = req.body ?? {};
        if (!seccionId) throw new ReglaNegocioError("Seleccione la sección del alumno.", 400);
        if (accesoPortal !== undefined && accesoPortal !== null && typeof accesoPortal !== "boolean") {
            throw new ReglaNegocioError("accesoPortal debe ser true, false o null.", 400);
        }

        const seccion = await prisma.seccion.findUnique({ where: { seccionId: Number(seccionId) }, select: { sedeId: true } });
        if (!seccion || !(await puedeOperarSede(req, seccion.sedeId))) {
            throw new ReglaNegocioError("No puede inscribir alumnos en esa sede.", 403);
        }

        const r = await aprobarSolicitud(solicitud.solicitudId, { seccionId: Number(seccionId), accesoPortal, confirmarDuplicado: !!confirmarDuplicado }, Number(req.user?.id));

        const { subject, html } = plantillaInscripcionAprobada({
            nombreDestinatario: r.encargado.nombre,
            nombreAlumno: r.alumno.nombre,
            grado: r.seccion.grado.nombre,
            seccion: r.seccion.nombre,
            sede: r.seccion.sede.nombre,
            anioLectivo: r.seccion.anioLectivo,
            usuarioEncargado: r.encargado.usuario,
            credencialEncargado: r.encargado.passwordTemporal ? { usuario: r.encargado.usuario, password: r.encargado.passwordTemporal } : null,
            credencialAlumno: r.alumno.passwordTemporal ? { usuario: r.alumno.usuario, password: r.alumno.passwordTemporal } : null,
        });
        const correoEnviado = await sendMail({ to: r.encargado.usuario, subject, html, usuarioId: r.encargadoId, tipo: "Inscripcion" });

        // Las credenciales también se devuelven para entregarlas en ventanilla si el correo falla
        return res.status(201).json({
            status: "success",
            message: correoEnviado
                ? `${r.alumno.nombre} quedó inscrito. Se enviaron los accesos a ${r.encargado.usuario}.`
                : `${r.alumno.nombre} quedó inscrito, pero no se pudo enviar el correo: entregue los accesos en persona.`,
            data: { alumnoId: r.alumnoId, encargadoId: r.encargadoId, encargado: r.encargado, alumno: r.alumno, correoEnviado },
        });
    } catch (error) {
        return responderError(res, error, "No se pudo aprobar la solicitud.");
    }
};

// POST /api/solicitudes/:id/rechazar { motivo }
export const rechazar = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const motivo = typeof req.body?.motivo === "string" ? req.body.motivo.trim() : "";
        if (motivo.length < 5) throw new ReglaNegocioError("Indique el motivo del rechazo (se le enviará al encargado).", 400);

        const solicitud = await verificarSolicitudDeMiSede(req, Number(req.params.id));
        if (solicitud.estado === "APROBADA" || solicitud.estado === "RECHAZADA") {
            throw new ReglaNegocioError("La solicitud ya fue resuelta.", 409);
        }

        await prisma.solicitud.update({
            where: { solicitudId: solicitud.solicitudId },
            data: { estado: "RECHAZADA", motivoResolucion: motivo.slice(0, 500), fechaResolucion: new Date() },
        });

        const { subject, html } = plantillaInscripcionRechazada({
            nombreDestinatario: `${solicitud.encargadoNombres} ${solicitud.encargadoApellidos}`,
            nombreAlumno: `${solicitud.alumnoNombres} ${solicitud.alumnoApellidos}`,
            numero: solicitud.numero,
            motivo,
        });
        const correoEnviado = await sendMail({ to: solicitud.encargadoCorreo, subject, html });

        return res.json({
            status: "success",
            message: correoEnviado ? "Solicitud rechazada; se notificó al encargado." : "Solicitud rechazada, pero no se pudo enviar el correo al encargado.",
        });
    } catch (error) {
        return responderError(res, error, "No se pudo rechazar la solicitud.");
    }
};
