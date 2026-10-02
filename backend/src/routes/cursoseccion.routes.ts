import { Router } from "express";
import {
    getCursosSeccion,
    getCursoSeccionById,
    getCursosDeCatedratico,
    createCursoSeccion,
    updateCursoSeccion,
    deleteCursoSeccionById
} from '../controllers/cursoseccion.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', getCursosSeccion);
router.get('/catedratico/:catedraticoId', getCursosDeCatedratico);
router.get('/:id', getCursoSeccionById);

router.post('/', permitir('horarios'), createCursoSeccion);
router.put('/:id', permitir('horarios'), updateCursoSeccion);
router.delete('/:id', permitir('horarios'), deleteCursoSeccionById);

export default router;