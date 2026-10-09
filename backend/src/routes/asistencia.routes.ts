import { Router } from "express";
import {
    getListaParaPasar,
    pasarLista,
    getAsistencias,
    getResumenAsistencia,
    updateAsistencia,
    deleteAsistenciaById
} from '../controllers/asistencia.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

// Consultas
router.get('/', getAsistencias);
router.get('/lista/:cursoSeccionId', getListaParaPasar);
router.get('/resumen/:cursoSeccionId', getResumenAsistencia);

router.post(
    '/pasar-lista',
    permitir('asistencia', ROL.CATEDRATICO),
    pasarLista
);

router.put(
    '/:id',
    permitir('asistencia', ROL.CATEDRATICO),
    updateAsistencia
);

router.delete(
    '/:id',
    permitir('asistencia'),
    deleteAsistenciaById
);

export default router;