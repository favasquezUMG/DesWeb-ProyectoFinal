import { Router } from "express";
import {
    crearSolicitud,
    getSolicitudes,
    getSolicitudById,
    getSolicitudByDpiCorreo,
    updateEstadoSolicitud,
    getSolicitudByNumero
} from "../controllers/solicitud.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.post("/", crearSolicitud);
router.get("/", getSolicitudes);
router.get("/dpi-correo", getSolicitudByDpiCorreo);
router.get("/numero", getSolicitudByNumero)

router.get("/:id", getSolicitudById);

router.use(authenticateToken);

router.put("/:id/estado", verificarRol(ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE),updateEstadoSolicitud);

export default router;