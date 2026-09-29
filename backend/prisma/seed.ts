import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ROLES = [
    'Administrador General',
    'Administrador de Sede',
    'Catedratico',
    'Alumno',
    'Encargado',
] as const;

const SEDES = [
    { nombre: 'Sede Central', direccion: 'Zona 1, Ciudad de Guatemala', telefono: '22550001' },
    { nombre: 'Sede Norte', direccion: 'Zona 18, Ciudad de Guatemala', telefono: '22550002' },
    { nombre: 'Sede Sur', direccion: 'Villa Nueva, Guatemala', telefono: '22550003' },
    { nombre: 'Sede Mixco', direccion: 'Zona 4 de Mixco, Guatemala', telefono: '22550004' },
    { nombre: 'Sede Antigua', direccion: 'Antigua Guatemala, Sacatepéquez', telefono: '78320005' },
    { nombre: 'Sede Quetzaltenango', direccion: 'Zona 3, Quetzaltenango', telefono: '77610006' },
    { nombre: 'Sede Escuintla', direccion: 'Zona 1, Escuintla', telefono: '78880007' },
    { nombre: 'Sede Cobán', direccion: 'Cobán, Alta Verapaz', telefono: '79510008' },
    { nombre: 'Sede Huehuetenango', direccion: 'Zona 1, Huehuetenango', telefono: '77640009' },
    { nombre: 'Sede Petén', direccion: 'Flores, Petén', telefono: '79260010' },
];

// Solo las primeras sedes y grados reciben alumnos, cursos y notas, para que el
// volumen de datos académicos se mantenga manejable. El resto queda con secciones vacías.
const SEDES_CON_ALUMNOS = 3;
const GRADOS_CON_ALUMNOS = 6;

const GRADOS = [
    { nombre: 'Primero Primaria', nivel: 'Primaria', orden: 1 },
    { nombre: 'Segundo Primaria', nivel: 'Primaria', orden: 2 },
    { nombre: 'Tercero Primaria', nivel: 'Primaria', orden: 3 },
    { nombre: 'Cuarto Primaria', nivel: 'Primaria', orden: 4 },
    { nombre: 'Quinto Primaria', nivel: 'Primaria', orden: 5 },
    { nombre: 'Sexto Primaria', nivel: 'Primaria', orden: 6 },
    { nombre: 'Primero Básico', nivel: 'Básico', orden: 7 },
    { nombre: 'Segundo Básico', nivel: 'Básico', orden: 8 },
    { nombre: 'Tercero Básico', nivel: 'Básico', orden: 9 },
    { nombre: 'Cuarto Bachillerato', nivel: 'Diversificado', orden: 10 },
];

const CURSOS = [
    { nombre: 'Matemática', descripcion: 'Curso base del CNB' },
    { nombre: 'Comunicación y Lenguaje', descripcion: 'Curso base del CNB' },
    { nombre: 'Ciencias Naturales', descripcion: 'Curso base del CNB' },
    { nombre: 'Ciencias Sociales', descripcion: 'Historia, geografía y formación ciudadana' },
    { nombre: 'Inglés', descripcion: 'Idioma extranjero' },
    { nombre: 'Educación Física', descripcion: 'Desarrollo motriz y deporte' },
    { nombre: 'Expresión Artística', descripcion: 'Música, artes plásticas y teatro' },
    { nombre: 'Computación', descripcion: 'Tecnologías del aprendizaje y la comunicación' },
    { nombre: 'Productividad y Desarrollo', descripcion: 'Emprendimiento y proyectos' },
    { nombre: 'Idioma Maya', descripcion: 'Segundo idioma nacional' },
];
// Cada grado lleva los 3 cursos base + 3 cursos que rotan según el grado
const CURSOS_POR_GRADO = 6;

const ANIO_LECTIVO = 2026;
const DEFAULT_PASSWORD = 'Password123!';
const USUARIOS_POR_ROL = 10;
const TOTAL_CATEDRATICOS = 20;
const TOTAL_ENCARGADOS = 35;
const TOTAL_ALUMNOS = 60;

