export interface AnioCarrera {
  nombre: string;
  cursos: string[];
}

export interface CarreraDiversificado {
  nombre: string;
  anios: AnioCarrera[];
}

export interface GradoMalla {
  nombre: string;
  cursos: string[];
}

export interface NivelMalla {
  nivel: string;
  id: "pre" | "pri" | "bas" | "div";
  grados: GradoMalla[];
  carreras?: CarreraDiversificado[];
}

const CARRERAS_DIVERSIFICADO: CarreraDiversificado[] = [
  {
    nombre: "Bachillerato en Ciencias y Letras",
    anios: [
      { nombre: "Cuarto", cursos: ["Matemática IV", "Física", "Química", "Biología", "Comunicación y Lenguaje", "Inglés IV", "Filosofía", "Educación Física"] },
      { nombre: "Quinto", cursos: ["Matemática V", "Física II", "Química II", "Biología II", "Comunicación y Lenguaje", "Inglés V", "Estadística", "Educación Física"] },
    ],
  },
  {
    nombre: "Bachillerato en Ciencias y Letras con orientación en Computación",
    anios: [
      { nombre: "Cuarto", cursos: ["Matemática IV", "Física", "Química", "Comunicación y Lenguaje", "Inglés IV", "Introducción a la Programación", "Ofimática", "Educación Física"] },
      { nombre: "Quinto", cursos: ["Matemática V", "Estadística", "Comunicación y Lenguaje", "Inglés V", "Bases de Datos", "Desarrollo Web", "Redes y Conectividad", "Educación Física"] },
    ],
  },
  {
    nombre: "Perito Contador",
    anios: [
      { nombre: "Cuarto", cursos: ["Contabilidad General", "Matemática Financiera", "Legislación Fiscal", "Comunicación y Lenguaje", "Inglés Técnico", "Ofimática"] },
      { nombre: "Quinto", cursos: ["Contabilidad de Costos", "Derecho Mercantil", "Estadística", "Inglés Técnico II", "Matemática Financiera II", "Auditoría I"] },
      { nombre: "Sexto", cursos: ["Contabilidad Superior", "Auditoría II", "Legislación Laboral", "Finanzas Corporativas", "Seminario de Práctica Contable"] },
    ],
  },
  {
    nombre: "Secretariado Bilingüe",
    anios: [
      { nombre: "Cuarto", cursos: ["Mecanografía y Digitación", "Inglés Comercial I", "Redacción y Correspondencia", "Ofimática", "Archivo y Documentación"] },
      { nombre: "Quinto", cursos: ["Inglés Comercial II", "Taquigrafía", "Atención al Cliente", "Organización de Eventos", "Contabilidad Básica"] },
      { nombre: "Sexto", cursos: ["Inglés Comercial III", "Gestión de Oficina", "Protocolo Empresarial", "Legislación Laboral", "Seminario de Práctica Secretarial"] },
    ],
  },
  {
    nombre: "Magisterio de Educación Infantil",
    anios: [
      { nombre: "Cuarto", cursos: ["Psicología del Desarrollo Infantil", "Didáctica General", "Comunicación y Lenguaje", "Expresión Artística", "Educación Física"] },
      { nombre: "Quinto", cursos: ["Didáctica de la Lectoescritura", "Planeamiento Didáctico", "Psicopedagogía", "Recursos Educativos", "Evaluación del Aprendizaje"] },
      { nombre: "Sexto", cursos: ["Práctica Docente Supervisada", "Legislación Educativa", "Didáctica de la Matemática Infantil", "Atención a la Diversidad", "Seminario de Graduación"] },
    ],
  },
];

export const MALLA_CNB: NivelMalla[] = [
  {
    nivel: "Preprimaria", id: "pre",
    grados: [
      { nombre: "Párvulos 1", cursos: ["Destrezas de Aprendizaje", "Comunicación y Lenguaje", "Medio Social y Natural", "Expresión Artística", "Educación Física"] },
      { nombre: "Párvulos 2", cursos: ["Destrezas de Aprendizaje", "Comunicación y Lenguaje", "Medio Social y Natural", "Expresión Artística", "Educación Física"] },
      { nombre: "Párvulos 3", cursos: ["Destrezas de Aprendizaje", "Comunicación y Lenguaje", "Matemática", "Medio Social y Natural", "Expresión Artística", "Educación Física"] },
    ]
  },
  {
    nivel: "Primaria", id: "pri",
    grados: [
      { nombre: "Primero Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales", "Estudios Sociales", "Formación Ciudadana", "Expresión Artística", "Educación Física"] },
      { nombre: "Segundo Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales", "Estudios Sociales", "Formación Ciudadana", "Expresión Artística", "Educación Física"] },
      { nombre: "Tercero Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales y Tecnología", "Estudios Sociales", "Formación Ciudadana", "Expresión Artística", "Educación Física"] },
      { nombre: "Cuarto Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales y Tecnología", "Estudios Sociales", "Formación Ciudadana", "Inglés", "Educación Física"] },
      { nombre: "Quinto Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales y Tecnología", "Estudios Sociales", "Formación Ciudadana", "Inglés", "Educación Física"] },
      { nombre: "Sexto Primaria", cursos: ["Matemática", "Comunicación y Lenguaje A", "Comunicación y Lenguaje B", "Ciencias Naturales y Tecnología", "Estudios Sociales", "Formación Ciudadana", "Inglés", "Educación Física"] },
    ]
  },
  {
    nivel: "Básico", id: "bas",
    grados: [
      { nombre: "Primero Básico", cursos: ["Matemática", "Comunicación y Lenguaje", "Ciencias Naturales", "Estudios Sociales", "Tecnologías del Aprendizaje", "Inglés", "Educación Física", "Expresión Artística", "Formación Ciudadana"] },
      { nombre: "Segundo Básico", cursos: ["Matemática", "Comunicación y Lenguaje", "Ciencias Naturales", "Estudios Sociales", "Tecnologías del Aprendizaje", "Inglés", "Educación Física", "Expresión Artística", "Formación Ciudadana"] },
      { nombre: "Tercero Básico", cursos: ["Matemática", "Comunicación y Lenguaje", "Ciencias Naturales", "Estudios Sociales", "Tecnologías del Aprendizaje", "Inglés", "Educación Física", "Expresión Artística", "Formación Ciudadana"] },
    ]
  },
  {
    nivel: "Diversificado", id: "div",
    grados: CARRERAS_DIVERSIFICADO.flatMap((carrera) =>
      carrera.anios.map((anio) => ({ nombre: `${carrera.nombre} — ${anio.nombre}`, cursos: anio.cursos }))
    ),
    carreras: CARRERAS_DIVERSIFICADO,
  },
];
