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
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', getHorarios);
router.get('/:id', getHorarioById);

// Chequeo previo para el formulario del frontend: no guarda nada
router.post('/verificar', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), verificarChoque);

router.post('/', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), createHorario);
router.put('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), updateHorario);
router.delete('/:id', verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), deleteHorarioById);

export default router;