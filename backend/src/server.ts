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
import cursoRoutes from "./routes/curso.routes.js";
import horarioRoutes from "./routes/horario.routes.js";
import cursoSeccionRoutes from "./routes/cursoseccion.routes.js";
import asistenciaRoutes from "./routes/asistencia.routes.js";





dotenv.config();
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


////// Rutas publicas

//Para ver que este vivo el sistema nada mas
app.get("/", (_req, res) => {
  res.json({
    message: "API DERCAS",
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

app.use('/api/users', userRoutes);
app.use('/api/roles', rolRoutes);
app.use('/api/becas', becaRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/horarios', horarioRoutes);
app.use('/api/curso-seccion', cursoSeccionRoutes);
app.use('/api/asistencia', asistenciaRoutes);

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