import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ITEMS_SUS, SUS_MAX, SUS_MIN, VERSION_SUS } from './sus';
import {
  CARACTERISTICAS_ISO25010, INSTRUMENTO_VALIDADO, VERSION_ISO25010, itemsIso25010,
} from '../calidad/items-iso25010';

export type ClaveInstrumento = 'SUS' | 'ISO25010';

interface Definicion {
  clave: ClaveInstrumento;
  titulo: string;
  descripcion: string;
  version: string;
  /** Roles a los que les corresponde responderlo. */
  roles: string[];
  minutos: number;
  items: { id: string; texto: string; seccion: string | null }[];
}

const ANCLAJES = [
  { valor: 1, etiqueta: 'Totalmente en desacuerdo' },
  { valor: 2, etiqueta: 'En desacuerdo' },
  { valor: 3, etiqueta: 'Ni de acuerdo ni en desacuerdo' },
  { valor: 4, etiqueta: 'De acuerdo' },
  { valor: 5, etiqueta: 'Totalmente de acuerdo' },
];

const CONSENTIMIENTO =
  'Tus respuestas se usan solo con fines académicos, para evaluar el sistema PREXI. Se analizan de ' +
  'forma anónima (sin tu nombre, CI ni RU) y no influyen en ninguna calificación. Responder es ' +
  'voluntario y solo se puede hacer una vez.';

/**
 * INSTRUMENTOS DE VALORACIÓN del estudio (SUS e ISO/IEC 25010).
 *
 *  · Solo se pueden responder con la FASE DE EVALUACIÓN activa
 *    (ConfiguracionSistema.faseEvaluacionActiva): es la medición única, al final
 *    del período de uso, que exige el diseño transversal.
 *  · UNA aplicación por usuario y versión: no se puede responder dos veces.
 *  · Se exige el cuestionario COMPLETO: uno a medias no se puede puntuar.
 *  · A cada rol le corresponde un instrumento: SUS a estudiantes, ISO/IEC 25010
 *    a docentes del área y evaluadores (con cuenta de rol docente).
 */
@Injectable()
export class InstrumentosService {
  constructor(private readonly prisma: PrismaService) {}

  private definiciones(): Definicion[] {
    const nombreDe = new Map(CARACTERISTICAS_ISO25010.map((c) => [c.clave, c.nombre]));
    return [
      {
        clave: 'SUS',
        titulo: 'Usabilidad de PREXI',
        descripcion: 'Diez afirmaciones sobre tu experiencia usando PREXI (escala SUS).',
        version: VERSION_SUS,
        roles: ['estudiante'],
        minutos: 3,
        items: ITEMS_SUS.map((i) => ({ id: i.id, texto: i.texto, seccion: null })),
      },
      {
        clave: 'ISO25010',
        titulo: 'Calidad del producto de software',
        descripcion: 'Valoración de PREXI por característica de calidad (ISO/IEC 25010).',
        version: VERSION_ISO25010,
        roles: ['docente'],
        minutos: 5,
        items: itemsIso25010().map((i) => ({ id: i.id, texto: i.texto, seccion: nombreDe.get(i.caracteristica) ?? null })),
      },
    ];
  }

  private definicion(clave: string): Definicion {
    const def = this.definiciones().find((d) => d.clave === clave);
    if (!def) throw new NotFoundException('Instrumento no encontrado.');
    return def;
  }

  async faseActiva(): Promise<boolean> {
    const cfg = await this.prisma.configuracionSistema.findUnique({
      where: { id: 1 }, select: { faseEvaluacionActiva: true },
    });
    return cfg?.faseEvaluacionActiva ?? false;
  }

  /** Activa o desactiva la fase de evaluación (docente/admin). */
  async cambiarFase(activa: boolean) {
    await this.prisma.configuracionSistema.upsert({
      where: { id: 1 }, create: { id: 1, faseEvaluacionActiva: activa }, update: { faseEvaluacionActiva: activa },
    });
    return { fase_activa: activa };
  }

  private async yaRespondio(usuarioId: number, def: Definicion): Promise<boolean> {
    const n = await this.prisma.respuestaInstrumento.count({
      where: { usuarioId, instrumento: def.clave, version: def.version },
    });
    return n > 0;
  }

