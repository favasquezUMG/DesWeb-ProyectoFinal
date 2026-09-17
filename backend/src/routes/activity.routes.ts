import { Router } from "express";
import { 
    getActivities,
    getActivityById,
    createActivity,
    updateActivity,
    deleteActivity,
    getActivitiesByUnidad
} from "../controllers/activity.controller.js"
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js"

const router = Router();

// Todas las rutas de abajo quedan protegidas con el JWT
router.use(authenticateToken);

router.get('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivities);
router.get('/unidad/:unidadId', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivitiesByUnidad)
router.get('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivityById);
router.post('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), createActivity);
router.put('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), updateActivity);
router.delete('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), deleteActivity);

export default router;