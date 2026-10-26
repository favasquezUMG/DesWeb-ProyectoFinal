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
    getMisDatosSolicitud,
    crearSolicitudPropia,
} from "../controllers/solicitud.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

// Públicas: el formulario de inscripción y la consulta del estado
router.post("/", crearSolicitud);
router.get("/dpi-correo", getSolicitudByDpiCorreo);
router.get("/numero", getSolicitudByNumero);

// Encargado con cuenta que inscribe a otro hijo: la solicitud queda a nombre de su cuenta
router.get("/mis-datos", authenticateToken, verificarRol(ROL.ENCARGADO), getMisDatosSolicitud);
router.post("/mia", authenticateToken, verificarRol(ROL.ENCARGADO), crearSolicitudPropia);

// Administración (contienen DPI, teléfono y correo: nunca públicas)
router.use(authenticateToken, permitir("matriculas"));

router.get("/", getSolicitudes);
router.get("/:id", getSolicitudById);
router.get("/:id/opciones", getOpcionesAprobacion);
router.put("/:id/estado", updateEstadoSolicitud);
router.post("/:id/aprobar", aprobar);
router.post("/:id/rechazar", rechazar);

export default router;
