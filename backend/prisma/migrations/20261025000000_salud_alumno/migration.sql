-- AlterTable
ALTER TABLE "Alumno" ADD COLUMN "necesidadesApoyo" VARCHAR(500),
ADD COLUMN "alergias" VARCHAR(500),
ADD COLUMN "medicamentos" VARCHAR(500);

-- AlterTable
ALTER TABLE "Solicitud" ADD COLUMN "alumnoNecesidadesApoyo" VARCHAR(500),
ADD COLUMN "alumnoAlergias" VARCHAR(500),
ADD COLUMN "alumnoMedicamentos" VARCHAR(500);
