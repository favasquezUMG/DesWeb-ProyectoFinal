import { Router } from "express";
import { testMail } from "../controllers/mail.controller.js";

const router = Router();

router.post("/test", testMail);
router.post("/test/:plantilla", testMail);

export default router;
