import { Router } from "express";
import {
    getBecas,
    getBecaById,
    createBeca,
    updateBeca,
    deleteBecaById
} from '../controllers/beca.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de administración de becas quedan protegidas con el JWT
// router.use(authenticateToken)

router.get('/all', getBecas);
router.get('/:id', getBecaById);
router.post('/', createBeca);
router.put('/:id', updateBeca);
router.delete('/:id', deleteBecaById);

export default router;
