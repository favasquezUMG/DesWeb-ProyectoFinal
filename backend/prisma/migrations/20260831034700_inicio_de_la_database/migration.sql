-- CreateTable
CREATE TABLE "Sede" (
    "sedeId" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" VARCHAR(255),
    "telefono" VARCHAR(20),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("sedeId")
);

-- CreateTable
CREATE TABLE "Rol" (
    "rolId" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("rolId")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "usuarioId" SERIAL NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "rolId" INTEGER NOT NULL,
    "sedeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "Catedratico" (
    "catedraticoId" INTEGER NOT NULL,
    "especialidad" VARCHAR(100),

    CONSTRAINT "Catedratico_pkey" PRIMARY KEY ("catedraticoId")
);

-- CreateTable
CREATE TABLE "Encargado" (
    "encargadoId" INTEGER NOT NULL,
    "parentesco" VARCHAR(50),

    CONSTRAINT "Encargado_pkey" PRIMARY KEY ("encargadoId")
);

-- CreateTable
CREATE TABLE "Alumno" (
    "alumnoId" INTEGER NOT NULL,
    "fechaNacimiento" DATE,
    "seccionId" INTEGER NOT NULL,

    CONSTRAINT "Alumno_pkey" PRIMARY KEY ("alumnoId")
);

-- CreateTable
CREATE TABLE "AlumnoEncargado" (
    "alumnoId" INTEGER NOT NULL,
    "encargadoId" INTEGER NOT NULL,
    "esPrincipal" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AlumnoEncargado_pkey" PRIMARY KEY ("alumnoId","encargadoId")
);

-- CreateTable
CREATE TABLE "Grado" (
    "gradoId" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "nivel" VARCHAR(30) NOT NULL,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "Grado_pkey" PRIMARY KEY ("gradoId")
);

-- CreateTable
CREATE TABLE "Curso" (
    "cursoId" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" VARCHAR(255),

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("cursoId")
);

-- CreateTable
CREATE TABLE "MallaCurricular" (
    "mallaId" SERIAL NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "cursoId" INTEGER NOT NULL,

    CONSTRAINT "MallaCurricular_pkey" PRIMARY KEY ("mallaId")
);

-- CreateTable
CREATE TABLE "Seccion" (
    "seccionId" SERIAL NOT NULL,
    "gradoId" INTEGER NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "nombre" VARCHAR(10) NOT NULL,
    "anioLectivo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Seccion_pkey" PRIMARY KEY ("seccionId")
);

-- CreateTable
CREATE TABLE "CursoSeccion" (
    "cursoSeccionId" SERIAL NOT NULL,
    "cursoId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "catedraticoId" INTEGER NOT NULL,

    CONSTRAINT "CursoSeccion_pkey" PRIMARY KEY ("cursoSeccionId")
);

-- CreateTable
CREATE TABLE "Horario" (
    "horarioId" SERIAL NOT NULL,
    "cursoSeccionId" INTEGER NOT NULL,
    "diaSemana" SMALLINT NOT NULL,
    "horaInicio" TIME NOT NULL,
    "horaFin" TIME NOT NULL,

    CONSTRAINT "Horario_pkey" PRIMARY KEY ("horarioId")
);

-- CreateTable
CREATE TABLE "Matricula" (
    "matriculaId" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "seccionId" INTEGER NOT NULL,
    "encargadoId" INTEGER NOT NULL,
    "fechaMatricula" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anioLectivo" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Activa',

    CONSTRAINT "Matricula_pkey" PRIMARY KEY ("matriculaId")
);

-- CreateTable
CREATE TABLE "Unidad" (
    "unidadId" SERIAL NOT NULL,
    "cursoSeccionId" INTEGER NOT NULL,
    "numero" SMALLINT NOT NULL,

    CONSTRAINT "Unidad_pkey" PRIMARY KEY ("unidadId")
);

-- CreateTable
CREATE TABLE "Actividad" (
    "actividadId" SERIAL NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "puntosMaximos" DECIMAL(5,2) NOT NULL,
    "fecha" DATE,

    CONSTRAINT "Actividad_pkey" PRIMARY KEY ("actividadId")
);

-- CreateTable
CREATE TABLE "Nota" (
    "notaId" SERIAL NOT NULL,
    "actividadId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "valor" DECIMAL(5,2) NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("notaId")
);

