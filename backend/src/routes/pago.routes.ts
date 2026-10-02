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
import { permitir, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', permitir('pagos'), getPagos);
router.get('/estado-cuenta/:alumnoId', getEstadoCuenta);
router.get('/cotizar/:alumnoId', cotizarColegiatura);
router.get('/verificar/:sessionId', verificarSesion);
router.get('/:id', getPagoById);

router.post(
    '/checkout',
    permitir('pagos', ROL.ENCARGADO, ROL.ALUMNO),
    crearCheckout
);

export default router;