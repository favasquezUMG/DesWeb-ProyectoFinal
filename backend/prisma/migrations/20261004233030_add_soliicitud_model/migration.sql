-- CreateEnum
CREATE TYPE "ModoInscripcion" AS ENUM ('PUBLICO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "EstadoSolicitud" AS ENUM ('PENDIENTE', 'REVISION', 'APROBADA', 'RECHAZADA', 'VENCIDA');

-- CreateTable
CREATE TABLE "Solicitud" (
    "solicitudId" SERIAL NOT NULL,
    "numero" TEXT NOT NULL,
    "modo" "ModoInscripcion" NOT NULL,
    "estado" "EstadoSolicitud" NOT NULL DEFAULT 'PENDIENTE',
    "encargadoNombres" TEXT NOT NULL,
    "encargadoApellidos" TEXT NOT NULL,
    "encargadoDpi" TEXT NOT NULL,
    "encargadoTelefono" TEXT NOT NULL,
    "encargadoCorreo" TEXT NOT NULL,
    "encargadoParentesco" TEXT NOT NULL,
    "alumnoNombres" TEXT NOT NULL,
    "alumnoApellidos" TEXT NOT NULL,
    "alumnoFechaNacimiento" TIMESTAMP(3) NOT NULL,
    "alumnoNivel" TEXT NOT NULL,
    "alumnoCarrera" TEXT,
    "alumnoAnio" TEXT,
    "alumnoGrado" TEXT,
    "sedeId" INTEGER,
    "documentos" TEXT[],
    "observaciones" TEXT,
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("solicitudId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_numero_key" ON "Solicitud"("numero");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE SET NULL ON UPDATE CASCADE;
