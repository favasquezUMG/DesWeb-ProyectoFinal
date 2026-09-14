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

// Todas las rutas de cursos requieren sesión
router.use(authenticateToken)

// Consultas: cualquier usuario autenticado
router.get('/', getCursos);
router.get('/:id', getCursoById);

// Escritura del catálogo y de la malla: solo administradores,
// porque la malla base es la misma para todas las sedes.
router.post('/', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), createCurso);
router.put('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), updateCurso);
router.delete('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), deleteCursoById);

// Malla curricular: qué cursos lleva cada grado
router.post('/:id/grados', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), asignarCursoAGrado);
router.delete('/:id/grados/:gradoId', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL), quitarCursoDeGrado);

export default router;