const ESPECIALIDADES = ['Matemática', 'Comunicación y Lenguaje', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Física'];
const PARENTESCOS = ['Madre', 'Padre', 'Tutor Legal'];

const NOMBRES = [
    'María José', 'Juan Pablo', 'Ana Lucía', 'Carlos Andrés', 'Sofía', 'Diego Alejandro', 'Valeria', 'José Manuel',
    'Camila', 'Luis Fernando', 'Isabella', 'Pedro Antonio', 'Gabriela', 'Javier', 'Daniela', 'Andrés',
    'Mariana', 'Kevin', 'Fernanda', 'Emilio',
];
const APELLIDOS = [
    'García López', 'Hernández Pérez', 'Morales Castillo', 'Rodríguez Méndez', 'Castillo Ramírez', 'Pérez Juárez',
    'López Cifuentes', 'Méndez Orellana', 'Ramírez Fuentes', 'Juárez Estrada', 'Cifuentes Barrios', 'Orellana Solís',
    'Fuentes Aguilar', 'Estrada Velásquez', 'Barrios Monterroso',
];
const nombreDe = (i: number) => NOMBRES[(i * 7) % NOMBRES.length];
const apellidoDe = (i: number) => APELLIDOS[(i * 3) % APELLIDOS.length];

// Sede, Grado y Curso no tienen un campo @unique en el schema, así que no admiten
// upsert nativo: se busca por nombre y solo se crea si no existe.
async function findOrCreateSede(data: typeof SEDES[number]) {
    const existente = await prisma.sede.findFirst({ where: { nombre: data.nombre } });
    if (existente) return existente;
    return prisma.sede.create({ data });
}

async function findOrCreateGrado(data: typeof GRADOS[number]) {
    const existente = await prisma.grado.findFirst({ where: { nombre: data.nombre } });
    if (existente) return existente;
    return prisma.grado.create({ data });
}

async function findOrCreateCurso(data: typeof CURSOS[number]) {
    const existente = await prisma.curso.findFirst({ where: { nombre: data.nombre } });
    if (existente) return existente;
    return prisma.curso.create({ data });
}

async function main() {
    console.log('Sembrando datos de prueba...');

    // 1. Roles
    const roles = new Map<string, number>();
    for (const nombre of ROLES) {
        const rol = await prisma.rol.upsert({
            where: { nombre },
            update: {},
            create: { nombre },
        });
        roles.set(nombre, rol.rolId);
    }
    console.log(`Roles listos: ${roles.size}`);

    // 2. Sedes
    const sedes = [];
    for (const data of SEDES) {
        sedes.push(await findOrCreateSede(data));
    }
    console.log(`Sedes listas: ${sedes.length}`);

    // 3. Grados
    const grados = [];
    for (const data of GRADOS) {
        grados.push(await findOrCreateGrado(data));
    }
    console.log(`Grados listos: ${grados.length}`);

    // 3b. Cursos y malla curricular
    const cursos = [];
    for (const data of CURSOS) {
        cursos.push(await findOrCreateCurso(data));
    }
    const mallaData = grados.flatMap((grado, g) => {
        const base = cursos.slice(0, 3);
        const extras = Array.from({ length: CURSOS_POR_GRADO - 3 }, (_, k) => cursos[3 + ((g + k) % (cursos.length - 3))]);
        return [...base, ...extras].map((curso) => ({ gradoId: grado.gradoId, cursoId: curso.cursoId }));
    });
    await prisma.mallaCurricular.createMany({ data: mallaData, skipDuplicates: true });
    console.log(`Cursos listos: ${cursos.length}, malla curricular: ${await prisma.mallaCurricular.count()} registros`);

    // 4. Secciones: una sección "A" por cada combinación de sede y grado
    const secciones = [];
    for (const sede of sedes) {
        for (const grado of grados) {
            const seccion = await prisma.seccion.upsert({
                where: {
                    gradoId_sedeId_nombre_anioLectivo: {
                        gradoId: grado.gradoId,
                        sedeId: sede.sedeId,
                        nombre: 'A',
                        anioLectivo: ANIO_LECTIVO,
                    },
                },
                update: {},
                create: {
                    gradoId: grado.gradoId,
                    sedeId: sede.sedeId,
                    nombre: 'A',
                    anioLectivo: ANIO_LECTIVO,
                },
            });
            secciones.push(seccion);
        }
    }
    console.log(`Secciones listas: ${secciones.length}`);

    // Secciones que reciben alumnos (mismo orden que en seeds anteriores: sede x grado)
    const seccionesConAlumnos = secciones.filter((s) => {
        const iSede = sedes.findIndex((sede) => sede.sedeId === s.sedeId);
        const iGrado = grados.findIndex((grado) => grado.gradoId === s.gradoId);
        return iSede < SEDES_CON_ALUMNOS && iGrado < GRADOS_CON_ALUMNOS;
    });
    const sedesConAlumnos = sedes.slice(0, SEDES_CON_ALUMNOS);

    // 5. Usuarios, con contraseña hasheada compartida para pruebas
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // Administrador General: sin sede fija, supervisa toda la red
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        await prisma.usuario.upsert({
            where: { email: `admin.general${i}@dercas.edu.gt` },
            update: {},
            create: {
                nombres: `AdminGeneral${i}`,
                apellidos: 'Prueba',
                email: `admin.general${i}@dercas.edu.gt`,
                passwordHash,
                rolId: roles.get('Administrador General')!,
                sedeId: null,
            },
        });
    }

    // Administrador de Sede: repartidos entre las sedes con alumnos
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const sede = sedesConAlumnos[(i - 1) % sedesConAlumnos.length];
        await prisma.usuario.upsert({
            where: { email: `admin.sede${i}@dercas.edu.gt` },
            update: {},
            create: {
                nombres: `AdminSede${i}`,
                apellidos: 'Prueba',
                email: `admin.sede${i}@dercas.edu.gt`,
                passwordHash,
                rolId: roles.get('Administrador de Sede')!,
                sedeId: sede.sedeId,
            },
        });
    }

    // Catedraticos: usuario base + registro de extensión Catedratico
    for (let i = 1; i <= TOTAL_CATEDRATICOS; i++) {
        const sede = sedesConAlumnos[(i - 1) % sedesConAlumnos.length];
        const email = `catedratico${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres: i <= USUARIOS_POR_ROL ? `Catedratico${i}` : nombreDe(i),
                apellidos: i <= USUARIOS_POR_ROL ? 'Prueba' : apellidoDe(i),
                email,
                passwordHash,
                rolId: roles.get('Catedratico')!,
                sedeId: sede.sedeId,
            },
        });

        await prisma.catedratico.upsert({
            where: { catedraticoId: usuario.usuarioId },
            update: {},
            create: {
                catedraticoId: usuario.usuarioId,
                especialidad: ESPECIALIDADES[(i - 1) % ESPECIALIDADES.length],
            },
        });
    }

    // Encargados: usuario base + registro de extensión Encargado.
    // El update corrige el rol si el registro del rol fue renombrado o reemplazado.
    for (let i = 1; i <= TOTAL_ENCARGADOS; i++) {
        const email = `encargado${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: { rolId: roles.get('Encargado')! },
            create: {
                nombres: i <= USUARIOS_POR_ROL ? `Encargado${i}` : nombreDe(i + 3),
                apellidos: i <= USUARIOS_POR_ROL ? 'Prueba' : apellidoDe(i),
                email,
                passwordHash,
                rolId: roles.get('Encargado')!,
                sedeId: null,
            },
        });

        await prisma.encargado.upsert({
            where: { encargadoId: usuario.usuarioId },
            update: {},
            create: {
                encargadoId: usuario.usuarioId,
                parentesco: PARENTESCOS[(i - 1) % PARENTESCOS.length],
            },
        });
    }

    // Alumnos: usuario base + registro de extensión Alumno, asignados a una sección
    for (let i = 1; i <= TOTAL_ALUMNOS; i++) {
        const seccion = seccionesConAlumnos[(i - 1) % seccionesConAlumnos.length];
        const email = `alumno${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres: i <= USUARIOS_POR_ROL ? `Alumno${i}` : nombreDe(i + 11),
                apellidos: i <= USUARIOS_POR_ROL ? 'Prueba' : apellidoDe(Math.ceil(i / 2)),
                email,
                passwordHash,
                rolId: roles.get('Alumno')!,
                sedeId: seccion.sedeId,
            },
        });

        await prisma.alumno.upsert({
            where: { alumnoId: usuario.usuarioId },
            update: {},
            create: {
                alumnoId: usuario.usuarioId,
                fechaNacimiento: new Date(2015 - (i % 6), (i * 5) % 12, ((i - 1) % 28) + 1),
                seccionId: seccion.seccionId,
            },
        });
    }

    // Vínculo alumno-encargado. Los primeros 10 alumnos siguen con su encargado del mismo número;
    // del 11 en adelante se reparten entre los encargados, así varios encargados tienen 2 hijos.
    // Cada 4 alumnos se agrega además un encargado secundario.
    const encargadoPrincipalDe = (i: number) => (i <= USUARIOS_POR_ROL ? i : ((i - 1) % TOTAL_ENCARGADOS) + 1);
    for (let i = 1; i <= TOTAL_ALUMNOS; i++) {
        const alumno = await prisma.usuario.findUnique({ where: { email: `alumno${i}@dercas.edu.gt` }, include: { alumno: true } });
        const encargado = await prisma.usuario.findUnique({ where: { email: `encargado${encargadoPrincipalDe(i)}@dercas.edu.gt` } });
        if (!alumno?.alumno || !encargado) continue;

        await prisma.alumnoEncargado.upsert({
            where: { alumnoId_encargadoId: { alumnoId: alumno.usuarioId, encargadoId: encargado.usuarioId } },
            update: {},
            create: { alumnoId: alumno.usuarioId, encargadoId: encargado.usuarioId, esPrincipal: true },
        });

        if (i % 4 === 0) {
            const secundario = await prisma.usuario.findUnique({
                where: { email: `encargado${((encargadoPrincipalDe(i) + 16) % TOTAL_ENCARGADOS) + 1}@dercas.edu.gt` },
            });
            if (secundario && secundario.usuarioId !== encargado.usuarioId) {
                await prisma.alumnoEncargado.upsert({
                    where: { alumnoId_encargadoId: { alumnoId: alumno.usuarioId, encargadoId: secundario.usuarioId } },
                    update: {},
                    create: { alumnoId: alumno.usuarioId, encargadoId: secundario.usuarioId, esPrincipal: false },
                });
            }
        }

        // Matricula no tiene @@unique, se crea solo si el alumno no tiene una para el año lectivo
        const matricula = await prisma.matricula.findFirst({
            where: { alumnoId: alumno.usuarioId, anioLectivo: ANIO_LECTIVO },
        });
        if (!matricula) {
            await prisma.matricula.create({
                data: {
                    alumnoId: alumno.usuarioId,
                    seccionId: alumno.alumno.seccionId,
                    encargadoId: encargado.usuarioId,
                    anioLectivo: ANIO_LECTIVO,
                    fechaMatricula: new Date(ANIO_LECTIVO - 1, 10 + (i % 2), ((i * 3) % 27) + 1),
                },
            });
        }
    }
    console.log(`Vínculos alumno-encargado y matrículas listos: ${await prisma.matricula.count()} matrículas`);

    // 6. Cursos-Sección: si faltan, se crean a partir de la malla curricular de cada sección con alumnos
    const catedraticos = await prisma.catedratico.findMany({ include: { usuario: true }, orderBy: { catedraticoId: 'asc' } });
    const catedraticosPorSede = new Map<number, typeof catedraticos>();
    for (const cat of catedraticos) {
        if (cat.usuario.sedeId == null) continue;
        const lista = catedraticosPorSede.get(cat.usuario.sedeId) ?? [];
        lista.push(cat);
        catedraticosPorSede.set(cat.usuario.sedeId, lista);
    }

    const cursoSeccionAntes = await prisma.cursoSeccion.count();
    for (const [indiceSeccion, seccion] of seccionesConAlumnos.entries()) {
        const malla = await prisma.mallaCurricular.findMany({ where: { gradoId: seccion.gradoId }, orderBy: { cursoId: 'asc' } });
        const catedraticosSede = catedraticosPorSede.get(seccion.sedeId) ?? [];
        if (!catedraticosSede.length) continue;

        await prisma.cursoSeccion.createMany({
            data: malla.map((m, i) => ({
                cursoId: m.cursoId,
                seccionId: seccion.seccionId,
                catedraticoId: catedraticosSede[(i + indiceSeccion) % catedraticosSede.length].catedraticoId,
            })),
            skipDuplicates: true,
        });
    }
    const cursosSeccionCreados = (await prisma.cursoSeccion.count()) - cursoSeccionAntes;
    console.log(`Cursos-sección creados: ${cursosSeccionCreados}`);

    const todasCursoSeccion = await prisma.cursoSeccion.findMany({
        select: { cursoSeccionId: true, seccionId: true, catedraticoId: true },
        orderBy: { cursoSeccionId: 'asc' },
    });

    // 6b. Horarios: 2 periodos de 1 hora por semana para cada curso-sección que no tenga,
    // evitando choques de la sección y del catedrático (se consideran también los ya existentes)
    const PERIODOS = [7, 8, 9, 10, 11, 12, 13]; // hora de inicio de cada periodo
    const horaDe = (h: number) => new Date(Date.UTC(1970, 0, 1, h, 0, 0, 0));
    const ocupado = new Set<string>();
    const existentes = await prisma.horario.findMany({ include: { cursoSeccion: true } });
    const conHorario = new Set(existentes.map((h) => h.cursoSeccionId));
    for (const h of existentes) {
        const hora = h.horaInicio.getUTCHours();
        ocupado.add(`s${h.cursoSeccion.seccionId}-${h.diaSemana}-${hora}`);
        ocupado.add(`c${h.cursoSeccion.catedraticoId}-${h.diaSemana}-${hora}`);
    }

    const horariosNuevos = [];
    for (const [idx, cs] of todasCursoSeccion.entries()) {
        if (conHorario.has(cs.cursoSeccionId)) continue;
        let asignados = 0;
        for (let intento = 0; intento < 5 * PERIODOS.length && asignados < 2; intento++) {
            const dia = ((idx + intento * 2) % 5) + 1;
            const hora = PERIODOS[(idx + Math.floor(intento / 5)) % PERIODOS.length];
            const claveSeccion = `s${cs.seccionId}-${dia}-${hora}`;
            const claveCatedratico = `c${cs.catedraticoId}-${dia}-${hora}`;
            if (ocupado.has(claveSeccion) || ocupado.has(claveCatedratico)) continue;
            ocupado.add(claveSeccion);
            ocupado.add(claveCatedratico);
            horariosNuevos.push({ cursoSeccionId: cs.cursoSeccionId, diaSemana: dia, horaInicio: horaDe(hora), horaFin: horaDe(hora + 1) });
            asignados++;
        }
    }
    await prisma.horario.createMany({ data: horariosNuevos });
    console.log(`Horarios creados: ${horariosNuevos.length}`);

    // 7. Unidades: 4 por curso-sección (numero 1 a 4)
    const unidadesCreadas = await prisma.unidad.createMany({
        data: todasCursoSeccion.flatMap((cs) => [1, 2, 3, 4].map((numero) => ({ cursoSeccionId: cs.cursoSeccionId, numero }))),
        skipDuplicates: true,
    });
    console.log(`Unidades creadas: ${unidadesCreadas.count}`);

    // 8. Actividades: 3 por unidad, puntosMaximos 10 + 10 + 5 = 25 (las 4 unidades suman 100)
    // Actividad no tiene @@unique, así que se crean solo las que falten por nombre dentro de la unidad
    const ACTIVIDADES_UNIDAD = [
        { nombre: 'Actividad 1', puntosMaximos: 10 },
        { nombre: 'Actividad 2', puntosMaximos: 10 },
        { nombre: 'Actividad 3', puntosMaximos: 5 },
    ];
    // Mes de referencia de cada unidad dentro del ciclo escolar (0 = enero)
    const MES_POR_UNIDAD = [1, 3, 6, 9];

    const unidades = await prisma.unidad.findMany({
        select: { unidadId: true, numero: true, actividades: { select: { nombre: true } } },
        orderBy: { unidadId: 'asc' },
    });

    const actividadesNuevas = unidades.flatMap((unidad) =>
        ACTIVIDADES_UNIDAD.flatMap(({ nombre, puntosMaximos }, idx) => {
            if (unidad.actividades.some((a) => a.nombre === nombre)) return [];
            const fecha = new Date(ANIO_LECTIVO, MES_POR_UNIDAD[(unidad.numero - 1) % 4], 10 + idx * 7);
            return [{ unidadId: unidad.unidadId, nombre, puntosMaximos, fecha }];
        })
    );
    await prisma.actividad.createMany({ data: actividadesNuevas });
    console.log(`Actividades creadas: ${actividadesNuevas.length}`);

    // 9. Notas: distribución controlada (no aleatoria) para que ~30% de los alumnos
    // termine con promedio por debajo de 61 y el resto por encima. El "desempeño" de
    // cada alumno es fijo según su posición global y se reparte proporcionalmente
    // entre las actividades de cada unidad, para que el total de cada curso
    // (4 unidades x 25 puntos = 100) quede cerca de ese porcentaje.
    // Solo se crean las notas que falten; las ya registradas no se modifican.
    const alumnosOrdenados = await prisma.alumno.findMany({ orderBy: { alumnoId: 'asc' } });
    const desempenoPorAlumno = new Map<number, number>();
    alumnosOrdenados.forEach((alumno, indice) => {
        const esBajo = indice % 10 < 3; // 3 de cada 10 alumnos => ~30%
        const desempeno = esBajo
            ? 35 + (indice % 4) * 6 // banda reprobada: 35, 41, 47, 53
            : 65 + (indice % 5) * 6; // banda aprobada: 65, 71, 77, 83, 89
        desempenoPorAlumno.set(alumno.alumnoId, desempeno);
    });

    const alumnosPorSeccion = new Map<number, number[]>();
    for (const alumno of alumnosOrdenados) {
        const lista = alumnosPorSeccion.get(alumno.seccionId) ?? [];
        lista.push(alumno.alumnoId);
        alumnosPorSeccion.set(alumno.seccionId, lista);
    }

    const unidadesConActividades = await prisma.unidad.findMany({
        select: {
            unidadId: true,
            cursoSeccion: { select: { seccionId: true } },
            actividades: { orderBy: { actividadId: 'asc' } },
        },
        orderBy: { unidadId: 'asc' },
    });

    const notasNuevas = [];
    for (const unidad of unidadesConActividades) {
        const puntosUnidad = unidad.actividades.reduce((suma, a) => suma + Number(a.puntosMaximos), 0);

        for (const alumnoId of alumnosPorSeccion.get(unidad.cursoSeccion.seccionId) ?? []) {
            const desempeno = desempenoPorAlumno.get(alumnoId) ?? 70;
            let restante = Math.round((puntosUnidad * desempeno) / 100);

            for (let i = 0; i < unidad.actividades.length; i++) {
                const actividad = unidad.actividades[i];
                const esUltima = i === unidad.actividades.length - 1;
                const maximo = Number(actividad.puntosMaximos);

                const valor = esUltima
                    ? Math.max(0, Math.min(restante, maximo))
                    : Math.max(0, Math.min(Math.round((maximo * desempeno) / 100), maximo, restante));
                restante -= valor;

                notasNuevas.push({ actividadId: actividad.actividadId, alumnoId, valor });
            }
        }
    }
    const notasCreadas = await prisma.nota.createMany({ data: notasNuevas, skipDuplicates: true });
    console.log(`Notas registradas: ${notasCreadas.count}`);

    // 10. Asistencia: últimas 2 semanas (solo días hábiles), con mayoría de presentes.
    // La API solo acepta Presente y Ausente, así que se normalizan estados de seeds anteriores.
    await prisma.asistencia.updateMany({ where: { estado: 'Tarde' }, data: { estado: 'Presente' } });
    await prisma.asistencia.updateMany({ where: { estado: 'Justificado' }, data: { estado: 'Ausente' } });

    const ESTADOS_ASISTENCIA = [
        'Presente', 'Presente', 'Presente', 'Presente', 'Presente', 'Presente', 'Presente',
        'Presente', 'Ausente', 'Ausente',
    ];

    const diasHabiles: Date[] = [];
    const hoy = new Date();
    for (let offset = 0; offset < 14; offset++) {
        const fecha = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - offset));
        const diaSemana = fecha.getUTCDay();
        if (diaSemana !== 0 && diaSemana !== 6) diasHabiles.push(fecha);
    }

    const asistenciasNuevas = [];
    let contadorEstado = 0;
    for (const cs of todasCursoSeccion) {
        for (const alumnoId of alumnosPorSeccion.get(cs.seccionId) ?? []) {
            for (const fecha of diasHabiles) {
                const estado = ESTADOS_ASISTENCIA[(alumnoId + fecha.getUTCDate() + contadorEstado) % ESTADOS_ASISTENCIA.length];
                contadorEstado++;
                asistenciasNuevas.push({ cursoSeccionId: cs.cursoSeccionId, alumnoId, fecha, estado });
            }
        }
    }
    const asistenciasCreadas = await prisma.asistencia.createMany({ data: asistenciasNuevas, skipDuplicates: true });
    console.log(`Asistencias registradas: ${asistenciasCreadas.count}`);

    // 11. Becas: 1 de cada 4 alumnos tiene beca activa; algunas ya vencidas para probar el historial
    const alumnosSeed = await prisma.usuario.findMany({
        where: { email: { startsWith: 'alumno' }, alumno: { isNot: null } },
        orderBy: { usuarioId: 'asc' },
        include: { alumno: true },
    });
    const BECAS = [
        { porcentaje: 25, descripcion: 'Beca por excelencia académica' },
        { porcentaje: 50, descripcion: 'Beca socioeconómica' },
        { porcentaje: 15, descripcion: 'Descuento por hermanos' },
        { porcentaje: 100, descripcion: 'Beca completa por convenio' },
        { porcentaje: 30, descripcion: 'Beca deportiva' },
    ];
    let becasCreadas = 0;
    for (const [idx, alumno] of alumnosSeed.entries()) {
        if (idx % 4 !== 0 && idx % 9 !== 0) continue;
        const existente = await prisma.beca.findFirst({ where: { alumnoId: alumno.usuarioId } });
        if (existente) continue;
        const beca = BECAS[idx % BECAS.length];
        const vencida = idx % 9 === 0 && idx % 4 !== 0;
        await prisma.beca.create({
            data: {
                alumnoId: alumno.usuarioId,
                porcentaje: beca.porcentaje,
                descripcion: beca.descripcion,
                fechaInicio: new Date(Date.UTC(vencida ? ANIO_LECTIVO - 1 : ANIO_LECTIVO, 0, 1)),
                fechaFin: vencida ? new Date(Date.UTC(ANIO_LECTIVO - 1, 11, 31)) : new Date(Date.UTC(ANIO_LECTIVO, 11, 31)),
                activa: !vencida,
            },
        });
        becasCreadas++;
    }
    console.log(`Becas creadas: ${becasCreadas}`);

    // 12. Pagos de colegiatura de enero al mes actual. La mayoría está al día;
    // 1 de cada 5 alumnos debe los últimos meses (Pendiente) para probar morosidad.
    const colegiatura = Number(process.env.COLEGIATURA_MENSUAL ?? 500);
    const mesActual = Math.min(new Date().getMonth() + 1, 10);
    const becasActivas = await prisma.beca.findMany({ where: { activa: true } });
    const pagosNuevos = [];
    for (const [idx, alumno] of alumnosSeed.entries()) {
        const beca = becasActivas.find((b) => b.alumnoId === alumno.usuarioId);
        const monto = Number((colegiatura * (1 - (beca ? Number(beca.porcentaje) : 0) / 100)).toFixed(2));
        const moroso = idx % 5 === 2;
        for (let mes = 1; mes <= mesActual; mes++) {
            const pagado = !(moroso && mes >= mesActual - 1) && mes < mesActual + (idx % 3 === 0 ? 1 : 0);
            pagosNuevos.push({
                alumnoId: alumno.usuarioId,
                monto,
                concepto: 'Colegiatura',
                anioLectivo: ANIO_LECTIVO,
                mes,
                estado: pagado ? 'Pagado' : 'Pendiente',
                fechaPago: pagado ? new Date(Date.UTC(ANIO_LECTIVO, mes - 1, 1 + (idx % 10))) : null,
            });
        }
    }
    const pagosCreados = await prisma.pago.createMany({ data: pagosNuevos, skipDuplicates: true });
    console.log(`Pagos creados: ${pagosCreados.count}`);

    // 13. Eventos del ciclo escolar. Se crean con enviarRecordatorio = false para que el
    // servidor no mande correos reales a las cuentas ficticias del seed.
    const EVENTOS = [
        { sede: null, nombre: 'Día de la Independencia', tipoEvento: 'Festivo', mes: 9, dia: 15, descripcion: 'Desfile y acto cívico. No hay clases.' },
        { sede: null, nombre: 'Día del Ejército (asueto)', tipoEvento: 'Festivo', mes: 6, dia: 30, descripcion: 'Asueto oficial.' },
        { sede: null, nombre: 'Revolución de 1944', tipoEvento: 'Festivo', mes: 10, dia: 20, descripcion: 'Asueto oficial.' },
        { sede: null, nombre: 'Exámenes de cuarta unidad', tipoEvento: 'Academico', mes: 10, dia: 12, descripcion: 'Semana de evaluaciones finales.' },
        { sede: null, nombre: 'Clausura del ciclo escolar', tipoEvento: 'Academico', mes: 10, dia: 30, descripcion: 'Acto de clausura y entrega de diplomas.' },
        { sede: 0, nombre: 'Reunión de padres - Sede Central', tipoEvento: 'Reunion', mes: 10, dia: 2, descripcion: 'Entrega de notas de tercera unidad.' },
        { sede: 1, nombre: 'Reunión de padres - Sede Norte', tipoEvento: 'Reunion', mes: 10, dia: 3, descripcion: 'Entrega de notas de tercera unidad.' },
        { sede: 2, nombre: 'Reunión de padres - Sede Sur', tipoEvento: 'Reunion', mes: 10, dia: 5, descripcion: 'Entrega de notas de tercera unidad.' },
        { sede: 0, nombre: 'Olimpiadas deportivas', tipoEvento: 'Deportivo', mes: 8, dia: 21, descripcion: 'Competencias interaulas de fútbol y atletismo.' },
        { sede: 1, nombre: 'Feria científica', tipoEvento: 'Academico', mes: 8, dia: 28, descripcion: 'Exposición de proyectos de Ciencias Naturales.' },
        { sede: 2, nombre: 'Kermés escolar', tipoEvento: 'Deportivo', mes: 11, dia: 7, descripcion: 'Actividad para recaudar fondos.' },
        { sede: 3, nombre: 'Inauguración Sede Mixco', tipoEvento: 'Reunion', mes: 1, dia: 12, descripcion: 'Acto de apertura del ciclo en la nueva sede.' },
    ];
    let eventosCreados = 0;
    for (const e of EVENTOS) {
        if (await prisma.evento.findFirst({ where: { nombre: e.nombre } })) continue;
        await prisma.evento.create({
            data: {
                sedeId: e.sede === null ? null : sedes[e.sede].sedeId,
                nombre: e.nombre,
                descripcion: e.descripcion,
                fecha: new Date(Date.UTC(ANIO_LECTIVO, e.mes - 1, e.dia)),
                tipoEvento: e.tipoEvento,
                enviarRecordatorio: false,
            },
        });
        eventosCreados++;
    }
    console.log(`Eventos creados: ${eventosCreados}`);

    // 14. Conducta, notificaciones y comunicados de ejemplo (sin @@unique: se busca por título)
    const REPORTES_CONDUCTA = [
        { tipo: 'Leve', titulo: 'Llegada tarde reiterada', descripcion: 'El alumno llegó tarde a la primera clase tres días de esta semana.' },
        { tipo: 'Positivo', titulo: 'Apoyo a sus compañeros', descripcion: 'Ayudó a dos compañeros a resolver los ejercicios de fracciones durante la clase.' },
        { tipo: 'Grave', titulo: 'Falta de respeto en clase', descripcion: 'Respondió de forma irrespetuosa al catedrático frente al grupo después de un llamado de atención.' },
        { tipo: 'Leve', titulo: 'No entregó tarea', descripcion: 'No presentó la tarea asignada para esta semana y no trajo justificación.' },
        { tipo: 'Positivo', titulo: 'Participación destacada', descripcion: 'Participó activamente y expuso con mucha claridad su proyecto.' },
        { tipo: 'Leve', titulo: 'Uso de celular en clase', descripcion: 'Se le llamó la atención por usar el celular durante la explicación.' },
        { tipo: 'Grave', titulo: 'Pelea en el recreo', descripcion: 'Participó en una pelea con otro alumno durante el recreo. Se requiere reunión con el encargado.' },
        { tipo: 'Positivo', titulo: 'Liderazgo en trabajo grupal', descripcion: 'Organizó a su grupo y lograron entregar el mejor trabajo de la sección.' },
        { tipo: 'Leve', titulo: 'Uniforme incompleto', descripcion: 'Se presentó sin el uniforme completo dos días seguidos.' },
        { tipo: 'Positivo', titulo: 'Mejora notable en notas', descripcion: 'Ha mejorado considerablemente su rendimiento en la unidad.' },
        { tipo: 'Grave', titulo: 'Copia en examen', descripcion: 'Fue sorprendido copiando durante la evaluación parcial.' },
        { tipo: 'Leve', titulo: 'Interrupciones constantes', descripcion: 'Interrumpe constantemente la clase conversando con sus compañeros.' },
    ];
    const cursosSeccionConCatedratico = await prisma.cursoSeccion.findMany({ select: { seccionId: true, catedraticoId: true } });
    for (const [idx, r] of REPORTES_CONDUCTA.entries()) {
        // Los 3 primeros conservan los alumnos de seeds anteriores (alumno1, alumno1, alumno2)
        const alumno = alumnosSeed[idx < 2 ? 0 : idx === 2 ? 1 : (idx * 5) % alumnosSeed.length];
        if (!alumno?.alumno) continue;
        const existente = await prisma.reporteConducta.findFirst({ where: { alumnoId: alumno.usuarioId, titulo: r.titulo } });
        if (existente) continue;
        const autorId =
            cursosSeccionConCatedratico.find((cs) => cs.seccionId === alumno.alumno!.seccionId)?.catedraticoId ?? catedraticos[0].catedraticoId;
        const revisado = idx % 3 === 1;
        await prisma.reporteConducta.create({
            data: {
                alumnoId: alumno.usuarioId,
                autorId,
                tipo: r.tipo,
                titulo: r.titulo,
                descripcion: r.descripcion,
                fecha: new Date(Date.now() - idx * 2 * 24 * 60 * 60 * 1000),
                revisado,
                fechaRevision: revisado ? new Date(Date.now() - idx * 24 * 60 * 60 * 1000) : null,
                comentarioEncargado: revisado ? 'Enterado, hablaremos con él en casa. Gracias por avisar.' : null,
            },
        });
    }

    const NOTIFICACIONES = [
        { tipo: 'Conducta', titulo: 'Nuevo reporte de conducta', mensaje: 'Se registró un reporte de conducta de Alumno1 Prueba. Revíselo en el portal.' },
        { tipo: 'Notas', titulo: 'Notas de Matemática disponibles', mensaje: 'Ya están disponibles las notas de la Unidad 1 de Matemática.' },
        { tipo: 'Aviso', titulo: 'Reunión de padres de familia', mensaje: 'Se convoca a reunión de padres el viernes a las 16:00 horas en el salón de actos.' },
        { tipo: 'Notas', titulo: 'Notas de Comunicación y Lenguaje disponibles', mensaje: 'Ya están disponibles las notas de la Unidad 3 de Comunicación y Lenguaje.' },
        { tipo: 'Evento', titulo: 'Recordatorio: Día de la Independencia', mensaje: 'El 15 de septiembre no hay clases. Los alumnos participan en el desfile.' },
        { tipo: 'Aviso', titulo: 'Pago de colegiatura pendiente', mensaje: 'Le recordamos que tiene una colegiatura pendiente de pago.' },
    ];
    const encargadosSeed = await prisma.usuario.findMany({
        where: { email: { startsWith: 'encargado' }, encargado: { isNot: null } },
        orderBy: { usuarioId: 'asc' },
        take: 12,
    });
    const notificacionesAntes = await prisma.notificacion.count();
    for (const [e, encargado] of encargadosSeed.entries()) {
        // encargado1 recibe todas; el resto recibe 2 rotando
        const lista = e === 0 ? NOTIFICACIONES : [NOTIFICACIONES[e % NOTIFICACIONES.length], NOTIFICACIONES[(e + 2) % NOTIFICACIONES.length]];
        for (const [n, notif] of lista.entries()) {
            const existente = await prisma.notificacion.findFirst({ where: { usuarioId: encargado.usuarioId, titulo: notif.titulo } });
            if (existente) continue;
            await prisma.notificacion.create({
                data: {
                    usuarioId: encargado.usuarioId,
                    ...notif,
                    fechaEnvio: new Date(Date.now() - (n + e) * 12 * 60 * 60 * 1000),
                    leida: (n + e) % 3 === 0,
                },
            });
        }
    }
    console.log(`Notificaciones creadas: ${(await prisma.notificacion.count()) - notificacionesAntes}`);

    const adminsSede = await prisma.usuario.findMany({
        where: { email: { startsWith: 'admin.sede' } },
        orderBy: { usuarioId: 'asc' },
    });
    const adminGeneral1 = await prisma.usuario.findUnique({ where: { email: 'admin.general1@dercas.edu.gt' } });
    const COMUNICADOS = [
        { tipo: 'Aviso', titulo: 'Inicio de la cuarta unidad', mensaje: 'Se informa a los padres de familia que la cuarta unidad inicia el lunes 5 de octubre.', destinatarios: 'Padres y encargados' },
        { tipo: 'Asueto', titulo: 'Asueto 15 de septiembre', mensaje: 'Por conmemorarse el Día de la Independencia no habrá clases el 15 de septiembre.', destinatarios: 'Toda la comunidad educativa' },
        { tipo: 'Actividad', titulo: 'Olimpiadas deportivas', mensaje: 'Los alumnos deben presentarse con uniforme de educación física el viernes 21 de agosto.', destinatarios: 'Padres y encargados' },
        { tipo: 'Sancion', titulo: 'Recordatorio de reglamento de uniforme', mensaje: 'A partir de la próxima semana se sancionará a los alumnos que no porten el uniforme completo.', destinatarios: 'Alumnos' },
        { tipo: 'Aviso', titulo: 'Entrega de notas de tercera unidad', mensaje: 'La entrega de notas será en la reunión de padres. La asistencia es obligatoria.', destinatarios: 'Padres y encargados' },
        { tipo: 'Actividad', titulo: 'Feria científica', mensaje: 'Invitamos a las familias a la feria científica de la sede. Habrá exposición de proyectos.', destinatarios: 'Toda la comunidad educativa' },
        { tipo: 'Asueto', titulo: 'Asueto 20 de octubre', mensaje: 'Por el Día de la Revolución no habrá clases el 20 de octubre.', destinatarios: 'Toda la comunidad educativa' },
        { tipo: 'Aviso', titulo: 'Pago de colegiatura', mensaje: 'Recordamos que la colegiatura debe pagarse antes del día 10 de cada mes.', destinatarios: 'Padres y encargados' },
        { tipo: 'Sancion', titulo: 'Uso de celulares', mensaje: 'Los celulares que se usen en clase serán decomisados y entregados solo a los encargados.', destinatarios: 'Alumnos' },
        { tipo: 'Actividad', titulo: 'Kermés escolar', mensaje: 'Los esperamos en la kermés escolar. Lo recaudado será para mejoras de la biblioteca.', destinatarios: 'Padres y encargados' },
        { tipo: 'Aviso', titulo: 'Clausura del ciclo escolar', mensaje: 'La clausura será el 30 de octubre a las 9:00 horas.', destinatarios: 'Toda la comunidad educativa' },
    ];
    let comunicadosCreados = 0;
    for (const [idx, c] of COMUNICADOS.entries()) {
        if (await prisma.comunicado.findFirst({ where: { titulo: c.titulo } })) continue;
        // Algunos los envía la administración general (sin sede), el resto los admins de sede
        const autor = idx % 4 === 1 && adminGeneral1 ? adminGeneral1 : adminsSede[idx % adminsSede.length];
        if (!autor) continue;
        await prisma.comunicado.create({
            data: {
                sedeId: autor.sedeId,
                autorId: autor.usuarioId,
                tipo: c.tipo,
                titulo: c.titulo,
                mensaje: c.mensaje,
                destinatarios: c.destinatarios,
                totalDestinatarios: autor.sedeId ? Math.ceil(TOTAL_ENCARGADOS / SEDES_CON_ALUMNOS) : TOTAL_ENCARGADOS,
                fechaEnvio: new Date(Date.now() - idx * 4 * 24 * 60 * 60 * 1000),
            },
        });
        comunicadosCreados++;
    }
    console.log(`Conducta, notificaciones y comunicados listos (comunicados nuevos: ${comunicadosCreados})`);

    console.log(`Seed completado. Contraseña de prueba para todos los usuarios: ${DEFAULT_PASSWORD}`);
}

main()
    .catch((error) => {
        console.error('Error al ejecutar el seed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
