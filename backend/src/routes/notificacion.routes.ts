import { Router } from "express";
import {
    enviarComunicado,
    getComunicados,
    getMisNotificaciones,
    marcarNotificacionLeida,
} from "../controllers/notificacion.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/mias', getMisNotificaciones);
router.patch('/:id/leida', marcarNotificacionLeida);
router.get('/comunicados', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getComunicados);
router.post('/comunicados', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), enviarComunicado);

export default router;
