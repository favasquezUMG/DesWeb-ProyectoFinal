import { Router } from "express";
import {
    requiereAccesoPortal,
    getPerfil,
    getMisNotas,
    getMiHorario,
    getMiAsistencia,
} from "../controllers/portalAlumno.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken, verificarRol(ROL.ALUMNO), requiereAccesoPortal);

router.get('/perfil', getPerfil);
router.get('/notas', getMisNotas);
router.get('/horario', getMiHorario);
router.get('/asistencia', getMiAsistencia);

export default router;
