import { Router } from "express";
import {
    getHorarios,
    getHorarioById,
    verificarChoque,
    createHorario,
    updateHorario,
    deleteHorarioById
} from '../controllers/horario.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', getHorarios);
router.get('/:id', getHorarioById);

router.post('/verificar', permitir('horarios'), verificarChoque);

router.post('/', permitir('horarios'), createHorario);
router.put('/:id', permitir('horarios'), updateHorario);
router.delete('/:id', permitir('horarios'), deleteHorarioById);

export default router;