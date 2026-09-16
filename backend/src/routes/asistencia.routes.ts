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
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

// Consultas
router.get('/', getAsistencias);
router.get('/lista/:cursoSeccionId', getListaParaPasar);
router.get('/resumen/:cursoSeccionId', getResumenAsistencia);

// El catedrático pasa lista de sus propios cursos; los administradores
// pueden hacerlo también. La validación de "es SU curso" se hace dentro
// del controller con puedeGestionarCurso().
router.post(
    '/pasar-lista',
    verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO),
    pasarLista
);

router.put(
    '/:id',
    verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO),
    updateAsistencia
);

router.delete(
    '/:id',
    verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE),
    deleteAsistenciaById
);

export default router;