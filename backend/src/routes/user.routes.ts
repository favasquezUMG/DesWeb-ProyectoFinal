import { Router } from "express";
import {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    setRolesAdicionales,
    cambiarEstadoUsuario,
    deleteUserById
} from '../controllers/user.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken, permitir('usuarios'))

router.get('/', getUsers);
router.get('/:id', getUserById);
router.post('/', createUser);
router.put('/:id', updateUser);
router.put('/:id/roles', setRolesAdicionales);
router.patch('/:id/estado', cambiarEstadoUsuario);
router.delete('/:id', deleteUserById);

export default router;
