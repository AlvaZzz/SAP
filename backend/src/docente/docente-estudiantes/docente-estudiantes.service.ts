import { Injectable, NotFoundException } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { detectarPatrones } from '../../tutor-ia/patrones-error';
import { ETIQUETA_NIVEL, NIVELES } from '../../common/niveles/nivel-dificultad';
import { estudiantesDelDocente } from '../docente-registro/docente-registro.service';
import {
  MotivoRiesgo, UMBRAL_APROBACION, UMBRAL_CERCA, Umbrales, motivosDeRiesgo, nivelGlobal, promedioGeneral, situacionPromedio,
} from './resumen-academico';

export type EstadoEstudiante = 'sin_ingresar' | 'en_riesgo' | 'inactivo' | 'en_progreso';

const MS_DIA = 86_400_000;

/** Fila de un estudiante en las listas del docente (dashboard, seguimiento, evaluación final). */
export interface FilaCurso {
  id: number;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  nombres: string | null;
  ci: string | null;
  ru: string | null;
  email: string | null;
  activo: boolean;
  ya_ingreso: boolean;
  paralelo: { id: number | null; nombre: string; materia: string | null; gestion: string | null };
  docente: string | null;
  nivel: NivelDificultad;
  nivel_label: string;
  /** Promedio general sobre 100; null si aún no rindió ninguna evaluación. */
  promedio: number | null;
  situacion: ReturnType<typeof situacionPromedio>;
  tasa_acierto: number | null;
  intentos: number;
  ejercicios_resueltos: number;
  xp: number;
  ultima_sesion: Date | null;
  tiene_diagnostico: boolean;
  evaluacion_final: number | null;
  estado: EstadoEstudiante;
  motivos_riesgo: MotivoRiesgo[];
}

/**
 * SEGUIMIENTO DE ESTUDIANTES (rol docente).
 *
 * Una sola fuente para todas las pantallas del docente: el dashboard, la lista
 * de seguimiento, la ficha y la evaluación final leen de aquí, así un mismo
 * estudiante nunca aparece con dos niveles o dos promedios distintos.
 *
 * El docente ve SOLO a los estudiantes de sus paralelos (más los que aún no
 * tienen docente asignado, para que nadie quede invisible). El admin ve todos.
 */
@Injectable()
export class DocenteEstudiantesService {
  constructor(private readonly prisma: PrismaService) {}

  private async umbrales(): Promise<Umbrales> {
    const cfg = await this.prisma.configuracionSistema.findUnique({ where: { id: 1 } });
    return {
      diasInactivo: cfg?.riesgoDiasInactivo ?? 7,
      tasaAciertoMin: cfg?.riesgoTasaAciertoMin ?? 40,
      minIntentos: cfg?.riesgoMinIntentos ?? 4,
      diasEstancado: 14,
    };
  }

