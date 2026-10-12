import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, IsBoolean } from 'class-validator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TutorIaService } from '../../tutor-ia/tutor-ia.service';
import { TIPOS_FLASHCARD, derivarFlashcard } from '../../flashcards/derivar';

export class CrearFlashcardDto {
  @IsInt() @Min(1)
  temaId!: number;

  @IsString() @MinLength(3) @MaxLength(600)
  frente!: string;

  @IsString() @MinLength(1) @MaxLength(600)
  reverso!: string;

  @IsOptional() @IsString() @MaxLength(1000)
  explicacion?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  codigoPython?: string;

  @IsOptional() @IsEnum(NivelDificultad)
  nivel?: NivelDificultad;
}

export class EditarFlashcardDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(600)
  frente?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(600)
  reverso?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  explicacion?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  codigoPython?: string;

  @IsOptional() @IsEnum(NivelDificultad)
  nivel?: NivelDificultad;

  @IsOptional() @IsBoolean()
  activo?: boolean;
}

export class GenerarFlashcardsDto {
  @IsInt() @Min(1)
  temaId!: number;
}

/**
 * Flashcards que prepara el docente para un tema: a mano o generadas desde los
 * ejercicios que ya cargó. Son repaso libre: no puntúan ni tocan métricas.
 */
@Injectable()
export class DocenteFlashcardsService {
  private readonly logger = new Logger(DocenteFlashcardsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tutorIa: TutorIaService,
  ) {}

  private vista(f: { id: number; temaId: number; ejercicioId: number | null; frente: string; reverso: string; explicacion: string | null; codigoPython: string | null; nivelDificultad: NivelDificultad; activo: boolean }) {
    return {
      id: f.id, temaId: f.temaId, ejercicioId: f.ejercicioId, frente: f.frente, reverso: f.reverso,
      explicacion: f.explicacion, codigoPython: f.codigoPython, nivel: f.nivelDificultad, activo: f.activo,
    };
  }

  /** Tarjetas del tema y cuántos ejercicios suyos aún no tienen tarjeta. */
  async listar(temaId: number) {
    const [flashcards, ejercicios] = await Promise.all([
      this.prisma.flashcard.findMany({ where: { temaId }, orderBy: [{ nivelDificultad: 'asc' }, { id: 'asc' }] }),
      this.prisma.ejercicio.findMany({
        where: { temaId, banco: 'practica', activo: true, tipo: { in: TIPOS_FLASHCARD } },
        select: { id: true },
      }),
    ]);
    const usados = new Set(flashcards.map((f) => f.ejercicioId).filter((x): x is number => x != null));
    return {
      flashcards: flashcards.map((f) => this.vista(f)),
      ejercicios_disponibles: ejercicios.length,
      ejercicios_sin_tarjeta: ejercicios.filter((e) => !usados.has(e.id)).length,
    };
  }

  async crear(dto: CrearFlashcardDto) {
    const tema = await this.prisma.tema.findUnique({ where: { id: dto.temaId }, select: { id: true } });
    if (!tema) throw new BadRequestException('El tema no existe');
    const f = await this.prisma.flashcard.create({
      data: {
        temaId: dto.temaId, frente: dto.frente.trim(), reverso: dto.reverso.trim(),
        explicacion: dto.explicacion?.trim() || null, codigoPython: dto.codigoPython?.trim() || null,
        nivelDificultad: dto.nivel ?? 'basico',
      },
    });
    return this.vista(f);
  }

