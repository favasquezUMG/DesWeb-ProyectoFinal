import { Router } from "express";
import {
    enviarComunicado,
    getComunicados,
    getMisNotificaciones,
    marcarNotificacionLeida,
} from "../controllers/notificacion.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/mias', getMisNotificaciones);
router.patch('/:id/leida', marcarNotificacionLeida);
router.get('/comunicados', permitir('comunicados'), getComunicados);
router.post('/comunicados', permitir('comunicados'), enviarComunicado);

export default router;
