import { Router } from "express";
import { 
    getEvents,
    getEventById,
    createEvent,
    updateEvent,
    deleteEvent,
    enviarRecordatorioAhora
} from "../controllers/event.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from '../middlewares/role.middleware.js'

const router = Router();

router.use(authenticateToken);

router.get('/', permitir('calendario', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getEvents);
router.get('/:id', permitir('calendario', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getEventById);
router.post('/', permitir('calendario'), createEvent);
router.post('/:id/recordatorio', permitir('calendario'), enviarRecordatorioAhora);
router.put('/:id', permitir('calendario'), updateEvent);
router.delete('/:id', permitir('calendario'), deleteEvent);

export default router;