  async editar(id: number, dto: EditarFlashcardDto) {
    const existe = await this.prisma.flashcard.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Flashcard no encontrada');
    const f = await this.prisma.flashcard.update({
      where: { id },
      data: {
        ...(dto.frente !== undefined ? { frente: dto.frente.trim() } : {}),
        ...(dto.reverso !== undefined ? { reverso: dto.reverso.trim() } : {}),
        ...(dto.explicacion !== undefined ? { explicacion: dto.explicacion.trim() || null } : {}),
        ...(dto.codigoPython !== undefined ? { codigoPython: dto.codigoPython.trim() || null } : {}),
        ...(dto.nivel !== undefined ? { nivelDificultad: dto.nivel } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });
    return this.vista(f);
  }

  async eliminar(id: number) {
    const existe = await this.prisma.flashcard.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Flashcard no encontrada');
    await this.prisma.flashcard.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Crea una flashcard por cada ejercicio activo del tema que todavía no tenga
   * la suya. PREXI redacta la tarjeta como concepto a recordar; si la IA no está
   * disponible o falla, la tarjeta se arma directamente con el enunciado y la
   * respuesta correcta del ejercicio. El docente puede editarlas después.
   */
  async generar(temaId: number) {
    const tema = await this.prisma.tema.findUnique({ where: { id: temaId }, select: { id: true, numero: true, titulo: true } });
    if (!tema) throw new BadRequestException('El tema no existe');

    const [ejercicios, yaHechas] = await Promise.all([
      this.prisma.ejercicio.findMany({
        where: { temaId, banco: 'practica', activo: true, tipo: { in: TIPOS_FLASHCARD } },
        orderBy: [{ nivelDificultad: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.flashcard.findMany({ where: { temaId, ejercicioId: { not: null } }, select: { ejercicioId: true } }),
    ]);
    const usados = new Set(yaHechas.map((f) => f.ejercicioId));
    const pendientes = ejercicios.filter((e) => !usados.has(e.id));
    if (ejercicios.length === 0) {
      throw new BadRequestException('Este tema aún no tiene ejercicios de opción múltiple, predecir salida o completar código. Créalos primero en el paso 2.');
    }
    if (pendientes.length === 0) return { creadas: 0, con_ia: false, mensaje: 'Todos los ejercicios de este tema ya tienen su flashcard.' };

    const base = pendientes
      .map((e) => ({ ejercicio: e, derivada: derivarFlashcard(e) }))
      .filter((x): x is { ejercicio: typeof pendientes[number]; derivada: NonNullable<ReturnType<typeof derivarFlashcard>> } => x.derivada !== null);

    // PREXI mejora la redacción; cualquier fallo deja la versión directa.
    let redactadas = new Map<number, { frente: string; reverso: string; explicacion: string }>();
    try {
      redactadas = await this.tutorIa.generarFlashcards(
        `${tema.numero} ${tema.titulo}`,
        base.map((b) => ({ id: b.ejercicio.id, pregunta: b.derivada.frente, codigo: b.derivada.codigoPython, respuesta: b.derivada.reverso, explicacion: b.derivada.explicacion })),
      );
    } catch (err) {
      this.logger.warn(`PREXI no redactó las flashcards del tema ${temaId}: ${err instanceof Error ? err.message : err}`);
    }

    await this.prisma.flashcard.createMany({
      data: base.map(({ ejercicio, derivada }) => {
        const ia = redactadas.get(ejercicio.id);
        return {
          temaId, ejercicioId: ejercicio.id,
          frente: ia?.frente ?? derivada.frente,
          // El reverso lo fija SIEMPRE el ejercicio: la IA no decide qué es correcto.
          reverso: derivada.reverso,
          explicacion: ia?.explicacion || derivada.explicacion,
          codigoPython: derivada.codigoPython,
          nivelDificultad: ejercicio.nivelDificultad,
        };
      }),
    });
    const conIa = redactadas.size > 0;
    return {
      creadas: base.length, con_ia: conIa,
      mensaje: conIa
        ? `PREXI redactó ${redactadas.size} de ${base.length} flashcards a partir de tus ejercicios.`
        : `Se crearon ${base.length} flashcards con el enunciado y la respuesta de tus ejercicios (PREXI no estaba disponible para mejorar la redacción).`,
    };
  }
}
