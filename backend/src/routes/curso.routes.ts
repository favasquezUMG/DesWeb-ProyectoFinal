import { Router } from "express";
import {
    getCursos,
    getCursoById,
    createCurso,
    updateCurso,
    deleteCursoById,
    asignarCursoAGrado,
    quitarCursoDeGrado
} from '../controllers/curso.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', getCursos);
router.get('/:id', getCursoById);

router.post('/', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), createCurso);
router.put('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), updateCurso);
router.delete('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), deleteCursoById);

router.post('/:id/grados', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), asignarCursoAGrado);
router.delete('/:id/grados/:gradoId', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), quitarCursoDeGrado);

export default router;