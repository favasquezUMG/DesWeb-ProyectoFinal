import { Router } from "express";
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUserById
} from '../controllers/user.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de administración de usuarios quedan protegidas con el JWT
router.use(authenticateToken)

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.delete('/:id', deleteUserById);

export default router;