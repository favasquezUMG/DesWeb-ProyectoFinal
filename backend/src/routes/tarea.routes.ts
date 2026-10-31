import { Router } from "express";
import {
    getEntregasTarea,
    agregarMaterial,
    quitarMaterial,
    calificarEntrega,
    devolverEntrega,
    marcarEnClase,
    desmarcarEnClase,
    getTablero,
    getTareaAlumno,
    guardarEntrega,
    firmarArchivo,
    getUrlArchivo,
} from "../controllers/tarea.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js";

// Tareas con entrega en linea. Cada controlador valida ademas la relacion con el curso o el alumno.
const router = Router();
router.use(authenticateToken);

const comunidad = permitir("notas", ROL.CATEDRATICO, ROL.ALUMNO, ROL.ENCARGADO);
const curso = permitir("notas", ROL.CATEDRATICO);

// Alumno y encargado
router.get("/alumno/:alumnoId", comunidad, getTablero);
router.get("/alumno/:alumnoId/:actividadId", comunidad, getTareaAlumno);
router.put("/:actividadId/alumnos/:alumnoId/entrega", permitir("notas", ROL.ALUMNO, ROL.ENCARGADO), guardarEntrega);

// Archivos
router.post("/:actividadId/firma", comunidad, firmarArchivo);
router.get("/archivos/:archivoId/url", comunidad, getUrlArchivo);

// Catedratico
router.get("/:actividadId/entregas", curso, getEntregasTarea);
router.post("/:actividadId/material", curso, agregarMaterial);
router.delete("/material/:archivoId", curso, quitarMaterial);
router.post("/:actividadId/alumnos/:alumnoId/calificar", curso, calificarEntrega);
router.post("/:actividadId/alumnos/:alumnoId/devolver", curso, devolverEntrega);
router.post("/:actividadId/alumnos/:alumnoId/en-clase", curso, marcarEnClase);
router.delete("/:actividadId/alumnos/:alumnoId/en-clase", curso, desmarcarEnClase);

export default router;
