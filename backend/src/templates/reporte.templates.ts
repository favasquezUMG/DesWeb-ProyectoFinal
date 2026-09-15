/**
 * Plantillas HTML para los reportes en PDF. No usan la plantilla de correo
 * porque van orientadas a impresión (tablas, márgenes, sin envoltorio de card).
 */

const NOMBRE_COLEGIO = process.env.COLEGIO_NOMBRE || "DERCAS - Sistema Escolar";

const documentoBase = (tituloReporte: string, contenidoHtml: string): string => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
    <title>${tituloReporte}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 12px;
            margin: 0;
        }
        .encabezado {
            border-bottom: 2px solid #1d4ed8;
            padding-bottom: 10px;
            margin-bottom: 18px;
        }
        .encabezado h1 {
            margin: 0;
            font-size: 18px;
            color: #1d4ed8;
        }
        .encabezado h2 {
            margin: 4px 0 10px 0;
            font-size: 14px;
            color: #111827;
        }
        .meta {
            width: 100%;
            font-size: 11px;
            color: #374151;
            border-collapse: collapse;
        }
        .meta td { padding: 2px 0; }
        h3.seccion-titulo {
            font-size: 13px;
            color: #1d4ed8;
            margin: 20px 0 6px 0;
        }
        table.datos {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 14px;
        }
        table.datos th, table.datos td {
            border: 1px solid #d1d5db;
            padding: 5px 8px;
            text-align: left;
        }
        table.datos th {
            background-color: #eff6ff;
            color: #1e3a8a;
        }
        table.datos td.numero { text-align: center; }
        .sin-datos {
            color: #6b7280;
            font-style: italic;
            margin: 6px 0 16px 0;
        }
        .bloque-reprobados h3 { color: #b91c1c; }
        .bloque-aprobados h3 { color: #15803d; }
    </style>
</head>
<body>
    ${contenidoHtml}
</body>
</html>
`;

const encabezado = (subtitulo: string, sede: string, cicloEscolar: string): string => `
    <div class="encabezado">
        <h1>${NOMBRE_COLEGIO}</h1>
        <h2>${subtitulo}</h2>
        <table class="meta">
            <tr>
                <td><strong>Sede:</strong> ${sede}</td>
                <td><strong>Ciclo escolar:</strong> ${cicloEscolar}</td>
            </tr>
            <tr>
                <td colspan="2"><strong>Fecha de generación:</strong> ${new Date().toLocaleString("es-GT")}</td>
            </tr>
        </table>
    </div>
`;

interface UnidadNota {
    numero: number;
    nota: number;
}

interface FilaAlumnoCurso {
    alumnoId: number;
    nombre: string;
    unidades: UnidadNota[];
    total: number;
}

interface CursoReporte {
    cursoSeccionId: number;
    curso: string;
    seccion: string;
    alumnos: FilaAlumnoCurso[];
}

export interface ReporteNotasPorCatedratico {
    catedratico: { catedraticoId: number; nombre: string; especialidad: string | null };
    sede: string;
    cicloEscolar: string;
    cursos: CursoReporte[];
}

export const plantillaReporteNotasPorCatedratico = (reporte: ReporteNotasPorCatedratico): string => {
    const tablasPorCurso = reporte.cursos
        .map((curso) => {
            const numerosUnidad = curso.alumnos[0]?.unidades.map((u) => u.numero) ?? [1, 2, 3, 4];

            const filas = curso.alumnos.length
                ? curso.alumnos
                      .map(
                          (a) => `
                <tr>
                    <td>${a.nombre}</td>
                    ${a.unidades.map((u) => `<td class="numero">${u.nota.toFixed(2)}</td>`).join("")}
                    <td class="numero"><strong>${a.total.toFixed(2)}</strong></td>
                </tr>`
                      )
                      .join("")
                : `<tr><td colspan="${numerosUnidad.length + 2}" class="sin-datos">No hay alumnos inscritos en esta sección.</td></tr>`;

            return `
            <h3 class="seccion-titulo">${curso.curso} — ${curso.seccion}</h3>
            <table class="datos">
                <thead>
                    <tr>
                        <th>Alumno</th>
                        ${numerosUnidad.map((n) => `<th>Unidad ${n}</th>`).join("")}
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${filas}
                </tbody>
            </table>`;
        })
        .join("");

    const contenido = `
        ${encabezado(`Notas por catedrático: ${reporte.catedratico.nombre}`, reporte.sede, reporte.cicloEscolar)}
        ${
            reporte.cursos.length
                ? tablasPorCurso
                : `<p class="sin-datos">Este catedrático no tiene cursos-sección asignados.</p>`
        }
    `;

    return documentoBase(`Notas por catedrático - ${reporte.catedratico.nombre}`, contenido);
};

interface FilaAlumnoPromedio {
    alumnoId: number;
    nombre: string;
    promedio: number;
}

export interface ReporteAlumnosPorRango {
    sede: string;
    cicloEscolar: string;
    seccion: string;
    reprobados: FilaAlumnoPromedio[];
    aprobados: FilaAlumnoPromedio[];
}

const tablaAlumnosPromedio = (alumnos: FilaAlumnoPromedio[]): string =>
    alumnos.length
        ? `
        <table class="datos">
            <thead>
                <tr><th>Alumno</th><th>Promedio</th></tr>
            </thead>
            <tbody>
                ${alumnos
                    .map((a) => `<tr><td>${a.nombre}</td><td class="numero">${a.promedio.toFixed(2)}</td></tr>`)
                    .join("")}
            </tbody>
        </table>`
        : `<p class="sin-datos">No hay alumnos en este rango.</p>`;

export const plantillaReporteAlumnosPorRango = (reporte: ReporteAlumnosPorRango): string => {
    const contenido = `
        ${encabezado(`Alumnos por rango de nota: ${reporte.seccion}`, reporte.sede, reporte.cicloEscolar)}
        <div class="bloque-reprobados">
            <h3>Reprobados (0 - 60)</h3>
            ${tablaAlumnosPromedio(reporte.reprobados)}
        </div>
        <div class="bloque-aprobados">
            <h3>Aprobados (61 - 100)</h3>
            ${tablaAlumnosPromedio(reporte.aprobados)}
        </div>
    `;

    return documentoBase(`Alumnos por rango - ${reporte.seccion}`, contenido);
};
