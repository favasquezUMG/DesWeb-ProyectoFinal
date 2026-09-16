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
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

// Consultas
router.get('/', getMatriculas);
router.get('/alumno/:alumnoId', getMatriculasDeAlumno);
router.get('/:id', getMatriculaById);

// Regla de negocio: solo el padre/encargado matricula al alumno.
// La administración también puede hacerlo desde ventanilla.
router.post(
    '/',
    verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.ENCARGADO),
    createMatricula
);

// El traslado y el retiro los autoriza la administración, no el encargado
router.put('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), trasladarMatricula);
router.put('/:id/estado', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), cambiarEstadoMatricula);
router.delete('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), deleteMatriculaById);

export default router;