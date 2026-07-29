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

/* ── Imágenes de portada de unidad ─────────────────────────────────────────
 * Mismo criterio de seguridad que los PDFs: se guardan con nombre OPACO (UUID)
 * fuera de src y se sirven por streaming. Se validan por MIME, tamaño y FIRMA
 * binaria (magic bytes), no solo por la extensión declarada. */
export const UPLOAD_IMG_DIR =
  process.env.UPLOAD_IMG_DIR ?? join(process.cwd(), 'uploads', 'unidades');

// Límite de tamaño de la imagen (por defecto 2 MB).
export const MAX_IMG_BYTES = Number(process.env.MAX_IMG_BYTES ?? 2 * 1024 * 1024);

// Formatos permitidos: jpg, png, webp. Cada uno con su MIME, extensión y firma.
export interface FormatoImagen { mime: string; ext: string; coincide: (b: Buffer) => boolean }
export const FORMATOS_IMAGEN: FormatoImagen[] = [
  { mime: 'image/jpeg', ext: 'jpg', coincide: (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', coincide: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  // WebP: contenedor RIFF "RIFF"....(size)...."WEBP".
  { mime: 'image/webp', ext: 'webp', coincide: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP' },
];

/** Devuelve el formato cuya FIRMA binaria coincide, o null si no es imagen válida. */
export function detectarFormatoImagen(buffer: Buffer): FormatoImagen | null {
  return FORMATOS_IMAGEN.find((f) => f.coincide(buffer)) ?? null;
}

/** Estructura mínima del archivo que entrega multer (evita depender de @types/multer). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
