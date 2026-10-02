import { Router } from "express";
import { getReporteNotasPorCatedratico, getReporteAlumnosPorRango } from "../controllers/reporte.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get("/notas-por-catedratico/:catedraticoId", permitir("reportes"), getReporteNotasPorCatedratico);
router.get("/alumnos-por-rango", permitir("reportes"), getReporteAlumnosPorRango);

export default router;
