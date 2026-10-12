import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { NotificacionesService } from '../../modulos/notificaciones/notificaciones.service';
import { DocenteEstudiantesService } from '../docente-estudiantes/docente-estudiantes.service';
import { nivelAlMenos } from '../../common/niveles/nivel-dificultad';
import { temaCompleto } from '../../common/niveles/desbloqueo';
import { UMBRAL_APROBACION, UMBRAL_CERCA } from '../../common/niveles/reglas-evaluacion';

export type EstadoExamen =
  | 'aprobado'            // ya rindió y aprobó
  | 'reprobado'           // rindió y no llegó a 80: puede reintentar
  | 'habilitado'          // cumple los requisitos por sí solo
  | 'habilitado_docente'  // lo habilitó su docente
  | 'cerca'               // casi cumple: candidato a habilitación manual
  | 'no_habilitado';      // todavía le falta

/**
 * EXÁMENES DE UNIDAD (rol docente).
 *
 * La evaluación final ya no es un módulo aparte: cada unidad cierra con su
 * examen. El examen se habilita solo cuando el estudiante completó todos los
 * temas y subtemas con nivel Intermedio o superior; si no llegó, su docente
 * puede habilitarlo a mano (por ejemplo, a quien está cerca).
 *
 * Aquí el docente ve, por unidad y por paralelo, a cada estudiante con su nivel,
 * su promedio y el estado de su examen, y habilita a quien corresponda.
 */
