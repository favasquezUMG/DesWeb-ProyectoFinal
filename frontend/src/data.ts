import type { AppUser, Sede, Alumno, Catedratico, Curso, Nota, Pago, Evento, Notificacion } from "./types";

export const DEMO_USERS: AppUser[] = [
  { id: "1", name: "Lic. Roberto Cifuentes Méndez", role: "admin-general", email: "rcifuentes@colegio.edu.gt", initials: "RC" },
  { id: "2", name: "Prof.ª Ana Lucía Morales Tzoc", role: "admin-sede", email: "amorales@colegio.edu.gt", initials: "AM", sede: "Sede Central" },
  { id: "3", name: "Prof. Carlos Humberto Gómez Quiché", role: "catedratico", email: "cgomez@colegio.edu.gt", initials: "CG", sede: "Sede Central" },
  { id: "4", name: "María José Ajú Pac", role: "alumno", email: "maju.2025@colegio.edu.gt", initials: "MJ", sede: "Sede Central", grado: "Tercero Básico", seccion: "A" },
  { id: "5", name: "Sra. Rosa Elena Pac Cuc", role: "padre", email: "rpac.encargado@gmail.com", initials: "RP" },
];

export const SEDES: Sede[] = [
  { id: "1", nombre: "Sede Central", ciudad: "Guatemala, Guatemala", alumnos: 842, catedraticos: 48, aprobacion: 87, mora: 12 },
  { id: "2", nombre: "Sede Xela", ciudad: "Quetzaltenango", alumnos: 523, catedraticos: 31, aprobacion: 83, mora: 15 },
  { id: "3", nombre: "Sede Coatepeque", ciudad: "Coatepeque, Quetzaltenango", alumnos: 318, catedraticos: 19, aprobacion: 79, mora: 18 },
];

export const ALUMNOS: Alumno[] = [
  { id: "1", nombre: "María José Ajú Pac", grado: "Tercero Básico", seccion: "A", promedio: 78, estado: "activo", encargado: "Rosa Elena Pac Cuc", encargadoEmail: "rpac@gmail.com", pagado: true, beca: 10, carnet: "2025-001", nacimiento: "12/03/2011" },
  { id: "2", nombre: "Diego Alejandro Cuc Toj", grado: "Tercero Básico", seccion: "A", promedio: 65, estado: "activo", encargado: "Pedro Antonio Cuc Morales", encargadoEmail: "pcuc@gmail.com", pagado: false, beca: 0, carnet: "2025-002", nacimiento: "08/07/2011" },
  { id: "3", nombre: "Lucía Fernanda Quiché Batz", grado: "Tercero Básico", seccion: "A", promedio: 88, estado: "activo", encargado: "Elena Rosa Batz Sicán", encargadoEmail: "ebatz@gmail.com", pagado: true, beca: 20, carnet: "2025-003", nacimiento: "21/11/2010" },
  { id: "4", nombre: "José Antonio Tzoc Chávez", grado: "Tercero Básico", seccion: "A", promedio: 55, estado: "activo", encargado: "María del Carmen Chávez", encargadoEmail: "mchavez@gmail.com", pagado: true, beca: 0, carnet: "2025-004", nacimiento: "04/05/2011" },
  { id: "5", nombre: "Ana Sofía Ixcot López", grado: "Primero Básico", seccion: "A", promedio: 91, estado: "activo", encargado: "Carmen Rebeca López Ajú", encargadoEmail: "clopez@gmail.com", pagado: true, beca: 25, carnet: "2025-005", nacimiento: "15/09/2013" },
  { id: "6", nombre: "Carlos Enrique Sis Boj", grado: "Primero Básico", seccion: "B", promedio: 43, estado: "activo", encargado: "Luis Fernando Sis", encargadoEmail: "lsis@gmail.com", pagado: false, beca: 0, carnet: "2025-006", nacimiento: "30/01/2013" },
  { id: "7", nombre: "Verónica Marisol Xoc Sic", grado: "Segundo Básico", seccion: "A", promedio: 76, estado: "activo", encargado: "Elena Concepción Sic", encargadoEmail: "esic@gmail.com", pagado: true, beca: 15, carnet: "2025-007", nacimiento: "18/06/2012" },
  { id: "8", nombre: "Roberto Isaías Coy Tún", grado: "Segundo Básico", seccion: "A", promedio: 82, estado: "activo", encargado: "Isabel Eugenia Tún", encargadoEmail: "itun@gmail.com", pagado: true, beca: 0, carnet: "2025-008", nacimiento: "25/02/2012" },
  { id: "9", nombre: "Gabriela del Rosario Ajú Tzep", grado: "Tercero Básico", seccion: "B", promedio: 69, estado: "activo", encargado: "Miguel Ángel Ajú", encargadoEmail: "maju2@gmail.com", pagado: true, beca: 0, carnet: "2025-009", nacimiento: "11/04/2011" },
  { id: "10", nombre: "Fernando Josué Tol Coche", grado: "Segundo Básico", seccion: "B", promedio: 71, estado: "activo", encargado: "Juana Petrona Coche", encargadoEmail: "jcoche@gmail.com", pagado: false, beca: 10, carnet: "2025-010", nacimiento: "02/12/2012" },
];

