import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";
import { getActividadReciente } from "../controllers/bitacora.controller.js";

const router = Router();

router.use(authenticateToken);

router.get('/actividad-reciente', verificarRol(ROL.ADMIN,ROL.ADMIN_GENERAL,ROL.ADMIN_SEDE), getActividadReciente);

export default router;