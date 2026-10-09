import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ROL, obtenerNombreRol, puedeOperarSede, tienePermiso, type Modulo } from "../middlewares/role.middleware.js";
import { encargadoTieneAcceso, type PermisoVinculo } from "./vinculos.service.js";

// ¿Quien hace la peticion puede ver esta informacion del alumno?
//  - El propio alumno.
//  - Un encargado con vinculo vigente y el permiso correspondiente (notas / pagos).
//  - Un catedratico que imparte en la seccion del alumno (no ve pagos).
//  - El personal con permiso del modulo en la sede del alumno.
export const puedeVerAlumno = async (
    req: AuthenticatedRequest,
    alumnoId: number,
    modulo: Modulo,
    permisoVinculo: PermisoVinculo = "general",
): Promise<boolean> => {
    const usuarioId = Number(req.user?.id);
    const rol = await obtenerNombreRol(req);

    if (rol === ROL.ALUMNO) return usuarioId === alumnoId;
    if (rol === ROL.ENCARGADO) return encargadoTieneAcceso(usuarioId, alumnoId, permisoVinculo);

    const alumno = await prisma.alumno.findUnique({ where: { alumnoId }, select: { seccionId: true, seccion: { select: { sedeId: true } } } });
    if (!alumno) return false;

    if (rol === ROL.CATEDRATICO) {
        if (modulo === "pagos" || modulo === "becas") return false;
        return (await prisma.cursoSeccion.count({ where: { seccionId: alumno.seccionId, catedraticoId: usuarioId } })) > 0;
    }

    return (await tienePermiso(req, modulo)) && (await puedeOperarSede(req, alumno.seccion.sedeId));
};
