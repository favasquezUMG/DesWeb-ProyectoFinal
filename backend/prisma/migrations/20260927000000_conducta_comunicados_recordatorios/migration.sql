-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "recordatorioEnviadoEn" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notificacion" ADD COLUMN     "tipo" VARCHAR(20) NOT NULL DEFAULT 'Aviso';

-- CreateTable
CREATE TABLE "ReporteConducta" (
    "reporteId" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "autorId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(1000) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "fechaRevision" TIMESTAMP(3),
    "comentarioEncargado" VARCHAR(500),

    CONSTRAINT "ReporteConducta_pkey" PRIMARY KEY ("reporteId")
);

-- CreateTable
CREATE TABLE "Comunicado" (
    "comunicadoId" SERIAL NOT NULL,
    "sedeId" INTEGER,
    "autorId" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "mensaje" VARCHAR(2000) NOT NULL,
    "destinatarios" VARCHAR(150) NOT NULL,
    "totalDestinatarios" INTEGER NOT NULL DEFAULT 0,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comunicado_pkey" PRIMARY KEY ("comunicadoId")
);

-- AddForeignKey
ALTER TABLE "ReporteConducta" ADD CONSTRAINT "ReporteConducta_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReporteConducta" ADD CONSTRAINT "ReporteConducta_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comunicado" ADD CONSTRAINT "Comunicado_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