export const CATEDRATICOS: Catedratico[] = [
  { id: "c1", nombre: "Prof. Carlos Humberto Gómez Quiché", email: "cgomez@colegio.edu.gt", cursos: ["Matemática — 3ro A", "Matemática — 2do A"], cargaHoraria: 24, estado: "activo" },
  { id: "c2", nombre: "Prof.ª Silvia Beatriz Ramírez Chaj", email: "sramirez@colegio.edu.gt", cursos: ["Comunicación y Lenguaje — 3ro A", "Comunicación y Lenguaje — 1ro A"], cargaHoraria: 20, estado: "activo" },
  { id: "c3", nombre: "Prof. Mario Enrique Ajú Ixcot", email: "maju@colegio.edu.gt", cursos: ["Ciencias Naturales — 3ro A", "Ciencias Naturales — 2do B"], cargaHoraria: 18, estado: "activo" },
  { id: "c4", nombre: "Prof.ª Elena Rosa Morales Sic", email: "emorales@colegio.edu.gt", cursos: ["Estudios Sociales — 3ro A", "Formación Ciudadana — 3ro A"], cargaHoraria: 16, estado: "activo" },
  { id: "c5", nombre: "Prof. Diego Arturo Tzoc Cuc", email: "dtzoc@colegio.edu.gt", cursos: ["Tecnologías del Aprendizaje — 3ro A", "Tecnologías del Aprendizaje — 1ro B"], cargaHoraria: 20, estado: "activo" },
  { id: "c6", nombre: "Prof.ª Jennifer Williams Monterroso", email: "jwilliams@colegio.edu.gt", cursos: ["Inglés — 3ro A", "Inglés — 2do A", "Inglés — 1ro A"], cargaHoraria: 18, estado: "activo" },
];

export const MIS_CURSOS: Curso[] = [
  { id: "cur1", nombre: "Matemática", area: "Matemática", grado: "Tercero Básico", seccion: "A", catedratico: "Prof. Carlos Gómez", alumnos: 28, horario: "Lun/Mar/Mié/Jue/Vie 07:30–08:15" },
  { id: "cur2", nombre: "Matemática", area: "Matemática", grado: "Segundo Básico", seccion: "A", catedratico: "Prof. Carlos Gómez", alumnos: 24, horario: "Lun/Mié 09:00–09:45" },
];

export const NOTAS_3A: Nota[] = [
  { alumnoId: "1", u1: 82, u2: 78, u3: 75, u4: null },
  { alumnoId: "2", u1: 65, u2: 60, u3: 68, u4: null },
  { alumnoId: "3", u1: 90, u2: 92, u3: 88, u4: null },
  { alumnoId: "4", u1: 55, u2: 58, u3: 50, u4: null },
];

