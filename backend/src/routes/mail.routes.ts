import { Router } from "express";
import { testMail } from "../controllers/mail.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

// Envio de correos de prueba: solo el administrador general (evita usar el SMTP del colegio para spam)
router.use(authenticateToken, verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL));

router.post("/test", testMail);
router.post("/test/:plantilla", testMail);

export default router;
