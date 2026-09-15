import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { login } from "./controllers/auth.controller.js";
import type { AuthenticatedRequest } from "./middlewares/auth.middleware.js";
import { authenticateToken } from "./middlewares/auth.middleware.js";
import { prisma } from "./lib/prisma.js";
import userRoutes from "./routes/user.routes.js";
import rolRoutes from "./routes/rol.routes.js";
import becaRoutes from "./routes/beca.routes.js";
import alumnoRoutes from "./routes/alumno.routes.js";
import cursoRoutes from "./routes/curso.routes.js";
import horarioRoutes from "./routes/horario.routes.js";
import cursoSeccionRoutes from "./routes/cursoseccion.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import notaRoutes from "./routes/nota.routes.js";
import eventRoutes from "./routes/event.routes.js";
import mailRoutes from "./routes/mail.routes.js";
import reporteRoutes from "./routes/reporte.routes.js";
import { closeBrowser } from "./services/pdf.service.js";

dotenv.config();
const app = express();

// Orígenes exactos permitidos (uno o varios separados por coma en CORS_ORIGIN)
const origenesPermitidos = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// En desarrollo también se acepta cualquier origen que use el mismo puerto que
// los orígenes configurados (ej. la IP de red local del Vite dev server, para
// poder probar desde el celular u otra máquina de la misma red).
const puertosDev = origenesPermitidos
  .map((o) => { try { return new URL(o).port; } catch { return null; } })
  .filter((p): p is string => !!p);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // same-origin, curl, Postman, etc.
    if (origenesPermitidos.includes(origin)) return callback(null, true);

    if (process.env.NODE_ENV !== "production") {
      try {
        if (puertosDev.includes(new URL(origin).port)) return callback(null, true);
      } catch {
        // origin mal formado: cae al rechazo de abajo
      }
    }

    callback(new Error("Origen no permitido por CORS"));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


////// Rutas publicas

//Para ver que este vivo el sistema nada mas
app.get("/", (_req, res) => {
  res.json({
    message: "API DesWeb - Proyecto Final",
    ambiente: process.env.NODE_ENV ?? "development",
  });
});

app.post('/api/auth/login', login);



////// Rutas protegidas

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
app.use('/api/horarios', horarioRoutes);
app.use('/api/curso-seccion', cursoSeccionRoutes);
app.use('/api/actividades', activityRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/eventos', eventRoutes);

const PORT = Number(process.env.PORT) || 8081;
const HOST = process.env.HOST || "http://localhost";

app.listen(PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`🚀 Servidor ejecutándose en ${HOST}:${PORT} [ambiente: ${process.env.NODE_ENV ?? "development"}]`);
    
  } catch (error) {
    console.error("❌ Error al conectar la base de datos:", error);
  }
});

// Cierra el navegador de Puppeteer y la conexión a la base al apagar el servidor
const apagarOrdenadamente = async () => {
  await closeBrowser();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGINT", apagarOrdenadamente);
process.on("SIGTERM", apagarOrdenadamente);