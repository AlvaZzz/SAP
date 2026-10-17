import { Prisma } from '@prisma/client';

/**
 * Qué retos gestiona un docente: los que escribió y los del BANCO DEL CURSO.
 *
 * Los retos del banco (cargados desde las prácticas con `seed:banco`, o
 * derivados de ejercicios) llevan `codigo` y quedan a nombre del docente que
 * existía al sembrarlos. Si solo los viera su autor, cualquier otro docente del
 * curso no podría verlos, corregirlos ni revisar sus entregas.
 */
export function retosDelDocente(autorId: number): Prisma.RetoWhereInput {
  return { OR: [{ autorId }, { codigo: { not: null } }] };
}

export function puedeGestionarReto(reto: { autorId: number; codigo: string | null }, autorId: number): boolean {
  return reto.autorId === autorId || reto.codigo !== null;
}
