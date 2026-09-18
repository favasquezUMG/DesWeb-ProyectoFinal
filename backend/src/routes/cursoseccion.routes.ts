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
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', getCursosSeccion);
router.get('/catedratico/:catedraticoId', getCursosDeCatedratico);
router.get('/:id', getCursoSeccionById);

router.post('/', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), createCursoSeccion);
router.put('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), updateCursoSeccion);
router.delete('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), deleteCursoSeccionById);

export default router;