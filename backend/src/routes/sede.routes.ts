import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";
import { getDashboardSede } from "../controllers/dashboardSede.controller.js";
import { 
    get,
    crearSede,
    actualizarSede,
    getSedesMetricas,
    getSedesAdmin,
    cambiarEstadoSede,
    eliminarSede
} from "../controllers/sede.controller.js";

const router = Router();

router.get("/", get);

router.use(authenticateToken);

router.post("/", verificarRol(ROL.ADMIN_GENERAL), crearSede);
router.put("/:id", verificarRol(ROL.ADMIN_GENERAL), actualizarSede);
router.get("/metricas", verificarRol(ROL.ADMIN_GENERAL), getSedesMetricas);
// Gestión de sedes: también las desactivadas. Solo se borra una sede desactivada y vacía
router.get("/admin", verificarRol(ROL.ADMIN_GENERAL), getSedesAdmin);
router.patch("/:id/activo", verificarRol(ROL.ADMIN_GENERAL), cambiarEstadoSede);
router.delete("/:id", verificarRol(ROL.ADMIN_GENERAL), eliminarSede);
router.get("/dashboard", verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getDashboardSede);

export default router;
