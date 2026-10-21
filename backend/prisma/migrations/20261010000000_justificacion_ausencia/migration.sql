-- CreateTable
CREATE TABLE "JustificacionAusencia" (
    "justificacionId" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" VARCHAR(500) NOT NULL,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
    "solicitanteId" INTEGER NOT NULL,
    "revisorId" INTEGER,
    "comentario" VARCHAR(300),
    "fechaSolicitud" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaRevision" TIMESTAMP(3),

    CONSTRAINT "JustificacionAusencia_pkey" PRIMARY KEY ("justificacionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "JustificacionAusencia_alumnoId_fecha_key" ON "JustificacionAusencia"("alumnoId", "fecha");

-- AddForeignKey
ALTER TABLE "JustificacionAusencia" ADD CONSTRAINT "JustificacionAusencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JustificacionAusencia" ADD CONSTRAINT "JustificacionAusencia_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JustificacionAusencia" ADD CONSTRAINT "JustificacionAusencia_revisorId_fkey" FOREIGN KEY ("revisorId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;
