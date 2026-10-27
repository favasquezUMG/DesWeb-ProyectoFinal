-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN     "aceptaEntregas" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaLimite" TIMESTAMP(3),
ADD COLUMN     "instrucciones" VARCHAR(4000),
ADD COLUMN     "permiteAtrasadas" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Entrega" (
    "entregaId" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "entregadoPorId" INTEGER,
    "estado" VARCHAR(15) NOT NULL DEFAULT 'Entregada',
    "enClase" BOOLEAN NOT NULL DEFAULT false,
    "comentario" VARCHAR(2000),
    "fechaEntrega" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retroalimentacion" VARCHAR(2000),
    "fechaRevision" TIMESTAMP(3),

    CONSTRAINT "Entrega_pkey" PRIMARY KEY ("entregaId")
);

-- CreateTable
CREATE TABLE "ArchivoTarea" (
    "archivoId" SERIAL NOT NULL,
    "actividadId" INTEGER,
    "entregaId" INTEGER,
    "publicId" VARCHAR(255) NOT NULL,
    "resourceType" VARCHAR(10) NOT NULL,
    "formato" VARCHAR(20),
    "nombre" VARCHAR(255) NOT NULL,
    "bytes" INTEGER NOT NULL,
    "subidoPorId" INTEGER NOT NULL,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoTarea_pkey" PRIMARY KEY ("archivoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entrega_actividadId_alumnoId_key" ON "Entrega"("actividadId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "ArchivoTarea_publicId_key" ON "ArchivoTarea"("publicId");

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("actividadId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entrega" ADD CONSTRAINT "Entrega_entregadoPorId_fkey" FOREIGN KEY ("entregadoPorId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoTarea" ADD CONSTRAINT "ArchivoTarea_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("actividadId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoTarea" ADD CONSTRAINT "ArchivoTarea_entregaId_fkey" FOREIGN KEY ("entregaId") REFERENCES "Entrega"("entregaId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArchivoTarea" ADD CONSTRAINT "ArchivoTarea_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

