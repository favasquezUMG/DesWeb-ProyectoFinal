import { Router } from "express";
import {
    getRoles,
    getRolById,
    createRol,
    updateRol,
    deleteRolById
} from '../controllers/rol.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de administración de roles quedan protegidas con el JWT
// router.use(authenticateToken)

router.get('/all', getRoles);
router.get('/:id', getRolById);
router.post('/', createRol);
router.put('/:id', updateRol);
router.delete('/:id', deleteRolById);

export default router;