-- CreateTable
CREATE TABLE "Asistencia" (
    "asistenciaId" SERIAL NOT NULL,
    "cursoSeccionId" INTEGER NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" VARCHAR(15) NOT NULL,

    CONSTRAINT "Asistencia_pkey" PRIMARY KEY ("asistenciaId")
);

-- CreateTable
CREATE TABLE "Beca" (
    "becaId" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "descripcion" VARCHAR(255),
    "fechaInicio" DATE NOT NULL,
    "fechaFin" DATE,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Beca_pkey" PRIMARY KEY ("becaId")
);

-- CreateTable
CREATE TABLE "Pago" (
    "pagoId" SERIAL NOT NULL,
    "alumnoId" INTEGER NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "concepto" VARCHAR(100) NOT NULL,
    "stripePaymentId" VARCHAR(150),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    "fechaPago" TIMESTAMP(3),

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("pagoId")
);

-- CreateTable
CREATE TABLE "Evento" (
    "eventoId" SERIAL NOT NULL,
    "sedeId" INTEGER,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(255),
    "fecha" DATE NOT NULL,
    "tipoEvento" VARCHAR(20) NOT NULL,
    "enviarRecordatorio" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("eventoId")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "notificacionId" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "mensaje" VARCHAR(500) NOT NULL,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("notificacionId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rol_nombre_key" ON "Rol"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MallaCurricular_gradoId_cursoId_key" ON "MallaCurricular"("gradoId", "cursoId");

-- CreateIndex
CREATE UNIQUE INDEX "Seccion_gradoId_sedeId_nombre_anioLectivo_key" ON "Seccion"("gradoId", "sedeId", "nombre", "anioLectivo");

-- CreateIndex
CREATE UNIQUE INDEX "CursoSeccion_cursoId_seccionId_key" ON "CursoSeccion"("cursoId", "seccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Unidad_cursoSeccionId_numero_key" ON "Unidad"("cursoSeccionId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Nota_actividadId_alumnoId_key" ON "Nota"("actividadId", "alumnoId");

-- CreateIndex
CREATE UNIQUE INDEX "Asistencia_cursoSeccionId_alumnoId_fecha_key" ON "Asistencia"("cursoSeccionId", "alumnoId", "fecha");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "Rol"("rolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Catedratico" ADD CONSTRAINT "Catedratico_catedraticoId_fkey" FOREIGN KEY ("catedraticoId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encargado" ADD CONSTRAINT "Encargado_encargadoId_fkey" FOREIGN KEY ("encargadoId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alumno" ADD CONSTRAINT "Alumno_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("seccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumnoEncargado" ADD CONSTRAINT "AlumnoEncargado_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumnoEncargado" ADD CONSTRAINT "AlumnoEncargado_encargadoId_fkey" FOREIGN KEY ("encargadoId") REFERENCES "Encargado"("encargadoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallaCurricular" ADD CONSTRAINT "MallaCurricular_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("gradoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MallaCurricular" ADD CONSTRAINT "MallaCurricular_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("cursoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_gradoId_fkey" FOREIGN KEY ("gradoId") REFERENCES "Grado"("gradoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seccion" ADD CONSTRAINT "Seccion_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoSeccion" ADD CONSTRAINT "CursoSeccion_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("cursoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoSeccion" ADD CONSTRAINT "CursoSeccion_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("seccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoSeccion" ADD CONSTRAINT "CursoSeccion_catedraticoId_fkey" FOREIGN KEY ("catedraticoId") REFERENCES "Catedratico"("catedraticoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("cursoSeccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_seccionId_fkey" FOREIGN KEY ("seccionId") REFERENCES "Seccion"("seccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matricula" ADD CONSTRAINT "Matricula_encargadoId_fkey" FOREIGN KEY ("encargadoId") REFERENCES "Encargado"("encargadoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unidad" ADD CONSTRAINT "Unidad_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("cursoSeccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Actividad" ADD CONSTRAINT "Actividad_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unidad"("unidadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_actividadId_fkey" FOREIGN KEY ("actividadId") REFERENCES "Actividad"("actividadId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_cursoSeccionId_fkey" FOREIGN KEY ("cursoSeccionId") REFERENCES "CursoSeccion"("cursoSeccionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asistencia" ADD CONSTRAINT "Asistencia_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Beca" ADD CONSTRAINT "Beca_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "Alumno"("alumnoId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("sedeId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("usuarioId") ON DELETE RESTRICT ON UPDATE CASCADE;
