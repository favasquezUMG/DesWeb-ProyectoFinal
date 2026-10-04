import { Router } from "express";
import { prisma } from "../lib/prisma.js";

// Rutas sin autenticacion: datos que muestra la pagina principal a cualquier visitante
const router = Router();

// GET /api/publico/inicio  — sedes y niveles del colegio
router.get("/inicio", async (_req, res) => {
    try {
        const [sedes, grados] = await Promise.all([
            prisma.sede.findMany({
                where: { activo: true, deletedAt: null },
                select: { sedeId: true, nombre: true, direccion: true, telefono: true },
                orderBy: { sedeId: "asc" },
            }),
            prisma.grado.findMany({
                select: { gradoId: true, nombre: true, nivel: true, orden: true },
                orderBy: { orden: "asc" },
            }),
        ]);

        // Agrupa los grados por nivel respetando el orden en que aparecen
        const niveles: { nivel: string; grados: string[] }[] = [];
        for (const grado of grados) {
            let nivel = niveles.find((n) => n.nivel === grado.nivel);
            if (!nivel) {
                nivel = { nivel: grado.nivel, grados: [] };
                niveles.push(nivel);
            }
            nivel.grados.push(grado.nombre);
        }

        return res.json({
            status: "success",
            data: {
                sedes,
                niveles,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener la información del colegio.", error });
    }
});

export default router;
