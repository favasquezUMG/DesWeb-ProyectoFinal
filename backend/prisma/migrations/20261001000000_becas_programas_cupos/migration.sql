-- Becas: programas con cupos, politicas por sede, estados e historial.
-- Las becas existentes se conservan: se les calcula el ciclo lectivo, la fecha de fin
-- (fin del ciclo si no tenian) y el estado a partir de la columna "activa".

-- AlterTable: columnas nuevas (anioLectivo se llena antes de hacerla obligatoria)
ALTER TABLE "Beca"
ADD COLUMN     "anioLectivo" INTEGER,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "estado" VARCHAR(20) NOT NULL DEFAULT 'Activa',
ADD COLUMN     "programaId" INTEGER,
ADD COLUMN     "solicitadaPorId" INTEGER;

UPDATE "Beca" SET "anioLectivo" = EXTRACT(YEAR FROM "fechaInicio")::INTEGER;

UPDATE "Beca"
SET "fechaFin" = make_date(EXTRACT(YEAR FROM "fechaInicio")::INTEGER, 12, 31)
WHERE "fechaFin" IS NULL;

UPDATE "Beca"
SET "estado" = CASE
    WHEN NOT "activa" THEN 'Revocada'
    WHEN "fechaFin" < CURRENT_DATE THEN 'Finalizada'
    ELSE 'Activa'
END;

ALTER TABLE "Beca"
DROP COLUMN "activa",
ALTER COLUMN "anioLectivo" SET NOT NULL,
ALTER COLUMN "fechaFin" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProgramaBeca" (
    "programaId" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "anioLectivo" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "descripcion" VARCHAR(255),
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "cupos" INTEGER,
    "promedioMinimo" DECIMAL(5,2),
    "pierdePorConductaGrave" BOOLEAN NOT NULL DEFAULT true,
    "permiteSolicitud" BOOLEAN NOT NULL DEFAULT true,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramaBeca_pkey" PRIMARY KEY ("programaId")
);

-- CreateTable
CREATE TABLE "PoliticaBeca" (
    "politicaId" SERIAL NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "anioLectivo" INTEGER NOT NULL,
    "presupuestoMensual" DECIMAL(10,2),
    "descuentoHermanos" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "descuentoMaximo" DECIMAL(5,2) NOT NULL DEFAULT 100,

    CONSTRAINT "PoliticaBeca_pkey" PRIMARY KEY ("politicaId")
);

-- CreateTable
CREATE TABLE "BecaHistorial" (
    "historialId" SERIAL NOT NULL,
    "becaId" INTEGER NOT NULL,
    "estadoAnterior" VARCHAR(20),
    "estadoNuevo" VARCHAR(20) NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "usuarioId" INTEGER,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BecaHistorial_pkey" PRIMARY KEY ("historialId")
);

-- Historial inicial de las becas que ya existian
INSERT INTO "BecaHistorial" ("becaId", "estadoAnterior", "estadoNuevo", "motivo", "fecha")
SELECT "becaId", NULL, "estado", 'Registro migrado del sistema anterior', CURRENT_TIMESTAMP
FROM "Beca";

-- CreateIndex
CREATE UNIQUE INDEX "ProgramaBeca_sedeId_anioLectivo_nombre_key" ON "ProgramaBeca"("sedeId", "anioLectivo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticaBeca_sedeId_anioLectivo_key" ON "PoliticaBeca"("sedeId", "anioLectivo");

-- CreateIndex
CREATE INDEX "Beca_alumnoId_estado_idx" ON "Beca"("alumnoId", "estado");

-- AddForeignKey
ALTER TABLE "ProgramaBeca" ADD CONSTRAINT "ProgramaBeca_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoliticaBeca" ADD CONSTRAINT "PoliticaBeca_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beca" ADD CONSTRAINT "Beca_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaBeca"("programaId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beca" ADD CONSTRAINT "Beca_solicitadaPorId_fkey" FOREIGN KEY ("solicitadaPorId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BecaHistorial" ADD CONSTRAINT "BecaHistorial_becaId_fkey" FOREIGN KEY ("becaId") REFERENCES "Beca"("becaId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BecaHistorial" ADD CONSTRAINT "BecaHistorial_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;
