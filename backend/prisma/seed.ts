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

const SEDES: { nombre: string; direccion: string; telefono: string | null }[] = [
    { nombre: 'Sede Central', direccion: 'Zona 1, Ciudad de Guatemala', telefono: '52000983' },
    { nombre: 'Sede Antigua', direccion: 'Antigua Guatemala, Sacatepéquez', telefono: null },
    { nombre: 'Sede Petén', direccion: 'Flores, Petén', telefono: null },
];

// Todas las sedes reciben alumnos, pero solo algunos grados, para que el volumen de datos
// académicos se mantenga manejable. El resto queda con secciones vacías.
const SEDES_CON_ALUMNOS = 3;
// Cada sede tiene su propio perfil para que el dashboard y las gráficas se distingan:
// peso = proporción de alumnos, ajuste = puntos que suma o resta al desempeño de sus alumnos,
// morososCada = 1 de cada N alumnos debe colegiaturas
const PERFIL_SEDE = [
    { peso: 3, ajuste: 0, morososCada: 5 },
    { peso: 2, ajuste: 6, morososCada: 8 },
    { peso: 2, ajuste: -7, morososCada: 3 },
];
// Grados (índice en GRADOS) que reciben alumnos: mezcla de Primaria, Básico y Diversificado
// para probar el acceso al portal (Primaria no entra por defecto; Básico y Diversificado sí)
const GRADOS_CON_ALUMNOS = [0, 2, 4, 6, 7, 9];

