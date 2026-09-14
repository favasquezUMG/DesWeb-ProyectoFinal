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
