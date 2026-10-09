import { Router } from "express";
import {
    getRoles,
    getModulos,
    getRolById,
    createRol,
    updateRol,
    setPermisos,
    deleteRolById
} from '../controllers/rol.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

// Consultar roles: quien administra usuarios (los necesita para asignarlos)
router.get('/all', permitir('usuarios'), getRoles);
router.get('/modulos', permitir('usuarios'), getModulos);
router.get('/:id', permitir('usuarios'), getRolById);

// Crear, modificar y cambiar permisos: solo el Administrador General
const soloGeneral = verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL);
router.post('/', soloGeneral, createRol);
router.put('/:id', soloGeneral, updateRol);
router.put('/:id/permisos', soloGeneral, setPermisos);
router.delete('/:id', soloGeneral, deleteRolById);

export default router;
