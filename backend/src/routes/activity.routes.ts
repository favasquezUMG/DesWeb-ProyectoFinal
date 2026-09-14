import { Router } from "express";
import { 
    getActivities,
    getActivityById,
    createActivity,
    updtadeActivity,
    deleteActivity
} from "../controllers/activity.controller.js"
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de abajo quedan protegidas con el JWT
router.use(authenticateToken);

router.get('/', getActivities);
router.get('/:id', getActivityById);
router.post('/', createActivity);
router.put('/:id', updtadeActivity);
router.delete('/:id', deleteActivity);

export default router;