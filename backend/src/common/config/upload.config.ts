import { join } from 'path';

/**
 * Configuración centralizada de la subida de documentos (PDF).
 * Un único lugar de la verdad para carpeta destino, límite de tamaño y tipo.
 * La ruta física NUNCA se expone al cliente: los PDFs se sirven por streaming
 * desde un endpoint controlado usando un nombre de archivo opaco (UUID).
 */

// Carpeta de almacenamiento fuera de src (configurable por env en despliegue).
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads', 'documentos');

// Límite de tamaño del PDF (por defecto 15 MB).
export const MAX_PDF_BYTES = Number(process.env.MAX_PDF_BYTES ?? 15 * 1024 * 1024);

export const PDF_MIME = 'application/pdf';

// Firma binaria de un PDF válido: los primeros bytes son "%PDF-".
export const PDF_MAGIC = Buffer.from('%PDF-');

/** Estructura mínima del archivo que entrega multer (evita depender de @types/multer). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
