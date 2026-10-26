import { Router } from "express";
import { getMisCirculares, responder, getRespuestas } from "../controllers/circular.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

// Encargado: circulares de sus hijos y su respuesta
router.get('/', verificarRol(ROL.ENCARGADO), getMisCirculares);
router.post('/:eventoId/respuesta', verificarRol(ROL.ENCARGADO), responder);

// Administración: control de respuestas de una circular
router.get('/:eventoId/respuestas', permitir('calendario'), getRespuestas);

export default router;