export const NOTAS_ALUMNO = [
  { curso: "Matemática", u1: 82, u2: 78, u3: 75, u4: null, catedratico: "Prof. Carlos Gómez" },
  { curso: "Comunicación y Lenguaje", u1: 90, u2: 85, u3: 88, u4: null, catedratico: "Prof.ª Silvia Ramírez" },
  { curso: "Ciencias Naturales", u1: 70, u2: 75, u3: 72, u4: null, catedratico: "Prof. Mario Ajú" },
  { curso: "Estudios Sociales", u1: 68, u2: 72, u3: 70, u4: null, catedratico: "Prof.ª Elena Morales" },
  { curso: "Tecnologías del Aprendizaje", u1: 88, u2: 90, u3: 85, u4: null, catedratico: "Prof. Diego Tzoc" },
  { curso: "Inglés", u1: 60, u2: 65, u3: 63, u4: null, catedratico: "Prof.ª Jennifer Williams" },
  { curso: "Educación Física", u1: 92, u2: 88, u3: null, u4: null, catedratico: "Prof. Juan Pérez" },
];

export const PAGOS: Pago[] = [
  { id: "p1", mes: "Enero 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pagado", fecha: "05/01/2025" },
  { id: "p2", mes: "Febrero 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pagado", fecha: "03/02/2025" },
  { id: "p3", mes: "Marzo 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pagado", fecha: "04/03/2025" },
  { id: "p4", mes: "Abril 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pagado", fecha: "02/04/2025" },
  { id: "p5", mes: "Mayo 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pagado", fecha: "05/05/2025" },
  { id: "p6", mes: "Junio 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "vencido", fecha: null },
  { id: "p7", mes: "Julio 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pendiente", fecha: null },
  { id: "p8", mes: "Agosto 2025", monto: 1250.00, beca: 125.00, total: 1125.00, estado: "pendiente", fecha: null },
];

export const EVENTOS: Evento[] = [
  // Enero
  { id: "e1", titulo: "Inicio de clases — Ciclo 2025", fecha: "2025-01-13", tipo: "institucional", recordatorio: true },
  { id: "e1b", titulo: "Clases normales", fecha: "2025-01-13", fechaFin: "2025-01-31", tipo: "clases" },
  // Febrero
  { id: "e2a", titulo: "Clases normales", fecha: "2025-02-03", fechaFin: "2025-02-21", tipo: "clases" },
  { id: "e2", titulo: "Semana de Exámenes — Primera Unidad", fecha: "2025-02-24", fechaFin: "2025-02-28", tipo: "examen", recordatorio: true },
  // Marzo
  { id: "e3", titulo: "Entrega de notas — Primera Unidad", fecha: "2025-03-07", tipo: "actividad", recordatorio: true },
  { id: "e3b", titulo: "Reunión de Padres de Familia", fecha: "2025-03-21", tipo: "actividad", recordatorio: true },
  { id: "e3c", titulo: "Clases normales", fecha: "2025-03-10", fechaFin: "2025-03-28", tipo: "clases" },
  // Abril
  { id: "e4a", titulo: "Clases normales", fecha: "2025-04-07", fechaFin: "2025-04-11", tipo: "clases" },
  { id: "e4", titulo: "Semana Santa — Asueto", fecha: "2025-04-14", fechaFin: "2025-04-18", tipo: "asueto" },
  { id: "e4b", titulo: "Clases normales", fecha: "2025-04-22", fechaFin: "2025-04-30", tipo: "clases" },
  // Mayo
  { id: "e5a", titulo: "Clases normales", fecha: "2025-05-05", fechaFin: "2025-05-09", tipo: "clases" },
  { id: "e5", titulo: "Semana de Exámenes — Segunda Unidad", fecha: "2025-05-12", fechaFin: "2025-05-16", tipo: "examen", recordatorio: true },
  { id: "e5b", titulo: "Entrega de notas — Segunda Unidad", fecha: "2025-05-23", tipo: "actividad", recordatorio: true },
  { id: "e5c", titulo: "Clases normales", fecha: "2025-05-26", fechaFin: "2025-05-30", tipo: "clases" },
  // Junio
  { id: "e6a", titulo: "Clases normales", fecha: "2025-06-02", fechaFin: "2025-06-20", tipo: "clases" },
  { id: "e6", titulo: "Día del Maestro — Asueto", fecha: "2025-06-25", tipo: "descanso" },
  { id: "e6b", titulo: "Clases normales", fecha: "2025-06-26", fechaFin: "2025-06-30", tipo: "clases" },
  // Julio
  { id: "e7a", titulo: "Vacaciones de medio año", fecha: "2025-07-07", fechaFin: "2025-07-18", tipo: "descanso" },
  { id: "e7b", titulo: "Regreso a clases", fecha: "2025-07-21", tipo: "institucional", recordatorio: true },
  { id: "e7c", titulo: "Clases normales", fecha: "2025-07-21", fechaFin: "2025-07-31", tipo: "clases" },
  // Agosto
  { id: "e8a", titulo: "Clases normales", fecha: "2025-08-04", fechaFin: "2025-08-15", tipo: "clases" },
  { id: "e9", titulo: "Semana de Exámenes — Tercera Unidad", fecha: "2025-08-18", fechaFin: "2025-08-22", tipo: "examen", recordatorio: true },
  { id: "e9b", titulo: "Entrega de notas — Tercera Unidad", fecha: "2025-08-29", tipo: "actividad", recordatorio: true },
  // Septiembre
  { id: "e8b", titulo: "Clases normales", fecha: "2025-09-01", fechaFin: "2025-09-12", tipo: "clases" },
  { id: "e8", titulo: "Día de la Independencia — Asueto", fecha: "2025-09-15", tipo: "festivo" },
  { id: "e8c", titulo: "Clases normales", fecha: "2025-09-16", fechaFin: "2025-09-30", tipo: "clases" },
  // Octubre
  { id: "e10a", titulo: "Clases normales", fecha: "2025-10-01", fechaFin: "2025-10-24", tipo: "clases" },
  { id: "e10", titulo: "Semana de Exámenes — Cuarta Unidad", fecha: "2025-10-27", fechaFin: "2025-10-31", tipo: "examen", recordatorio: true },
  // Noviembre
  { id: "e11a", titulo: "Entrega de notas finales", fecha: "2025-11-07", tipo: "actividad", recordatorio: true },
  { id: "e11b", titulo: "Día de Todos los Santos — Asueto", fecha: "2025-11-01", tipo: "festivo" },
  { id: "e11c", titulo: "Clausura y graduaciones", fecha: "2025-11-14", tipo: "institucional", recordatorio: true },
  { id: "e11d", titulo: "Clases normales", fecha: "2025-11-03", fechaFin: "2025-11-13", tipo: "clases" },
  // Diciembre
  { id: "e12a", titulo: "Fin de ciclo escolar 2025", fecha: "2025-12-01", tipo: "institucional" },
  { id: "e12b", titulo: "Vacaciones de fin de año", fecha: "2025-12-01", fechaFin: "2025-12-31", tipo: "descanso" },
];

export const NOTIFICACIONES_LISTA: Notificacion[] = [
  { id: "n1", titulo: "Asueto — Semana Santa", cuerpo: "Se informa a toda la comunidad educativa que del 14 al 18 de abril no hay clases por Semana Santa.", destinatarios: "Todos", fecha: "10/04/2025", tipo: "asueto" },
  { id: "n2", titulo: "Reunión de Padres de Familia", cuerpo: "Se convoca a los encargados de alumnos de Tercero Básico a reunión el viernes 21 de marzo a las 17:00 hrs.", destinatarios: "3ro Básico", fecha: "14/03/2025", tipo: "actividad" },
  { id: "n3", titulo: "Sanción — Conducta", cuerpo: "Se notifica que el alumno deberá presentarse a Dirección el lunes 10 de marzo con su encargado.", destinatarios: "Encargado específico", fecha: "07/03/2025", tipo: "sancion" },
];

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"] as const;

// Horario Básico / Primaria / Diversificado: 07:30 – 12:30
// Períodos de 45 min con receso a las 10:00–10:15
export const BLOQUES = [
  "07:30–08:15", "08:15–09:00", "09:00–09:45",
  "09:45–10:15", // Receso
  "10:15–11:00", "11:00–11:45", "11:45–12:30",
] as const;

// Horario Preprimaria: 08:00 – 11:00
// Períodos de 45 min con receso a las 09:30–09:45
export const BLOQUES_PREPRIMARIA = [
  "08:00–08:45", "08:45–09:30",
  "09:30–09:45", // Receso
  "09:45–10:30", "10:30–11:00",
] as const;

export type HorarioCelda = {
  curso: string;
  catedratico: string;
  salon: string;
  color: string;
};

export const HORARIO_3A: Record<string, Record<string, HorarioCelda>> = {
  "Lunes": {
    "07:30–08:15": { curso: "Matemática", catedratico: "Prof. C. Gómez", salon: "Aula 301", color: "bg-primary-100 text-primary-800 border-primary-200" },
    "08:15–09:00": { curso: "Comunicación y Lenguaje", catedratico: "Prof.ª S. Ramírez", salon: "Aula 105", color: "bg-info-100 text-info-800 border-info-200" },
    "09:00–09:45": { curso: "Ciencias Naturales", catedratico: "Prof. M. Ajú", salon: "Lab. Ciencias", color: "bg-success-100 text-success-800 border-success-200" },
    "11:00–11:45": { curso: "Inglés", catedratico: "Prof.ª J. Williams", salon: "Aula 205", color: "bg-warning-100 text-warning-800 border-warning-200" },
  },
  "Martes": {
    "07:30–08:15": { curso: "Estudios Sociales", catedratico: "Prof.ª E. Morales", salon: "Aula 102", color: "bg-action-100 text-action-800 border-action-200" },
    "08:15–09:00": { curso: "Matemática", catedratico: "Prof. C. Gómez", salon: "Aula 301", color: "bg-primary-100 text-primary-800 border-primary-200" },
    "10:15–11:00": { curso: "Tecnologías del Aprendizaje", catedratico: "Prof. D. Tzoc", salon: "Lab. Cómputo", color: "bg-purple-100 text-purple-800 border-purple-200" },
    "11:00–11:45": { curso: "Educación Física", catedratico: "Prof. J. Pérez", salon: "Cancha", color: "bg-teal-100 text-teal-800 border-teal-200" },
  },
  "Miércoles": {
    "07:30–08:15": { curso: "Comunicación y Lenguaje", catedratico: "Prof.ª S. Ramírez", salon: "Aula 105", color: "bg-info-100 text-info-800 border-info-200" },
    "08:15–09:00": { curso: "Inglés", catedratico: "Prof.ª J. Williams", salon: "Aula 205", color: "bg-warning-100 text-warning-800 border-warning-200" },
    "09:00–09:45": { curso: "Matemática", catedratico: "Prof. C. Gómez", salon: "Aula 301", color: "bg-primary-100 text-primary-800 border-primary-200" },
    "11:00–11:45": { curso: "Formación Ciudadana", catedratico: "Prof.ª E. Morales", salon: "Aula 102", color: "bg-action-100 text-action-800 border-action-200" },
    "11:45–12:30": { curso: "Expresión Artística", catedratico: "Prof.ª A. Quiché", salon: "Taller Arte", color: "bg-pink-100 text-pink-800 border-pink-200" },
  },
  "Jueves": {
    "07:30–08:15": { curso: "Ciencias Naturales", catedratico: "Prof. M. Ajú", salon: "Lab. Ciencias", color: "bg-success-100 text-success-800 border-success-200" },
    "08:15–09:00": { curso: "Matemática", catedratico: "Prof. C. Gómez", salon: "Aula 301", color: "bg-primary-100 text-primary-800 border-primary-200" },
    "10:15–11:00": { curso: "Estudios Sociales", catedratico: "Prof.ª E. Morales", salon: "Aula 102", color: "bg-action-100 text-action-800 border-action-200" },
    "11:00–11:45": { curso: "Tecnologías del Aprendizaje", catedratico: "Prof. D. Tzoc", salon: "Lab. Cómputo", color: "bg-purple-100 text-purple-800 border-purple-200" },
    "11:45–12:30": { curso: "Inglés", catedratico: "Prof.ª J. Williams", salon: "Aula 205", color: "bg-warning-100 text-warning-800 border-warning-200" },
  },
  "Viernes": {
    "07:30–08:15": { curso: "Matemática", catedratico: "Prof. C. Gómez", salon: "Aula 301", color: "bg-primary-100 text-primary-800 border-primary-200" },
    "08:15–09:00": { curso: "Comunicación y Lenguaje", catedratico: "Prof.ª S. Ramírez", salon: "Aula 105", color: "bg-info-100 text-info-800 border-info-200" },
    "09:00–09:45": { curso: "Ciencias Naturales", catedratico: "Prof. M. Ajú", salon: "Lab. Ciencias", color: "bg-success-100 text-success-800 border-success-200" },
    "10:15–11:00": { curso: "Educación Física", catedratico: "Prof. J. Pérez", salon: "Cancha", color: "bg-teal-100 text-teal-800 border-teal-200" },
    "11:45–12:30": { curso: "Estudios Sociales", catedratico: "Prof.ª E. Morales", salon: "Aula 102", color: "bg-action-100 text-action-800 border-action-200" },
  },
};

export const MALLA_CNB = [
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
    grados: [
      { nombre: "Cuarto Bachillerato (Ciencias)", cursos: ["Matemática IV", "Física", "Química", "Biología", "Comunicación y Lenguaje", "Inglés IV", "Filosofía", "Educación Física"] },
      { nombre: "Quinto Bachillerato (Ciencias)", cursos: ["Matemática V", "Física II", "Química II", "Biología II", "Comunicación y Lenguaje", "Inglés V", "Estadística", "Educación Física"] },
      { nombre: "Sexto Bachillerato (Ciencias)", cursos: ["Seminario", "Matemática VI", "Física III", "Química Orgánica", "Biología III", "Inglés VI", "Estadística II"] },
    ]
  },
];

