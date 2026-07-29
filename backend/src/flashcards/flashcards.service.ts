import { Injectable } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * FLASHCARDS — funcionalidad de APOYO (repaso libre / memorización activa).
 *
 * FRONTERA CON LA INVESTIGACIÓN (cuasi-experimento con grupo control): las
 * flashcards NO puntúan, NO cronometran y NO afectan al θ (IRT) ni a ninguna
 * métrica de medición (pretest/postest/nivel). Este módulo es de SOLO LECTURA:
 * deriva las tarjetas del banco de ejercicios ya existente (única fuente de
 * verdad; no se duplica contenido) y no escribe ningún registro de desempeño.
 * Su disponibilidad debe mantenerse coherente con el diseño experimental (mismo
 * tratamiento para quienes correspondan).
 */

/** Forma pública de una flashcard (coincide con el tipo del cliente). */
export interface Flashcard {
  id: string;
  unidadId: string;
  temaId: string;
  subtemaId?: string;
  frente: string;            // pregunta o concepto
  reverso: string;           // respuesta correcta
  explicacion?: string;      // explicación breve (si el ejercicio la tiene)
  codigo?: string;           // fragmento Python opcional
  nivel?: NivelDificultad;
}

type OpcionJson = { id: string; texto: string };

// Tipos de ejercicio que sí producen una buena flashcard (pregunta → respuesta).
// `ordenar_lineas` se excluye: su "respuesta" es un orden, no un concepto memorizable.
const TIPOS_FLASHCARD = ['opcion_multiple', 'predecir_salida', 'completar_codigo'] as const;

