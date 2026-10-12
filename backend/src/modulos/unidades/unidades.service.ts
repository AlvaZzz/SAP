import { Injectable, NotFoundException } from '@nestjs/common';
import { NivelDificultad } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ETIQUETA_NIVEL, siguienteNivel, nivelDominioAgregado } from '../../common/niveles/nivel-dificultad';
import { desbloqueoSecuencial } from '../../common/niveles/desbloqueo';

/** Nodo del mapa conceptual del Dashboard de Destino (tema o subtema). */
interface NodoMapa {
  id: number; tipo: 'tema' | 'subtema'; numero: string; titulo: string;
  nivel: NivelDificultad; nivel_label: string;
}
interface EjemploDash { titulo: string; codigo: string; diagrama: string; salida: string }

// Nivel mínimo de dominio que exige el EXAMEN de fin de unidad para avanzar.
const NIVEL_MIN_AVANZAR: NivelDificultad = 'intermedio';

interface EjLite { id: number; nivelDificultad: NivelDificultad }

/**
 * Vista del estudiante sobre la jerarquía académica real (Unidad → Tema →
 * Subtema), enriquecida con la ADAPTATIVIDAD por niveles:
 *  - cada tema muestra el NIVEL ACTUAL del estudiante y cuántos ejercicios tiene
 *    de ese nivel, y si puede intentar SUBIR de nivel;
 *  - cada unidad indica su DOMINIO agregado y si está DESBLOQUEADA (la siguiente
 *    unidad exige dominio ≥ Intermedio en la anterior — no basta con básico).
 */
