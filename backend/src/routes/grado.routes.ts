import { Router } from "express";
import {
    getGrados,
    getSecciones,
    createSeccion,
    updateSeccion,
    deleteSeccion,
    copiarSecciones,
} from "../controllers/grado.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/', getGrados);
router.get('/secciones', permitir('horarios'), getSecciones);
router.post('/secciones', permitir('horarios'), createSeccion);
router.post('/secciones/copiar', permitir('horarios'), copiarSecciones);
router.put('/secciones/:id', permitir('horarios'), updateSeccion);
router.delete('/secciones/:id', permitir('horarios'), deleteSeccion);

export default router;
