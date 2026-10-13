import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, basename } from 'path';
import { randomUUID } from 'crypto';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PREGUNTAS_POR_EVALUACION } from '../../common/niveles/reglas-evaluacion';
import {
  UPLOAD_IMG_DIR, MAX_IMG_BYTES, detectarFormatoImagen, ArchivoSubido,
} from '../../common/config/upload.config';
import { CrearUnidadDto, EditarUnidadDto, CrearTemaDto, EditarTemaDto } from './dto/unidad.dto';

/** Ejercicios ACTIVOS que un tema necesita EN CADA NIVEL (básico, intermedio, avanzado) para publicarse. */
export const MIN_EJERCICIOS_TEMA = PREGUNTAS_POR_EVALUACION;

const NIVELES: NivelDificultad[] = ['basico', 'intermedio', 'avanzado'];
const NOMBRE_NIVEL: Record<NivelDificultad, string> = { basico: 'básico', intermedio: 'intermedio', avanzado: 'avanzado' };
type PorNivel = Record<NivelDificultad, number>;
const sinEjercicios = (): PorNivel => ({ basico: 0, intermedio: 0, avanzado: 0 });

/** Qué le falta a un tema para llegar a 10 ejercicios por nivel, en palabras. */
export function faltantesPorNivel(n: PorNivel): string[] {
  return NIVELES.filter((k) => n[k] < MIN_EJERCICIOS_TEMA).map((k) => `${MIN_EJERCICIOS_TEMA - n[k]} de nivel ${NOMBRE_NIVEL[k]}`);
}

/** Mínimo de ítems del banco de diagnóstico para que un tema pueda entrar al pretest. */
export const MIN_ITEMS_DIAGNOSTICO = 3;

interface Extra { niveles: Map<number, PorNivel>; flash: Map<number, number>; borradores: Map<number, number> }

interface TemaVista {
  id: number; numero: string; titulo: string; descripcion: string | null; repaso: string | null; orden: number;
  umbral: number; publicado: boolean; ejercicios_activos: number; ejercicios_minimos: number;
  por_nivel: PorNivel; faltan: string[]; flashcards: number; borradores_ia: number;
  puede_publicarse: boolean; en_diagnostico: boolean; items_diagnostico: number;
  puede_diagnosticar: boolean; subtemas: TemaVista[];
}

/**
 * Estructura académica real (rol docente): UNIDAD → TEMA → SUBTEMA → ejercicios.
 * Complementa (no reemplaza) los 5 "niveles" de gamificación: un Tema puede
 * vivir sin nivel, y sus ejercicios se resuelven igual vía POST /intentos.
 */
