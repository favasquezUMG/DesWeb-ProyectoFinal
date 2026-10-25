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
import { getPendientes, crearIntentOrden, verificarOrden } from '../controllers/cobro.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL, verificarRol } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', permitir('pagos'), getPagos);
router.get('/mis-hijos', verificarRol(ROL.ENCARGADO), getMisHijos);
// Lo que el encargado tiene por pagar y el pago de varios conceptos juntos (colegiaturas y eventos autorizados)
router.get('/pendientes', verificarRol(ROL.ENCARGADO), getPendientes);
router.get('/orden/verificar/:paymentIntentId', verificarRol(ROL.ENCARGADO), verificarOrden);
router.post('/orden/intent', verificarRol(ROL.ENCARGADO), crearIntentOrden);

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