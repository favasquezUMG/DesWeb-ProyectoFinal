import { Router } from "express";
import {
    getPagos,
    getPagoById,
    getEstadoCuenta,
    cotizarColegiatura,
    crearIntentPago,
    verificarPago,
    getMisHijos,
    getMoraPagosMetrica
} from '../controllers/pago.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL, verificarRol } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', permitir('pagos'), getPagos);
router.get('/mis-hijos', verificarRol(ROL.ENCARGADO), getMisHijos);
router.get('/metrica-mora', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getMoraPagosMetrica);
router.get('/estado-cuenta/:alumnoId', getEstadoCuenta);
router.get('/cotizar/:alumnoId', cotizarColegiatura);
router.get('/verificar/:paymentIntentId', verificarPago);
router.get('/:id', getPagoById);

router.post(
    '/intent',
    permitir('pagos', ROL.ENCARGADO, ROL.ALUMNO),
    crearIntentPago
);

export default router;