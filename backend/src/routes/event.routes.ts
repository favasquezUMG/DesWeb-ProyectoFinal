import { Router } from "express";
import { 
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent
} from "../controllers/event.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from '../middlewares/role.middleware.js'

const router = Router();

router.use(authenticateToken);

router.get('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getEvents);
router.get('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getEventById);
router.post('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), createEvent);
router.put('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), updateEvent);
router.delete('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), deleteEvent);

export default router;