@Injectable()
export class DocenteExamenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estudiantes: DocenteEstudiantesService,
    private readonly notificaciones: NotificacionesService,
  ) {}

  async resumen(docenteId: number, rol: string, unidadIdPedida?: number) {
    const [unidades, cfg, { estudiantes: todos }] = await Promise.all([
      this.prisma.unidad.findMany({
        where: { temas: { some: { publicado: true } } },
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        select: { id: true, numero: true, titulo: true },
      }),
      this.prisma.configuracionSistema.findUnique({ where: { id: 1 }, select: { umbralPorcentaje: true } }),
      this.estudiantes.curso(docenteId, rol),
    ]);
    if (unidades.length === 0) return { unidades: [], unidad: null, estudiantes: [], resumen: null, nota_aprobacion: UMBRAL_APROBACION };

    const unidad = unidades.find((u) => u.id === unidadIdPedida) ?? unidades[0];
    const idx = unidades.findIndex((u) => u.id === unidad.id);
    const anterior = idx > 0 ? unidades[idx - 1] : null;
    const umbralPct = cfg?.umbralPorcentaje ?? 80;
    const activos = todos.filter((e) => e.activo);
    const ids = activos.map((e) => e.id);

    const [temas, progresos, examenes, habilitaciones, aprobaronAnterior, banco] = await Promise.all([
      this.prisma.tema.findMany({ where: { unidadId: unidad.id, publicado: true }, select: { id: true, numero: true, titulo: true, umbral: true } }),
      this.prisma.progresoTema.findMany({
        where: { usuarioId: { in: ids }, tema: { unidadId: unidad.id, publicado: true } },
        select: { usuarioId: true, temaId: true, ejerciciosCompletados: true, nivelActual: true },
      }),
      this.prisma.examenUnidad.findMany({
        where: { usuarioId: { in: ids }, unidadId: unidad.id },
        orderBy: { fecha: 'desc' },
        select: { usuarioId: true, puntaje: true, aprobado: true, fecha: true },
      }),
      this.prisma.habilitacionExamen.findMany({
        where: { usuarioId: { in: ids }, unidadId: unidad.id },
        include: { docente: { select: { nombre: true } } },
      }),
      anterior
        ? this.prisma.examenUnidad.findMany({
            where: { usuarioId: { in: ids }, unidadId: anterior.id, aprobado: true }, distinct: ['usuarioId'], select: { usuarioId: true },
          })
        : Promise.resolve([]),
      this.prisma.ejercicio.findMany({
        where: { banco: 'examen', activo: true, tema: { unidadId: unidad.id } },
        select: { temasIntegrados: true },
      }),
    ]);

    const progresoDe = new Map<string, { completados: number; nivel: (typeof progresos)[number]['nivelActual'] }>();
    for (const p of progresos) progresoDe.set(`${p.usuarioId}:${p.temaId}`, { completados: p.ejerciciosCompletados, nivel: p.nivelActual });
    const examenesDe = new Map<number, typeof examenes>();
    for (const e of examenes) examenesDe.set(e.usuarioId, [...(examenesDe.get(e.usuarioId) ?? []), e]);
    const habilitacionDe = new Map(habilitaciones.map((h) => [h.usuarioId, h]));
    const conAnterior = new Set(aprobaronAnterior.map((a) => a.usuarioId));

    const filas = activos.map((e) => {
      let completos = 0;
      let enNivel = 0;
      let listos = 0;
      const pendientes: string[] = [];
      for (const t of temas) {
        const p = progresoDe.get(`${e.id}:${t.id}`);
        const completo = temaCompleto(p?.completados ?? 0, t.umbral, umbralPct);
        const nivelOk = nivelAlMenos(p?.nivel ?? 'basico', 'intermedio');
        if (completo) completos++;
        if (nivelOk) enNivel++;
        if (completo && nivelOk) listos++;
        else pendientes.push(`${t.numero} ${t.titulo}${!completo ? ' (sin completar)' : ' (nivel Básico)'}`);
      }
      const avance = temas.length ? Math.round((listos / temas.length) * 100) : 0;
      const intentos = examenesDe.get(e.id) ?? [];
      const mejor = intentos.length ? Math.max(...intentos.map((x) => x.puntaje)) : null;
      const aprobado = intentos.some((x) => x.aprobado);
      const hab = habilitacionDe.get(e.id);
      const cumple = temas.length > 0 && listos === temas.length;
      const unidadAbierta = !anterior || conAnterior.has(e.id);

      const estado: EstadoExamen = aprobado ? 'aprobado'
        : hab ? 'habilitado_docente'
        : cumple ? 'habilitado'
        : intentos.length > 0 ? 'reprobado'
        : avance >= UMBRAL_CERCA || (e.promedio !== null && e.promedio >= UMBRAL_CERCA) ? 'cerca'
        : 'no_habilitado';

      return {
        id: e.id, nombre: e.nombre, ci: e.ci, ru: e.ru, paralelo: e.paralelo.nombre,
        nivel: e.nivel, nivel_label: e.nivel_label, promedio: e.promedio,
        temas_total: temas.length, temas_completos: completos, temas_en_nivel: enNivel,
        avance_pct: avance,
        pendientes: pendientes.slice(0, 6),
        unidad_abierta: unidadAbierta,
        nota: mejor, intentos: intentos.length, ultima_fecha: intentos[0]?.fecha ?? null,
        estado,
        habilitado_por: hab?.docente?.nombre ?? null,
        habilitado_en: hab?.fecha ?? null,
        // Se puede habilitar a mano a quien aún no aprobó, no cumple solo y no fue habilitado.
        puede_habilitarse: !aprobado && !cumple && !hab,
      };
    });

    const cuenta = (est: EstadoExamen) => filas.filter((f) => f.estado === est).length;
    return {
      unidades,
      unidad: {
        ...unidad,
        temas: temas.length,
        preguntas_examen: banco.length,
        preguntas_integradoras: banco.filter((b) => b.temasIntegrados.length >= 2).length,
      },
      nota_aprobacion: UMBRAL_APROBACION,
      umbral_cerca: UMBRAL_CERCA,
      estudiantes: filas,
      resumen: {
        total: filas.length,
        aprobados: cuenta('aprobado'),
        habilitados: cuenta('habilitado') + cuenta('habilitado_docente'),
        cerca: cuenta('cerca'),
        reprobados: cuenta('reprobado'),
        no_habilitados: cuenta('no_habilitado'),
      },
    };
  }

  /** Habilita el examen de la unidad a uno o varios estudiantes y les avisa. */
  async habilitar(docenteId: number, rol: string, unidadId: number, ids: number[]) {
    const unidad = await this.prisma.unidad.findUnique({ where: { id: unidadId }, select: { id: true, numero: true, titulo: true } });
    if (!unidad) throw new NotFoundException('Unidad no encontrada.');
    if (!ids?.length) throw new BadRequestException('Selecciona al menos un estudiante.');

    const { estudiantes } = await this.estudiantes.curso(docenteId, rol);
    const visibles = new Map(estudiantes.filter((e) => e.activo).map((e) => [e.id, e]));
    const elegidos = [...new Set(ids)].filter((id) => visibles.has(id));
    if (elegidos.length === 0) throw new BadRequestException('Esos estudiantes no pertenecen a tus paralelos.');

    const yaHabilitados = new Set(
      (await this.prisma.habilitacionExamen.findMany({ where: { unidadId, usuarioId: { in: elegidos } }, select: { usuarioId: true } }))
        .map((h) => h.usuarioId),
    );
    const nuevos = elegidos.filter((id) => !yaHabilitados.has(id));

    await this.prisma.$transaction(async (tx) => {
      for (const id of nuevos) {
        // Queda registrado quién habilitó, cuándo y con qué promedio iba el estudiante.
        await tx.habilitacionExamen.create({ data: { usuarioId: id, unidadId, docenteId, promedio: visibles.get(id)!.promedio } });
        await this.notificaciones.crear({
          usuarioId: id,
          tipo: 'examen_habilitado',
          titulo: 'Examen habilitado',
          mensaje: `Tu docente te habilitó el examen de la Unidad ${unidad.numero}: ${unidad.titulo}. Repasa la unidad y ríndelo cuando estés listo.`,
          enlace: `/examen-unidad/${unidad.id}`,
          refId: unidad.id,
        }, tx);
      }
      await tx.logAuditoria.create({
        data: {
          actorId: docenteId, accion: 'examen_habilitar', entidad: 'unidad', entidadId: unidadId,
          detalle: `Habilitó el examen de la Unidad ${unidad.numero} a ${nuevos.length} estudiante(s): ` +
            nuevos.map((id) => `#${id} (promedio ${visibles.get(id)!.promedio ?? 's/e'})`).join(', '),
        },
      });
    });
    return { habilitados: nuevos.length, ya_estaban: elegidos.length - nuevos.length };
  }

  /** Retira una habilitación manual (si el estudiante aún no aprobó). */
  async retirar(docenteId: number, rol: string, unidadId: number, usuarioId: number) {
    const { estudiantes } = await this.estudiantes.curso(docenteId, rol);
    if (!estudiantes.some((e) => e.id === usuarioId)) throw new NotFoundException('Estudiante no encontrado en tus paralelos.');
    await this.prisma.habilitacionExamen.deleteMany({ where: { usuarioId, unidadId } });
    return { ok: true };
  }
}
