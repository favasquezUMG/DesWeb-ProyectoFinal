import { Router } from "express";
import { testMail } from "../controllers/mail.controller.js";

const router = Router();

// Endpoint temporal y SIN autenticación para probar el envío de correo.
// Volver a activar authenticateToken + verificarRol antes de producción.
router.post("/test", testMail);

export default router;
