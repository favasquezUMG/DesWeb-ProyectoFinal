import { Router } from "express";
import {
    getPagos,
    getPagoById,
    getEstadoCuenta,
    cotizarColegiatura,
    crearCheckout,
    verificarSesion,
    getMoraPagosMetrica
} from '../controllers/pago.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, ROL, verificarRol } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', permitir('pagos'), getPagos);
router.get('/metrica-mora', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE), getMoraPagosMetrica);
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