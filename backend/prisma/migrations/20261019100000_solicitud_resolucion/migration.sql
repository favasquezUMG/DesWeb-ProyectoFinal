-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN "alumnoId" INTEGER,
ADD COLUMN "fechaResolucion" TIMESTAMP(3),
ADD COLUMN "motivoResolucion" VARCHAR(500);

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_alumnoId_key" ON "Solicitud"("alumnoId");

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE SET NULL ON UPDATE CASCADE;
