import type { Response } from "express";
import { obtenerBitacoraRecienteGlobal } from "../services/bitacora.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

// GET /api/bitacora/reciente
export const getActividadReciente = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const actividades = await obtenerBitacoraRecienteGlobal(10);

    const data = actividades.map((a) => ({
      id: a.bitacoraId,
      accion: a.accion,
      entidad: a.entidad,
      detalle: a.detalle,
      fecha: a.fecha,
      usuario: a.usuario
        ? `${a.usuario.nombres} ${a.usuario.apellidos}`
        : "Sistema",
    }));

    return res.json({ status: "success", data });
  } catch (error) {
    console.error("Error al obtener la actividad reciente:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al consultar la bitácora de actividades.",
    });
  }
};