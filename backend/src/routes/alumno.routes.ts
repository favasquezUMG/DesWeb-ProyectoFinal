import { Router } from "express";
import { getAlumnos } from '../controllers/alumno.controller.js'

const router = Router();

router.get('/all', getAlumnos);

export default router;
