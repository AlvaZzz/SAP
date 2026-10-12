import { Injectable } from '@nestjs/common';
import { NivelDificultad, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { TIPOS_FLASHCARD, derivarFlashcard } from './derivar';

/**
 * FLASHCARDS — funcionalidad de APOYO (repaso libre / memorización activa).
 *
 * FRONTERA CON LA MEDICIÓN: las flashcards NO puntúan, NO cronometran y NO afectan al θ (IRT) ni a ninguna
 * métrica de medición (pretest/postest/nivel). Este módulo es de SOLO LECTURA:
 * deriva las tarjetas del banco de ejercicios ya existente (única fuente de
 * verdad; no se duplica contenido) y no escribe ningún registro de desempeño.
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


const TEMA_SELECT = { id: true, unidadId: true, padreId: true, numero: true, titulo: true } satisfies Prisma.TemaSelect;

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Convierte un ejercicio del banco en una flashcard (o null si no aplica). */
  private aFlashcard(ej: Prisma.EjercicioGetPayload<{ include: { tema: { select: typeof TEMA_SELECT } } }>): Flashcard | null {
    const tema = ej.tema;
    if (!tema) return null;

    const derivada = derivarFlashcard(ej);
    if (!derivada) return null;
    const reverso = derivada.reverso;

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

  /**
   * Tarjetas de un conjunto de temas. Si el docente preparó flashcards para un
   * tema, se sirven ESAS; si no, las que se derivan de sus ejercicios.
   */
  private async cartasDeTemas(temaIds: number[]): Promise<Flashcard[]> {
    const [propias, ejs] = await Promise.all([
      this.prisma.flashcard.findMany({
        where: { temaId: { in: temaIds }, activo: true },
        include: { tema: { select: TEMA_SELECT } },
        orderBy: [{ nivelDificultad: 'asc' }, { id: 'asc' }],
      }),
      this.ejerciciosDeTemas(temaIds),
    ]);
    const conPropias = new Set(propias.map((p) => p.temaId));
    const delDocente: Flashcard[] = propias.map((p) => {
      const esSubtema = p.tema.padreId != null;
      return {
        id: `fc-${p.id}`,
        unidadId: String(p.tema.unidadId),
        temaId: String(esSubtema ? p.tema.padreId : p.tema.id),
        subtemaId: esSubtema ? String(p.tema.id) : undefined,
        frente: p.frente, reverso: p.reverso,
        explicacion: p.explicacion ?? undefined, codigo: p.codigoPython ?? undefined,
        nivel: p.nivelDificultad,
      };
    });
    const derivadas = ejs
      .filter((e) => e.temaId != null && !conPropias.has(e.temaId))
      .map((e) => this.aFlashcard(e))
      .filter((f): f is Flashcard => f !== null);
    return [...delDocente, ...derivadas];
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
    const [cards, niveles] = await Promise.all([this.cartasDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
    const tema = temaRow ? { id: temaRow.id, numero: temaRow.numero, titulo: temaRow.titulo, unidadId: temaRow.unidadId, unidadNumero: temaRow.unidad.numero } : null;
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
    const [cards, niveles] = await Promise.all([this.cartasDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
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
    const [cards, niveles] = await Promise.all([this.cartasDeTemas(temaIds), this.nivelesDelUsuario(usuarioId, temaIds)]);
    // Misma regla estricta que el resto de mazos: solo tarjetas del nivel del estudiante.
    const delNivel = this.filtrarPorNivel(cards, niveles);

    // Ordena por debilidad del tema (o subtema) al que pertenece la tarjeta.
    const debilidadDe = (f: Flashcard) => Math.min(
      debilidad.get(Number(f.subtemaId ?? f.temaId)) ?? 0,
      debilidad.get(Number(f.temaId)) ?? 0,
    );
    delNivel.sort((a, b) => debilidadDe(a) - debilidadDe(b));
    return { unidad, flashcards: delNivel.slice(0, Math.max(1, limite)) };
  }
}
