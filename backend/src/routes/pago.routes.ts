import { Router } from "express";
import {
    getPagos,
    getPagoById,
    getEstadoCuenta,
    cotizarColegiatura,
    crearCheckout,
    verificarSesion
} from '../controllers/pago.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

// OJO: el webhook de Stripe NO va aquí. Se monta directo en server.ts
// porque necesita el body crudo y no lleva token (Stripe no se loguea).

router.use(authenticateToken)

router.get('/', getPagos);
router.get('/estado-cuenta/:alumnoId', getEstadoCuenta);
router.get('/cotizar/:alumnoId', cotizarColegiatura);
router.get('/verificar/:sessionId', verificarSesion);
router.get('/:id', getPagoById);

// El encargado paga la colegiatura de sus hijos. La validación de
// "es SU hijo" se hace dentro del controller.
router.post(
    '/checkout',
    verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.ENCARGADO),
    crearCheckout
);

export default router;