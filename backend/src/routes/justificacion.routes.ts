import { Router } from "express";
import {
    getAsistenciaHijos,
    solicitarJustificacion,
    cancelarJustificacion,
    getJustificaciones,
    revisarJustificacion,
} from "../controllers/justificacion.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

// Encargado
router.get('/mis-hijos', verificarRol(ROL.ENCARGADO), getAsistenciaHijos);
router.post('/', verificarRol(ROL.ENCARGADO), solicitarJustificacion);
router.delete('/:id', verificarRol(ROL.ENCARGADO), cancelarJustificacion);

// Administración de la sede
router.get('/', permitir('asistencia'), getJustificaciones);
router.patch('/:id/revisar', permitir('asistencia'), revisarJustificacion);

export default router;