export const BECAS_DATA = [
  { id: "b1", alumno: "Lucía Fernanda Quiché Batz", grado: "3ro Básico A", porcentaje: 20, mensualidad: 1250, descuento: 250, total: 1000, desde: "01/2025", motivo: "Rendimiento académico" },
  { id: "b2", alumno: "María José Ajú Pac", grado: "3ro Básico A", porcentaje: 10, mensualidad: 1250, descuento: 125, total: 1125, desde: "01/2025", motivo: "Situación socioeconómica" },
  { id: "b3", alumno: "Ana Sofía Ixcot López", grado: "1ro Básico A", porcentaje: 25, mensualidad: 1250, descuento: 312.5, total: 937.5, desde: "01/2025", motivo: "Rendimiento académico" },
  { id: "b4", alumno: "Verónica Marisol Xoc Sic", grado: "2do Básico A", porcentaje: 15, mensualidad: 1250, descuento: 187.5, total: 1062.5, desde: "03/2025", motivo: "Situación socioeconómica" },
  { id: "b5", alumno: "Fernando Josué Tol Coche", grado: "2do Básico B", porcentaje: 10, mensualidad: 1250, descuento: 125, total: 1125, desde: "04/2025", motivo: "Hermano inscrito" },
];

export const METRICS_CONSOLIDADOS = {
  totalAlumnos: 1683,
  tasaAprobacion: 84,
  totalEnMora: 14,
  totalBecas: 186,
  tendencia: [72, 78, 80, 82, 84, 83, 84],
  meses: ["Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago"],
};
