import { Router } from "express";
import { getReporteNotasPorCatedratico, getReporteAlumnosPorRango } from "../controllers/reporte.controller.js";

const router = Router();

// SIN autenticación mientras se prueban los reportes.
// Volver a activar authenticateToken + verificarRol antes de producción.
router.get("/notas-por-catedratico/:catedraticoId", getReporteNotasPorCatedratico);
router.get("/alumnos-por-rango", getReporteAlumnosPorRango);

export default router;
