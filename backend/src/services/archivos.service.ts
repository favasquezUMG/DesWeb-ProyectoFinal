import { v2 as cloudinary } from "cloudinary";
import { ReglaNegocioError } from "../lib/errores.js";

// Archivos de tareas en Cloudinary. El navegador sube directo a Cloudinary con una firma que
// genera el backend (el archivo no pasa por Express); despues registra la subida y el backend
// verifica la firma de la respuesta. Se suben como "authenticated": la URL directa da 401 y
// solo se abren con una URL firmada que vence en pocos minutos.

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const TIPO_ENTREGA = "authenticated";
const MINUTOS_URL = 5;
export const MAX_BYTES = 10 * 1024 * 1024; // limite de Cloudinary para el plan gratis
export const MAX_ARCHIVOS = 10;
export const EXTENSIONES_PERMITIDAS = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "gif", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "zip"];

const carpetaBase = () => process.env.CLOUDINARY_CARPETA || "colegio-vanguardia";

export const carpetaMaterial = (actividadId: number) => `${carpetaBase()}/tareas/actividad-${actividadId}/material`;
export const carpetaEntrega = (actividadId: number, alumnoId: number) => `${carpetaBase()}/tareas/actividad-${actividadId}/alumno-${alumnoId}`;

export const cloudinaryConfigurado = () =>
    !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// Campos que el navegador manda junto con el archivo a la URL de subida
export const firmarSubida = (carpeta: string) => {
    if (!cloudinaryConfigurado()) throw new ReglaNegocioError("La subida de archivos no está configurada en el servidor.", 503);
    const params = { folder: carpeta, timestamp: Math.round(Date.now() / 1000), type: TIPO_ENTREGA, use_filename: true, unique_filename: true };
    return {
        url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        campos: { ...params, api_key: process.env.CLOUDINARY_API_KEY!, signature: cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!) },
        maxBytes: MAX_BYTES,
        extensiones: EXTENSIONES_PERMITIDAS,
    };
};

// Lo que el navegador reenvia de la respuesta de Cloudinary, mas el nombre original del archivo
export interface SubidaCloudinary {
    public_id: string;
    version: number;
    signature: string;
    resource_type: string;
    format?: string;
    bytes: number;
    nombre: string;
}

export interface ArchivoVerificado {
    publicId: string;
    resourceType: string;
    formato: string | null;
    nombre: string;
    bytes: number;
}

const extension = (nombre: string) => nombre.split(".").pop()?.toLowerCase() ?? "";

// Confirma que la subida la hizo Cloudinary con nuestra firma y en la carpeta esperada
export const verificarSubida = (s: SubidaCloudinary, carpeta: string): ArchivoVerificado => {
    const nombre = String(s?.nombre ?? "").trim().slice(0, 255);
    if (!s?.public_id || !s.version || !s.signature || !nombre) throw new ReglaNegocioError("Datos de archivo incompletos.", 400);
    // Cloudinary firma su respuesta con public_id + version y nuestro secreto
    const esperada = cloudinary.utils.api_sign_request({ public_id: s.public_id, version: s.version }, process.env.CLOUDINARY_API_SECRET!);
    if (esperada !== s.signature) {
        throw new ReglaNegocioError("No se pudo verificar el archivo subido.", 400);
    }
    if (!s.public_id.startsWith(`${carpeta}/`)) throw new ReglaNegocioError("El archivo no corresponde a esta tarea.", 400);
    if (!["image", "raw"].includes(s.resource_type)) throw new ReglaNegocioError("Ese tipo de archivo no se acepta.", 400);
    if (!EXTENSIONES_PERMITIDAS.includes(extension(nombre))) {
        throw new ReglaNegocioError(`Tipo de archivo no permitido. Se aceptan: ${EXTENSIONES_PERMITIDAS.join(", ")}.`, 400);
    }
    const bytes = Number(s.bytes);
    if (!(bytes > 0) || bytes > MAX_BYTES) throw new ReglaNegocioError("Cada archivo puede pesar como máximo 10 MB.", 400);
    return { publicId: s.public_id, resourceType: s.resource_type, formato: s.format ?? null, nombre, bytes };
};

// URL temporal para abrir o descargar el archivo
export const urlTemporal = (archivo: { publicId: string; resourceType: string; formato: string | null }) =>
    cloudinary.utils.private_download_url(archivo.publicId, archivo.formato ?? "", {
        resource_type: archivo.resourceType,
        type: TIPO_ENTREGA,
        expires_at: Math.round(Date.now() / 1000) + MINUTOS_URL * 60,
    });

// Borra de Cloudinary; si falla solo se registra, el registro en la base ya se elimino
export const borrarDeCloudinary = async (archivos: { publicId: string; resourceType: string }[]) => {
    for (const a of archivos) {
        try {
            await cloudinary.uploader.destroy(a.publicId, { resource_type: a.resourceType, type: TIPO_ENTREGA, invalidate: true });
        } catch (error) {
            console.error(`❌ No se pudo borrar ${a.publicId} de Cloudinary:`, error);
        }
    }
};
