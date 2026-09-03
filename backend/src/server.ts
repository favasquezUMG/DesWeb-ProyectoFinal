import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    message: "API DERCAS",
    ambiente: process.env.NODE_ENV ?? "development",
  });
});

// Aquí se irán registrando las rutas:
// registrarRutasAuth(app);
// registrarRutasRol(app);

const PORT = Number(process.env.PORT) || 8081;

app.listen(PORT, async () => {
  await prisma.$connect();
  console.log(`Servidor en puerto ${PORT} [ambiente: ${process.env.NODE_ENV ?? "development"}]`);
});