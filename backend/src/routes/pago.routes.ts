import { Router } from "express";
import {
    getPagos,
    getPagoById,
    getEstadoCuenta,
    cotizarColegiatura,
    crearIntentPago,
    verificarPago,
    getMisHijos
} from '../controllers/pago.controller.js'
import {
    getEventosDisponibles,
    crearIntentCarrito,
    verificarCarrito,
    getMisInscripciones
} from '../controllers/carrito.controller.js'
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken)

router.get('/', permitir('pagos'), getPagos);
router.get('/mis-hijos', verificarRol(ROL.ENCARGADO), getMisHijos);
// Carrito: eventos con cobro y colegiaturas en un solo pago (solo encargados)
router.get('/carrito/eventos', verificarRol(ROL.ENCARGADO), getEventosDisponibles);
router.get('/carrito/inscripciones', verificarRol(ROL.ENCARGADO), getMisInscripciones);
router.get('/carrito/verificar/:paymentIntentId', verificarRol(ROL.ENCARGADO), verificarCarrito);
router.post('/carrito/intent', verificarRol(ROL.ENCARGADO), crearIntentCarrito);

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