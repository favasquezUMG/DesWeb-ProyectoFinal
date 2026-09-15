import { Router } from "express";
import { 
    getNotasByActivity,
    getNotasByStudent,
    upsertNota,
    bulkUpsertNotas,
    getNotas
} from "../controllers/nota.controller.js"
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js"

const router = Router();

router.use(authenticateToken);

router.get('/actividad/:activityId', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getNotasByActivity);
router.get('/estudiante/:studentId', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getNotasByStudent);
router.get('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getNotas);
router.post('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), upsertNota);
router.post('/bulk', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), bulkUpsertNotas);

export default router;