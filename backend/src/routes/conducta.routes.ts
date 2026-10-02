import { Router } from "express";
import {
    getReportesConducta,
    createReporteConducta,
    revisarReporteConducta,
    deleteReporteConducta,
} from "../controllers/conducta.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { permitir, verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/', permitir('conducta', ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getReportesConducta);
router.post('/', permitir('conducta', ROL.CATEDRATICO), createReporteConducta);
router.patch('/:id/revisar', verificarRol(ROL.ENCARGADO), revisarReporteConducta);
router.delete('/:id', permitir('conducta', ROL.CATEDRATICO), deleteReporteConducta);

export default router;