  /**
   * Todos los estudiantes del docente con su resumen académico. Los conteos de
   * intentos se piden AGREGADOS a la base (no se traen los intentos a memoria).
   */
  async curso(docenteId: number, rol: string): Promise<{ estudiantes: FilaCurso[]; umbrales: Umbrales & { aprobacion: number; cerca: number } }> {
    const where = estudiantesDelDocente(docenteId, rol);
    const [umb, usuarios] = await Promise.all([
      this.umbrales(),
      this.prisma.usuario.findMany({
        where,
        orderBy: [{ apellidoPaterno: 'asc' }, { nombre: 'asc' }],
        take: 2000,
        select: {
          id: true, nombre: true, apellidoPaterno: true, apellidoMaterno: true, nombres: true,
          cedula: true, ru: true, email: true, activo: true, mustChangePassword: true, creadoEn: true,
          paralelo: true, nivelInicialAdaptativo: true, pretestCompletado: true,
          ranking: { select: { xpTotal: true, ultimaActividad: true } },
          paraleloRef: { select: { id: true, nombre: true, materia: { select: { nombre: true, gestion: true } }, docente: { select: { nombre: true } } } },
          progresoTemas: { select: { nivelActual: true, actualizadoEn: true } },
          evaluaciones: { select: { tipo: true, puntajeTotal: true } },
          examenesUnidad: { select: { unidadId: true, puntaje: true } },
          intentosSubidaNivel: { select: { temaId: true, hacia: true, puntaje: true } },
        },
      }),
    ]);

    const ids = usuarios.map((u) => u.id);
    const [totales, correctos, distintos] = await Promise.all([
      this.prisma.intento.groupBy({ by: ['usuarioId'], where: { usuarioId: { in: ids } }, _count: { _all: true }, _max: { fecha: true } }),
      this.prisma.intento.groupBy({ by: ['usuarioId'], where: { usuarioId: { in: ids }, correcto: true }, _count: { _all: true } }),
      this.prisma.intento.findMany({
        where: { usuarioId: { in: ids }, correcto: true },
        distinct: ['usuarioId', 'ejercicioId'], select: { usuarioId: true },
      }),
    ]);
    const mTotal = new Map(totales.map((t) => [t.usuarioId, { n: t._count._all, ultima: t._max.fecha ?? null }]));
    const mCorrectos = new Map(correctos.map((c) => [c.usuarioId, c._count._all]));
    const mResueltos = new Map<number, number>();
    for (const d of distintos) mResueltos.set(d.usuarioId, (mResueltos.get(d.usuarioId) ?? 0) + 1);

    const ahora = Date.now();
    const estudiantes = usuarios.map((u): FilaCurso => {
      const intentos = mTotal.get(u.id)?.n ?? 0;
      const ok = mCorrectos.get(u.id) ?? 0;
      const tasa = intentos > 0 ? Math.round((ok / intentos) * 100) : null;
      const ultima = u.ranking?.ultimaActividad ?? mTotal.get(u.id)?.ultima ?? null;
      const nivel = nivelGlobal(u.progresoTemas.map((p) => p.nivelActual), u.nivelInicialAdaptativo);
      const promedio = promedioGeneral(u.examenesUnidad, u.intentosSubidaNivel);
      const tieneDiagnostico = u.pretestCompletado || u.evaluaciones.some((e) => e.tipo === 'pre');
      // "Aún no ingresó" = sigue con la contraseña inicial Y no tiene ninguna
      // actividad. Una cuenta con historia a la que solo le resetearon la clave
      // sí ingresó alguna vez.
      const yaIngreso = !u.mustChangePassword || tieneDiagnostico || intentos > 0;
      const ultimoCambioNivel = u.progresoTemas.length
        ? new Date(Math.max(...u.progresoTemas.map((p) => p.actualizadoEn.getTime())))
        : null;

      const motivos = u.activo
        ? motivosDeRiesgo({ tieneDiagnostico, ultimaActividad: ultima, intentos, tasaAcierto: tasa, ultimoCambioNivel, creadoEn: u.creadoEn, yaIngreso }, umb, ahora)
        : [];
      const soloInactivo = motivos.length > 0 && motivos.every((m) => m.clave === 'inactivo');
      const estado: EstadoEstudiante = !yaIngreso ? 'sin_ingresar' : motivos.length === 0 ? 'en_progreso' : soloInactivo ? 'inactivo' : 'en_riesgo';

      return {
        id: u.id, nombre: u.nombre,
        apellido_paterno: u.apellidoPaterno, apellido_materno: u.apellidoMaterno, nombres: u.nombres,
        ci: u.cedula, ru: u.ru, email: u.email, activo: u.activo, ya_ingreso: yaIngreso,
        paralelo: {
          id: u.paraleloRef?.id ?? null,
          nombre: u.paraleloRef?.nombre ?? u.paralelo ?? 'Sin paralelo',
          materia: u.paraleloRef?.materia.nombre ?? null,
          gestion: u.paraleloRef?.materia.gestion ?? null,
        },
        docente: u.paraleloRef?.docente?.nombre ?? null,
        nivel, nivel_label: ETIQUETA_NIVEL[nivel],
        promedio, situacion: situacionPromedio(promedio),
        tasa_acierto: tasa, intentos,
        ejercicios_resueltos: mResueltos.get(u.id) ?? 0,
        xp: u.ranking?.xpTotal ?? 0,
        ultima_sesion: ultima,
        tiene_diagnostico: tieneDiagnostico,
        evaluacion_final: u.evaluaciones.find((e) => e.tipo === 'post')?.puntajeTotal ?? null,
        estado, motivos_riesgo: motivos,
      };
    });

    return { estudiantes, umbrales: { ...umb, aprobacion: UMBRAL_APROBACION, cerca: UMBRAL_CERCA } };
  }

