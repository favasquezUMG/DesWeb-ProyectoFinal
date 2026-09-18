import { Router } from "express";
import { getReporteNotasPorCatedratico, getReporteAlumnosPorRango } from "../controllers/reporte.controller.js";

const router = Router();

router.get("/notas-por-catedratico/:catedraticoId", getReporteNotasPorCatedratico);
router.get("/alumnos-por-rango", getReporteAlumnosPorRango);

export default router;
