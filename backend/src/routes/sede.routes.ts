import { Router } from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { 
    get,
    crearSede,
    actualizarSede,
    getSedesMetricas
} from "../controllers/sede.controller.js";

const router = Router();

router.get("/", get);

router.use(authenticateToken);

router.post("/", crearSede);
router.put("/:id", actualizarSede);
router.get("/metricas", getSedesMetricas);

export default router;