@Injectable()
export class DocenteUnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Unidades ──
  async listarUnidades(autorId?: number) {
    const unidades = await this.prisma.unidad.findMany({
      orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
      include: {
        temas: {
          where: { padreId: null },
          orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
          include: {
            _count: { select: { ejercicios: { where: { activo: true, banco: 'practica' } } } },
            subtemas: {
              orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
              include: { _count: { select: { ejercicios: { where: { activo: true, banco: 'practica' } } } } },
            },
          },
        },
      },
    });
    // Conteo de ítems del banco de diagnóstico (banco='pretest') por tema, en una
    // sola consulta (evita N+1); alimenta `items_diagnostico`/`puede_diagnosticar`.
    const diagRaw = await this.prisma.ejercicio.groupBy({
      by: ['temaId'],
      where: { banco: 'pretest', temaId: { not: null } },
      _count: { _all: true },
    });
    const diag = new Map<number, number>();
    for (const d of diagRaw) if (d.temaId != null) diag.set(d.temaId, d._count._all);

    // Ejercicios de práctica activos por tema y nivel, tarjetas que de ellos
    // salen, borradores de PREXI sin revisar y preguntas del examen por unidad.
    const [nivelRaw, flashRaw, borrRaw, examen] = await Promise.all([
      this.prisma.ejercicio.groupBy({ by: ['temaId', 'nivelDificultad'], where: { banco: 'practica', activo: true, temaId: { not: null } }, _count: { _all: true } }),
      this.prisma.flashcard.groupBy({ by: ['temaId'], where: { activo: true }, _count: { _all: true } }),
      this.prisma.preguntaGenerada.groupBy({ by: ['temaId', 'banco'], where: { estado: 'borrador', ...(autorId ? { autorId } : {}) }, _count: { _all: true } }),
      this.prisma.ejercicio.findMany({ where: { banco: 'examen', activo: true, temaId: { not: null } }, select: { temasIntegrados: true, tema: { select: { unidadId: true } } } }),
    ]);
    const extra: Extra = { niveles: new Map(), flash: new Map(), borradores: new Map() };
    for (const r of nivelRaw) {
      if (r.temaId == null) continue;
      const n = extra.niveles.get(r.temaId) ?? sinEjercicios();
      n[r.nivelDificultad] = r._count._all;
      extra.niveles.set(r.temaId, n);
    }
    for (const r of flashRaw) if (r.temaId != null) extra.flash.set(r.temaId, r._count._all);
    const borradoresExamen = new Map<number, number>();
    for (const r of borrRaw) {
      if (r.banco === 'examen') borradoresExamen.set(r.temaId, (borradoresExamen.get(r.temaId) ?? 0) + r._count._all);
      else extra.borradores.set(r.temaId, (extra.borradores.get(r.temaId) ?? 0) + r._count._all);
    }

    return unidades.map((u) => {
      const deLaUnidad = examen.filter((e) => e.tema?.unidadId === u.id);
      const temaIds = u.temas.flatMap((t) => [t.id, ...t.subtemas.map((s) => s.id)]);
      return {
      examen: {
        preguntas: deLaUnidad.length,
        integradoras: deLaUnidad.filter((e) => e.temasIntegrados.length >= 2).length,
        minimo: PREGUNTAS_POR_EVALUACION,
        borradores_ia: temaIds.reduce((s, id) => s + (borradoresExamen.get(id) ?? 0), 0),
      },
      id: u.id, numero: u.numero, titulo: u.titulo, descripcion: u.descripcion,
      introduccion: u.introduccion, repaso: u.repaso,
      dashObjetivos: u.dashObjetivos, dashAnalogias: u.dashAnalogias,
      xp: u.xp, orden: u.orden,
      // URL de stream (no la ruta física); null si la unidad no tiene portada.
      imagen_url: u.imagenUrl ? `/api/unidades/${u.id}/portada` : null,
      temas: u.temas.map((t) => this.vistaTema(t, diag, extra)),
      };
    });
  }

  // ── Imagen de portada de la unidad ──
  /**
   * Sube (o REEMPLAZA) la portada de una unidad. Valida por FIRMA binaria
   * (jpg/png/webp) y tamaño (≤2 MB), guarda con nombre opaco y borra la anterior.
   */
  async subirImagen(id: number, archivo?: ArchivoSubido) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (!archivo) throw new BadRequestException('Falta la imagen');
    if (archivo.size > MAX_IMG_BYTES) {
      throw new BadRequestException(`La imagen supera el límite de ${Math.round(MAX_IMG_BYTES / 1024 / 1024)} MB`);
    }
    const formato = detectarFormatoImagen(archivo.buffer);
    if (!formato) throw new BadRequestException('Formato no válido. Solo se aceptan imágenes JPG, PNG o WebP.');

    // El binario va a la BASE DE DATOS por el mismo motivo que el PDF de los
    // documentos: el filesystem del hosting gratuito no sobrevive a un reinicio.
    const nombreArchivo = `${randomUUID()}.${formato.ext}`;

    // Borra la portada anterior del disco (best-effort): solo aplica a las
    // subidas antes de este cambio; las nuevas se reemplazan en el propio UPDATE.
    if (unidad.imagenUrl) await fs.unlink(join(UPLOAD_IMG_DIR, basename(unidad.imagenUrl))).catch(() => undefined);

    await this.prisma.unidad.update({
      where: { id },
      // Uint8Array.from: el tipo `Bytes` de Prisma 6 exige Uint8Array<ArrayBuffer>.
      data: { imagenUrl: nombreArchivo, imagenDatos: Uint8Array.from(archivo.buffer), imagenMime: formato.mime },
    });
    return { imagen_url: `/api/unidades/${id}/portada` };
  }

  /** Quita la portada de la unidad (vuelve al fondo degradado por defecto). */
  async eliminarImagen(id: number) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (unidad.imagenUrl) {
      await fs.unlink(join(UPLOAD_IMG_DIR, basename(unidad.imagenUrl))).catch(() => undefined);
      await this.prisma.unidad.update({
        where: { id },
        data: { imagenUrl: null, imagenDatos: null, imagenMime: null },
      });
    }
    return { ok: true };
  }

  private vistaTema(t: {
    id: number; numero: string; titulo: string; descripcion: string | null; repaso: string | null; orden: number;
    umbral: number; publicado: boolean; enDiagnostico: boolean; _count: { ejercicios: number };
    subtemas?: { id: number; numero: string; titulo: string; descripcion: string | null; repaso: string | null; orden: number; umbral: number; publicado: boolean; enDiagnostico: boolean; _count: { ejercicios: number } }[];
  }, diag: Map<number, number>, extra: Extra): TemaVista {
    const items = diag.get(t.id) ?? 0;
    const porNivel = extra.niveles.get(t.id) ?? sinEjercicios();
    const faltan = faltantesPorNivel(porNivel);
    return {
      id: t.id, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion, repaso: t.repaso, orden: t.orden,
      umbral: t.umbral, publicado: t.publicado,
      ejercicios_activos: t._count.ejercicios,
      ejercicios_minimos: MIN_EJERCICIOS_TEMA,
      por_nivel: porNivel,
      faltan,
      flashcards: extra.flash.get(t.id) ?? 0,
      borradores_ia: extra.borradores.get(t.id) ?? 0,
      puede_publicarse: faltan.length === 0,
      en_diagnostico: t.enDiagnostico,
      items_diagnostico: items,
      puede_diagnosticar: items >= MIN_ITEMS_DIAGNOSTICO,
      subtemas: t.subtemas?.map((s) => this.vistaTema({ ...s, subtemas: undefined }, diag, extra)) ?? [],
    };
  }

  async crearUnidad(dto: CrearUnidadDto) {
    // numero es único por institución; el panel docente opera sobre el plan UPEA.
    const existe = await this.prisma.unidad.findFirst({ where: { numero: dto.numero } });
    if (existe) throw new BadRequestException(`Ya existe la unidad número ${dto.numero}`);
    return this.prisma.unidad.create({
      data: { numero: dto.numero, titulo: dto.titulo, descripcion: dto.descripcion, xp: dto.xp ?? 0, orden: dto.orden ?? dto.numero },
    });
  }

  async editarUnidad(id: number, dto: EditarUnidadDto) {
    const u = await this.prisma.unidad.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Unidad no encontrada');
    if (dto.numero !== undefined && dto.numero !== u.numero) {
      const choque = await this.prisma.unidad.findFirst({ where: { numero: dto.numero } });
      if (choque) throw new BadRequestException(`Ya existe la unidad número ${dto.numero}`);
    }
    return this.prisma.unidad.update({ where: { id }, data: dto });
  }

  async eliminarUnidad(id: number) {
    const conTemas = await this.prisma.tema.count({ where: { unidadId: id } });
    if (conTemas > 0) throw new ConflictException('No puedes eliminar una unidad con temas. Elimina primero sus temas.');
    await this.prisma.unidad.delete({ where: { id } });
    return { ok: true };
  }

  // ── Temas / Subtemas ──
  private async temaConHijos(temaId: number) {
    const t = await this.prisma.tema.findUnique({ where: { id: temaId } });
    if (!t) throw new NotFoundException('Tema no encontrado');
    return t;
  }

  async crearTema(unidadId: number, dto: CrearTemaDto) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id: unidadId } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    if (dto.padreId) {
      const padre = await this.temaConHijos(dto.padreId);
      if (padre.unidadId !== unidadId) throw new BadRequestException('El tema padre pertenece a otra unidad');
      if (padre.padreId) throw new BadRequestException('Un subtema no puede tener a su vez subtemas (un solo nivel de profundidad)');
    }
    return this.prisma.tema.create({
      data: {
        unidadId, padreId: dto.padreId ?? null, numero: dto.numero, titulo: dto.titulo,
        descripcion: dto.descripcion, umbral: dto.umbral ?? MIN_EJERCICIOS_TEMA, orden: dto.orden ?? 0,
      },
    });
  }

  async editarTema(id: number, dto: EditarTemaDto) {
    const t = await this.temaConHijos(id);
    if (dto.publicado === true && !t.publicado) {
      const filas = await this.prisma.ejercicio.groupBy({ by: ['nivelDificultad'], where: { temaId: id, activo: true, banco: 'practica' }, _count: { _all: true } });
      const porNivel = sinEjercicios();
      for (const f of filas) porNivel[f.nivelDificultad] = f._count._all;
      const faltan = faltantesPorNivel(porNivel);
      if (faltan.length > 0) {
        throw new BadRequestException(`Para publicar «${t.titulo}» cada nivel necesita ${MIN_EJERCICIOS_TEMA} ejercicios activos. Faltan: ${faltan.join(', ')}. Puedes crearlos a mano o generarlos con PREXI.`);
      }
    }
    // Para entrar al diagnóstico, el tema debe tener un banco de diagnóstico suficiente.
    if (dto.enDiagnostico === true && !t.enDiagnostico) {
      const items = await this.prisma.ejercicio.count({ where: { temaId: id, banco: 'pretest' } });
      if (items < MIN_ITEMS_DIAGNOSTICO) {
        throw new BadRequestException(`Este tema tiene ${items}/${MIN_ITEMS_DIAGNOSTICO} preguntas de diagnóstico. Necesita al menos ${MIN_ITEMS_DIAGNOSTICO} para el pretest.`);
      }
    }
    return this.prisma.tema.update({ where: { id }, data: dto });
  }

  async eliminarTema(id: number) {
    const conSubtemas = await this.prisma.tema.count({ where: { padreId: id } });
    if (conSubtemas > 0) throw new ConflictException('No puedes eliminar un tema con subtemas. Elimina primero los subtemas.');
    await this.prisma.tema.delete({ where: { id } });
    return { ok: true };
  }

  /** Lista simplificada de temas/subtemas (para selects: crear ejercicio, subir documento…). */
  /**
   * Temas para selectores. Devuelve la ETIQUETA ya compuesta (para selects
   * planos) y además la ESTRUCTURA (unidad, padre, orden), que es lo que
   * necesitan los desplegables dependientes Unidad → Tema → Subtema.
   */
  async opcionesTema() {
    const temas = await this.prisma.tema.findMany({
      orderBy: [{ unidadId: 'asc' }, { orden: 'asc' }],
      include: { unidad: { select: { id: true, numero: true, titulo: true } }, padre: { select: { numero: true, titulo: true } } },
    });
    return temas.map((t) => ({
      id: t.id,
      etiqueta: `U${t.unidad.numero} · ${t.numero} ${t.titulo}${t.padre ? ` (subtema de ${t.padre.numero})` : ''}`,
      publicado: t.publicado,
      numero: t.numero,
      titulo: t.titulo,
      orden: t.orden,
      padre_id: t.padreId,
      unidad_id: t.unidad.id,
      unidad_numero: t.unidad.numero,
      unidad_titulo: t.unidad.titulo,
    }));
  }
}
