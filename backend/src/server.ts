import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { openapiSpec } from "./docs/openapi.js";
import { login } from "./controllers/auth.controller.js";
import type { AuthenticatedRequest } from "./middlewares/auth.middleware.js";
import { authenticateToken } from "./middlewares/auth.middleware.js";
import { stripeWebhook } from "./controllers/stripewebhook.controller.js";
import { prisma } from "./lib/prisma.js";
import userRoutes from "./routes/user.routes.js";
import rolRoutes from "./routes/rol.routes.js";
import becaRoutes from "./routes/beca.routes.js";
import alumnoRoutes from "./routes/alumno.routes.js";
import cursoRoutes from "./routes/curso.routes.js";
import cursoSeccionRoutes from "./routes/cursoseccion.routes.js";
import horarioRoutes from "./routes/horario.routes.js";
import asistenciaRoutes from "./routes/asistencia.routes.js";
import matriculaRoutes from "./routes/matricula.routes.js";
import pagoRoutes from "./routes/pago.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import notaRoutes from "./routes/nota.routes.js";
import eventRoutes from "./routes/event.routes.js";
import mailRoutes from "./routes/mail.routes.js";
import reporteRoutes from "./routes/reporte.routes.js";
import { closeBrowser } from "./services/pdf.service.js";

dotenv.config();
const app = express();

const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || "http://localhost";

const origenesPermitidos = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const origenesPropios = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];

const puertosDev = origenesPermitidos
  .map((o) => { try { return new URL(o).port; } catch { return null; } })
  .filter((p): p is string => !!p);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origenesPermitidos.includes(origin)) return callback(null, true);
    if (origenesPropios.includes(origin)) return callback(null, true);

    if (process.env.NODE_ENV !== "production") {
      try {
        if (puertosDev.includes(new URL(origin).port)) return callback(null, true);
      } catch {}
    }

    callback(new Error("Origen no permitido por CORS"));
  },
}));

app.post(
  '/api/pagos/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    message: "API DesWeb - Proyecto Final",
    ambiente: process.env.NODE_ENV ?? "development",
  });
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: "API Sistema Escolar - Docs",
    swaggerOptions: { docExpansion: "list", defaultModelsExpandDepth: -1 },
  })
);

app.post('/api/auth/login', login);

app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({
    status: 'success',
    user: req.user
  });
});

app.use('/api/usuarios', userRoutes);
app.use('/api/roles', rolRoutes);
app.use('/api/becas', becaRoutes);
app.use('/api/alumnos', alumnoRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/curso-seccion', cursoSeccionRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/matriculas', matriculaRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/actividades', activityRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/reportes', reporteRoutes);

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`🚀 Servidor ejecutándose en ${HOST}:${PORT} [ambiente: ${process.env.NODE_ENV ?? "development"}]`);
    
  } catch (error) {
    console.error("❌ Error al conectar la base de datos:", error);
  }
});

const apagarOrdenadamente = async () => {
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", apagarOrdenadamente);
process.on("SIGTERM", apagarOrdenadamente);