import { Router } from "express";
import {
    getAlumnos,
    getEncargadosDeAlumno,
    buscarEncargados,
    agregarEncargado,
    actualizarVinculo,
    quitarEncargado,
    getConteoAlumnos
} from '../controllers/alumno.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL, verificarRol } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/all', permitir('alumnos', ROL.CATEDRATICO), getAlumnos);

// Encargados (padres, tutores...) de cada alumno
router.get('/conteo-alumnos', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getConteoAlumnos);
router.get('/encargados/buscar', permitir('alumnos'), buscarEncargados);
router.get('/:id/encargados', permitir('alumnos'), getEncargadosDeAlumno);
router.post('/:id/encargados', permitir('alumnos'), agregarEncargado);
router.put('/:id/encargados/:encargadoId', permitir('alumnos'), actualizarVinculo);
router.delete('/:id/encargados/:encargadoId', permitir('alumnos'), quitarEncargado);

export default router;