@Injectable()
export class UnidadesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: number) {
    const [usuario, unidades, aprobados, repasos, examenItems, resueltos, cfg] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      this.prisma.unidad.findMany({
        orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
        include: {
          temas: {
            where: { padreId: null, publicado: true },
            orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
            include: {
              ejercicios: { where: { activo: true }, select: { id: true, nivelDificultad: true } },
              progreso: { where: { usuarioId } },
              subtemas: {
                where: { publicado: true },
                orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
                include: {
                  ejercicios: { where: { activo: true }, select: { id: true, nivelDificultad: true } },
                  progreso: { where: { usuarioId } },
                },
              },
            },
          },
        },
      }),
      // Exámenes de unidad APROBADOS del estudiante (fuente del gate de avance).
      this.prisma.examenUnidad.findMany({ where: { usuarioId, aprobado: true }, select: { unidadId: true }, distinct: ['unidadId'] }),
      // Unidades cuyo repaso ya revisó (habilita el examen).
      this.prisma.repasoUnidad.findMany({ where: { usuarioId }, select: { unidadId: true } }),
      // Ítems del banco de examen (para saber qué unidades tienen examen disponible).
      this.prisma.ejercicio.findMany({ where: { banco: 'examen', activo: true }, select: { tema: { select: { unidadId: true } } } }),
      // Ejercicios RESUELTOS por el estudiante: se cargan una sola vez para todas
      // las unidades (no por tema) y sirven para saber si cumple la práctica
      // mínima de su nivel en cada tema.
      this.prisma.intento.findMany({ where: { usuarioId, correcto: true }, distinct: ['ejercicioId'], select: { ejercicioId: true } }),
      this.prisma.configuracionSistema.findUnique({ where: { id: 1 } }),
    ]);
    const resueltosIds = new Set(resueltos.map((r) => r.ejercicioId));
    const minimos: Record<NivelDificultad, number> = {
      basico: cfg?.minPracticaBasico ?? 10,
      intermedio: cfg?.minPracticaIntermedio ?? 10,
      avanzado: cfg?.minPracticaAvanzado ?? 10,
    };

    const nivelInicial: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';
    const conTemas = unidades.filter((u) => u.temas.length > 0); // oculta unidades sin temas publicados

    const aprobadas = new Set(aprobados.map((a) => a.unidadId));
    const repasadas = new Set(repasos.map((r) => r.unidadId));
    const conExamen = new Set(examenItems.map((e) => e.tema?.unidadId).filter((x): x is number => x != null));

    // Gate secuencial: la unidad k+1 se desbloquea si el EXAMEN DE FIN DE UNIDAD de
    // la unidad k está APROBADO (θ ≥ Intermedio). La primera siempre está abierta.
    let anteriorDesbloqueaSiguiente = true;

    const umbralPct = cfg?.umbralPorcentaje ?? 80;
    const avance = (xs: { umbral: number; progreso: { ejerciciosCompletados: number }[] }[]) =>
      xs.map((x) => ({ completados: x.progreso[0]?.ejerciciosCompletados ?? 0, umbral: x.umbral }));

    return conTemas.map((u) => {
      const desbloqueada = anteriorDesbloqueaSiguiente;
      const examenAprobado = aprobadas.has(u.id);
      // Desbloqueo CALCULADO desde el avance real (ver common/niveles/desbloqueo).
      const temasAbiertos = desbloqueoSecuencial(avance(u.temas), umbralPct, desbloqueada);

      const temas = u.temas.map((t, it) => {
        const pr = t.progreso[0];
        const desbloqueado = temasAbiertos[it];
        const subAbiertos = desbloqueoSecuencial(avance(t.subtemas), umbralPct, desbloqueado);
        const nivelActual: NivelDificultad = pr?.nivelActual ?? nivelInicial;
        return {
          ...this.mapTema(t, nivelActual, desbloqueado, resueltosIds, minimos),
          subtemas: t.subtemas.map((s, is) => {
            const prs = s.progreso[0];
            const desbSub = subAbiertos[is];
            const nivelSub: NivelDificultad = prs?.nivelActual ?? nivelInicial;
            return this.mapTema(s, nivelSub, desbSub, resueltosIds, minimos);
          }),
        };
      });

      // DOMINIO de la unidad = promedio del NIVEL en TODOS sus temas y subtemas
      // (lo MISMO que se muestra por tema). Así el dominio nunca contradice a los
      // niveles por tema (si están en Avanzado, el dominio no puede ser Básico) y
      // es independiente del progreso de ejercicios. Se calcula en vivo desde los
      // niveles ya resueltos para garantizar coherencia en la interfaz.
      const niveles: NivelDificultad[] = temas.flatMap((t) => [t.nivel_actual, ...t.subtemas.map((s) => s.nivel_actual)]);
      const { dominioPct, nivelDominio } = nivelDominioAgregado(niveles);
      // ¿Esta unidad habilita la siguiente? Ahora lo decide el EXAMEN aprobado
      // (no el dominio automático, que queda como indicador de preparación).
      anteriorDesbloqueaSiguiente = examenAprobado;

      const hayExamen = conExamen.has(u.id);
      return {
        id: u.id, numero: u.numero, titulo: u.titulo, descripcion: u.descripcion, xp: u.xp,
        // Portada: URL de stream si tiene imagen; null → el front usa el degradado por defecto.
        imagen_url: u.imagenUrl ? `/api/unidades/${u.id}/portada` : null,
        desbloqueada,
        dominio_pct: dominioPct,
        nivel_dominio: nivelDominio,
        nivel_dominio_label: ETIQUETA_NIVEL[nivelDominio],
        // Requisito de aprobación del examen para avanzar (Intermedio).
        requiere_nivel: NIVEL_MIN_AVANZAR,
        requiere_nivel_label: ETIQUETA_NIVEL[NIVEL_MIN_AVANZAR],
        // Estado del EXAMEN DE FIN DE UNIDAD (gate real de avance).
        examen_aprobado: examenAprobado,
        examen_disponible: hayExamen,
        repaso_revisado: repasadas.has(u.id),
        puede_rendir_examen: desbloqueada && !examenAprobado && hayExamen,
        habilita_siguiente: examenAprobado,
        temas,
      };
    });
  }

  /** Proyecta un tema/subtema con su nivel actual, conteos por nivel y estado. */
  private mapTema(
    t: { id: number; numero: string; titulo: string; descripcion: string | null; umbral: number; ejercicios: EjLite[]; progreso: { ejerciciosCompletados: number }[] },
    nivelActual: NivelDificultad,
    desbloqueado: boolean,
    resueltosIds: Set<number>,
    minimos: Record<NivelDificultad, number>,
  ) {
    const completados = t.progreso[0]?.ejerciciosCompletados ?? 0;
    const completo = completados >= t.umbral;
    const delNivel = t.ejercicios.filter((e) => e.nivelDificultad === nivelActual);
    const totalNivel = delNivel.length;
    const objetivo = siguienteNivel(nivelActual);
    // Avanzado es el nivel máximo: no hay "siguiente nivel" al que subir.
    const nivelMaximo = objetivo === null;

    // PRÁCTICA MÍNIMA DEL NIVEL VIGENTE. Antes `puedeSubir` solo miraba que
    // existieran ejercicios del nivel objetivo, así que el botón "¿Intentar
    // subir?" salía desde el primer momento y se podía saltar el nivel entero
    // sin resolver un solo ejercicio. El mínimo se topa al total disponible:
    // un tema con menos ejercicios que el mínimo no debe dejar atrapado a nadie.
    const resueltosNivel = delNivel.filter((e) => resueltosIds.has(e.id)).length;
    const minimoNivel = Math.min(minimos[nivelActual] ?? 0, totalNivel);
    const cumpleMinimo = totalNivel > 0 && resueltosNivel >= minimoNivel;
    // Puede subir si no está en Avanzado, hay ejercicios del nivel objetivo Y ya
    // practicó lo suficiente en el nivel actual (el backend lo exige igual en
    // AdaptatividadService.exigirPracticaMinima: esto es solo la interfaz).
    const puedeSubir = !!objetivo && t.ejercicios.some((e) => e.nivelDificultad === objetivo) && cumpleMinimo;

    return {
      id: t.id, numero: t.numero, titulo: t.titulo, descripcion: t.descripcion,
      umbral: t.umbral, total_ejercicios: t.ejercicios.length,
      total_ejercicios_nivel: totalNivel,
      ejercicios_completados: completados, desbloqueado,
      nivel_actual: nivelActual, nivel_actual_label: ETIQUETA_NIVEL[nivelActual],
      nivel_objetivo: objetivo, nivel_objetivo_label: objetivo ? ETIQUETA_NIVEL[objetivo] : null,
      puede_subir: puedeSubir,
      // Progreso DENTRO del nivel vigente (distinto de `ejercicios_completados`,
      // que cuenta el tema entero sin mirar el nivel).
      resueltos_nivel: resueltosNivel,
      minimo_nivel: minimoNivel,
      faltan_nivel: Math.max(0, minimoNivel - resueltosNivel),
      cumple_minimo_nivel: cumpleMinimo,
      // El estudiante ya está en el nivel máximo (Avanzado) en este tema.
      nivel_maximo: nivelMaximo,
      estado: completo ? 'completado' : desbloqueado ? 'en_progreso' : 'bloqueado',
    };
  }

  /**
   * DASHBOARD DE DESTINO (Preview de Unidad). Devuelve las 4 zonas: ① objetivos
   * y ③ analogías (Markdown editado por el docente), ④ ejemplos (sembrados) y
   * ② el MAPA CONCEPTUAL derivado del temario (Tema→Subtema) coloreado por el
   * NIVEL IRT del estudiante en cada tema, más el % de progreso de la unidad.
   */
  async dashboard(usuarioId: number, unidadId: number) {
    const [usuario, unidad] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuarioId }, select: { nivelInicialAdaptativo: true } }),
      this.prisma.unidad.findUnique({
        where: { id: unidadId },
        include: {
          temas: {
            where: { padreId: null, publicado: true },
            orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
            include: {
              ejercicios: { where: { activo: true }, select: { id: true } },
              progreso: { where: { usuarioId }, select: { nivelActual: true, ejerciciosCompletados: true } },
              subtemas: {
                where: { publicado: true },
                orderBy: [{ orden: 'asc' }, { numero: 'asc' }],
                include: {
                  ejercicios: { where: { activo: true }, select: { id: true } },
                  progreso: { where: { usuarioId }, select: { nivelActual: true, ejerciciosCompletados: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    if (!unidad) throw new NotFoundException('Unidad no encontrada');
    const nivelInicial: NivelDificultad = usuario?.nivelInicialAdaptativo ?? 'basico';

    const nodos: NodoMapa[] = [];
    const aristas: { de: number; a: number; tipo: 'se_compone_de' }[] = [];
    let total = 0;
    let comp = 0;
    const agregar = (t: { id: number; numero: string; titulo: string; ejercicios: { id: number }[]; progreso: { nivelActual: NivelDificultad; ejerciciosCompletados: number }[] }, tipo: 'tema' | 'subtema') => {
      const nivel = t.progreso[0]?.nivelActual ?? nivelInicial;
      const tot = t.ejercicios.length;
      total += tot;
      comp += Math.min(t.progreso[0]?.ejerciciosCompletados ?? 0, tot || (t.progreso[0]?.ejerciciosCompletados ?? 0));
      nodos.push({ id: t.id, tipo, numero: t.numero, titulo: t.titulo, nivel, nivel_label: ETIQUETA_NIVEL[nivel] });
    };
    for (const t of unidad.temas) {
      agregar(t, 'tema');
      for (const s of t.subtemas) {
        agregar(s, 'subtema');
        aristas.push({ de: t.id, a: s.id, tipo: 'se_compone_de' });
      }
    }

    const ejemplos: EjemploDash[] = Array.isArray(unidad.dashEjemplos) ? (unidad.dashEjemplos as unknown as EjemploDash[]) : [];
    return {
      unidad: { id: unidad.id, numero: unidad.numero, titulo: unidad.titulo },
      objetivos_md: unidad.dashObjetivos,
      analogias_md: unidad.dashAnalogias,
      ejemplos,
      minutos: unidad.dashMinutos ?? unidad.temas.length * 15,
      progreso_pct: total ? Math.round((comp / total) * 100) : 0,
      mapa: { nodos, aristas },
    };
  }
}
