-- Carrito de eventos: eventos con cobro, inscripciones y ordenes de pago (varios conceptos en un solo cobro)

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "costo" DECIMAL(10,2),
ADD COLUMN     "cupoMaximo" INTEGER,
ADD COLUMN     "fechaLimiteInscripcion" DATE,
ADD COLUMN     "requierePago" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "ordenId" INTEGER;

-- CreateTable
CREATE TABLE "InscripcionEvento" (
    "inscripcionId" SERIAL NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    "ordenId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPago" TIMESTAMP(3),

    CONSTRAINT "InscripcionEvento_pkey" PRIMARY KEY ("inscripcionId")
);

-- CreateTable
CREATE TABLE "OrdenPago" (
    "ordenId" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "stripePaymentId" VARCHAR(150),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPago" TIMESTAMP(3),

    CONSTRAINT "OrdenPago_pkey" PRIMARY KEY ("ordenId")
);

-- CreateIndex
CREATE UNIQUE INDEX "InscripcionEvento_eventoId_alumnoId_key" ON "InscripcionEvento"("eventoId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenPago_stripePaymentId_key" ON "OrdenPago"("stripePaymentId");

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenPago"("ordenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionEvento" ADD CONSTRAINT "InscripcionEvento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("eventoId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionEvento" ADD CONSTRAINT "InscripcionEvento_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionEvento" ADD CONSTRAINT "InscripcionEvento_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenPago"("ordenId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenPago" ADD CONSTRAINT "OrdenPago_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

