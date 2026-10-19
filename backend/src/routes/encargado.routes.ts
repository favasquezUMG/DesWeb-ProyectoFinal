import { Router } from "express";
import {
    getHijos,
    getBoletinHijo,
    getOpcionesMatricula,
    setNotificacionesHijo,
    restablecerPasswordHijo,
    getHorarioHijo,
} from "../controllers/encargado.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken, verificarRol(ROL.ENCARGADO));

router.get('/hijos', getHijos);
router.get('/hijos/:alumnoId/notas', getBoletinHijo);
router.get('/hijos/:alumnoId/horario', getHorarioHijo);
router.get('/hijos/:alumnoId/matricula', getOpcionesMatricula);
router.patch('/hijos/:alumnoId/notificaciones', setNotificacionesHijo);
router.post('/hijos/:alumnoId/password', restablecerPasswordHijo);

export default router;