const GRADOS = [
    { nombre: 'Primero Primaria', nivel: 'Primaria', orden: 4 },
    { nombre: 'Segundo Primaria', nivel: 'Primaria', orden: 5 },
    { nombre: 'Tercero Primaria', nivel: 'Primaria', orden: 6 },
    { nombre: 'Cuarto Primaria', nivel: 'Primaria', orden: 7 },
    { nombre: 'Quinto Primaria', nivel: 'Primaria', orden: 8 },
    { nombre: 'Sexto Primaria', nivel: 'Primaria', orden: 9 },
    { nombre: 'Primero Básico', nivel: 'Básico', orden: 10 },
    { nombre: 'Segundo Básico', nivel: 'Básico', orden: 11 },
    { nombre: 'Tercero Básico', nivel: 'Básico', orden: 12 },
    { nombre: 'Cuarto Bachillerato', nivel: 'Diversificado', orden: 13 },
    // Preprimaria va al final de la lista (el orden lo da "orden") para no mover los índices
    // que usan GRADOS_CON_ALUMNOS y la rotación de cursos de la malla
    { nombre: 'Párvulos 1', nivel: 'Preprimaria', orden: 1 },
    { nombre: 'Párvulos 2', nivel: 'Preprimaria', orden: 2 },
    { nombre: 'Párvulos 3', nivel: 'Preprimaria', orden: 3 },
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

// Áreas del CNB de Preprimaria (las que no están en CURSOS se crean aparte)
const CURSOS_PREPRIMARIA = [
    { nombre: 'Destrezas de Aprendizaje', descripcion: 'Área del CNB de Preprimaria' },
    { nombre: 'Comunicación y Lenguaje', descripcion: 'Curso base del CNB' },
    { nombre: 'Medio Social y Natural', descripcion: 'Área del CNB de Preprimaria' },
    { nombre: 'Expresión Artística', descripcion: 'Música, artes plásticas y teatro' },
    { nombre: 'Educación Física', descripcion: 'Desarrollo motriz y deporte' },
];
// Cada grado lleva los 3 cursos base + 3 cursos que rotan según el grado
const CURSOS_POR_GRADO = 6;

const ANIO_LECTIVO = 2026;
const DEFAULT_PASSWORD = '12345678';
const DOMINIO_CORREO = 'vanguardia.edu.gt';
const USUARIOS_POR_ROL = 10;
const TOTAL_CATEDRATICOS = 30;
const TOTAL_ENCARGADOS = 90;
const TOTAL_ALUMNOS = 150;

const ESPECIALIDADES = ['Matemática', 'Comunicación y Lenguaje', 'Ciencias Naturales', 'Ciencias Sociales', 'Educación Física'];
const PARENTESCOS = ['Madre', 'Padre', 'Tutor Legal'];

const NOMBRES_HOMBRE = [
    'José', 'Juan', 'Luis', 'Carlos', 'Jorge', 'Mario', 'Pedro', 'Manuel', 'Francisco', 'Miguel', 'Ángel', 'Antonio',
    'Fernando', 'Ricardo', 'Roberto', 'Sergio', 'Óscar', 'Edgar', 'Erick', 'Byron', 'Marvin', 'Walter', 'Otto', 'Rodrigo',
    'Diego', 'Andrés', 'Javier', 'Daniel', 'David', 'Pablo', 'Alejandro', 'Sebastián', 'Mateo', 'Santiago', 'Emilio',
    'Gabriel', 'Rafael', 'Raúl', 'Hugo', 'Julio', 'César', 'Estuardo', 'Esteban', 'Gustavo', 'Héctor', 'Iván', 'Kevin',
    'Brandon', 'Bryan', 'Cristian', 'Josué', 'Samuel', 'Isaac', 'Elías', 'Rubén', 'Rolando', 'Gerardo', 'Alfredo',
    'Armando', 'Arturo', 'Eduardo', 'Enrique', 'Felipe', 'Ernesto', 'Leonel', 'Mynor', 'Wilson', 'Henry', 'Alexander',
    'Tomás', 'Joaquín', 'Nicolás', 'Adrián', 'Fabián', 'Marco', 'Abner', 'Otoniel', 'Selvin', 'Elmer', 'Rudy',
];
const NOMBRES_MUJER = [
    'María', 'Ana', 'Lucía', 'Sofía', 'Valeria', 'Camila', 'Isabella', 'Gabriela', 'Daniela', 'Mariana', 'Fernanda',
    'Andrea', 'Paola', 'Alejandra', 'Carolina', 'Claudia', 'Patricia', 'Rosa', 'Carmen', 'Gloria', 'Silvia', 'Mónica',
    'Verónica', 'Karla', 'Lourdes', 'Ingrid', 'Brenda', 'Sandra', 'Wendy', 'Heidy', 'Evelyn', 'Jessica', 'Marisol',
    'Leticia', 'Beatriz', 'Elena', 'Julia', 'Natalia', 'Regina', 'Ximena', 'Renata', 'Victoria', 'Valentina', 'Paula',
    'Abigail', 'Emily', 'Allison', 'Dulce', 'Esther', 'Raquel', 'Rebeca', 'Sara', 'Débora', 'Noemí', 'Olga', 'Irma',
    'Marta', 'Elisa', 'Josefina', 'Cristina', 'Lorena', 'Mayra', 'Yesenia', 'Astrid', 'Lesly', 'Nancy', 'Julissa',
    'Ruth', 'Miriam', 'Alba', 'Teresa', 'Inés', 'Luisa', 'Adriana', 'Melissa', 'Fátima', 'Guadalupe', 'Estefanía',
];
const APELLIDOS = [
    'García', 'López', 'Hernández', 'Pérez', 'Morales', 'Castillo', 'Rodríguez', 'Méndez', 'Ramírez', 'Juárez',
    'Cifuentes', 'Orellana', 'Fuentes', 'Estrada', 'Barrios', 'Monterroso', 'Aguilar', 'Velásquez', 'Solís', 'González',
    'Martínez', 'Gómez', 'Díaz', 'Reyes', 'Cruz', 'Ortiz', 'Ramos', 'Flores', 'Chávez', 'Mejía', 'Sánchez', 'Rivera',
    'Vásquez', 'Castro', 'Herrera', 'Medina', 'Alvarado', 'Guzmán', 'Mazariegos', 'Ajú', 'Tzul', 'Xicará', 'Cuxil',
    'Chamalé', 'Coyoy', 'Boror', 'Sical', 'Choc', 'Caal', 'Pop', 'Tun', 'Ixcot', 'Batz', 'Quiñónez', 'Recinos',
    'Arévalo', 'Paredes', 'Samayoa', 'Sandoval', 'Carrillo', 'Contreras', 'Del Cid', 'De León', 'Girón', 'Lemus',
    'Marroquín', 'Monzón', 'Najarro', 'Ordóñez', 'Palacios', 'Pineda', 'Portillo', 'Salazar', 'Santizo', 'Soto',
    'Toledo', 'Urízar', 'Valdez', 'Villatoro', 'Zamora', 'Zepeda', 'Escobar', 'Figueroa', 'Galindo', 'Godoy', 'Lima',
    'Lucero', 'Maldonado', 'Montenegro', 'Muñoz', 'Nájera', 'Ochoa', 'Polanco', 'Rosales', 'Rivas', 'Sagastume',
    'Tobar', 'Barrera', 'Cabrera', 'Coronado', 'Dardón', 'Echeverría', 'Franco', 'Gálvez', 'Hidalgo', 'Jerez',
    'Linares', 'Mendoza', 'Navas', 'Oliva', 'Pacheco',
];

// Generador pseudoaleatorio con semilla fija (mulberry32): cada ejecución produce las mismas personas
let semillaAzar = 2026;
function azar() {
    semillaAzar = (semillaAzar + 0x6d2b79f5) | 0;
    let t = Math.imul(semillaAzar ^ (semillaAzar >>> 15), 1 | semillaAzar);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Saca elementos de la lista barajada y solo vuelve a barajar cuando se agota,
// así los nombres y apellidos se repiten lo menos posible
function baraja<T>(lista: readonly T[]) {
    let pila: T[] = [];
    return () => {
        if (pila.length === 0) {
            pila = [...lista];
            for (let i = pila.length - 1; i > 0; i--) {
                const j = Math.floor(azar() * (i + 1));
                [pila[i], pila[j]] = [pila[j], pila[i]];
            }
        }
        return pila.pop()!;
    };
}

type Genero = 'H' | 'M';
interface Persona { nombres: string; apellido1: string; apellido2: string; apellidos: string; email: string; genero: Genero }

const siguienteNombre = { H: baraja(NOMBRES_HOMBRE), M: baraja(NOMBRES_MUJER) };
const siguienteApellido = baraja(APELLIDOS);
const correosUsados = new Set<string>();
const nombresUsados = new Set<string>();
const paraCorreo = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

// Correo nombre.apellido@dominio; si ya existe se agrega el segundo apellido y luego un número
function correoPara(nombres: string, apellido1: string, apellido2: string) {
    const nombre = paraCorreo(nombres.split(' ')[0]);
    const base = `${nombre}.${paraCorreo(apellido1)}`;
    let usuario = [base, `${base}.${paraCorreo(apellido2)}`].find((c) => !correosUsados.has(c));
    for (let n = 2; !usuario; n++) {
        if (!correosUsados.has(`${base}${n}`)) usuario = `${base}${n}`;
    }
    correosUsados.add(usuario);
    return `${usuario}@${DOMINIO_CORREO}`;
}

function nuevaPersona(opciones: { genero?: Genero; apellido1?: string; apellido2?: string; probCompuesto?: number } = {}): Persona {
    const genero = opciones.genero ?? (azar() < 0.5 ? 'H' : 'M');
    for (;;) {
        const primero = siguienteNombre[genero]();
        let nombres = primero;
        if (azar() < (opciones.probCompuesto ?? 0.4)) {
            let segundo = siguienteNombre[genero]();
            while (segundo === primero) segundo = siguienteNombre[genero]();
            nombres = `${primero} ${segundo}`;
        }
        const apellido1 = opciones.apellido1 ?? siguienteApellido();
        let apellido2 = opciones.apellido2 ?? siguienteApellido();
        while (apellido2 === apellido1) apellido2 = siguienteApellido();
        const apellidos = `${apellido1} ${apellido2}`;
        if (nombresUsados.has(`${nombres} ${apellidos}`)) continue;
        nombresUsados.add(`${nombres} ${apellidos}`);
        return { nombres, apellido1, apellido2, apellidos, email: correoPara(nombres, apellido1, apellido2), genero };
    }
}

// Vínculo alumno-encargado. Los primeros 10 alumnos tienen al encargado del mismo número;
// del 11 en adelante se reparten entre los encargados, así varios encargados tienen 2 hijos.
const encargadoPrincipalDe = (i: number) => (i <= USUARIOS_POR_ROL ? i : ((i - 1) % TOTAL_ENCARGADOS) + 1);

// Todas las personas del seed se generan de antemano (índice 0 = número 1) para que los
// hijos lleven el apellido de su padre o madre y los hermanos compartan apellidos
function generarPersonas() {
    const lista = (total: number, crear: (i: number) => Persona) => Array.from({ length: total }, (_, k) => crear(k + 1));
    const adminsGenerales = lista(USUARIOS_POR_ROL, () => nuevaPersona());
    const adminsSede = lista(USUARIOS_POR_ROL, () => nuevaPersona());
    // catedratico1 es también madre de alumno8 (ver sembrarCasosDeEncargados)
    const catedraticos = lista(TOTAL_CATEDRATICOS, (i) => nuevaPersona({ genero: i === 1 ? 'M' : undefined }));
    const encargados = lista(TOTAL_ENCARGADOS, (i) => {
        const parentesco = PARENTESCOS[(i - 1) % PARENTESCOS.length];
        // encargado3 pasa a ser la madre de alumno3 en el caso de padres divorciados
        const genero = parentesco === 'Madre' || i === 3 ? 'M' : parentesco === 'Padre' ? 'H' : undefined;
        return nuevaPersona({ genero });
    });

    const apellidosDeHijos = new Map<number, { apellido1?: string; apellido2?: string }>();
    const alumnos = lista(TOTAL_ALUMNOS, (i) => {
        const e = encargadoPrincipalDe(i);
        const encargado = encargados[e - 1];
        const parentesco = PARENTESCOS[(e - 1) % PARENTESCOS.length];
        if (!apellidosDeHijos.has(e)) {
            apellidosDeHijos.set(e, parentesco === 'Padre'
                ? { apellido1: encargado.apellido1 }
                : parentesco === 'Madre' || e === 3
                    ? { apellido1: siguienteApellido(), apellido2: encargado.apellido1 }
                    : {});
        }
        const apellidos = i === 8 ? { apellido1: apellidosDeHijos.get(e)!.apellido1, apellido2: catedraticos[0].apellido1 } : apellidosDeHijos.get(e)!;
        const persona = nuevaPersona({ ...apellidos, probCompuesto: 0.55 });
        // Hermanos: comparten ambos apellidos con el primer hijo del mismo encargado
        apellidosDeHijos.set(e, { apellido1: persona.apellido1, apellido2: persona.apellido2 });
        return persona;
    });

    return {
        adminsGenerales,
        adminsSede,
        catedraticos,
        encargados,
        alumnos,
        secretaria: nuevaPersona({ genero: 'M' }),
        padreAlumno3: nuevaPersona({ genero: 'H', apellido1: alumnos[2].apellido1 }),
        padreAlumno6: nuevaPersona({ genero: 'H', apellido1: alumnos[5].apellido1 }),
        abuelaAlumno7: nuevaPersona({ genero: 'M', probCompuesto: 0.2 }),
    };
}
type Personas = ReturnType<typeof generarPersonas>;

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

async function findOrCreateCurso(data: { nombre: string; descripcion: string }) {
    const existente = await prisma.curso.findFirst({ where: { nombre: data.nombre } });
    if (existente) return existente;
    return prisma.curso.create({ data });
}

async function main() {
    console.log('Sembrando datos de prueba...');

    // 1. Roles de sistema (no se renombran ni eliminan) y roles del personal creados por el colegio
    const DESCRIPCION_ROL: Record<string, string> = {
        'Administrador General': 'Administra toda la red de sedes, los roles y los permisos.',
        'Administrador de Sede': 'Dirige una sede; su acceso se define en la matriz de permisos.',
        'Catedratico': 'Ve y califica los cursos que tiene asignados.',
        'Alumno': 'Consulta sus notas, horario y avisos.',
        'Encargado': 'Padre, madre o tutor: ve la información de los alumnos a su cargo según su vínculo.',
    };
    const roles = new Map<string, number>();
    for (const nombre of ROLES) {
        const rol = await prisma.rol.upsert({
            where: { nombre },
            update: { esSistema: true },
            create: { nombre, esSistema: true, descripcion: DESCRIPCION_ROL[nombre] },
        });
        roles.set(nombre, rol.rolId);
    }

    const MODULOS = ['usuarios', 'alumnos', 'matriculas', 'horarios', 'notas', 'asistencia', 'conducta', 'becas', 'pagos', 'comunicados', 'calendario', 'reportes'];
    const ROLES_PERSONAL = [
        { nombre: 'Administrador de Sede', permisos: MODULOS },
        { nombre: 'Secretaría', descripcion: 'Atención a padres: alumnos, encargados, matrículas y avisos.', permisos: ['alumnos', 'matriculas', 'comunicados', 'calendario', 'conducta'] },
    ];
    for (const r of ROLES_PERSONAL) {
        const rol = await prisma.rol.upsert({
            where: { nombre: r.nombre },
            update: {},
            create: { nombre: r.nombre, descripcion: r.descripcion ?? null },
        });
        roles.set(r.nombre, rol.rolId);
        // Solo se siembran los permisos si el rol aún no tiene (no se pisan cambios hechos en la matriz)
        if ((await prisma.permiso.count({ where: { rolId: rol.rolId } })) === 0) {
            await prisma.permiso.createMany({ data: r.permisos.map((modulo) => ({ rolId: rol.rolId, modulo })) });
        }
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
    const cursosPreprimaria = [];
    for (const data of CURSOS_PREPRIMARIA) {
        cursosPreprimaria.push(await findOrCreateCurso(data));
    }
    const mallaData = grados.flatMap((grado, g) => {
        if (grado.nivel === 'Preprimaria') {
            return cursosPreprimaria.map((curso) => ({ gradoId: grado.gradoId, cursoId: curso.cursoId }));
        }
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
        return iSede < SEDES_CON_ALUMNOS && GRADOS_CON_ALUMNOS.includes(iGrado);
    });
    const sedesConAlumnos = sedes.slice(0, SEDES_CON_ALUMNOS);
    const indiceSede = (sedeId: number) => sedes.findIndex((s) => s.sedeId === sedeId);

    // Sede de cada alumno según el peso de la sede; los hermanos (alumnos que comparten
    // encargado principal) estudian en la misma sede que el hermano mayor
    const turnosSede = PERFIL_SEDE.slice(0, SEDES_CON_ALUMNOS).flatMap((p, s) => Array<number>(p.peso).fill(s));
    const sedeDeAlumno: number[] = [];
    for (let i = 1; i <= TOTAL_ALUMNOS; i++) {
        sedeDeAlumno[i] = i > TOTAL_ENCARGADOS ? sedeDeAlumno[encargadoPrincipalDe(i)] : turnosSede[(i - 1) % turnosSede.length];
    }
    // Dentro de cada sede los alumnos se reparten entre sus secciones por turnos
    const turnoSeccion = new Map<number, number>();
    const seccionDeAlumno = (i: number) => {
        const sede = sedesConAlumnos[sedeDeAlumno[i]];
        const delaSede = seccionesConAlumnos.filter((s) => s.sedeId === sede.sedeId);
        const turno = turnoSeccion.get(sede.sedeId) ?? 0;
        turnoSeccion.set(sede.sedeId, turno + 1);
        return delaSede[turno % delaSede.length];
    };

    // 5. Usuarios, con contraseña hasheada compartida para pruebas
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    const personas = generarPersonas();

    // Administrador General: sin sede fija, supervisa toda la red
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const { nombres, apellidos, email } = personas.adminsGenerales[i - 1];
        await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres,
                apellidos,
                email,
                passwordHash,
                rolId: roles.get('Administrador General')!,
                sedeId: null,
            },
        });
    }

    // Administrador de Sede: repartidos entre las sedes con alumnos
    for (let i = 1; i <= USUARIOS_POR_ROL; i++) {
        const sede = sedesConAlumnos[(i - 1) % sedesConAlumnos.length];
        const { nombres, apellidos, email } = personas.adminsSede[i - 1];
        await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres,
                apellidos,
                email,
                passwordHash,
                rolId: roles.get('Administrador de Sede')!,
                sedeId: sede.sedeId,
            },
        });
    }

    // Catedraticos: usuario base + registro de extensión Catedratico
    for (let i = 1; i <= TOTAL_CATEDRATICOS; i++) {
        const sede = sedesConAlumnos[(i - 1) % sedesConAlumnos.length];
        const { nombres, apellidos, email } = personas.catedraticos[i - 1];
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres,
                apellidos,
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
        const { nombres, apellidos, email } = personas.encargados[i - 1];
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: { rolId: roles.get('Encargado')! },
            create: {
                nombres,
                apellidos,
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
        const seccion = seccionDeAlumno(i);
        const { nombres, apellidos, email } = personas.alumnos[i - 1];
        const usuario = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: {
                nombres,
                apellidos,
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
                // Edad acorde al grado: Primero Primaria ~7 años, cada grado suma uno
                fechaNacimiento: new Date(ANIO_LECTIVO - 6 - (grados.find((g) => g.gradoId === seccion.gradoId)?.orden ?? 1), (i * 5) % 12, ((i - 1) % 28) + 1),
                seccionId: seccion.seccionId,
            },
        });
    }

    // Vínculo alumno-encargado (ver encargadoPrincipalDe).
    // Cada 4 alumnos se agrega además un encargado secundario.
    for (let i = 1; i <= TOTAL_ALUMNOS; i++) {
        const alumno = await prisma.usuario.findUnique({ where: { email: personas.alumnos[i - 1].email }, include: { alumno: true } });
        const encargado = await prisma.usuario.findUnique({ where: { email: personas.encargados[encargadoPrincipalDe(i) - 1].email } });
        if (!alumno?.alumno || !encargado) continue;

        await prisma.alumnoEncargado.upsert({
            where: { alumnoId_encargadoId: { alumnoId: alumno.usuarioId, encargadoId: encargado.usuarioId } },
            update: {},
            create: {
                alumnoId: alumno.usuarioId,
                encargadoId: encargado.usuarioId,
                esPrincipal: true,
                responsableFinanciero: true,
                parentesco: PARENTESCOS[(encargadoPrincipalDe(i) - 1) % PARENTESCOS.length],
            },
        });

        if (i % 4 === 0) {
            const secundario = await prisma.usuario.findUnique({
                where: { email: personas.encargados[(encargadoPrincipalDe(i) + 16) % TOTAL_ENCARGADOS].email },
            });
            if (secundario && secundario.usuarioId !== encargado.usuarioId) {
                await prisma.alumnoEncargado.upsert({
                    where: { alumnoId_encargadoId: { alumnoId: alumno.usuarioId, encargadoId: secundario.usuarioId } },
                    update: {},
                    create: {
                        alumnoId: alumno.usuarioId,
                        encargadoId: secundario.usuarioId,
                        esPrincipal: false,
                        parentesco: PARENTESCOS[(encargadoPrincipalDe(i) - 1) % PARENTESCOS.length] === 'Padre' ? 'Madre' : 'Padre',
                    },
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

    // 8. Actividades: cada unidad vale 100 = zona 60 (15 + 15 + 30) + examen 40.
    // La nota final del curso es el promedio de las 4 unidades.
    // Actividad no tiene @@unique, así que se crean solo las que falten por nombre dentro de la unidad
    const ACTIVIDADES_UNIDAD = [
        { nombre: 'Tarea 1', puntosMaximos: 15, tipo: 'Zona' as const },
        { nombre: 'Tarea 2', puntosMaximos: 15, tipo: 'Zona' as const },
        { nombre: 'Proyecto', puntosMaximos: 30, tipo: 'Zona' as const },
        { nombre: 'Examen de unidad', puntosMaximos: 40, tipo: 'Examen' as const },
    ];
    // Mes en que empieza cada unidad (0 = enero). Las actividades de una unidad se reparten en tres
    // meses (mes de inicio + [meses, día]), así el ciclo tiene notas de febrero a octubre
    const MES_POR_UNIDAD = [1, 3, 5, 7];
    const FECHA_ACTIVIDAD = [[0, 12], [1, 2], [1, 20], [2, 5]];

    // Seeds anteriores creaban 'Actividad 1/2/3' de 10 + 10 + 5 puntos (unidades de 25).
    // Se convierten a la escala nueva y sus notas se escalan en la misma proporción.
    const CONVERSION_ANTERIOR = [
        { antes: 'Actividad 1', puntosAntes: 10, ahora: ACTIVIDADES_UNIDAD[0] },
        { antes: 'Actividad 2', puntosAntes: 10, ahora: ACTIVIDADES_UNIDAD[1] },
        { antes: 'Actividad 3', puntosAntes: 5, ahora: ACTIVIDADES_UNIDAD[2] },
    ];
    for (const { antes, puntosAntes, ahora } of CONVERSION_ANTERIOR) {
        const viejas = await prisma.actividad.findMany({
            where: { nombre: antes, puntosMaximos: puntosAntes },
            select: { actividadId: true },
        });
        if (viejas.length === 0) continue;
        const ids = viejas.map((a) => a.actividadId);
        const factor = ahora.puntosMaximos / puntosAntes;
        await prisma.$transaction([
            prisma.$executeRaw`UPDATE "Nota" SET valor = ROUND(valor * ${factor}::numeric, 2) WHERE "actividadId" = ANY(${ids})`,
            prisma.actividad.updateMany({
                where: { actividadId: { in: ids } },
                data: { nombre: ahora.nombre, puntosMaximos: ahora.puntosMaximos, tipo: ahora.tipo },
            }),
        ]);
        console.log(`Actividades '${antes}' convertidas a '${ahora.nombre}': ${ids.length}`);
    }

    const unidades = await prisma.unidad.findMany({
        select: { unidadId: true, numero: true, actividades: { select: { nombre: true } } },
        orderBy: { unidadId: 'asc' },
    });

    const actividadesNuevas = unidades.flatMap((unidad) =>
        ACTIVIDADES_UNIDAD.flatMap(({ nombre, puntosMaximos, tipo }, idx) => {
            if (unidad.actividades.some((a) => a.nombre === nombre)) return [];
            const [meses, dia] = FECHA_ACTIVIDAD[idx % FECHA_ACTIVIDAD.length];
            const fecha = new Date(Date.UTC(ANIO_LECTIVO, MES_POR_UNIDAD[(unidad.numero - 1) % 4] + meses, dia));
            return [{ unidadId: unidad.unidadId, nombre, puntosMaximos, fecha, tipo }];
        })
    );
    await prisma.actividad.createMany({ data: actividadesNuevas });
    console.log(`Actividades creadas: ${actividadesNuevas.length}`);

    // 9. Notas: distribución controlada (no aleatoria) para que ~30% de los alumnos
    // termine con promedio por debajo de 61 y el resto por encima. El "desempeño" de
    // cada alumno es fijo según su posición global; cada actividad se califica cerca de ese
    // porcentaje, con una variación por unidad, por tipo (el examen sale algo más bajo) y un
    // poco de azar, para que el rendimiento promedio suba y baje a lo largo del año.
    // La nota se registra unos días después de la actividad.
    // Solo se crean las notas que falten; las ya registradas no se modifican.
    // El ajuste de la sede sube o baja ese porcentaje, así cada sede tiene su propio nivel de aprobación.
    const alumnosOrdenados = await prisma.alumno.findMany({ orderBy: { alumnoId: 'asc' }, include: { seccion: true } });
    const desempenoPorAlumno = new Map<number, number>();
    alumnosOrdenados.forEach((alumno, indice) => {
        const esBajo = indice % 10 < 3; // 3 de cada 10 alumnos => ~30%
        const desempeno = esBajo
            ? 35 + (indice % 4) * 6 // banda reprobada: 35, 41, 47, 53
            : 65 + (indice % 5) * 6; // banda aprobada: 65, 71, 77, 83, 89
        const ajuste = PERFIL_SEDE[indiceSede(alumno.seccion.sedeId)]?.ajuste ?? 0;
        desempenoPorAlumno.set(alumno.alumnoId, Math.max(20, Math.min(98, desempeno + ajuste)));
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
            numero: true,
            cursoSeccion: { select: { seccionId: true } },
            actividades: { orderBy: { actividadId: 'asc' } },
        },
        orderBy: { unidadId: 'asc' },
    });

    // La segunda unidad suele ser la más difícil y al final del ciclo los alumnos mejoran
    const VARIACION_UNIDAD = [2, -7, 1, 6];
    const UN_DIA = 24 * 60 * 60 * 1000;
    const notasNuevas = [];
    for (const unidad of unidadesConActividades) {
        for (const alumnoId of alumnosPorSeccion.get(unidad.cursoSeccion.seccionId) ?? []) {
            const desempeno = desempenoPorAlumno.get(alumnoId) ?? 70;

            for (const actividad of unidad.actividades) {
                const maximo = Number(actividad.puntosMaximos);
                const porcentaje = desempeno
                    + VARIACION_UNIDAD[(unidad.numero - 1) % 4]
                    + (actividad.tipo === 'Examen' ? -5 : 2)
                    + (azar() - 0.5) * 16;
                const valor = Math.round((maximo * Math.max(0, Math.min(100, porcentaje))) / 100);
                const fechaRegistro = actividad.fecha
                    ? new Date(Math.min(actividad.fecha.getTime() + (1 + Math.floor(azar() * 6)) * UN_DIA, Date.now()))
                    : undefined;

                notasNuevas.push({ actividadId: actividad.actividadId, alumnoId, valor, fechaRegistro });
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

    // 10b. Casos reales de roles y encargados para probar el sistema
    await sembrarCasosDeEncargados(roles, passwordHash, personas);

    // Personal con roles creados por el colegio (Secretaría) en la primera sede
    for (const [nombreRol, { nombres, apellidos, email }] of [
        ['Secretaría', personas.secretaria],
    ] as const) {
        await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: { nombres, apellidos, email, passwordHash, rolId: roles.get(nombreRol)!, sedeId: sedesConAlumnos[0].sedeId },
        });
    }

    // 11. Becas. Cada sede con alumnos tiene sus programas (ciclo anterior y actual) con cupos y
    // requisitos, una política (presupuesto, descuento por hermanos y tope) y becas en todos los
    // estados para probar el flujo: activas, solicitadas, suspendidas y finalizadas.
    const alumnosSeed = await prisma.usuario.findMany({
        where: { rolId: roles.get('Alumno')!, alumno: { isNot: null } },
        orderBy: { usuarioId: 'asc' },
        include: { alumno: { include: { seccion: true, encargados: true } } },
    });

    // Becas del seed anterior (sin programa): se reemplazan por las nuevas
    const DESCRIPCIONES_SEED_ANTERIOR = [
        'Beca por excelencia académica', 'Beca socioeconómica', 'Descuento por hermanos',
        'Beca completa por convenio', 'Beca deportiva',
    ];
    const becasAnteriores = await prisma.beca.findMany({
        where: { programaId: null, descripcion: { in: DESCRIPCIONES_SEED_ANTERIOR } },
        select: { becaId: true },
    });
    if (becasAnteriores.length > 0) {
        const ids = becasAnteriores.map((b) => b.becaId);
        await prisma.becaHistorial.deleteMany({ where: { becaId: { in: ids } } });
        await prisma.beca.deleteMany({ where: { becaId: { in: ids } } });
    }

    const PROGRAMAS_BECA = [
        { nombre: 'Excelencia académica', tipo: 'Merito', porcentaje: 50, cupos: 3, promedioMinimo: 85, pierdePorConductaGrave: true, permiteSolicitud: true, descripcion: 'Para alumnos con promedio sobresaliente.' },
        { nombre: 'Apoyo socioeconómico', tipo: 'Socioeconomica', porcentaje: 40, cupos: 4, promedioMinimo: 61, pierdePorConductaGrave: true, permiteSolicitud: true, descripcion: 'Familias con dificultades económicas comprobadas.' },
        { nombre: 'Beca deportiva', tipo: 'Deportiva', porcentaje: 30, cupos: 2, promedioMinimo: 70, pierdePorConductaGrave: true, permiteSolicitud: true, descripcion: 'Alumnos que representan al colegio en competencias.' },
        { nombre: 'Convenio institucional', tipo: 'Convenio', porcentaje: 100, cupos: 1, promedioMinimo: null, pierdePorConductaGrave: false, permiteSolicitud: false, descripcion: 'Hijos de personal según convenio.' },
    ];

    const programasPorSede = new Map<number, Map<string, { programaId: number; cupos: number | null; porcentaje: number }>>();
    for (const sede of sedesConAlumnos) {
        const delCiclo = new Map<string, { programaId: number; cupos: number | null; porcentaje: number }>();
        for (const anio of [ANIO_LECTIVO - 1, ANIO_LECTIVO]) {
            for (const p of PROGRAMAS_BECA) {
                const programa = await prisma.programaBeca.upsert({
                    where: { sedeId_anioLectivo_nombre: { sedeId: sede.sedeId, anioLectivo: anio, nombre: p.nombre } },
                    update: {},
                    create: { ...p, sedeId: sede.sedeId, anioLectivo: anio },
                });
                delCiclo.set(`${anio}:${p.nombre}`, { programaId: programa.programaId, cupos: programa.cupos, porcentaje: p.porcentaje });
            }
        }
        programasPorSede.set(sede.sedeId, delCiclo);

        await prisma.politicaBeca.upsert({
            where: { sedeId_anioLectivo: { sedeId: sede.sedeId, anioLectivo: ANIO_LECTIVO } },
            update: {},
            create: { sedeId: sede.sedeId, anioLectivo: ANIO_LECTIVO, presupuestoMensual: 2500, descuentoHermanos: 10, descuentoMaximo: 75 },
        });
    }

    const cuposOcupados = new Map<number, number>();
    const inicioCiclo = (anio: number) => new Date(Date.UTC(anio, 0, 1));
    const finCiclo = (anio: number) => new Date(Date.UTC(anio, 11, 31));

    let becasCreadas = 0;
    for (const [idx, usuarioAlumno] of alumnosSeed.entries()) {
        const alumno = usuarioAlumno.alumno!;
        const programas = programasPorSede.get(alumno.seccion.sedeId);
        if (!programas) continue;
        if (await prisma.beca.findFirst({ where: { alumnoId: alumno.alumnoId } })) continue;

        // Qué le toca a cada alumno según su posición (solo algunos tienen beca)
        let plan: { anio: number; programa: string; estado: string; motivo: string } | null = null;
        const desempeno = desempenoPorAlumno.get(alumno.alumnoId) ?? 70;
        if (idx % 4 === 0) {
            // Solo programas cuyo promedio mínimo cumple el alumno, para que "Evaluar requisitos"
            // no las suspenda recién sembradas
            const nombres = PROGRAMAS_BECA
                .filter((p) => p.promedioMinimo === null || desempeno >= p.promedioMinimo)
                .map((p) => p.nombre);
            plan = { anio: ANIO_LECTIVO, programa: nombres[(idx / 4) % nombres.length], estado: 'Activa', motivo: 'Beca asignada por la administración.' };
        } else if (idx % 9 === 0) {
            plan = { anio: ANIO_LECTIVO - 1, programa: 'Apoyo socioeconómico', estado: 'Finalizada', motivo: 'Terminó la vigencia de la beca.' };
        } else if (idx % 7 === 0) {
            plan = { anio: ANIO_LECTIVO, programa: idx % 2 ? 'Beca deportiva' : 'Apoyo socioeconómico', estado: 'Solicitada', motivo: 'Solicitud enviada por el encargado.' };
        } else if (idx % 11 === 0) {
            plan = { anio: ANIO_LECTIVO, programa: 'Excelencia académica', estado: 'Suspendida', motivo: 'Promedio por debajo del mínimo que exige el programa.' };
        }
        if (!plan) continue;

        const programa = programas.get(`${plan.anio}:${plan.programa}`)!;
        const ocupaCupo = plan.estado === 'Activa' || plan.estado === 'Suspendida';
        // Se cuentan tambien las becas de ejecuciones anteriores del seed para no pasarse del cupo
        const ocupados = cuposOcupados.get(programa.programaId)
            ?? await prisma.beca.count({ where: { programaId: programa.programaId, estado: { in: ['Activa', 'Suspendida'] } } });
        if (ocupaCupo && programa.cupos !== null && ocupados >= programa.cupos) continue;
        if (ocupaCupo) cuposOcupados.set(programa.programaId, ocupados + 1);

        const encargadoPrincipal = alumno.encargados.find((e) => e.esPrincipal) ?? alumno.encargados[0];
        const beca = await prisma.beca.create({
            data: {
                alumnoId: alumno.alumnoId,
                programaId: programa.programaId,
                anioLectivo: plan.anio,
                porcentaje: programa.porcentaje,
                descripcion: plan.estado === 'Solicitada'
                    ? 'La familia atraviesa una situación económica difícil este año y solicita apoyo.'
                    : null,
                fechaInicio: inicioCiclo(plan.anio),
                fechaFin: finCiclo(plan.anio),
                estado: plan.estado,
                solicitadaPorId: plan.estado === 'Solicitada' ? encargadoPrincipal?.encargadoId ?? null : null,
            },
        });

        const inicial = plan.estado === 'Solicitada' ? 'Solicitada' : 'Activa';
        await prisma.becaHistorial.create({
            data: {
                becaId: beca.becaId,
                estadoAnterior: null,
                estadoNuevo: inicial,
                motivo: inicial === 'Solicitada' ? 'Solicitud enviada por el encargado.' : 'Beca asignada por la administración.',
            },
        });
        if (plan.estado !== inicial) {
            await prisma.becaHistorial.create({
                data: { becaId: beca.becaId, estadoAnterior: inicial, estadoNuevo: plan.estado, motivo: plan.motivo },
            });
        }
        becasCreadas++;
    }
    console.log(`Programas de beca listos: ${PROGRAMAS_BECA.length * 2} por sede. Becas creadas: ${becasCreadas}`);

    // 12. Pagos de colegiatura de enero al mes actual. La mayoría está al día; según la sede,
    // 1 de cada N alumnos (PERFIL_SEDE.morososCada) debe los últimos meses (Pendiente) para probar morosidad.
    const colegiatura = Number(process.env.COLEGIATURA_MENSUAL ?? 500);
    const mesActual = Math.min(new Date().getMonth() + 1, 10);
    const becasActivas = await prisma.beca.findMany({ where: { estado: 'Activa', anioLectivo: ANIO_LECTIVO } });
    const pagosNuevos = [];
    for (const [idx, alumno] of alumnosSeed.entries()) {
        const beca = becasActivas.find((b) => b.alumnoId === alumno.usuarioId);
        const monto = Number((colegiatura * (1 - (beca ? Number(beca.porcentaje) : 0) / 100)).toFixed(2));
        const morososCada = PERFIL_SEDE[indiceSede(alumno.alumno!.seccion.sedeId)]?.morososCada ?? 5;
        const moroso = idx % morososCada === 2 % morososCada;
        for (let mes = 1; mes <= mesActual; mes++) {
            const pagado = !(moroso && mes >= mesActual - 1) && mes < mesActual + (idx % 3 === 0 ? 1 : 0);
            pagosNuevos.push({
                alumnoId: alumno.usuarioId,
                monto,
                concepto: 'Colegiatura',
                anioLectivo: ANIO_LECTIVO,
                mes,
                // Beca completa: el mes no se cobra, queda exonerado
                estado: monto === 0 ? 'Exonerado' : pagado ? 'Pagado' : 'Pendiente',
                fechaPago: monto === 0 || pagado ? new Date(Date.UTC(ANIO_LECTIVO, mes - 1, 1 + (idx % 10))) : null,
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
        { sede: 1, nombre: 'Reunión de padres - Sede Antigua', tipoEvento: 'Reunion', mes: 10, dia: 3, descripcion: 'Entrega de notas de tercera unidad.' },
        { sede: 2, nombre: 'Reunión de padres - Sede Petén', tipoEvento: 'Reunion', mes: 10, dia: 5, descripcion: 'Entrega de notas de tercera unidad.' },
        { sede: 0, nombre: 'Olimpiadas deportivas', tipoEvento: 'Deportivo', mes: 8, dia: 21, descripcion: 'Competencias interaulas de fútbol y atletismo.' },
        { sede: 1, nombre: 'Feria científica', tipoEvento: 'Academico', mes: 8, dia: 28, descripcion: 'Exposición de proyectos de Ciencias Naturales.' },
        { sede: 2, nombre: 'Kermés escolar', tipoEvento: 'Deportivo', mes: 11, dia: 7, descripcion: 'Actividad para recaudar fondos.' },
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
        { tipo: 'Conducta', titulo: 'Nuevo reporte de conducta', mensaje: `Se registró un reporte de conducta de ${personas.alumnos[0].nombres} ${personas.alumnos[0].apellidos}. Revíselo en el portal.` },
        { tipo: 'Notas', titulo: 'Notas de Matemática disponibles', mensaje: 'Ya están disponibles las notas de la Unidad 1 de Matemática.' },
        { tipo: 'Aviso', titulo: 'Reunión de padres de familia', mensaje: 'Se convoca a reunión de padres el viernes a las 16:00 horas en el salón de actos.' },
        { tipo: 'Notas', titulo: 'Notas de Comunicación y Lenguaje disponibles', mensaje: 'Ya están disponibles las notas de la Unidad 3 de Comunicación y Lenguaje.' },
        { tipo: 'Evento', titulo: 'Recordatorio: Día de la Independencia', mensaje: 'El 15 de septiembre no hay clases. Los alumnos participan en el desfile.' },
        { tipo: 'Aviso', titulo: 'Pago de colegiatura pendiente', mensaje: 'Le recordamos que tiene una colegiatura pendiente de pago.' },
    ];
    const encargadosSeed = await prisma.usuario.findMany({
        where: { rolId: roles.get('Encargado')!, encargado: { isNot: null } },
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
        where: { rolId: roles.get('Administrador de Sede')! },
        orderBy: { usuarioId: 'asc' },
    });
    const adminGeneral1 = await prisma.usuario.findUnique({ where: { email: personas.adminsGenerales[0].email } });
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

    // 15. Justificaciones de ausencia: sobre ausencias reales de la asistencia sembrada, en todos los
    // estados. Las revisa el administrador de la sede del alumno.
    const ausencias = asistenciasNuevas.filter((a) => a.estado === 'Ausente');
    const MOTIVOS_AUSENCIA = [
        'Cita médica en el IGSS por control de rutina.',
        'Presentó fiebre y el pediatra recomendó reposo.',
        'Viaje familiar por fallecimiento de un familiar.',
        'Trámite del pasaporte en Migración.',
        'Malestar estomacal, se adjunta constancia médica.',
        'Participó en un torneo deportivo representando al departamento.',
    ];
    const ESTADOS_JUSTIFICACION = ['Pendiente', 'Pendiente', 'Aprobada', 'Pendiente', 'Rechazada', 'Aprobada'];
    const justificadas = new Set<string>();
    let justificacionesCreadas = 0;
    for (const [idx, usuarioAlumno] of alumnosSeed.entries()) {
        if (idx % 4 !== 1) continue;
        const ausencia = ausencias.find((a) => a.alumnoId === usuarioAlumno.usuarioId && !justificadas.has(`${a.alumnoId}|${a.fecha.toISOString()}`));
        const solicitante = usuarioAlumno.alumno!.encargados.find((e) => e.esPrincipal);
        if (!ausencia || !solicitante) continue;
        justificadas.add(`${ausencia.alumnoId}|${ausencia.fecha.toISOString()}`);
        const estado = ESTADOS_JUSTIFICACION[justificacionesCreadas % ESTADOS_JUSTIFICACION.length];
        const revisor = adminsSede.find((a) => a.sedeId === usuarioAlumno.alumno!.seccion.sedeId);
        await prisma.justificacionAusencia.upsert({
            where: { alumnoId_fecha: { alumnoId: ausencia.alumnoId, fecha: ausencia.fecha } },
            update: {},
            create: {
                alumnoId: ausencia.alumnoId,
                fecha: ausencia.fecha,
                motivo: MOTIVOS_AUSENCIA[idx % MOTIVOS_AUSENCIA.length],
                estado,
                solicitanteId: solicitante.encargadoId,
                revisorId: estado === 'Pendiente' ? null : revisor?.usuarioId ?? null,
                comentario: estado === 'Rechazada' ? 'No se presentó la constancia que respalde la ausencia.' : null,
                fechaSolicitud: new Date(ausencia.fecha.getTime() + 24 * 60 * 60 * 1000),
                fechaRevision: estado === 'Pendiente' ? null : new Date(ausencia.fecha.getTime() + 2 * 24 * 60 * 60 * 1000),
            },
        });
        justificacionesCreadas++;
    }
    console.log(`Justificaciones de ausencia creadas: ${justificacionesCreadas}`);

    // 16. Solicitudes de inscripción para el próximo ciclo en cada sede. Son familias que aún no
    // tienen cuenta, por eso su correo es personal y no del colegio.
    const ESTADOS_SOLICITUD = ['PENDIENTE', 'PENDIENTE', 'REVISION', 'PENDIENTE', 'RECHAZADA', 'REVISION', 'VENCIDA'] as const;
    const DOCUMENTOS_SOLICITUD = [
        'Certificación de nacimiento del alumno extendida por RENAP',
        'Certificado del último grado aprobado',
        'Copia de DPI del padre o encargado',
        'Dos fotografías tamaño cédula',
    ];
    const SOLICITUDES_POR_SEDE = [7, 5, 4];
    let numeroSolicitud = 0;
    for (const [s, sede] of sedes.entries()) {
        for (let k = 0; k < (SOLICITUDES_POR_SEDE[s] ?? 0); k++) {
            numeroSolicitud++;
            const numero = `SOL-${ANIO_LECTIVO}-${String(numeroSolicitud).padStart(5, '0')}`;
            if (await prisma.solicitud.findUnique({ where: { numero } })) continue;
            const grado = grados[(numeroSolicitud * 5) % grados.length];
            const madre = numeroSolicitud % 3 !== 0;
            const encargado = nuevaPersona({ genero: madre ? 'M' : 'H' });
            const hijo = nuevaPersona({ apellido1: madre ? undefined : encargado.apellido1, apellido2: madre ? encargado.apellido1 : undefined });
            const estado = ESTADOS_SOLICITUD[numeroSolicitud % ESTADOS_SOLICITUD.length];
            const fechaSolicitud = new Date(Date.now() - (numeroSolicitud % 12 + 1) * 3 * 24 * 60 * 60 * 1000);
            const fechaLimite = new Date(fechaSolicitud.getTime() + (estado === 'VENCIDA' ? 7 : 30) * 24 * 60 * 60 * 1000);
            await prisma.solicitud.create({
                data: {
                    numero,
                    modo: numeroSolicitud % 2 ? 'PUBLICO' : 'PRESENCIAL',
                    estado,
                    encargadoNombres: encargado.nombres,
                    encargadoApellidos: encargado.apellidos,
                    encargadoDpi: String(2000000000000 + numeroSolicitud * 7919357).slice(0, 13),
                    encargadoTelefono: `${[3, 4, 5][numeroSolicitud % 3]}${String(1000000 + numeroSolicitud * 48271).slice(-7)}`,
                    encargadoCorreo: `${paraCorreo(encargado.nombres.split(' ')[0])}.${paraCorreo(encargado.apellido1)}${numeroSolicitud}@gmail.com`,
                    encargadoParentesco: madre ? 'Madre' : 'Padre',
                    alumnoNombres: hijo.nombres,
                    alumnoApellidos: hijo.apellidos,
                    alumnoFechaNacimiento: new Date(Date.UTC(ANIO_LECTIVO - 5 - grado.orden, numeroSolicitud % 12, (numeroSolicitud % 27) + 1)),
                    alumnoNivel: grado.nivel,
                    alumnoGrado: grado.nombre,
                    sedeId: sede.sedeId,
                    documentos: grado.nivel === 'Preprimaria' ? DOCUMENTOS_SOLICITUD.filter((_, d) => d !== 1) : DOCUMENTOS_SOLICITUD,
                    observaciones: estado === 'REVISION' ? 'Documentos recibidos, pendiente de entrevista con dirección.' : null,
                    fechaSolicitud,
                    fechaLimite,
                    fechaResolucion: estado === 'RECHAZADA' ? new Date(fechaSolicitud.getTime() + 5 * 24 * 60 * 60 * 1000) : null,
                    motivoResolucion: estado === 'RECHAZADA' ? 'No hay cupo disponible en el grado solicitado.' : null,
                },
            });
        }
    }
    console.log(`Solicitudes de inscripción: ${await prisma.solicitud.count()}`);

    console.log(`Seed completado. Contraseña de prueba para todos los usuarios: ${DEFAULT_PASSWORD}`);
}


// Situaciones reales con varios encargados por alumno:
//  - alumno3: padres divorciados. La madre tiene la custodia y es el contacto principal;
//    el padre paga la colegiatura y ve notas, pero no está autorizado a recogerlo.
//  - alumno6: el padre tiene una orden de alejamiento: sin acceso a nada.
//  - alumno7: la abuela es tutora temporal mientras los padres trabajan fuera (con fecha de fin).
//  - catedratico1 también es madre de alumno8 (un usuario con dos roles).
async function sembrarCasosDeEncargados(roles: Map<string, number>, passwordHash: string, personas: Personas) {
    const usuarioDe = (email: string) => prisma.usuario.findUnique({ where: { email } });
    const crearEncargado = async ({ email, nombres, apellidos }: Persona) => {
        const u = await prisma.usuario.upsert({
            where: { email },
            update: {},
            create: { nombres, apellidos, email, passwordHash, rolId: roles.get('Encargado')! },
        });
        await prisma.encargado.upsert({ where: { encargadoId: u.usuarioId }, update: {}, create: { encargadoId: u.usuarioId } });
        return u;
    };
    const vincular = async (alumnoEmail: string, encargadoId: number, datos: Record<string, unknown>) => {
        const alumno = await usuarioDe(alumnoEmail);
        if (!alumno) return;
        await prisma.alumnoEncargado.upsert({
            where: { alumnoId_encargadoId: { alumnoId: alumno.usuarioId, encargadoId } },
            update: {},
            create: { alumnoId: alumno.usuarioId, encargadoId, ...datos },
        });
        return alumno.usuarioId;
    };

    // Padres divorciados
    const padreDivorciado = await crearEncargado(personas.padreAlumno3);
    const alumno3 = await vincular(personas.alumnos[2].email, padreDivorciado.usuarioId, {
        parentesco: 'Padre', responsableFinanciero: true, tieneCustodia: false, autorizadoRecoger: false,
        observaciones: 'Padres divorciados. Custodia de la madre según convenio; el padre cubre la colegiatura.',
    });
    if (alumno3) {
        await prisma.alumnoEncargado.updateMany({
            where: { alumnoId: alumno3, encargadoId: { not: padreDivorciado.usuarioId } },
            data: { parentesco: 'Madre', responsableFinanciero: false, tieneCustodia: true },
        });
    }

    // Orden de alejamiento
    const padreRestringido = await crearEncargado(personas.padreAlumno6);
    await vincular(personas.alumnos[5].email, padreRestringido.usuarioId, {
        parentesco: 'Padre', restringido: true,
        motivoRestriccion: 'Orden de alejamiento No. 01080-2026-00118, Juzgado de Familia. No entregar al alumno ni dar información.',
        tieneCustodia: false, autorizadoRecoger: false, puedeVerNotas: false, puedeVerPagos: false, recibeNotificaciones: false,
    });

    // Tutor temporal
    const abuela = await crearEncargado(personas.abuelaAlumno7);
    await vincular(personas.alumnos[6].email, abuela.usuarioId, {
        parentesco: 'Abuelo(a)', autorizadoRecoger: true, tieneCustodia: true,
        vigenteHasta: new Date(Date.UTC(ANIO_LECTIVO, 11, 31)),
        observaciones: 'Tutora temporal mientras los padres trabajan en el extranjero.',
    });

    // Catedrática que también es madre de familia
    const catedratico = await usuarioDe(personas.catedraticos[0].email);
    if (catedratico) {
        await prisma.usuarioRol.upsert({
            where: { usuarioId_rolId: { usuarioId: catedratico.usuarioId, rolId: roles.get('Encargado')! } },
            update: {},
            create: { usuarioId: catedratico.usuarioId, rolId: roles.get('Encargado')! },
        });
        await prisma.encargado.upsert({ where: { encargadoId: catedratico.usuarioId }, update: {}, create: { encargadoId: catedratico.usuarioId } });
        await vincular(personas.alumnos[7].email, catedratico.usuarioId, { parentesco: 'Madre' });
    }
}

main()
    .catch((error) => {
        console.error('Error al ejecutar el seed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