  /** Qué le toca responder a este usuario. Lo consulta la tarjeta "Evalúa PREXI". */
  async estado(usuarioId: number, rol: string) {
    const fase = await this.faseActiva();
    const propios = this.definiciones().filter((d) => d.roles.includes(rol));
    const instrumentos = await Promise.all(
      propios.map(async (d) => ({
        clave: d.clave,
        titulo: d.titulo,
        descripcion: d.descripcion,
        minutos: d.minutos,
        total_items: d.items.length,
        respondido: await this.yaRespondio(usuarioId, d),
      })),
    );
    return {
      fase_activa: fase,
      instrumentos,
      pendientes: fase ? instrumentos.filter((i) => !i.respondido).length : 0,
    };
  }

  private exigirRol(def: Definicion, rol: string) {
    if (!def.roles.includes(rol)) {
      throw new ForbiddenException('Este cuestionario no corresponde a tu rol.');
    }
  }

  /** Cuestionario a mostrar (ítems, escala y consentimiento). */
  async cuestionario(usuarioId: number, rol: string, clave: string) {
    const def = this.definicion(clave);
    this.exigirRol(def, rol);
    return {
      clave: def.clave,
      titulo: def.titulo,
      descripcion: def.descripcion,
      version: def.version,
      minutos: def.minutos,
      fase_activa: await this.faseActiva(),
      respondido: await this.yaRespondio(usuarioId, def),
      escala: { min: SUS_MIN, max: SUS_MAX, anclajes: ANCLAJES },
      consentimiento: CONSENTIMIENTO,
      provisional: def.clave === 'ISO25010' && !INSTRUMENTO_VALIDADO,
      items: def.items,
    };
  }

  /** Guarda el cuestionario completo. Una sola vez por usuario y versión. */
  async responder(
    usuarioId: number,
    rol: string,
    clave: string,
    respuestas: { itemId: string; valor: number }[],
    aceptaConsentimiento: boolean,
  ) {
    const def = this.definicion(clave);
    this.exigirRol(def, rol);
    if (!(await this.faseActiva())) {
      throw new ForbiddenException('La fase de evaluación del sistema aún no está habilitada.');
    }
    if (aceptaConsentimiento !== true) {
      throw new BadRequestException('Debes aceptar el consentimiento para enviar tus respuestas.');
    }
    if (await this.yaRespondio(usuarioId, def)) {
      throw new ConflictException('Ya respondiste este cuestionario. Solo se puede responder una vez.');
    }

    const porItem = new Map(respuestas.map((r) => [r.itemId, r.valor]));
    const faltan = def.items.filter((i) => !porItem.has(i.id));
    if (faltan.length > 0) {
      throw new BadRequestException(`Faltan ${faltan.length} respuesta(s). Responde todas las afirmaciones.`);
    }
    if (porItem.size !== def.items.length || respuestas.length !== def.items.length) {
      throw new BadRequestException('Las respuestas no corresponden a este cuestionario.');
    }
    for (const v of porItem.values()) {
      if (!Number.isInteger(v) || v < SUS_MIN || v > SUS_MAX) {
        throw new BadRequestException(`Cada respuesta debe ser un valor entre ${SUS_MIN} y ${SUS_MAX}.`);
      }
    }

    await this.prisma.respuestaInstrumento.createMany({
      data: def.items.map((i) => ({
        usuarioId, instrumento: def.clave, itemId: i.id, valor: porItem.get(i.id)!, version: def.version,
      })),
    });
    return { guardado: true, instrumento: def.clave, total_items: def.items.length };
  }

  /**
   * Respuestas agrupadas por persona, de la versión VIGENTE del instrumento.
   * Insumo del panel del investigador y de la exportación. Sin datos personales:
   * solo el id interno, que el llamador convierte en id anónimo.
   */
  async respuestasPorPersona(clave: ClaveInstrumento): Promise<Map<number, Record<string, number>>> {
    const def = this.definicion(clave);
    const filas = await this.prisma.respuestaInstrumento.findMany({
      where: { instrumento: def.clave, version: def.version },
      select: { usuarioId: true, itemId: true, valor: true },
      orderBy: [{ usuarioId: 'asc' }, { itemId: 'asc' }],
    });
    const mapa = new Map<number, Record<string, number>>();
    for (const f of filas) {
      const r = mapa.get(f.usuarioId) ?? {};
      r[f.itemId] = f.valor;
      mapa.set(f.usuarioId, r);
    }
    return mapa;
  }
}
