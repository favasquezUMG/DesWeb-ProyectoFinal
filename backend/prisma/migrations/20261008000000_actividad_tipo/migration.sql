-- CreateEnum
CREATE TYPE "TipoActividad" AS ENUM ('Zona', 'Examen');

-- AlterTable
ALTER TABLE "Actividad" ADD COLUMN "tipo" "TipoActividad" NOT NULL DEFAULT 'Zona';
