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
import { permitir, ROL } from "../middlewares/role.middleware.js"

const router = Router();

router.use(authenticateToken);

router.get('/', permitir('notas', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivities);
router.get('/unidad/:unidadId', permitir('notas', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivitiesByUnidad)
router.get('/:id', permitir('notas', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getActivityById);
router.post('/', permitir('notas', ROL.CATEDRATICO), createActivity);
router.put('/:id', permitir('notas', ROL.CATEDRATICO), updateActivity);
router.delete('/:id', permitir('notas', ROL.CATEDRATICO), deleteActivity);

export default router;