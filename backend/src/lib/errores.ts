// Error de regla de negocio: el controlador lo convierte en una respuesta 4xx con su mensaje
export class ReglaNegocioError extends Error {
    constructor(message: string, public status = 409) {
        super(message);
    }
}
