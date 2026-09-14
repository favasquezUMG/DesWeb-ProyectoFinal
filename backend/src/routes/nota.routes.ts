import { Router } from "express";
import { 
    getNotasByActivity,
    getNotasByStudent,
    upsertNota,
    bulkUpsertNotas
} from "../controllers/nota.controller.js"
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/actividad/:activityId', getNotasByActivity);
router.get('/estudiante/:studentId', getNotasByStudent);
router.post('/', upsertNota);
router.post('/bulk', bulkUpsertNotas);

export default router;