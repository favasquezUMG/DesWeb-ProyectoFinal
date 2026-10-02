-- Roles: roles de sistema, permisos por modulo, varios roles por usuario y bitacora.
-- Encargados: cada vinculo alumno-encargado guarda parentesco, custodia, permisos,
-- restriccion judicial y vigencia.

-- AlterTable
ALTER TABLE "Rol" ADD COLUMN     "descripcion" VARCHAR(255),
ADD COLUMN     "esSistema" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AlumnoEncargado" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autorizadoRecoger" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "motivoRestriccion" VARCHAR(500),
ADD COLUMN     "observaciones" VARCHAR(255),
ADD COLUMN     "parentesco" VARCHAR(30),
ADD COLUMN     "puedeVerNotas" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "puedeVerPagos" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recibeNotificaciones" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "responsableFinanciero" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restringido" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tieneCustodia" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "vigenteDesde" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "vigenteHasta" DATE;

-- CreateTable
CREATE TABLE "Permiso" (
    "rolId" INTEGER NOT NULL,
    "modulo" VARCHAR(30) NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("rolId","modulo")
);

-- CreateTable
CREATE TABLE "UsuarioRol" (
    "usuarioId" INTEGER NOT NULL,
    "rolId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioRol_pkey" PRIMARY KEY ("usuarioId","rolId")
);

-- CreateTable
CREATE TABLE "Bitacora" (
    "bitacoraId" SERIAL NOT NULL,
    "usuarioId" INTEGER,
    "accion" VARCHAR(50) NOT NULL,
    "entidad" VARCHAR(30) NOT NULL,
    "entidadId" INTEGER NOT NULL,
    "detalle" VARCHAR(1000) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("bitacoraId")
);

-- CreateIndex
CREATE INDEX "Bitacora_entidad_entidadId_idx" ON "Bitacora"("entidad", "entidadId");

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("rolId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioRol" ADD CONSTRAINT "UsuarioRol_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("rolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bitacora" ADD CONSTRAINT "Bitacora_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("usuarioId") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Datos
-- ---------------------------------------------------------------------------

-- Roles de los que depende el codigo: no se pueden renombrar ni eliminar
UPDATE "Rol" SET "esSistema" = true
WHERE "nombre" IN ('Administrador General', 'Administrador de Sede', 'Catedratico', 'Alumno', 'Encargado', 'Admin');

-- El Administrador de Sede conserva el acceso que ya tenia a todos los modulos administrativos
INSERT INTO "Permiso" ("rolId", "modulo")
SELECT r."rolId", m.modulo
FROM "Rol" r
CROSS JOIN (VALUES ('usuarios'), ('alumnos'), ('matriculas'), ('horarios'), ('notas'), ('asistencia'),
                   ('conducta'), ('becas'), ('pagos'), ('comunicados'), ('calendario'), ('reportes')) AS m(modulo)
WHERE r."nombre" = 'Administrador de Sede'
ON CONFLICT DO NOTHING;

-- El parentesco pasa a cada vinculo (una persona puede ser madre de uno y tutora de otro)
UPDATE "AlumnoEncargado" ae
SET "parentesco" = e."parentesco"
FROM "Encargado" e
WHERE e."encargadoId" = ae."encargadoId";

-- Alumnos sin contacto principal: el vinculo mas antiguo pasa a ser el principal
UPDATE "AlumnoEncargado" ae
SET "esPrincipal" = true
WHERE ae."encargadoId" = (
    SELECT MIN(x."encargadoId") FROM "AlumnoEncargado" x WHERE x."alumnoId" = ae."alumnoId"
)
AND NOT EXISTS (
    SELECT 1 FROM "AlumnoEncargado" y WHERE y."alumnoId" = ae."alumnoId" AND y."esPrincipal"
);

-- Hasta ahora el principal era quien pagaba
UPDATE "AlumnoEncargado" SET "responsableFinanciero" = "esPrincipal";
