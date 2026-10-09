import { Router } from "express";
import {
    getMatriculas,
    getMatriculaById,
    getMatriculasDeAlumno,
    createMatricula,
    trasladarMatricula,
    cambiarEstadoMatricula,
    deleteMatriculaById
} from '../controllers/matricula.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

// Consultas
router.get('/', getMatriculas);
router.get('/alumno/:alumnoId', getMatriculasDeAlumno);
router.get('/:id', getMatriculaById);

router.post(
    '/',
    permitir('matriculas', ROL.ENCARGADO),
    createMatricula
);

router.put('/:id', permitir('matriculas'), trasladarMatricula);
router.put('/:id/estado', permitir('matriculas'), cambiarEstadoMatricula);
router.delete('/:id', permitir('matriculas'), deleteMatriculaById);

export default router;