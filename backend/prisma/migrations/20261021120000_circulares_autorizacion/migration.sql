-- Circulares: el encargado autoriza (o no) la participacion de cada hijo en un evento, con o sin costo.
-- Reemplaza al carrito: InscripcionEvento pasa a ser la respuesta a la circular.

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "requiereAutorizacion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InscripcionEvento" ADD COLUMN     "fechaRespuesta" TIMESTAMP(3),
ADD COLUMN     "respondidoPorId" INTEGER,
ALTER COLUMN "monto" SET DEFAULT 0,
ALTER COLUMN "estado" SET DEFAULT 'Autorizada';

-- AddForeignKey
ALTER TABLE "InscripcionEvento" ADD CONSTRAINT "InscripcionEvento_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- Los eventos con cobro del carrito pasan a ser circulares
UPDATE "Evento" SET "requiereAutorizacion" = true WHERE "requierePago" = true;

-- Lo que estaba en un carrito sin pagar no era una autorizacion: esos carritos se cancelan
-- y el alumno queda como sin respuesta
UPDATE "Pago" SET "ordenId" = NULL
WHERE "estado" = 'Pendiente'
  AND "ordenId" IN (SELECT "ordenId" FROM "InscripcionEvento" WHERE "estado" = 'Pendiente' AND "ordenId" IS NOT NULL);

UPDATE "OrdenPago" SET "estado" = 'Cancelada'
WHERE "estado" = 'Pendiente'
  AND "ordenId" IN (SELECT "ordenId" FROM "InscripcionEvento" WHERE "estado" = 'Pendiente' AND "ordenId" IS NOT NULL);

DELETE FROM "InscripcionEvento" WHERE "estado" = 'Pendiente';
