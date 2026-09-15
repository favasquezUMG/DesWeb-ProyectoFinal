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
];

const GRADOS = [
    { nombre: 'Primero Primaria', nivel: 'Primaria', orden: 1 },
    { nombre: 'Segundo Primaria', nivel: 'Primaria', orden: 2 },
    { nombre: 'Tercero Primaria', nivel: 'Primaria', orden: 3 },
    { nombre: 'Cuarto Primaria', nivel: 'Primaria', orden: 4 },
    { nombre: 'Quinto Primaria', nivel: 'Primaria', orden: 5 },
    { nombre: 'Sexto Primaria', nivel: 'Primaria', orden: 6 },
];

const ANIO_LECTIVO = 2026;
const DEFAULT_PASSWORD = 'Password123!';
const USUARIOS_POR_ROL = 10;

const ESPECIALIDADES = ['Matemática', 'Comunicación y Lenguaje', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Física'];
const PARENTESCOS = ['Madre', 'Padre', 'Tutor Legal'];

// Sede y Grado no tienen un campo @unique en el schema, así que no admiten
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

    // 5. Usuarios (10 por rol), con contraseña hasheada compartida para pruebas
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

    // Administrador de Sede: repartidos entre las sedes
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const sede = sedes[(i - 1) % sedes.length];
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
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const sede = sedes[(i - 1) % sedes.length];
        const email = `catedratico${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres: `Catedratico${i}`,
                apellidos: 'Prueba',
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

    // Encargados: usuario base + registro de extensión Encargado
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const email = `encargado${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres: `Encargado${i}`,
                apellidos: 'Prueba',
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
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const seccion = secciones[(i - 1) % secciones.length];
        const email = `alumno${i}@dercas.edu.gt`;
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres: `Alumno${i}`,
                apellidos: 'Prueba',
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
                fechaNacimiento: new Date(2015, 0, ((i - 1) % 28) + 1),
                seccionId: seccion.seccionId,
            },
        });
    }

    // 6. Cursos-Sección: si faltan, se crean a partir de la malla curricular de cada sección
    const catedraticos = await prisma.catedratico.findMany({ include: { usuario: true } });
    const catedraticosPorSede = new Map<number, typeof catedraticos>();
    for (const cat of catedraticos) {
        if (cat.usuario.sedeId == null) continue;
        const lista = catedraticosPorSede.get(cat.usuario.sedeId) ?? [];
        lista.push(cat);
        catedraticosPorSede.set(cat.usuario.sedeId, lista);
    }

    const cursoSeccionAntes = await prisma.cursoSeccion.count();
    for (const seccion of secciones) {
        const malla = await prisma.mallaCurricular.findMany({ where: { gradoId: seccion.gradoId } });
        const catedraticosSede = catedraticosPorSede.get(seccion.sedeId) ?? [];
        if (!catedraticosSede.length) continue;

        for (let i = 0; i < malla.length; i++) {
            const catedratico = catedraticosSede[i % catedraticosSede.length];
            await prisma.cursoSeccion.upsert({
                where: { cursoId_seccionId: { cursoId: malla[i].cursoId, seccionId: seccion.seccionId } },
                update: {},
                create: {
                    cursoId: malla[i].cursoId,
                    seccionId: seccion.seccionId,
                    catedraticoId: catedratico.catedraticoId,
                },
            });
        }
    }
    const cursosSeccionCreados = (await prisma.cursoSeccion.count()) - cursoSeccionAntes;
    console.log(`Cursos-sección creados: ${cursosSeccionCreados}`);

    const todasCursoSeccion = await prisma.cursoSeccion.findMany({
        select: { cursoSeccionId: true, seccionId: true },
        orderBy: { cursoSeccionId: 'asc' },
    });

    // 7. Unidades: 4 por curso-sección (numero 1 a 4)
    const unidadesAntes = await prisma.unidad.count();
    for (const cs of todasCursoSeccion) {
        for (let numero = 1; numero <= 4; numero++) {
            await prisma.unidad.upsert({
                where: { cursoSeccionId_numero: { cursoSeccionId: cs.cursoSeccionId, numero } },
                update: {},
                create: { cursoSeccionId: cs.cursoSeccionId, numero },
            });
        }
    }
    const unidadesCreadas = (await prisma.unidad.count()) - unidadesAntes;
    console.log(`Unidades creadas: ${unidadesCreadas}`);

    // 8. Actividades: 3 por unidad, puntosMaximos 10 + 10 + 5 = 25 (las 4 unidades suman 100)
    // Actividad no tiene @@unique, así que se sigue el mismo patrón de findOrCreate que Sede/Grado
    const ACTIVIDADES_UNIDAD = [
        { nombre: 'Actividad 1', puntosMaximos: 10 },
        { nombre: 'Actividad 2', puntosMaximos: 10 },
        { nombre: 'Actividad 3', puntosMaximos: 5 },
    ];
    // Mes de referencia de cada unidad dentro del ciclo escolar (0 = enero)
    const MES_POR_UNIDAD = [1, 3, 6, 9];

    const unidades = await prisma.unidad.findMany({
        select: { unidadId: true, numero: true, cursoSeccionId: true },
        orderBy: { unidadId: 'asc' },
    });

    let actividadesCreadas = 0;
    for (const unidad of unidades) {
        for (let idx = 0; idx < ACTIVIDADES_UNIDAD.length; idx++) {
            const { nombre, puntosMaximos } = ACTIVIDADES_UNIDAD[idx];
            const existente = await prisma.actividad.findFirst({ where: { unidadId: unidad.unidadId, nombre } });
            if (existente) continue;

            const fecha = new Date(ANIO_LECTIVO, MES_POR_UNIDAD[unidad.numero - 1], 10 + idx * 7);

            await prisma.actividad.create({
                data: { unidadId: unidad.unidadId, nombre, puntosMaximos, fecha },
            });
            actividadesCreadas++;
        }
    }
    console.log(`Actividades creadas: ${actividadesCreadas}`);

    // 9. Notas: distribución controlada (no aleatoria) para que ~30% de los alumnos
    // termine con promedio por debajo de 61 y el resto por encima. El "desempeño" de
    // cada alumno es fijo según su posición global y se reparte proporcionalmente
    // entre las actividades de cada unidad, para que el total de cada curso
    // (4 unidades x 25 puntos = 100) quede cerca de ese porcentaje.
    const alumnosOrdenados = await prisma.alumno.findMany({ orderBy: { alumnoId: 'asc' } });
    const desempenoPorAlumno = new Map<number, number>();
    alumnosOrdenados.forEach((alumno, indice) => {
        const esBajo = indice % 10 < 3; // 3 de cada 10 alumnos => ~30%
        const desempeno = esBajo
            ? 35 + (indice % 4) * 6 // banda reprobada: 35, 41, 47, 53
            : 65 + (indice % 5) * 6; // banda aprobada: 65, 71, 77, 83, 89
        desempenoPorAlumno.set(alumno.alumnoId, desempeno);
    });

    const unidadesConActividades = await prisma.unidad.findMany({
        select: {
            unidadId: true,
            cursoSeccion: { select: { seccionId: true } },
            actividades: { orderBy: { actividadId: 'asc' } },
        },
        orderBy: { unidadId: 'asc' },
    });

    const notasAntes = await prisma.nota.count();
    for (const unidad of unidadesConActividades) {
        const puntosUnidad = unidad.actividades.reduce((suma, a) => suma + Number(a.puntosMaximos), 0);
        const alumnosSeccion = await prisma.alumno.findMany({
            where: { seccionId: unidad.cursoSeccion.seccionId },
            orderBy: { alumnoId: 'asc' },
        });

        for (const alumno of alumnosSeccion) {
            const desempeno = desempenoPorAlumno.get(alumno.alumnoId) ?? 70;
            let restante = Math.round((puntosUnidad * desempeno) / 100);

            for (let i = 0; i < unidad.actividades.length; i++) {
                const actividad = unidad.actividades[i];
                const esUltima = i === unidad.actividades.length - 1;
                const maximo = Number(actividad.puntosMaximos);

                const valor = esUltima
                    ? Math.max(0, Math.min(restante, maximo))
                    : Math.max(0, Math.min(Math.round((maximo * desempeno) / 100), maximo, restante));
                restante -= valor;

                await prisma.nota.upsert({
                    where: { actividadId_alumnoId: { actividadId: actividad.actividadId, alumnoId: alumno.alumnoId } },
                    update: { valor },
                    create: { actividadId: actividad.actividadId, alumnoId: alumno.alumnoId, valor },
                });
            }
        }
    }
    const notasCreadas = (await prisma.nota.count()) - notasAntes;
    console.log(`Notas registradas: ${notasCreadas}`);

    // 10. Asistencia: últimas 2 semanas (solo días hábiles), con mayoría de presentes
    const ESTADOS_ASISTENCIA = [
        'Presente', 'Presente', 'Presente', 'Presente', 'Presente', 'Presente', 'Presente',
        'Tarde', 'Ausente', 'Justificado',
    ];

    const diasHabiles: Date[] = [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    for (let offset = 0; offset < 14; offset++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() - offset);
        const diaSemana = fecha.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) diasHabiles.push(fecha);
    }

    const asistenciasAntes = await prisma.asistencia.count();
    let contadorEstado = 0;
    for (const cs of todasCursoSeccion) {
        const alumnosSeccion = await prisma.alumno.findMany({
            where: { seccionId: cs.seccionId },
            orderBy: { alumnoId: 'asc' },
        });

        for (const alumno of alumnosSeccion) {
            for (const fecha of diasHabiles) {
                const estado = ESTADOS_ASISTENCIA[(alumno.alumnoId + fecha.getDate() + contadorEstado) % ESTADOS_ASISTENCIA.length];
                contadorEstado++;

                await prisma.asistencia.upsert({
                    where: {
                        cursoSeccionId_alumnoId_fecha: {
                            cursoSeccionId: cs.cursoSeccionId,
                            alumnoId: alumno.alumnoId,
                            fecha,
                        },
                    },
                    update: { estado },
                    create: { cursoSeccionId: cs.cursoSeccionId, alumnoId: alumno.alumnoId, fecha, estado },
                });
            }
        }
    }
    const asistenciasCreadas = (await prisma.asistencia.count()) - asistenciasAntes;
    console.log(`Asistencias registradas: ${asistenciasCreadas}`);

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