const TEMA_SELECT = { id: true, unidadId: true, padreId: true, numero: true, titulo: true } satisfies Prisma.TemaSelect;

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Convierte un ejercicio del banco en una flashcard (o null si no aplica). */
  private aFlashcard(ej: Prisma.EjercicioGetPayload<{ include: { tema: { select: typeof TEMA_SELECT } } }>): Flashcard | null {
    const tema = ej.tema;
    if (!tema) return null;

    let reverso = '';
    if (ej.tipo === 'opcion_multiple' || ej.tipo === 'predecir_salida') {
      const ops = Array.isArray(ej.opciones) ? (ej.opciones as unknown as OpcionJson[]) : [];
      const correcta = ops.find((o) => (o?.id ?? '').trim().toUpperCase() === ej.respuestaCorrecta.trim().toUpperCase());
      reverso = correcta?.texto ?? ej.respuestaCorrecta;
    } else if (ej.tipo === 'completar_codigo') {
      // La respuesta puede traer variantes equivalentes separadas por "|": toma la primera.
      reverso = ej.respuestaCorrecta.split('|')[0].trim();
    } else {
      return null;
    }

    const esSubtema = tema.padreId != null;
    return {
      id: `ej-${ej.id}`,
      unidadId: String(tema.unidadId),
      temaId: String(esSubtema ? tema.padreId : tema.id),
      subtemaId: esSubtema ? String(tema.id) : undefined,
      frente: ej.enunciado,
      reverso,
      explicacion: ej.explicacionIa ?? undefined,
      codigo: ej.codigoPython ?? undefined,
      nivel: ej.nivelDificultad,
    };
  }

  private async ejerciciosDeTemas(temaIds: number[]) {
    return this.prisma.ejercicio.findMany({
      where: {
        banco: 'practica', activo: true,
        temaId: { in: temaIds },
        tipo: { in: [...TIPOS_FLASHCARD] },
      },
      include: { tema: { select: TEMA_SELECT } },
      orderBy: [{ nivelDificultad: 'asc' }, { id: 'asc' }],
    });
  }

  /** Nivel adaptativo ACTUAL del estudiante en cada tema (fallback: nivel inicial). */
  private async nivelesDelUsuario(usuarioId: number, temaIds: number[]): Promise<Map<number, NivelDificultad>> {
    const [usuario, progresos] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      this.prisma.progresoTema.findMany({ where: { usuarioId, temaId: { in: temaIds } }, select: { temaId: true, nivelActual: true } }),
    ]);
    const base: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';
    const m = new Map<number, NivelDificultad>(temaIds.map((id) => [id, base]));
    for (const p of progresos) m.set(p.temaId, p.nivelActual);
    return m;
  }

  /**
   * Filtro ESTRICTO por nivel: cada tarjeta entra al mazo SOLO si su nivel
   * coincide con el nivel ACTUAL del estudiante en su tema/subtema (el mismo que
   * usa la adaptatividad). El estudiante NO elige nivel y NUNCA se mezclan
   * niveles: si su nivel no tiene tarjetas, el mazo va vacío (nada de rellenar
   * con otros niveles — el badge debe corresponder siempre al contenido servido).
   * Solo lectura: no toca métricas.
   */
  private filtrarPorNivel(cards: Flashcard[], niveles: Map<number, NivelDificultad>): Flashcard[] {
    return cards.filter((c) => {
      const nivelTema = niveles.get(Number(c.subtemaId ?? c.temaId)) ?? niveles.get(Number(c.temaId)) ?? 'basico';
      return c.nivel === nivelTema;
    });
  }

  /**
   * Mazo de un tema (incluye sus subtemas), ESTRICTAMENTE al nivel del estudiante
   * en ese tema. El estudiante no elige nivel. `nivel_defecto` = su nivel actual
   * (para el encabezado del mazo, que así SIEMPRE coincide con las tarjetas).
   */
  async porTema(usuarioId: number, temaId: number): Promise<{
    tema: { id: number; numero: string; titulo: string; unidadId: number; unidadNumero: number } | null;
    flashcards: Flashcard[]; nivel_defecto: NivelDificultad;
  }> {
    const [temaRow, subtemas] = await Promise.all([
      this.prisma.tema.findUnique({ where: { id: temaId }, select: { id: true, numero: true, titulo: true, unidadId: true, unidad: { select: { numero: true } } } }),
      this.prisma.tema.findMany({ where: { padreId: temaId, publicado: true }, select: { id: true } }),
    ]);
    const temaIds = [temaId, ...subtemas.map((s) => s.id)];
    const [ejs, niveles] = await Promise.all([this.ejerciciosDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
    const tema = temaRow ? { id: temaRow.id, numero: temaRow.numero, titulo: temaRow.titulo, unidadId: temaRow.unidadId, unidadNumero: temaRow.unidad.numero } : null;
    const cards = ejs.map((e) => this.aFlashcard(e)).filter((f): f is Flashcard => f !== null);
    return { tema, flashcards: this.filtrarPorNivel(cards, niveles), nivel_defecto: niveles.get(temaId) ?? 'basico' };
  }

  /**
   * Mazo de toda una unidad: cada tarjeta va estrictamente al nivel del estudiante
   * en SU tema (el mismo criterio de la adaptatividad). `nivel_defecto: null` =
   * la sesión es "a tu nivel" (puede variar por tema dentro de la unidad).
   */
  async porUnidad(usuarioId: number, unidadId: number): Promise<{
    unidad: { id: number; numero: number; titulo: string } | null; flashcards: Flashcard[]; nivel_defecto: null;
  }> {
    const [unidad, temas] = await Promise.all([
      this.prisma.unidad.findUnique({ where: { id: unidadId }, select: { id: true, numero: true, titulo: true } }),
      this.prisma.tema.findMany({ where: { unidadId, publicado: true }, select: { id: true } }),
    ]);
    const temaIds = temas.map((t) => t.id);
    const [ejs, niveles] = await Promise.all([this.ejerciciosDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
    const cards = ejs.map((e) => this.aFlashcard(e)).filter((f): f is Flashcard => f !== null);
    return { unidad, flashcards: this.filtrarPorNivel(cards, niveles), nivel_defecto: null };
  }

  /**
   * Mazo de REPASO PREVIO a un examen de unidad: prioriza los temas más DÉBILES
   * del estudiante (menor nivel adaptativo) y limita el tamaño (~10–15) para que
   * sea rápido y omitible. No lee ni escribe ninguna métrica de medición.
   */
  async paraExamen(usuarioId: number, unidadId: number, limite = 12): Promise<{ unidad: { id: number; numero: number; titulo: string } | null; flashcards: Flashcard[] }> {
    const [unidad, temas] = await Promise.all([
      this.prisma.unidad.findUnique({ where: { id: unidadId }, select: { id: true, numero: true, titulo: true } }),
      this.prisma.tema.findMany({
        where: { unidadId, publicado: true },
        select: { id: true, progreso: { where: { usuarioId }, select: { nivelActual: true } } },
      }),
    ]);

    // Debilidad por tema: básico=0 (más débil) … avanzado=2. Sin señal → básico.
    const peso: Record<NivelDificultad, number> = { basico: 0, intermedio: 1, avanzado: 2 };
    const debilidad = new Map<number, number>(temas.map((t) => [t.id, peso[t.progreso[0]?.nivelActual ?? 'basico']]));

    const temaIds = temas.map((t) => t.id);
    const [ejs, niveles] = await Promise.all([this.ejerciciosDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
    // Misma regla estricta que el resto de mazos: solo tarjetas del nivel del estudiante.
    const cards = this.filtrarPorNivel(
      ejs.map((e) => this.aFlashcard(e)).filter((f): f is Flashcard => f !== null),
      niveles,
    );

    // Ordena por debilidad del tema (o subtema) al que pertenece la tarjeta.
    const debilidadDe = (f: Flashcard) => Math.min(
      debilidad.get(Number(f.subtemaId ?? f.temaId)) ?? 0,
      debilidad.get(Number(f.temaId)) ?? 0,
    );
    cards.sort((a, b) => debilidadDe(a) - debilidadDe(b));
    return { unidad, flashcards: cards.slice(0, Math.max(1, limite)) };
  }
}
