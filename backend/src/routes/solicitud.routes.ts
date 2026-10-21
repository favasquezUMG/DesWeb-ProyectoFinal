import { Router } from "express";
import {
    crearSolicitud,
    getSolicitudes,
    getSolicitudById,
    getSolicitudByDpiCorreo,
    updateEstadoSolicitud,
    getSolicitudByNumero,
    getOpcionesAprobacion,
    aprobar,
    rechazar,
} from "../controllers/solicitud.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir } from "../middlewares/role.middleware.js";

const router = Router();

// Públicas: el formulario de inscripción y la consulta del estado
router.post("/", crearSolicitud);
router.get("/dpi-correo", getSolicitudByDpiCorreo);
router.get("/numero", getSolicitudByNumero);

// Administración (contienen DPI, teléfono y correo: nunca públicas)
router.use(authenticateToken, permitir("matriculas"));

router.get("/", getSolicitudes);
router.get("/:id", getSolicitudById);
router.get("/:id/opciones", getOpcionesAprobacion);
router.put("/:id/estado", updateEstadoSolicitud);
router.post("/:id/aprobar", aprobar);
router.post("/:id/rechazar", rechazar);

export default router;
