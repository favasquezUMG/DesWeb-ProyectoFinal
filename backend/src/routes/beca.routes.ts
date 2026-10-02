import { Router } from "express";
import {
    getBecas,
    getResumen,
    getBecaById,
    createBeca,
    updateBeca,
    cambiarEstadoBeca,
    deleteBecaById,
    renovarBeca,
    evaluarBecas,
    getProgramas,
    createPrograma,
    updatePrograma,
    getPolitica,
    upsertPolitica,
    getMisBecas,
    solicitarBeca
} from '../controllers/beca.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

const soloAdmin = permitir('becas');

// Portal de encargados y alumnos
router.get('/mias', verificarRol(ROL.ENCARGADO, ROL.ALUMNO), getMisBecas);
router.post('/solicitar', verificarRol(ROL.ENCARGADO), solicitarBeca);

// Programas y politica de la sede
router.get('/programas', soloAdmin, getProgramas);
router.post('/programas', soloAdmin, createPrograma);
router.put('/programas/:id', soloAdmin, updatePrograma);
router.get('/politica', soloAdmin, getPolitica);
router.put('/politica', soloAdmin, upsertPolitica);

// Becas
router.get('/all', soloAdmin, getBecas);
router.get('/resumen', soloAdmin, getResumen);
router.post('/evaluar', soloAdmin, evaluarBecas);
router.get('/:id', soloAdmin, getBecaById);
router.post('/', soloAdmin, createBeca);
router.put('/:id', soloAdmin, updateBeca);
router.patch('/:id/estado', soloAdmin, cambiarEstadoBeca);
router.post('/:id/renovar', soloAdmin, renovarBeca);
router.delete('/:id', soloAdmin, deleteBecaById);

export default router;
