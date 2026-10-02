import { Router } from "express";
import { 
    getNotasByActivity,
    getNotasByStudent,
    upsertNota,
    bulkUpsertNotas,
    getNotas,
    enviarNotasAEncargados
} from "../controllers/nota.controller.js"
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL } from "../middlewares/role.middleware.js"

const router = Router();

router.use(authenticateToken);

router.get('/actividad/:activityId', permitir('notas', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getNotasByActivity);
router.get('/estudiante/:studentId', permitir('notas', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getNotasByStudent);
router.get('/', permitir('notas'), getNotas);
router.post('/', permitir('notas', ROL.CATEDRATICO), upsertNota);
router.post('/enviar-encargados', permitir('notas', ROL.CATEDRATICO), enviarNotasAEncargados);
router.post('/bulk', permitir('notas', ROL.CATEDRATICO), bulkUpsertNotas);

export default router;