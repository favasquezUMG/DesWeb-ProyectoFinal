import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";

const router = Router();

// GET /api/sedes  — sedes activas (para formularios)
router.get("/", async (_req, res) => {
    try {
        const sedes = await prisma.sede.findMany({
            where: { activo: true, deletedAt: null },
            select: { sedeId: true, nombre: true, direccion: true },
            orderBy: { nombre: "asc" },
        });
        return res.json({ status: "success", data: sedes });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener las sedes.", error });
    }
});

router.use(authenticateToken);

export default router;
