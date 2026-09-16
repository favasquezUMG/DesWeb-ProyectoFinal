/*
  Warnings:

  - A unique constraint covering the columns `[stripePaymentId]` on the table `Pago` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[alumnoId,anioLectivo,mes,concepto]` on the table `Pago` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `anioLectivo` to the `Pago` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mes` to the `Pago` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Pago" ADD COLUMN     "anioLectivo" INTEGER NOT NULL,
ADD COLUMN     "mes" SMALLINT NOT NULL,
ADD COLUMN     "stripeSessionId" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "Pago_stripePaymentId_key" ON "Pago"("stripePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_alumnoId_anioLectivo_mes_concepto_key" ON "Pago"("alumnoId", "anioLectivo", "mes", "concepto");
