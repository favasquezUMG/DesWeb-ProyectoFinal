/**
 * Definición estática de OpenAPI 3.0 para la API del Sistema Escolar.
 *
 * Se arma como objeto (en vez de comentarios JSDoc esparcidos en cada ruta)
 * para mantener las rutas limpias y controlar qué tan detallada queda la
 * documentación en un solo lugar. Los helpers de abajo solo evitan repetir
 * los mismos bloques (respuestas de error, envoltorios {status, data}) en
 * cada endpoint.
 */

// ---------- Helpers para no repetir bloques comunes ----------

const jsonBody = (schema: object) => ({
  content: { "application/json": { schema } },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

/** Respuesta { status: 'success', data: <schema> } */
const dataResponse = (description: string, schema: object) => ({
  description,
  ...jsonBody({
    type: "object",
    properties: { status: { type: "string", example: "success" }, data: schema },
  }),
});

/** Respuesta { status: 'success', data: [<schema>] } */
const listResponse = (description: string, itemSchema: object) => ({
  description,
  ...jsonBody({
    type: "object",
    properties: {
      status: { type: "string", example: "success" },
      data: { type: "array", items: itemSchema },
    },
  }),
});

const messageResponse = (description: string) => ({
  description,
  ...jsonBody(ref("SuccessMessage")),
});

const bearer = [{ bearerAuth: [] as string[] }];

const idParam = (name: string, description: string) => ({
  name,
  in: "path" as const,
  required: true,
  description,
  schema: { type: "integer" },
});

// Respuestas de error reutilizables (referenciadas por $ref en cada operación)
const commonErrors = {
  400: { $ref: "#/components/responses/BadRequest" },
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
  404: { $ref: "#/components/responses/NotFound" },
  500: { $ref: "#/components/responses/ServerError" },
};

/** Arma un CRUD estándar (list/get/create/update/delete) para un recurso. */
function crud(opts: {
  tag: string;
  base: string; // ej. /api/becas
  idName: string; // ej. becaId
  schema: string; // nombre del schema, ej. "Beca"
  inputSchema: string; // nombre del schema de entrada
  listQuery?: object[];
  auth?: boolean; // si requiere bearer (default true)
}) {
  const { tag, base, idName, schema, inputSchema, listQuery = [], auth = true } = opts;
  const security = auth ? bearer : undefined;
  const errors = auth
    ? { 401: commonErrors[401], 404: commonErrors[404], 500: commonErrors[500] }
    : { 404: commonErrors[404], 500: commonErrors[500] };

  return {
    [base]: {
      get: {
        tags: [tag],
        summary: `Listar ${tag.toLowerCase()}`,
        security,
        parameters: listQuery,
        responses: { 200: listResponse("Listado obtenido", ref(schema)), ...errors },
      },
      post: {
        tags: [tag],
        summary: `Crear ${tag.toLowerCase().replace(/s$/, "")}`,
        security,
        requestBody: jsonBody(ref(inputSchema)),
        responses: { 200: dataResponse("Creado", ref(schema)), 400: commonErrors[400], ...errors },
      },
    },
    [`${base}/{${idName}}`]: {
      get: {
        tags: [tag],
        summary: `Obtener ${tag.toLowerCase().replace(/s$/, "")} por ID`,
        security,
        parameters: [idParam(idName, `ID de ${tag.toLowerCase()}`)],
        responses: { 200: dataResponse("Encontrado", ref(schema)), ...errors },
      },
      put: {
        tags: [tag],
        summary: `Actualizar ${tag.toLowerCase().replace(/s$/, "")}`,
        security,
        parameters: [idParam(idName, `ID de ${tag.toLowerCase()}`)],
        requestBody: jsonBody(ref(inputSchema)),
        responses: { 200: dataResponse("Actualizado", ref(schema)), ...errors },
      },
      delete: {
        tags: [tag],
        summary: `Eliminar ${tag.toLowerCase().replace(/s$/, "")}`,
        security,
        parameters: [idParam(idName, `ID de ${tag.toLowerCase()}`)],
        responses: { 200: messageResponse("Eliminado"), ...errors },
      },
    },
  };
}

const q = (name: string, description: string, type: "integer" | "string" = "integer") => ({
  name,
  in: "query" as const,
  required: false,
  description,
  schema: { type },
});

// ---------- Documento OpenAPI ----------

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "API Sistema Escolar - DesWeb Proyecto Final",
    version: "1.0.0",
    description:
      "Documentación de los endpoints REST del backend (Express + Prisma). " +
      "Autenticación por JWT (Bearer). Usa `POST /api/auth/login` para obtener un token.",
  },
  servers: [{ url: "/api", description: "Prefijo base de la API" }],
  tags: [
    { name: "Auth" },
    { name: "Usuarios" },
    { name: "Roles" },
    { name: "Becas" },
    { name: "Alumnos" },
    { name: "Cursos" },
    { name: "CursoSeccion" },
    { name: "Actividades" },
    { name: "Notas" },
    { name: "Horarios" },
    { name: "Eventos" },
    { name: "Mail" },
    { name: "Reportes" },
    { name: "Pagos" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    responses: {
      BadRequest: { description: "Datos inválidos o incompletos", ...jsonBody(ref("ErrorResponse")) },
      Unauthorized: { description: "Falta token o es inválido", ...jsonBody(ref("ErrorResponse")) },
      Forbidden: { description: "No tiene permisos para esta acción", ...jsonBody(ref("ErrorResponse")) },
      NotFound: { description: "Recurso no encontrado", ...jsonBody(ref("ErrorResponse")) },
      ServerError: { description: "Error interno del servidor", ...jsonBody(ref("ErrorResponse")) },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "error" },
          message: { type: "string" },
        },
      },
      SuccessMessage: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          message: { type: "string" },
        },
      },

      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          token: { type: "string" },
          usuario: {
            type: "object",
            properties: {
              usuarioId: { type: "integer" },
              nombre: { type: "string" },
              email: { type: "string" },
              rol: { type: "string" },
            },
          },
        },
      },

      Usuario: {
        type: "object",
        properties: {
          usuarioId: { type: "integer" },
          nombres: { type: "string" },
          apellidos: { type: "string" },
          email: { type: "string" },
          rolId: { type: "integer" },
          sedeId: { type: "integer", nullable: true },
        },
      },
      UsuarioInput: {
        type: "object",
        required: ["nombres", "apellidos", "email", "password", "rolId"],
        properties: {
          nombres: { type: "string" },
          apellidos: { type: "string" },
          email: { type: "string" },
          password: { type: "string" },
          rolId: { type: "integer" },
          sedeId: { type: "integer", nullable: true },
        },
      },

      Rol: {
        type: "object",
        properties: { rolId: { type: "integer" }, nombre: { type: "string" } },
      },
      RolInput: {
        type: "object",
        required: ["nombre"],
        properties: { nombre: { type: "string" } },
      },

      Alumno: {
        type: "object",
        properties: {
          alumnoId: { type: "integer" },
          seccionId: { type: "integer" },
          usuario: {
            type: "object",
            properties: { nombres: { type: "string" }, apellidos: { type: "string" } },
          },
        },
      },

      Beca: {
        type: "object",
        properties: {
          becaId: { type: "integer" },
          alumnoId: { type: "integer" },
          porcentaje: { type: "number" },
          descripcion: { type: "string", nullable: true },
          fechaInicio: { type: "string", format: "date" },
          fechaFin: { type: "string", format: "date", nullable: true },
          activa: { type: "boolean" },
        },
      },
      BecaInput: {
        type: "object",
        required: ["alumnoId", "porcentaje", "fechaInicio"],
        properties: {
          alumnoId: { type: "integer" },
          porcentaje: { type: "number" },
          descripcion: { type: "string" },
          fechaInicio: { type: "string", format: "date" },
          fechaFin: { type: "string", format: "date" },
          activa: { type: "boolean" },
        },
      },

      Curso: {
        type: "object",
        properties: {
          cursoId: { type: "integer" },
          nombre: { type: "string" },
          descripcion: { type: "string", nullable: true },
        },
      },
      CursoInput: {
        type: "object",
        required: ["nombre"],
        properties: {
          nombre: { type: "string" },
          descripcion: { type: "string" },
          gradosIds: { type: "array", items: { type: "integer" }, description: "Grados a los que se asigna en la malla curricular" },
        },
      },

      CursoSeccion: {
        type: "object",
        properties: {
          cursoSeccionId: { type: "integer" },
          cursoId: { type: "integer" },
          seccionId: { type: "integer" },
          catedraticoId: { type: "integer" },
        },
      },
      CursoSeccionInput: {
        type: "object",
        required: ["cursoId", "seccionId", "catedraticoId"],
        properties: {
          cursoId: { type: "integer" },
          seccionId: { type: "integer" },
          catedraticoId: { type: "integer" },
        },
      },

      Actividad: {
        type: "object",
        properties: {
          actividadId: { type: "integer" },
          unidadId: { type: "integer" },
          nombre: { type: "string" },
          puntosMaximos: { type: "number" },
          fecha: { type: "string", format: "date", nullable: true },
        },
      },
      ActividadInput: {
        type: "object",
        required: ["unidadId", "nombre", "puntosMaximos"],
        properties: {
          unidadId: { type: "integer" },
          nombre: { type: "string" },
          puntosMaximos: { type: "number" },
          fecha: { type: "string", format: "date" },
        },
      },

      Nota: {
        type: "object",
        properties: {
          notaId: { type: "integer" },
          actividadId: { type: "integer" },
          alumnoId: { type: "integer" },
          valor: { type: "number" },
          fechaRegistro: { type: "string", format: "date-time" },
        },
      },
      NotaInput: {
        type: "object",
        required: ["actividadId", "alumnoId", "valor"],
        properties: {
          actividadId: { type: "integer" },
          alumnoId: { type: "integer" },
          valor: { type: "number" },
        },
      },
      NotaBulkInput: {
        type: "object",
        required: ["actividadId", "notas"],
        properties: {
          actividadId: { type: "integer" },
          notas: {
            type: "array",
            items: {
              type: "object",
              properties: { alumnoId: { type: "integer" }, valor: { type: "number" } },
            },
          },
        },
      },

      Horario: {
        type: "object",
        properties: {
          horarioId: { type: "integer" },
          cursoSeccionId: { type: "integer" },
          diaSemana: { type: "integer", description: "1 (Lunes) a 7 (Domingo)" },
          horaInicio: { type: "string", example: "07:00" },
          horaFin: { type: "string", example: "08:00" },
        },
      },
      HorarioInput: {
        type: "object",
        required: ["cursoSeccionId", "diaSemana", "horaInicio", "horaFin"],
        properties: {
          cursoSeccionId: { type: "integer" },
          diaSemana: { type: "integer", description: "1 (Lunes) a 7 (Domingo)" },
          horaInicio: { type: "string", example: "07:00" },
          horaFin: { type: "string", example: "08:00" },
        },
      },

      Evento: {
        type: "object",
        properties: {
          eventoId: { type: "integer" },
          sedeId: { type: "integer", nullable: true },
          nombre: { type: "string" },
          descripcion: { type: "string", nullable: true },
          fecha: { type: "string", format: "date" },
          tipoEvento: { type: "string" },
          enviarRecordatorio: { type: "boolean" },
        },
      },
      EventoInput: {
        type: "object",
        required: ["nombre", "fecha", "tipoEvento"],
        properties: {
          sedeId: { type: "integer" },
          nombre: { type: "string" },
          descripcion: { type: "string" },
          fecha: { type: "string", format: "date" },
          tipoEvento: { type: "string" },
          enviarRecordatorio: { type: "boolean" },
        },
      },

      Pago: {
        type: "object",
        properties: {
          pagoId: { type: "integer" },
          alumnoId: { type: "integer" },
          concepto: { type: "string", example: "Colegiatura" },
          anioLectivo: { type: "integer" },
          mes: { type: "integer", description: "1 a 12" },
          monto: { type: "number" },
          estado: { type: "string", enum: ["Pendiente", "Pagado", "Cancelado"] },
          stripeSessionId: { type: "string", nullable: true },
          fechaPago: { type: "string", format: "date-time", nullable: true },
        },
      },
      CotizacionColegiatura: {
        type: "object",
        properties: {
          alumno: { type: "string" },
          anioLectivo: { type: "integer" },
          mes: { type: "integer" },
          nombreMes: { type: "string" },
          montoBase: { type: "number" },
          descuentoPorcentaje: { type: "number" },
          montoFinal: { type: "number" },
          yaTienePago: { type: "boolean" },
          estadoPago: { type: "string", nullable: true },
        },
      },
      EstadoCuenta: {
        type: "object",
        properties: {
          alumno: { type: "string" },
          grado: { type: "string" },
          seccion: { type: "string" },
          anioLectivo: { type: "integer" },
          mesesPagados: { type: "integer" },
          mesesPendientes: { type: "integer" },
          totalPagado: { type: "number" },
          detalle: {
            type: "array",
            items: {
              type: "object",
              properties: {
                mes: { type: "integer" },
                nombreMes: { type: "string" },
                estado: { type: "string" },
                monto: { type: "number", nullable: true },
                fechaPago: { type: "string", format: "date-time", nullable: true },
              },
            },
          },
        },
      },
      CheckoutInput: {
        type: "object",
        required: ["alumnoId", "mes"],
        properties: {
          alumnoId: { type: "integer" },
          anioLectivo: { type: "integer", description: "Por defecto el año actual" },
          mes: { type: "integer", description: "1 a 12" },
        },
      },
      CheckoutResponse: {
        type: "object",
        properties: {
          pagoId: { type: "integer" },
          monto: { type: "number" },
          descuentoAplicado: { type: "number" },
          checkoutUrl: { type: "string", description: "URL de Stripe Checkout a la que redirigir al usuario" },
          sessionId: { type: "string" },
        },
      },
      VerificacionSesion: {
        type: "object",
        properties: {
          pagado: { type: "boolean" },
          estadoStripe: { type: "string" },
          estadoLocal: { type: "string", nullable: true },
          monto: { type: "number", nullable: true },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["Auth"],
        summary: "Estado del servicio (sin prefijo /api)",
        security: [],
        responses: { 200: { description: "API viva" } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Iniciar sesión y obtener JWT",
        security: [],
        requestBody: jsonBody(ref("LoginInput")),
        responses: {
          200: { description: "Login correcto", ...jsonBody(ref("LoginResponse")) },
          400: commonErrors[400],
          404: { description: "Credenciales inválidas", ...jsonBody(ref("ErrorResponse")) },
          500: commonErrors[500],
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Obtener el usuario autenticado a partir del token",
        security: bearer,
        responses: { 200: { description: "Usuario del token" }, 401: commonErrors[401], 403: commonErrors[403] },
      },
    },

    // Usuarios: requiere bearer en todas
    ...crud({ tag: "Usuarios", base: "/usuarios", idName: "id", schema: "Usuario", inputSchema: "UsuarioInput" }),

    // Roles y Becas: sin middleware de auth activo por ahora (ver rol.routes.ts / beca.routes.ts)
    ...crud({
      tag: "Roles",
      base: "/roles/all",
      idName: "id",
      schema: "Rol",
      inputSchema: "RolInput",
      auth: false,
    }),
    ...crud({
      tag: "Becas",
      base: "/becas/all",
      idName: "id",
      schema: "Beca",
      inputSchema: "BecaInput",
      auth: false,
      listQuery: [q("activa", "Filtrar por becas activas (true/false)", "string")],
    }),

    "/alumnos/all": {
      get: {
        tags: ["Alumnos"],
        summary: "Listar alumnos",
        parameters: [q("seccionId", "Filtrar por sección")],
        responses: { 200: listResponse("Listado de alumnos", ref("Alumno")), 500: commonErrors[500] },
      },
    },

    ...crud({
      tag: "Cursos",
      base: "/cursos",
      idName: "id",
      schema: "Curso",
      inputSchema: "CursoInput",
      listQuery: [q("gradoId", "Filtrar cursos asignados a un grado")],
    }),
    "/cursos/{id}/grados": {
      post: {
        tags: ["Cursos"],
        summary: "Asignar el curso a la malla curricular de un grado",
        security: bearer,
        parameters: [idParam("id", "ID de curso")],
        requestBody: jsonBody({ type: "object", required: ["gradoId"], properties: { gradoId: { type: "integer" } } }),
        responses: { 200: messageResponse("Asignado"), ...commonErrors },
      },
    },
    "/cursos/{id}/grados/{gradoId}": {
      delete: {
        tags: ["Cursos"],
        summary: "Quitar el curso de la malla curricular de un grado",
        security: bearer,
        parameters: [idParam("id", "ID de curso"), idParam("gradoId", "ID de grado")],
        responses: { 200: messageResponse("Eliminado"), ...commonErrors },
      },
    },

    ...crud({
      tag: "CursoSeccion",
      base: "/curso-seccion",
      idName: "id",
      schema: "CursoSeccion",
      inputSchema: "CursoSeccionInput",
      listQuery: [
        q("seccionId", "Filtrar por sección"),
        q("catedraticoId", "Filtrar por catedrático"),
        q("sedeId", "Filtrar por sede"),
      ],
    }),
    "/curso-seccion/catedratico/{catedraticoId}": {
      get: {
        tags: ["CursoSeccion"],
        summary: "Cursos-sección asignados a un catedrático",
        security: bearer,
        parameters: [idParam("catedraticoId", "ID de catedrático")],
        responses: { 200: listResponse("Listado", ref("CursoSeccion")), ...commonErrors },
      },
    },

    ...crud({
      tag: "Actividades",
      base: "/actividades",
      idName: "id",
      schema: "Actividad",
      inputSchema: "ActividadInput",
    }),
    "/actividades/unidad/{unidadId}": {
      get: {
        tags: ["Actividades"],
        summary: "Actividades de una unidad",
        security: bearer,
        parameters: [idParam("unidadId", "ID de unidad")],
        responses: { 200: listResponse("Listado", ref("Actividad")), ...commonErrors },
      },
    },

    "/notas/actividad/{activityId}": {
      get: {
        tags: ["Notas"],
        summary: "Notas registradas para una actividad",
        security: bearer,
        parameters: [idParam("activityId", "ID de actividad")],
        responses: { 200: listResponse("Listado", ref("Nota")), ...commonErrors },
      },
    },
    "/notas/estudiante/{studentId}": {
      get: {
        tags: ["Notas"],
        summary: "Notas de un estudiante",
        security: bearer,
        parameters: [idParam("studentId", "ID de alumno")],
        responses: { 200: listResponse("Listado", ref("Nota")), ...commonErrors },
      },
    },
    "/notas": {
      get: {
        tags: ["Notas"],
        summary: "Listar todas las notas (solo administradores)",
        security: bearer,
        responses: { 200: listResponse("Listado", ref("Nota")), ...commonErrors },
      },
      post: {
        tags: ["Notas"],
        summary: "Registrar o actualizar una nota",
        security: bearer,
        requestBody: jsonBody(ref("NotaInput")),
        responses: { 200: dataResponse("Guardada", ref("Nota")), ...commonErrors },
      },
    },
    "/notas/bulk": {
      post: {
        tags: ["Notas"],
        summary: "Registrar o actualizar varias notas de una actividad",
        security: bearer,
        requestBody: jsonBody(ref("NotaBulkInput")),
        responses: { 200: dataResponse("Guardadas", { type: "array", items: ref("Nota") }), ...commonErrors },
      },
    },

    ...crud({
      tag: "Horarios",
      base: "/horarios",
      idName: "id",
      schema: "Horario",
      inputSchema: "HorarioInput",
      listQuery: [
        q("cursoSeccionId", "Filtrar por curso-sección"),
        q("catedraticoId", "Filtrar por catedrático"),
        q("seccionId", "Filtrar por sección"),
        q("diaSemana", "Filtrar por día (1-7)"),
      ],
    }),
    "/horarios/verificar": {
      post: {
        tags: ["Horarios"],
        summary: "Verificar choque de horario antes de guardar (no persiste nada)",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          required: ["cursoSeccionId", "diaSemana", "horaInicio", "horaFin"],
          properties: {
            cursoSeccionId: { type: "integer" },
            horarioId: { type: "integer", description: "Excluir este horario de la validación (al editar)" },
            diaSemana: { type: "integer" },
            horaInicio: { type: "string", example: "07:00" },
            horaFin: { type: "string", example: "08:00" },
          },
        }),
        responses: { 200: { description: "Resultado de la verificación" }, ...commonErrors },
      },
    },

    ...crud({
      tag: "Eventos",
      base: "/events",
      idName: "id",
      schema: "Evento",
      inputSchema: "EventoInput",
      listQuery: [q("sedeId", "Filtrar por sede")],
    }),

    "/mail/test": {
      post: {
        tags: ["Mail"],
        summary: "Enviar un correo de prueba (endpoint temporal, sin auth)",
        requestBody: jsonBody({
          type: "object",
          required: ["to"],
          properties: {
            to: { type: "string", format: "email" },
            usuarioId: { type: "integer" },
            titulo: { type: "string" },
            mensaje: { type: "string" },
          },
        }),
        responses: { 200: messageResponse("Correo enviado"), 400: commonErrors[400], 502: { description: "Falló el envío" } },
      },
    },

    "/reportes/notas-por-catedratico/{catedraticoId}": {
      get: {
        tags: ["Reportes"],
        summary: "Reporte de notas por catedrático (JSON o PDF, sin auth por ahora)",
        parameters: [
          idParam("catedraticoId", "ID de catedrático"),
          q("formato", "\"json\" para JSON, cualquier otro valor devuelve PDF", "string"),
        ],
        responses: { 200: { description: "Reporte en JSON o el PDF" }, 404: commonErrors[404], 500: commonErrors[500] },
      },
    },
    "/reportes/alumnos-por-rango": {
      get: {
        tags: ["Reportes"],
        summary: "Reporte de alumnos aprobados/reprobados por sección (JSON o PDF, sin auth por ahora)",
        parameters: [
          q("seccionId", "ID de sección (obligatorio)"),
          q("formato", "\"json\" para JSON, cualquier otro valor devuelve PDF", "string"),
        ],
        responses: { 200: { description: "Reporte en JSON o el PDF" }, 400: commonErrors[400], 404: commonErrors[404], 500: commonErrors[500] },
      },
    },

    "/pagos": {
      get: {
        tags: ["Pagos"],
        summary: "Listar pagos",
        security: bearer,
        parameters: [
          q("alumnoId", "Filtrar por alumno"),
          q("anioLectivo", "Filtrar por año lectivo"),
          q("mes", "Filtrar por mes (1-12)"),
          q("estado", "Filtrar por estado (Pendiente/Pagado/Cancelado)", "string"),
        ],
        responses: { 200: listResponse("Listado de pagos", ref("Pago")), ...commonErrors },
      },
    },
    "/pagos/{id}": {
      get: {
        tags: ["Pagos"],
        summary: "Obtener un pago por ID",
        security: bearer,
        parameters: [idParam("id", "ID de pago")],
        responses: { 200: dataResponse("Encontrado", ref("Pago")), ...commonErrors },
      },
    },
    "/pagos/cotizar/{alumnoId}": {
      get: {
        tags: ["Pagos"],
        summary: "Cotizar la colegiatura de un mes (aplica beca si tiene)",
        security: bearer,
        parameters: [
          idParam("alumnoId", "ID de alumno"),
          q("anioLectivo", "Por defecto el año actual"),
          q("mes", "Por defecto el mes actual (1-12)"),
        ],
        responses: { 200: dataResponse("Cotización calculada", ref("CotizacionColegiatura")), ...commonErrors },
      },
    },
    "/pagos/estado-cuenta/{alumnoId}": {
      get: {
        tags: ["Pagos"],
        summary: "Estado de cuenta del alumno (meses pagados/pendientes del ciclo escolar)",
        security: bearer,
        parameters: [idParam("alumnoId", "ID de alumno"), q("anioLectivo", "Por defecto el año actual")],
        responses: { 200: dataResponse("Estado de cuenta", ref("EstadoCuenta")), ...commonErrors },
      },
    },
    "/pagos/verificar/{sessionId}": {
      get: {
        tags: ["Pagos"],
        summary: "Verificar en Stripe el estado real de una sesión de checkout",
        description:
          "Consulta directo a Stripe (no la base local) el estado de una sesión. " +
          "Útil para la pantalla de confirmación a la que vuelve el usuario tras pagar; " +
          "no reemplaza al webhook, que es lo que efectivamente marca el pago como completado.",
        security: bearer,
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            description: "ID de la sesión de Stripe Checkout (cs_...)",
            schema: { type: "string" },
          },
        ],
        responses: { 200: dataResponse("Estado de la sesión", ref("VerificacionSesion")), ...commonErrors },
      },
    },
    "/pagos/checkout": {
      post: {
        tags: ["Pagos"],
        summary: "Crear una sesión de Stripe Checkout para pagar la colegiatura",
        description:
          "Crea la sesión de pago en Stripe y registra el pago localmente en estado " +
          "'Pendiente'. Devuelve `checkoutUrl`, a donde debe redirigirse al usuario para " +
          "completar el pago con tarjeta. El pago solo queda 'Pagado' cuando llega el " +
          "webhook de Stripe (`POST /api/pagos/webhook`, fuera de esta documentación porque " +
          "no lleva JWT: Stripe no puede loguearse, se valida con la firma del webhook).\n\n" +
          "Solo puede pagar el propio alumno, uno de sus encargados, o un administrador.",
        security: bearer,
        requestBody: jsonBody(ref("CheckoutInput")),
        responses: {
          201: dataResponse("Sesión de checkout creada", ref("CheckoutResponse")),
          400: commonErrors[400],
          401: commonErrors[401],
          403: commonErrors[403],
          404: commonErrors[404],
          409: { description: "Ya está pagado ese mes", ...jsonBody(ref("ErrorResponse")) },
          500: commonErrors[500],
        },
      },
    },
  },
};