  /** Lista de seguimiento + los paralelos disponibles para filtrar. */
  async listar(docenteId: number, rol: string) {
    const { estudiantes, umbrales } = await this.curso(docenteId, rol);
    const paralelos = new Map<string, { id: number | null; nombre: string; materia: string | null; total: number }>();
    for (const e of estudiantes) {
      const k = `${e.paralelo.id ?? 'x'}:${e.paralelo.nombre}`;
      const p = paralelos.get(k) ?? { id: e.paralelo.id, nombre: e.paralelo.nombre, materia: e.paralelo.materia, total: 0 };
      p.total++;
      paralelos.set(k, p);
    }
    return {
      estudiantes,
      paralelos: [...paralelos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      umbrales,
      resumen: {
        total: estudiantes.length,
        activos: estudiantes.filter((e) => e.activo).length,
        sin_ingresar: estudiantes.filter((e) => e.activo && e.estado === 'sin_ingresar').length,
        en_riesgo: estudiantes.filter((e) => e.activo && (e.estado === 'en_riesgo' || e.estado === 'inactivo')).length,
      },
    };
  }

  /**
   * FICHA del estudiante: quién es, en qué curso está, qué nivel tiene y cómo le
   * va en ejercicios y en exámenes. Solo si pertenece a los paralelos del docente.
   */
  async detalle(estudianteId: number, docenteId: number, rol: string) {
    const visible = await this.prisma.usuario.findFirst({
      where: { id: estudianteId, ...estudiantesDelDocente(docenteId, rol) }, select: { id: true },
    });
    if (!visible) throw new NotFoundException('Estudiante no encontrado en tus paralelos.');

    const [{ estudiantes }, u, intentos, examenes, subidas, unidades, nota] = await Promise.all([
      this.curso(docenteId, rol),
      this.prisma.usuario.findUniqueOrThrow({
        where: { id: estudianteId },
        include: {
          evaluaciones: true,
          ranking: true,
          progresoTemas: true,
          desempenoUnidades: true,
          diagnosticoTemas: { select: { temaId: true, nivel: true, puntaje: true } },
        },
      }),
      this.prisma.intento.findMany({
        where: { usuarioId: estudianteId },
        orderBy: { fecha: 'desc' },
        include: { ejercicio: { select: { titulo: true, categoria: true, tipo: true, respuestaCorrecta: true, temaId: true, nivelDificultad: true } } },
      }),
      this.prisma.examenUnidad.findMany({
        where: { usuarioId: estudianteId }, orderBy: { fecha: 'desc' },
        include: { unidad: { select: { numero: true, titulo: true } } },
      }),
      this.prisma.intentoSubidaNivel.findMany({
        where: { usuarioId: estudianteId }, orderBy: { fecha: 'desc' },
        include: { tema: { select: { numero: true, titulo: true } } },
      }),
      this.prisma.unidad.findMany({
        orderBy: { numero: 'asc' },
        select: {
          id: true, numero: true, titulo: true,
          temas: { where: { publicado: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }], select: { id: true, numero: true, titulo: true, padreId: true } },
        },
      }),
      this.prisma.notaDocente.findUnique({ where: { estudianteId_docenteId: { estudianteId, docenteId } } }),
    ]);
    const fila = estudiantes.find((e) => e.id === estudianteId)!;

    // ── Nivel por unidad y tema ──
    const progresoPorTema = new Map(u.progresoTemas.map((p) => [p.temaId, p]));
    const diagnosticoPorTema = new Map(u.diagnosticoTemas.map((d) => [d.temaId, d]));
    const porTema = new Map<number, { intentos: number; correctos: number; resueltos: Set<number> }>();
    for (const it of intentos) {
      if (it.ejercicio.temaId == null) continue;
      const t = porTema.get(it.ejercicio.temaId) ?? { intentos: 0, correctos: 0, resueltos: new Set<number>() };
      t.intentos++;
      if (it.correcto) { t.correctos++; t.resueltos.add(it.ejercicioId); }
      porTema.set(it.ejercicio.temaId, t);
    }
    const desempeno = new Map(u.desempenoUnidades.map((d) => [d.unidadId, d]));
    const mejorExamen = new Map<number, { puntaje: number; aprobado: boolean }>();
    for (const e of examenes) {
      const m = mejorExamen.get(e.unidadId);
      if (!m || e.puntaje > m.puntaje) mejorExamen.set(e.unidadId, { puntaje: e.puntaje, aprobado: e.aprobado || !!m?.aprobado });
    }

    const nivelesPorUnidad = unidades.map((un) => {
      const d = desempeno.get(un.id);
      return {
        unidad_id: un.id, numero: un.numero, titulo: un.titulo,
        nivel: d?.nivelDominio ?? null,
        nivel_label: d ? ETIQUETA_NIVEL[d.nivelDominio] : null,
        examen: mejorExamen.get(un.id) ?? null,
        temas: un.temas.map((t) => {
          const pr = progresoPorTema.get(t.id);
          const ag = porTema.get(t.id);
          const nivel = pr?.nivelActual ?? diagnosticoPorTema.get(t.id)?.nivel ?? null;
          return {
            tema_id: t.id, numero: t.numero, titulo: t.titulo, es_subtema: t.padreId !== null,
            nivel, nivel_label: nivel ? ETIQUETA_NIVEL[nivel] : null,
            // Ejercicios DISTINTOS resueltos en el tema (no intentos repetidos).
            ejercicios_resueltos: ag?.resueltos.size ?? 0,
            intentos: ag?.intentos ?? 0,
            tasa_acierto: ag && ag.intentos > 0 ? Math.round((ag.correctos / ag.intentos) * 100) : null,
          };
        }),
      };
    }).filter((un) => un.temas.length > 0);

    // ── Ejercicios: temas débiles (al menos 3 intentos y menos de 60 % de acierto) ──
    const temasDebiles = nivelesPorUnidad
      .flatMap((un) => un.temas.map((t) => ({ ...t, unidad: un.numero })))
      .filter((t) => t.intentos >= 3 && t.tasa_acierto !== null && t.tasa_acierto < 60)
      .sort((a, b) => (a.tasa_acierto ?? 0) - (b.tasa_acierto ?? 0))
      .slice(0, 5)
      .map((t) => ({ numero: t.numero, titulo: t.titulo, tasa_acierto: t.tasa_acierto, intentos: t.intentos }));

    const porNivel = NIVELES.map((n) => {
      const xs = intentos.filter((it) => it.ejercicio.nivelDificultad === n);
      return { nivel: n, nivel_label: ETIQUETA_NIVEL[n], intentos: xs.length, tasa_acierto: xs.length ? Math.round((xs.filter((x) => x.correcto).length / xs.length) * 100) : null };
    });

    // Actividad de los últimos 7 días.
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const actividad = Array.from({ length: 7 }, (_, k) => {
      const d = new Date(hoy.getTime() - (6 - k) * MS_DIA);
      const sig = new Date(d.getTime() + MS_DIA);
      const delDia = intentos.filter((it) => it.fecha >= d && it.fecha < sig);
      return { dia: d.toISOString().slice(0, 10), intentos: delDia.length, aciertos: delDia.filter((it) => it.correcto).length };
    });

    const patrones = detectarPatrones(intentos.map((it) => ({
      correcto: it.correcto, respuestaDada: it.respuestaDada ?? '', categoria: it.ejercicio.categoria,
      tipo: it.ejercicio.tipo, respuestaCorrecta: it.ejercicio.respuestaCorrecta,
    })));

    const pre = u.evaluaciones.find((e) => e.tipo === 'pre');
    const post = u.evaluaciones.find((e) => e.tipo === 'post');

    return {
      estudiante: {
        ...fila,
        carrera: u.carrera,
        racha_dias: u.ranking?.rachaDias ?? 0,
        registrado_en: u.creadoEn,
        nivel_inicial: u.nivelInicialAdaptativo,
        nivel_inicial_label: u.nivelInicialAdaptativo ? ETIQUETA_NIVEL[u.nivelInicialAdaptativo] : null,
      },
      niveles: nivelesPorUnidad,
      ejercicios: {
        intentos: fila.intentos,
        resueltos: fila.ejercicios_resueltos,
        tasa_acierto: fila.tasa_acierto,
        por_nivel: porNivel,
        temas_debiles: temasDebiles,
        patrones_error: patrones.map((p) => ({ clave: p.clave, descripcion: p.descripcion, frecuencia: p.frecuencia })),
      },
      examenes: {
        promedio: fila.promedio,
        de_unidad: examenes.map((e) => ({
          unidad: e.unidad.numero, titulo: e.unidad.titulo, nota: e.puntaje, aciertos: e.aciertos, total: e.total,
          aprobado: e.aprobado, fecha: e.fecha,
        })),
        subida_nivel: subidas.map((s) => ({
          tema: s.tema.numero, titulo: s.tema.titulo, desde: ETIQUETA_NIVEL[s.desde], hacia: ETIQUETA_NIVEL[s.hacia],
          nota: s.puntaje, aprobado: s.aprobado, fecha: s.fecha,
        })),
        diagnostico: pre ? { nota: pre.puntajeTotal, tiempo_seg: pre.tiempoSeg, por_categoria: pre.porCategoria, fecha: pre.fecha } : null,
        evaluacion_final: post ? { nota: post.puntajeTotal, tiempo_seg: post.tiempoSeg, por_categoria: post.porCategoria, fecha: post.fecha } : null,
      },
      actividad,
      historial: intentos.slice(0, 15).map((it) => ({
        titulo: it.ejercicio.titulo, categoria: it.ejercicio.categoria,
        correcto: it.correcto, xp: it.xpOtorgado, tiempo_seg: it.tiempoSeg, fecha: it.fecha,
      })),
      nota: nota?.texto ?? '',
    };
  }

  async guardarNota(estudianteId: number, docenteId: number, rol: string, texto: string) {
    const existe = await this.prisma.usuario.findFirst({
      where: { id: estudianteId, ...estudiantesDelDocente(docenteId, rol) }, select: { id: true },
    });
    if (!existe) throw new NotFoundException('Estudiante no encontrado en tus paralelos.');
    await this.prisma.notaDocente.upsert({
      where: { estudianteId_docenteId: { estudianteId, docenteId } },
      create: { estudianteId, docenteId, texto },
      update: { texto },
    });
    return { ok: true };
  }
}
