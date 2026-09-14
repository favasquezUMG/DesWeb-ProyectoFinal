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

const router = Router();

router.use(authenticateToken)

router.get('/', getCursos);
router.get('/:id', getCursoById);
router.post('/', createCurso);
router.put('/:id', updateCurso);
router.delete('/:id', deleteCursoById);

// Malla curricular: qué cursos lleva cada grado
router.post('/:id/grados', asignarCursoAGrado);
router.delete('/:id/grados/:gradoId', quitarCursoDeGrado);

export default router;