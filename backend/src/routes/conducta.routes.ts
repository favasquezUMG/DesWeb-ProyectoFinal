import { Router } from "express";
import {
    getReportesConducta,
    createReporteConducta,
    revisarReporteConducta,
    deleteReporteConducta,
} from "../controllers/conducta.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { verificarRol, ROL } from "../middlewares/role.middleware.js";

const router = Router();

router.use(authenticateToken);

router.get('/', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO, ROL.ENCARGADO, ROL.ALUMNO), getReportesConducta);
router.post('/', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), createReporteConducta);
router.patch('/:id/revisar', verificarRol(ROL.ENCARGADO), revisarReporteConducta);
router.delete('/:id', verificarRol(ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE, ROL.CATEDRATICO), deleteReporteConducta);

export default router;
