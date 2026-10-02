const jsonBody = (schema: object) => ({
  content: { "application/json": { schema } },
});

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const dataResponse = (description: string, schema: object) => ({
  description,
  ...jsonBody({
    type: "object",
    properties: { status: { type: "string", example: "success" }, data: schema },
  }),
});

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

const commonErrors = {
  400: { $ref: "#/components/responses/BadRequest" },
  401: { $ref: "#/components/responses/Unauthorized" },
  403: { $ref: "#/components/responses/Forbidden" },
  404: { $ref: "#/components/responses/NotFound" },
  500: { $ref: "#/components/responses/ServerError" },
};

function crud(opts: {
  tag: string;
  base: string;
  idName: string;
  schema: string;
  inputSchema: string;
  listQuery?: object[];
  auth?: boolean;
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
    { name: "Conducta" },
    { name: "Notificaciones" },
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
          rolId: { type: "integer", description: "Opcional: con qué rol entrar si la persona tiene varios" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          token: { type: "string", description: "JWT con el rol activo" },
          usuario: {
            type: "object",
            properties: {
              usuarioId: { type: "integer" },
              nombre: { type: "string" },
              apellidos: { type: "string" },
              email: { type: "string" },
              rol: { type: "string", description: "Rol activo" },
              rolId: { type: "integer" },
              sedeId: { type: "integer", nullable: true },
              sede: { type: "string", nullable: true },
              roles: {
                type: "array",
                description: "Todos los roles de la persona (ej. Catedratico + Encargado)",
                items: { type: "object", properties: { rolId: { type: "integer" }, nombre: { type: "string" } } },
              },
              permisos: { type: "array", items: { type: "string" }, description: "Módulos administrativos del rol activo" },
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
          rolId: { type: "integer", description: "Rol principal" },
          sedeId: { type: "integer", nullable: true },
          deletedAt: { type: "string", format: "date-time", nullable: true, description: "Fecha de baja (null = activo)" },
          rol: { type: "object", properties: { rolId: { type: "integer" }, nombre: { type: "string" } } },
          rolesAdicionales: { type: "array", items: { type: "object", properties: { rolId: { type: "integer" } } } },
          passwordTemporal: { type: "string", nullable: true, description: "Solo al crear sin contraseña: se muestra una única vez" },
        },
      },
      UsuarioInput: {
        type: "object",
        required: ["nombres", "apellidos", "email", "rolId"],
        properties: {
          nombres: { type: "string" },
          apellidos: { type: "string" },
          email: { type: "string" },
          password: { type: "string", description: "Opcional: sin ella se genera una contraseña temporal" },
          rolId: { type: "integer" },
          rolesAdicionales: { type: "array", items: { type: "integer" } },
          sedeId: { type: "integer", nullable: true, description: "Solo Administrador General; el resto crea en su sede" },
          especialidad: { type: "string", description: "Si es catedrático" },
          seccionId: { type: "integer", description: "Obligatorio si el rol es Alumno" },
          fechaNacimiento: { type: "string", format: "date" },
        },
      },

      Rol: {
        type: "object",
        properties: {
          rolId: { type: "integer" },
          nombre: { type: "string" },
          descripcion: { type: "string", nullable: true },
          esSistema: { type: "boolean", description: "Los roles de sistema no se renombran ni eliminan" },
          tipo: { type: "string", enum: ["global", "comunidad", "personal"] },
          permisos: { type: "array", items: { type: "string", enum: ["usuarios", "alumnos", "matriculas", "horarios", "notas", "asistencia", "conducta", "becas", "pagos", "comunicados", "calendario", "reportes"] } },
          permisosEditables: { type: "boolean" },
          usuarios: { type: "integer" },
        },
      },
      RolInput: {
        type: "object",
        required: ["nombre"],
        properties: {
          nombre: { type: "string", example: "Secretaría" },
          descripcion: { type: "string" },
          permisos: { type: "array", items: { type: "string", enum: ["usuarios", "alumnos", "matriculas", "horarios", "notas", "asistencia", "conducta", "becas", "pagos", "comunicados", "calendario", "reportes"] } },
        },
      },
      VinculoEncargado: {
        type: "object",
        description: "Vínculo de un alumno con un adulto responsable",
        properties: {
          encargadoId: { type: "integer" },
          parentesco: { type: "string", nullable: true, example: "Padre" },
          esPrincipal: { type: "boolean", description: "Contacto principal (uno por alumno)" },
          responsableFinanciero: { type: "boolean", description: "Paga la colegiatura (al menos uno)" },
          tieneCustodia: { type: "boolean" },
          autorizadoRecoger: { type: "boolean" },
          puedeVerNotas: { type: "boolean" },
          puedeVerPagos: { type: "boolean" },
          recibeNotificaciones: { type: "boolean" },
          restringido: { type: "boolean", description: "Orden judicial: sin ningún acceso" },
          motivoRestriccion: { type: "string", nullable: true },
          vigenteHasta: { type: "string", format: "date", nullable: true, description: "Tutor temporal" },
          activo: { type: "boolean" },
          observaciones: { type: "string", nullable: true },
        },
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
          programaId: { type: "integer", nullable: true },
          anioLectivo: { type: "integer", example: 2026 },
          porcentaje: { type: "number" },
          descripcion: { type: "string", nullable: true },
          fechaInicio: { type: "string", format: "date" },
          fechaFin: { type: "string", format: "date" },
          estado: { type: "string", enum: ["Solicitada", "Activa", "Rechazada", "Suspendida", "Revocada", "Finalizada"] },
          solicitadaPorId: { type: "integer", nullable: true },
          programa: {
            type: "object",
            nullable: true,
            properties: { programaId: { type: "integer" }, nombre: { type: "string" }, tipo: { type: "string" } },
          },
          historial: { type: "array", items: { $ref: "#/components/schemas/BecaHistorial" } },
        },
      },
      BecaHistorial: {
        type: "object",
        properties: {
          historialId: { type: "integer" },
          estadoAnterior: { type: "string", nullable: true },
          estadoNuevo: { type: "string" },
          motivo: { type: "string" },
          usuarioId: { type: "integer", nullable: true, description: "null = cambio automático del sistema" },
          fecha: { type: "string", format: "date-time" },
        },
      },
      BecaInput: {
        type: "object",
        required: ["alumnoId", "programaId"],
        properties: {
          alumnoId: { type: "integer" },
          programaId: { type: "integer" },
          porcentaje: { type: "number", description: "Opcional; por defecto el del programa" },
          descripcion: { type: "string" },
          fechaInicio: { type: "string", format: "date", description: "Por defecto hoy (dentro del ciclo)" },
          fechaFin: { type: "string", format: "date", description: "Por defecto fin del ciclo" },
        },
      },
      BecaUpdateInput: {
        type: "object",
        properties: {
          porcentaje: { type: "number" },
          descripcion: { type: "string" },
          fechaInicio: { type: "string", format: "date" },
          fechaFin: { type: "string", format: "date" },
        },
      },
      BecaEstadoInput: {
        type: "object",
        required: ["estado", "motivo"],
        properties: {
          estado: { type: "string", enum: ["Activa", "Rechazada", "Suspendida", "Revocada", "Finalizada"] },
          motivo: { type: "string", example: "Cumple con los requisitos del programa." },
        },
      },
      ProgramaBeca: {
        type: "object",
        properties: {
          programaId: { type: "integer" },
          sedeId: { type: "integer" },
          anioLectivo: { type: "integer" },
          nombre: { type: "string", example: "Excelencia académica" },
          tipo: { type: "string", enum: ["Merito", "Socioeconomica", "Deportiva", "Convenio", "Otro"] },
          descripcion: { type: "string", nullable: true },
          porcentaje: { type: "number", example: 50 },
          cupos: { type: "integer", nullable: true, description: "null = sin límite" },
          cuposUsados: { type: "integer" },
          cuposDisponibles: { type: "integer", nullable: true },
          promedioMinimo: { type: "number", nullable: true },
          pierdePorConductaGrave: { type: "boolean" },
          permiteSolicitud: { type: "boolean" },
          activo: { type: "boolean" },
        },
      },
      ProgramaBecaInput: {
        type: "object",
        required: ["nombre", "tipo", "porcentaje"],
        properties: {
          sedeId: { type: "integer", description: "Solo el administrador general; el de sede usa la suya" },
          anioLectivo: { type: "integer" },
          nombre: { type: "string" },
          tipo: { type: "string", enum: ["Merito", "Socioeconomica", "Deportiva", "Convenio", "Otro"] },
          descripcion: { type: "string" },
          porcentaje: { type: "number" },
          cupos: { type: "integer", nullable: true },
          promedioMinimo: { type: "number", nullable: true },
          pierdePorConductaGrave: { type: "boolean" },
          permiteSolicitud: { type: "boolean" },
          activo: { type: "boolean" },
        },
      },
      PoliticaBeca: {
        type: "object",
        properties: {
          sedeId: { type: "integer" },
          anioLectivo: { type: "integer" },
          presupuestoMensual: { type: "number", nullable: true, description: "Monto máximo que la sede deja de cobrar al mes por becas" },
          descuentoHermanos: { type: "number", description: "% para el 2do hijo en adelante" },
          descuentoMaximo: { type: "number", description: "Tope de beca + hermanos" },
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
          descuentoPorcentaje: { type: "number", description: "Descuento total aplicado (beca + hermanos, con tope)" },
          descuentoBeca: { type: "number" },
          descuentoHermanos: { type: "number" },
          programaBeca: { type: "string", nullable: true },
          topeAplicado: { type: "boolean" },
          montoFinal: { type: "number" },
          exonerado: { type: "boolean", description: "true si el mes está cubierto al 100%" },
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
          mesesExonerados: { type: "integer" },
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
        summary: "Perfil del usuario con su rol activo, todos sus roles y permisos",
        security: bearer,
        responses: { 200: { description: "Usuario del token" }, 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/auth/cambiar-rol": {
      post: {
        tags: ["Auth"],
        summary: "Cambiar de rol sin cerrar sesión (ej. catedrático que también es padre)",
        security: bearer,
        requestBody: jsonBody({ type: "object", required: ["rolId"], properties: { rolId: { type: "integer" } } }),
        responses: {
          200: { description: "Token nuevo con el rol pedido", ...jsonBody(ref("LoginResponse")) },
          403: { description: "No tiene asignado ese rol", ...jsonBody(ref("ErrorResponse")) },
        },
      },
    },

    "/usuarios": {
      get: {
        tags: ["Usuarios"],
        summary: "Listar usuarios (permiso 'usuarios'; el personal de sede solo ve su sede y no ve administradores)",
        security: bearer,
        parameters: [
          q("q", "Buscar por nombre o correo", "string"),
          q("rolId", "Filtrar por rol (principal o adicional)"),
          q("estado", "activos (defecto) | inactivos | todos", "string"),
          q("sedeId", "Solo Administrador General"),
        ],
        responses: { 200: listResponse("Usuarios", ref("Usuario")), 401: commonErrors[401], 403: commonErrors[403] },
      },
      post: {
        tags: ["Usuarios"],
        summary: "Crear usuario. Nadie puede asignar un rol con más permisos que los propios",
        security: bearer,
        requestBody: jsonBody(ref("UsuarioInput")),
        responses: { 201: dataResponse("Usuario creado", ref("Usuario")), 400: commonErrors[400], 403: commonErrors[403], 409: { description: "Correo repetido" } },
      },
    },
    "/usuarios/{id}": {
      get: {
        tags: ["Usuarios"],
        summary: "Ficha del usuario con dependencias (cursos, alumnos a cargo) y bitácora",
        security: bearer,
        parameters: [idParam("id", "ID de usuario")],
        responses: { 200: dataResponse("Usuario", ref("Usuario")), ...commonErrors },
      },
      put: {
        tags: ["Usuarios"],
        summary: "Modificar datos, rol principal, sede o contraseña (no se puede cambiar el rol propio)",
        security: bearer,
        parameters: [idParam("id", "ID de usuario")],
        requestBody: jsonBody(ref("UsuarioInput")),
        responses: { 200: dataResponse("Usuario actualizado", ref("Usuario")), ...commonErrors, 409: { description: "El rol anterior tiene dependencias" } },
      },
      delete: {
        tags: ["Usuarios"],
        summary: "Dar de baja (equivale a PATCH estado con activo=false)",
        security: bearer,
        parameters: [idParam("id", "ID de usuario")],
        responses: { 200: messageResponse("Cuenta dada de baja"), ...commonErrors },
      },
    },
    "/usuarios/{id}/roles": {
      put: {
        tags: ["Usuarios"],
        summary: "Definir los roles adicionales del usuario",
        security: bearer,
        parameters: [idParam("id", "ID de usuario")],
        requestBody: jsonBody({ type: "object", properties: { rolesAdicionales: { type: "array", items: { type: "integer" } } } }),
        responses: { 200: dataResponse("Roles actualizados", ref("Usuario")), ...commonErrors, 409: { description: "No se puede quitar el rol (cursos asignados, único encargado...)" } },
      },
    },
    "/usuarios/{id}/estado": {
      patch: {
        tags: ["Usuarios"],
        summary: "Dar de baja o reactivar una cuenta",
        description:
          "No se permite: darse de baja a sí mismo, dejar al colegio sin Administrador General, dar de baja a un catedrático " +
          "con cursos asignados ni a un encargado que es el único responsable de algún alumno.",
        security: bearer,
        parameters: [idParam("id", "ID de usuario")],
        requestBody: jsonBody({ type: "object", required: ["activo", "motivo"], properties: { activo: { type: "boolean" }, motivo: { type: "string" } } }),
        responses: { 200: messageResponse("Estado actualizado"), ...commonErrors, 409: { description: "Tiene dependencias" } },
      },
    },

    "/roles/all": {
      get: {
        tags: ["Roles"],
        summary: "Listar roles con sus permisos y cantidad de usuarios",
        security: bearer,
        responses: { 200: listResponse("Roles", ref("Rol")), 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/roles/modulos": {
      get: {
        tags: ["Roles"],
        summary: "Módulos que se pueden asignar en la matriz de permisos",
        security: bearer,
        responses: { 200: { description: "Lista de módulos" } },
      },
    },
    "/roles": {
      post: {
        tags: ["Roles"],
        summary: "Crear rol del personal (solo Administrador General)",
        security: bearer,
        requestBody: jsonBody(ref("RolInput")),
        responses: { 201: dataResponse("Rol creado", ref("Rol")), 400: commonErrors[400], 403: commonErrors[403], 409: { description: "Nombre repetido" } },
      },
    },
    "/roles/{id}": {
      get: {
        tags: ["Roles"],
        summary: "Obtener rol",
        security: bearer,
        parameters: [idParam("id", "ID de rol")],
        responses: { 200: dataResponse("Rol", ref("Rol")), ...commonErrors },
      },
      put: {
        tags: ["Roles"],
        summary: "Renombrar o describir un rol (los de sistema no se renombran)",
        security: bearer,
        parameters: [idParam("id", "ID de rol")],
        requestBody: jsonBody({ type: "object", properties: { nombre: { type: "string" }, descripcion: { type: "string" } } }),
        responses: { 200: dataResponse("Rol actualizado", ref("Rol")), ...commonErrors, 409: { description: "Rol de sistema o nombre repetido" } },
      },
      delete: {
        tags: ["Roles"],
        summary: "Eliminar un rol del colegio sin usuarios",
        security: bearer,
        parameters: [idParam("id", "ID de rol")],
        responses: { 200: messageResponse("Rol eliminado"), ...commonErrors, 409: { description: "Rol de sistema o con usuarios" } },
      },
    },
    "/roles/{id}/permisos": {
      put: {
        tags: ["Roles"],
        summary: "Guardar los módulos a los que tiene acceso un rol del personal (aplica de inmediato)",
        security: bearer,
        parameters: [idParam("id", "ID de rol")],
        requestBody: jsonBody({ type: "object", required: ["permisos"], properties: { permisos: { type: "array", items: { type: "string" } } } }),
        responses: { 200: dataResponse("Permisos guardados", ref("Rol")), ...commonErrors },
      },
    },
    "/sedes": {
      get: {
        tags: ["Usuarios"],
        summary: "Sedes activas (para formularios)",
        security: bearer,
        responses: { 200: { description: "Sedes" } },
      },
    },
    "/becas/all": {
      get: {
        tags: ["Becas"],
        summary: "Listar becas (administración; el admin de sede solo ve la suya)",
        security: bearer,
        parameters: [
          q("estado", "Uno o varios estados separados por coma (Activa,Suspendida)", "string"),
          q("anioLectivo", "Ciclo lectivo"),
          q("programaId", "Filtrar por programa"),
          q("alumnoId", "Filtrar por alumno"),
          q("sedeId", "Solo administrador general"),
        ],
        responses: { 200: listResponse("Listado de becas", ref("Beca")), 401: commonErrors[401], 403: commonErrors[403], 500: commonErrors[500] },
      },
    },
    "/becas/resumen": {
      get: {
        tags: ["Becas"],
        summary: "Resumen del ciclo: colegiatura, presupuesto usado/disponible y conteo por estado",
        security: bearer,
        parameters: [q("anioLectivo", "Ciclo lectivo"), q("sedeId", "Solo administrador general")],
        responses: { 200: { description: "Resumen" }, 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/becas": {
      post: {
        tags: ["Becas"],
        summary: "Asignar una beca (queda Activa). Valida cupos, promedio, conducta, presupuesto y que no tenga otra beca vigente",
        security: bearer,
        requestBody: jsonBody(ref("BecaInput")),
        responses: {
          201: dataResponse("Beca asignada", ref("Beca")),
          400: commonErrors[400],
          403: commonErrors[403],
          404: commonErrors[404],
          409: { description: "No cumple una regla (sin cupos, sin presupuesto, ya tiene beca...)", ...jsonBody(ref("ErrorResponse")) },
        },
      },
    },
    "/becas/{id}": {
      get: {
        tags: ["Becas"],
        summary: "Obtener beca con su historial",
        security: bearer,
        parameters: [idParam("id", "ID de beca")],
        responses: { 200: dataResponse("Beca", ref("Beca")), ...commonErrors },
      },
      put: {
        tags: ["Becas"],
        summary: "Modificar porcentaje, fechas u observaciones (queda en el historial)",
        security: bearer,
        parameters: [idParam("id", "ID de beca")],
        requestBody: jsonBody(ref("BecaUpdateInput")),
        responses: { 200: dataResponse("Beca actualizada", ref("Beca")), ...commonErrors },
      },
      delete: {
        tags: ["Becas"],
        summary: "Revocar la beca (no se borra)",
        security: bearer,
        parameters: [idParam("id", "ID de beca")],
        requestBody: jsonBody({ type: "object", properties: { motivo: { type: "string" } } }),
        responses: { 200: messageResponse("Beca revocada"), ...commonErrors },
      },
    },
    "/becas/{id}/estado": {
      patch: {
        tags: ["Becas"],
        summary: "Cambiar estado: aprobar/rechazar solicitud, suspender, reactivar o revocar",
        description:
          "Transiciones: Solicitada → Activa | Rechazada; Activa → Suspendida | Revocada | Finalizada; " +
          "Suspendida → Activa | Revocada. Rechazada, Revocada y Finalizada son definitivas. El motivo es obligatorio y se notifica al encargado.",
        security: bearer,
        parameters: [idParam("id", "ID de beca")],
        requestBody: jsonBody(ref("BecaEstadoInput")),
        responses: { 200: dataResponse("Estado actualizado", ref("Beca")), ...commonErrors },
      },
    },
    "/becas/{id}/renovar": {
      post: {
        tags: ["Becas"],
        summary: "Renovar la beca para el siguiente ciclo (en el programa con el mismo nombre)",
        security: bearer,
        parameters: [idParam("id", "ID de beca")],
        requestBody: jsonBody({ type: "object", properties: { anioLectivo: { type: "integer" }, programaId: { type: "integer" } } }),
        responses: { 201: dataResponse("Beca renovada", ref("Beca")), ...commonErrors },
      },
    },
    "/becas/evaluar": {
      post: {
        tags: ["Becas"],
        summary: "Revisar requisitos de las becas activas y suspender las que ya no cumplen (promedio / conducta grave)",
        security: bearer,
        requestBody: jsonBody({ type: "object", properties: { anioLectivo: { type: "integer" } } }),
        responses: { 200: { description: "Resultado de la evaluación" }, 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/becas/programas": {
      get: {
        tags: ["Becas"],
        summary: "Listar programas de beca con cupos usados y disponibles",
        security: bearer,
        parameters: [q("anioLectivo", "Ciclo lectivo"), q("sedeId", "Solo administrador general"), q("incluirInactivos", "true para ver también los cerrados", "string")],
        responses: { 200: listResponse("Programas", ref("ProgramaBeca")), 401: commonErrors[401], 403: commonErrors[403] },
      },
      post: {
        tags: ["Becas"],
        summary: "Crear programa de beca",
        security: bearer,
        requestBody: jsonBody(ref("ProgramaBecaInput")),
        responses: { 201: dataResponse("Programa creado", ref("ProgramaBeca")), 400: commonErrors[400], 409: { description: "Nombre repetido" } },
      },
    },
    "/becas/programas/{id}": {
      put: {
        tags: ["Becas"],
        summary: "Actualizar programa (los cupos no pueden quedar por debajo de los usados)",
        security: bearer,
        parameters: [idParam("id", "ID de programa")],
        requestBody: jsonBody(ref("ProgramaBecaInput")),
        responses: { 200: dataResponse("Programa actualizado", ref("ProgramaBeca")), ...commonErrors },
      },
    },
    "/becas/politica": {
      get: {
        tags: ["Becas"],
        summary: "Política de becas de la sede (presupuesto, hermanos, tope)",
        security: bearer,
        parameters: [q("anioLectivo", "Ciclo lectivo"), q("sedeId", "Solo administrador general")],
        responses: { 200: dataResponse("Política", ref("PoliticaBeca")), 401: commonErrors[401], 403: commonErrors[403] },
      },
      put: {
        tags: ["Becas"],
        summary: "Guardar la política de becas de la sede",
        security: bearer,
        requestBody: jsonBody(ref("PoliticaBeca")),
        responses: { 200: dataResponse("Política guardada", ref("PoliticaBeca")), 400: commonErrors[400], 409: { description: "Presupuesto menor a lo ya usado" } },
      },
    },
    "/becas/mias": {
      get: {
        tags: ["Becas"],
        summary: "Encargado: becas de sus hijos y programas que puede solicitar. Alumno: sus becas",
        security: bearer,
        responses: { 200: { description: "Becas del usuario" }, 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/becas/solicitar": {
      post: {
        tags: ["Becas"],
        summary: "Encargado: solicitar una beca para su hijo (queda Solicitada)",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          required: ["alumnoId", "programaId", "justificacion"],
          properties: {
            alumnoId: { type: "integer" },
            programaId: { type: "integer" },
            justificacion: { type: "string", minLength: 20 },
          },
        }),
        responses: { 201: dataResponse("Solicitud enviada", ref("Beca")), 400: commonErrors[400], 403: commonErrors[403], 409: { description: "Ya tiene beca o solicitud, o no hay cupos" } },
      },
    },

    "/alumnos/all": {
      get: {
        tags: ["Alumnos"],
        summary: "Listar alumnos (personal: su sede; catedrático: sus secciones) con resumen de encargados",
        security: bearer,
        parameters: [q("seccionId", "Filtrar por sección"), q("q", "Buscar por nombre", "string")],
        responses: { 200: listResponse("Listado de alumnos", ref("Alumno")), 401: commonErrors[401], 403: commonErrors[403] },
      },
    },
    "/alumnos/encargados/buscar": {
      get: {
        tags: ["Alumnos"],
        summary: "Buscar personas con cuenta para vincularlas como encargado",
        security: bearer,
        parameters: [q("q", "Nombre o correo (mín. 3 letras)", "string")],
        responses: { 200: { description: "Coincidencias" } },
      },
    },
    "/alumnos/{id}/encargados": {
      get: {
        tags: ["Alumnos"],
        summary: "Encargados del alumno (vigentes, restringidos, anteriores) y bitácora de cambios",
        security: bearer,
        parameters: [idParam("id", "ID de alumno")],
        responses: { 200: listResponse("Vínculos", ref("VinculoEncargado")), ...commonErrors },
      },
      post: {
        tags: ["Alumnos"],
        summary: "Agregar encargado: vincular una cuenta existente (usuarioId) o crear una nueva (nuevo)",
        description:
          "Máximo 4 encargados activos. Siempre debe quedar un contacto principal y un responsable de pagos. " +
          "Si la persona ya tiene cuenta con otro rol (ej. catedrático) se le agrega el rol Encargado.",
        security: bearer,
        parameters: [idParam("id", "ID de alumno")],
        requestBody: jsonBody({
          allOf: [
            ref("VinculoEncargado"),
            {
              type: "object",
              properties: {
                usuarioId: { type: "integer" },
                nuevo: { type: "object", properties: { nombres: { type: "string" }, apellidos: { type: "string" }, email: { type: "string" } } },
              },
            },
          ],
        }),
        responses: { 201: { description: "Encargado vinculado (incluye passwordTemporal si se creó la cuenta)" }, ...commonErrors, 409: { description: "Regla de vínculos" } },
      },
    },
    "/alumnos/{id}/encargados/{encargadoId}": {
      put: {
        tags: ["Alumnos"],
        summary: "Cambiar permisos, custodia, contacto principal, vigencia o registrar una restricción judicial",
        security: bearer,
        parameters: [idParam("id", "ID de alumno"), idParam("encargadoId", "ID del encargado")],
        requestBody: jsonBody(ref("VinculoEncargado")),
        responses: { 200: messageResponse("Vínculo actualizado"), ...commonErrors, 409: { description: "Dejaría al alumno sin contacto principal o sin responsable de pagos" } },
      },
      delete: {
        tags: ["Alumnos"],
        summary: "Quitar encargado (el vínculo se termina y se conserva el historial)",
        security: bearer,
        parameters: [idParam("id", "ID de alumno"), idParam("encargadoId", "ID del encargado")],
        requestBody: jsonBody({ type: "object", required: ["motivo"], properties: { motivo: { type: "string" } } }),
        responses: { 200: messageResponse("Encargado retirado"), ...commonErrors },
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

    "/events/{id}/recordatorio": {
      post: {
        tags: ["Eventos"],
        summary: "Enviar ya el recordatorio del evento a los encargados",
        description:
          "Los recordatorios se envían solos el día anterior al evento (a partir de RECORDATORIOS_HORA). " +
          "Este endpoint lo envía de inmediato; el envío corre en segundo plano.",
        security: bearer,
        parameters: [idParam("id", "ID del evento")],
        responses: { 200: messageResponse("Recordatorio en envío"), ...commonErrors },
      },
    },

    "/notas/enviar-encargados": {
      post: {
        tags: ["Notas"],
        summary: "Enviar por correo la boleta de notas a los encargados",
        description:
          "Con `cursoSeccionId` envía solo las notas de ese curso (el catedrático solo puede usar sus cursos). " +
          "Con `seccionId` envía la boleta completa de la sección (solo administradores). " +
          "`alumnoId` limita el envío a un alumno. El envío corre en segundo plano.",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          properties: {
            cursoSeccionId: { type: "integer" },
            seccionId: { type: "integer" },
            alumnoId: { type: "integer" },
          },
        }),
        responses: { 200: { description: "Envío iniciado" }, ...commonErrors },
      },
    },

    "/conducta": {
      get: {
        tags: ["Conducta"],
        summary: "Listar reportes de conducta (filtrados según el rol del usuario)",
        security: bearer,
        parameters: [q("alumnoId", "Filtrar por alumno"), q("revisado", "true / false", "string")],
        responses: { 200: { description: "Listado de reportes" }, 401: commonErrors[401], 500: commonErrors[500] },
      },
      post: {
        tags: ["Conducta"],
        summary: "Crear un reporte de conducta y notificar por correo a los encargados",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          required: ["alumnoId", "tipo", "titulo", "descripcion"],
          properties: {
            alumnoId: { type: "integer" },
            tipo: { type: "string", enum: ["Positivo", "Leve", "Grave"] },
            titulo: { type: "string", maxLength: 150 },
            descripcion: { type: "string", maxLength: 1000 },
          },
        }),
        responses: { 201: { description: "Reporte creado" }, ...commonErrors },
      },
    },
    "/conducta/{id}/revisar": {
      patch: {
        tags: ["Conducta"],
        summary: "El encargado marca el reporte como revisado",
        security: bearer,
        parameters: [idParam("id", "ID del reporte")],
        requestBody: jsonBody({ type: "object", properties: { comentario: { type: "string", maxLength: 500 } } }),
        responses: { 200: { description: "Reporte revisado" }, ...commonErrors },
      },
    },
    "/conducta/{id}": {
      delete: {
        tags: ["Conducta"],
        summary: "Eliminar un reporte (su autor o un administrador)",
        security: bearer,
        parameters: [idParam("id", "ID del reporte")],
        responses: { 200: messageResponse("Eliminado"), ...commonErrors },
      },
    },

    "/notificaciones/comunicados": {
      get: {
        tags: ["Notificaciones"],
        summary: "Historial de comunicados enviados",
        security: bearer,
        responses: { 200: { description: "Listado de comunicados" }, 401: commonErrors[401], 500: commonErrors[500] },
      },
      post: {
        tags: ["Notificaciones"],
        summary: "Enviar un comunicado por correo a un grupo",
        description:
          "El admin de sede siempre envía a su sede; el admin general puede indicar `sedeId` o enviar a todas. " +
          "El envío corre en segundo plano.",
        security: bearer,
        requestBody: jsonBody({
          type: "object",
          required: ["tipo", "titulo", "mensaje", "destino"],
          properties: {
            tipo: { type: "string", enum: ["Aviso", "Sancion", "Actividad", "Asueto"] },
            titulo: { type: "string", maxLength: 150 },
            mensaje: { type: "string", maxLength: 2000 },
            destino: { type: "string", enum: ["encargados", "catedraticos", "alumnos", "todos", "seccion"] },
            seccionId: { type: "integer", description: "Obligatorio si destino = seccion" },
            sedeId: { type: "integer", description: "Solo admin general" },
          },
        }),
        responses: { 201: { description: "Comunicado en envío" }, ...commonErrors },
      },
    },
    "/notificaciones/mias": {
      get: {
        tags: ["Notificaciones"],
        summary: "Notificaciones del usuario autenticado",
        security: bearer,
        parameters: [q("noLeidas", "true para solo las no leídas", "string")],
        responses: { 200: { description: "Listado de notificaciones" }, 401: commonErrors[401], 500: commonErrors[500] },
      },
    },
    "/notificaciones/{id}/leida": {
      patch: {
        tags: ["Notificaciones"],
        summary: "Marcar una notificación propia como leída",
        security: bearer,
        parameters: [idParam("id", "ID de la notificación")],
        responses: { 200: messageResponse("Marcada como leída"), ...commonErrors },
      },
    },

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

    "/mail/test/{plantilla}": {
      post: {
        tags: ["Mail"],
        summary: "Enviar un correo de prueba con una plantilla específica (sin auth)",
        description: "Usa datos de ejemplo; cualquier campo de la plantilla enviado en el body los sobrescribe.",
        parameters: [
          {
            name: "plantilla",
            in: "path",
            required: true,
            schema: { type: "string", enum: ["general", "recordatorio-evento", "matricula", "boleta", "conducta", "comunicado"] },
          },
        ],
        requestBody: jsonBody({
          type: "object",
          required: ["to"],
          properties: {
            to: { type: "string", format: "email" },
            usuarioId: { type: "integer" },
            nombreDestinatario: { type: "string" },
          },
          additionalProperties: true,
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
        summary: "Cotizar la colegiatura de un mes (aplica beca activa y descuento por hermanos)",
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
          "Solo puede pagar el propio alumno, uno de sus encargados, o un administrador.\n\n" +
          "Si la beca (más el descuento por hermanos) cubre el 100%, no se crea sesión de Stripe: " +
          "el mes queda registrado como 'Exonerado' y `checkoutUrl` es null.",
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
