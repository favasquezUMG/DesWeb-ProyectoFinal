import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";
import { getDashboardSede } from "../controllers/dashboardSede.controller.js";
import { 
    get,
    crearSede,
    actualizarSede,
    getSedesMetricas
} from "../controllers/sede.controller.js";

const router = Router();

router.get("/", get);

router.use(authenticateToken);

router.post("/", verificarRol(ROL.ADMIN_GENERAL), crearSede);
router.put("/:id", verificarRol(ROL.ADMIN_GENERAL), actualizarSede);
router.get("/metricas", verificarRol(ROL.ADMIN_GENERAL), getSedesMetricas);
router.get("/dashboard", verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getDashboardSede);

export default router;
