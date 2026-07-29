import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { EMBLEMAS } from './catalogo';

/** Un emblema recién desbloqueado (para la animación de "¡Logro desbloqueado!"). */
export interface EmblemaOtorgado {
  clave: string;
  nombre: string;
  descripcion: string;
  svgKey: string;
  icono: string;
}

const VELOZ_MIN = 10; // "Estudiante veloz": completar un tema en < 10 minutos

/**
 * Otorgamiento y validación de EMBLEMAS — SIEMPRE en el backend, sin duplicar
 * (constraint en logros_usuario). Centraliza toda la lógica de requisitos que
 * antes vivía dispersa. Cada método devuelve los emblemas realmente nuevos para
 * que el frontend los celebre.
 */
@Injectable()
export class EmblemasService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Otorga emblemas por clave (envuelve `otorgar` en su propia transacción). Para
   * casos fuera del flujo de intentos, p. ej. las misiones de depuración (bug‑hunt).
   */
  async otorgarClaves(usuarioId: number, claves: string[]): Promise<EmblemaOtorgado[]> {
    return this.prisma.$transaction((tx) => this.otorgar(tx, usuarioId, claves));
  }

  /** Inserta los emblemas nuevos (idempotente) y devuelve los que no tenía. */
  private async otorgar(tx: Prisma.TransactionClient, usuarioId: number, claves: string[]): Promise<EmblemaOtorgado[]> {
    const unicas = [...new Set(claves)];
    if (unicas.length === 0) return [];
    const logros = await tx.logro.findMany({ where: { clave: { in: unicas } } });
    const yaTiene = await tx.logroUsuario.findMany({ where: { usuarioId, logroId: { in: logros.map((l) => l.id) } }, select: { logroId: true } });
    const yaSet = new Set(yaTiene.map((y) => y.logroId));
    const nuevos = logros.filter((l) => !yaSet.has(l.id));
    if (nuevos.length) {
      await tx.logroUsuario.createMany({ data: nuevos.map((l) => ({ usuarioId, logroId: l.id })), skipDuplicates: true });
    }
    return nuevos.map((l) => ({ clave: l.clave, nombre: l.nombre, descripcion: l.descripcion, svgKey: l.svgKey, icono: l.icono }));
  }

  /**
   * Evalúa los emblemas disparables por un intento de ejercicio. Recibe el
   * contexto ya calculado por EjerciciosService (correcto, pistas, racha) y
   * consulta la BD para los requisitos que dependen de agregados (temas, etc.).
   */
  async evaluarIntento(
    tx: Prisma.TransactionClient,
    usuarioId: number,
    ctx: {
      ejercicio: { id: number; categoria: string; temaId: number | null };
      correcto: boolean;
      pistasUsadas: number;
      rachaDias: number;
      fecha?: Date;
    },
  ): Promise<EmblemaOtorgado[]> {
    const claves: string[] = [];
    const fecha = ctx.fecha ?? new Date();
    const hora = fecha.getHours();

    if (ctx.correcto) {
      const totalCorrectos = await tx.intento.count({ where: { usuarioId, correcto: true } });
      if (totalCorrectos === 1) claves.push('primer_acierto');
      if (totalCorrectos >= 25) claves.push('centurion');

      // Maestría por categoría (5 aciertos distintos en Bucles / Funciones).
      if (ctx.ejercicio.categoria === 'Bucles' || ctx.ejercicio.categoria === 'Funciones') {
        const aciertosCat = await tx.intento.count({
          where: { usuarioId, correcto: true, ejercicio: { categoria: ctx.ejercicio.categoria } },
        });
        if (aciertosCat >= 5) claves.push(ctx.ejercicio.categoria === 'Bucles' ? 'maestro_bucles' : 'maestro_funciones');
      }

      // Horarios (usa la hora local del servidor).
      if (hora < 7) claves.push('madrugador');
      if (hora >= 23) claves.push('nocturno');
    }

    // Racha.
    if (ctx.rachaDias >= 7) claves.push('racha_fuego');
    if (ctx.rachaDias >= 14) claves.push('racha_titan');

    // Top 5 del ranking.
    const rk = await tx.ranking.findUnique({ where: { usuarioId } });
    if (rk?.posicion != null && rk.posicion <= 5) claves.push('top_5');

    // Emblemas ligados a COMPLETAR un tema (y de ahí, una unidad).
    if (ctx.correcto && ctx.ejercicio.temaId) {
      claves.push(...(await this.evaluarTema(tx, usuarioId, ctx.ejercicio.temaId, fecha)));
    }

    return this.otorgar(tx, usuarioId, claves);
  }

  /** Requisitos que se disparan al COMPLETAR un tema (y su unidad). */
  private async evaluarTema(tx: Prisma.TransactionClient, usuarioId: number, temaId: number, fecha: Date): Promise<string[]> {
    const tema = await tx.tema.findUnique({ where: { id: temaId }, include: { ejercicios: { where: { activo: true }, select: { id: true } } } });
    if (!tema) return [];
    const ejercicioIds = tema.ejercicios.map((e) => e.id);
    if (ejercicioIds.length === 0) return [];

    const correctosDistintos = await tx.intento.findMany({
      where: { usuarioId, correcto: true, ejercicioId: { in: ejercicioIds } },
      distinct: ['ejercicioId'], select: { ejercicioId: true },
    });
    // El tema se considera completo al alcanzar su umbral de ejercicios correctos.
    if (correctosDistintos.length < tema.umbral) return [];

    const claves = ['tema_completado'];

    // "Sin errores": ningún intento incorrecto en los ejercicios del tema.
    const fallidos = await tx.intento.count({ where: { usuarioId, correcto: false, ejercicioId: { in: ejercicioIds } } });
    if (fallidos === 0) claves.push('sin_errores');

    // "Mente brillante": ninguna pista de ALVARO en los ejercicios del tema.
    const pistas = await tx.consultaIa.count({ where: { usuarioId, tipo: 'pista', ejercicioId: { in: ejercicioIds } } });
    if (pistas === 0) claves.push('mente_brillante');

    // "Estudiante veloz": del primer intento del tema a ahora, menos de 10 min.
    const primerIntento = await tx.intento.findFirst({
      where: { usuarioId, ejercicioId: { in: ejercicioIds } }, orderBy: { fecha: 'asc' }, select: { fecha: true },
    });
    if (primerIntento) {
      const minutos = (fecha.getTime() - primerIntento.fecha.getTime()) / 60_000;
      if (minutos <= VELOZ_MIN) claves.push('estudiante_veloz');
    }

    // "Unidad conquistada": todos los temas publicados de la unidad completos.
    const temasUnidad = await tx.tema.findMany({ where: { unidadId: tema.unidadId, publicado: true }, select: { id: true, umbral: true } });
    if (temasUnidad.length > 0) {
      const progresos = await tx.progresoTema.findMany({ where: { usuarioId, temaId: { in: temasUnidad.map((t) => t.id) } } });
      const todos = temasUnidad.every((t) => {
        if (t.id === temaId) return true; // el actual se acaba de completar
        const pr = progresos.find((p) => p.temaId === t.id);
        return (pr?.ejerciciosCompletados ?? 0) >= t.umbral;
      });
      if (todos) claves.push('unidad_conquistada');
    }

    return claves;
  }

  /** "Perfeccionista": 100% en el postest. Se llama al finalizar el postest. */
  async evaluarPostest(usuarioId: number, puntaje: number): Promise<EmblemaOtorgado[]> {
    if (puntaje < 100) return [];
    return this.prisma.$transaction((tx) => this.otorgar(tx, usuarioId, ['perfeccionista']));
  }

  /** Lista de emblemas del catálogo con el estado del usuario (para ranking/perfil). */
  async listar(usuarioId: number) {
    const todos = await this.prisma.logro.findMany({
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      include: { usuarios: { where: { usuarioId } } },
    });
    const desbloqueados = todos.filter((l) => l.usuarios.length > 0).length;
    return {
      total: todos.length,
      desbloqueados,
      emblemas: todos.map((l) => ({
        id: l.id, clave: l.clave, nombre: l.nombre, condicion: l.condicion, descripcion: l.descripcion,
        icono: l.icono, svgKey: l.svgKey, categoria: l.categoria,
        obtenido: l.usuarios.length > 0,
        fecha_obtenido: l.usuarios[0]?.fechaObtenido ?? null,
      })),
    };
  }
}

// Re-export para el seed/tests que quieran el catálogo tipado.
export { EMBLEMAS };
