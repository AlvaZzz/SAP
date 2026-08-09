/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  MEDICIÓN DEL USO REAL DE LA PLATAFORMA — la DOSIS de la intervención
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  POR QUÉ EXISTE ESTE MÓDULO
 *  Sin medir cuánto usó realmente cada estudiante el sistema, la hipótesis es
 *  indefendible ante la pregunta más obvia de un tribunal: "¿y si el grupo
 *  experimental simplemente no usó la plataforma?". La dosis es además lo que
 *  permite mostrar una relación DOSIS-RESPUESTA (más uso → más aprendizaje),
 *  que es la evidencia causal más fuerte disponible sin aleatorización estricta.
 *
 *  QUÉ SE MIDE Y QUÉ NO
 *  Todo se deriva de eventos REALMENTE registrados (intentos, consultas al
 *  tutor, entregas de retos, código guardado). No hay telemetría de "tiempo en
 *  pantalla": el sistema no sabe si el navegador estaba abierto y el estudiante
 *  no estaba. Por eso el tiempo se reporta siempre como ESTIMACIÓN y se explica
 *  cómo se calcula, en vez de presentarse como una medida directa.
 *
 *  Funciones puras, sin Prisma: verificadas en `uso.spec.ts`.
 * ═══════════════════════════════════════════════════════════════════════════
 */

const MS_MINUTO = 60_000;
const MS_DIA = 86_400_000;

/**
 * UMBRAL DE SESIÓN — decisión metodológica, no un detalle de implementación.
 *
 * Dos eventos separados por menos de 30 minutos se consideran parte de la misma
 * sesión de trabajo. Es la convención habitual en analítica de aprendizaje
 * (heredada de la analítica web, donde 30 min es el corte estándar): por debajo
 * se fragmentan sesiones reales en las que el estudiante se detuvo a pensar o a
 * leer; por encima se fusionan sesiones distintas del mismo día.
 *
 * Se declara aquí, se documenta en el diccionario de variables y se reporta en
 * la ficha metodológica, porque cambiar este número cambia el número de sesiones
 * reportado y eso debe ser auditable.
 */
export const UMBRAL_SESION_MIN = 30;

/**
 * Tope por evento para la estimación de tiempo. Si entre dos eventos de la misma
 * sesión pasan 25 minutos, contarlos todos como "tiempo de trabajo" inflaría la
 * cifra: pudo haberse levantado. Se acota la contribución de cada hueco.
 */
export const TOPE_HUECO_MIN = 15;

export interface Uso {
  /** Fechas ÚNICAS con actividad. Es la medida de dosis más honesta y simple. */
  dias_activos: number;
  primer_dia: Date | null;
  ultimo_dia: Date | null;
  /** Días transcurridos entre el primer y el último evento (inclusive). */
  periodo_dias: number;
  /** Bloques de trabajo separados por más de UMBRAL_SESION_MIN. */
  sesiones: number;
  /** Estimación acotada del tiempo en plataforma. NO es una medida directa. */
  minutos_estimados: number;
  /** Minutos estimados ÷ sesiones. */
  minutos_por_sesion: number;
  /**
   * dias_activos ÷ periodo_dias. Distingue a quien usó el sistema de forma
   * sostenida (cerca de 1) de quien concentró todo en una tarde (cerca de 0).
   */
  regularidad: number | null;
  /** Eventos por día, para el calendario de actividad. */
  por_dia: { dia: string; eventos: number }[];
  /** Eventos por semana ISO, para evidenciar constancia vs. atracón final. */
  por_semana: { semana: string; eventos: number }[];
  /** Total de eventos considerados. */
  eventos: number;
}

/** Clave YYYY-MM-DD en hora local (no UTC: importa el día del estudiante). */
function claveDia(f: Date): string {
  const y = f.getFullYear();
  const m = String(f.getMonth() + 1).padStart(2, '0');
  const d = String(f.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Clave de semana ISO (año-Www), para agrupar por semana de forma estable. */
export function claveSemana(f: Date): string {
  const d = new Date(Date.UTC(f.getFullYear(), f.getMonth(), f.getDate()));
  // ISO 8601: la semana pertenece al año del jueves de esa semana.
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d.getTime() - inicioAnio.getTime()) / MS_DIA + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/**
 * Calcula todos los indicadores de uso a partir de las FECHAS de los eventos
 * del estudiante (intentos, consultas al tutor, entregas, código guardado).
 *
 * El resultado con cero eventos es explícito y no se confunde con "no calculado":
 * dias_activos = 0 y regularidad = null, porque sin periodo no hay proporción
 * que calcular (dividir por cero produciría un dato inventado).
 */
export function calcularUso(fechas: Date[]): Uso {
  const vacio: Uso = {
    dias_activos: 0, primer_dia: null, ultimo_dia: null, periodo_dias: 0,
    sesiones: 0, minutos_estimados: 0, minutos_por_sesion: 0,
    regularidad: null, por_dia: [], por_semana: [], eventos: 0,
  };
  if (fechas.length === 0) return vacio;

  const orden = [...fechas].sort((a, b) => a.getTime() - b.getTime());
  const primer = orden[0];
  const ultimo = orden[orden.length - 1];

  // ── Días activos y distribución temporal ──
  const porDia = new Map<string, number>();
  const porSemana = new Map<string, number>();
  for (const f of orden) {
    const kd = claveDia(f);
    porDia.set(kd, (porDia.get(kd) ?? 0) + 1);
    const ks = claveSemana(f);
    porSemana.set(ks, (porSemana.get(ks) ?? 0) + 1);
  }

  // ── Periodo de participación ──
  // Se cuenta en días CALENDARIO e inclusive: quien entró solo un día tiene
  // periodo 1, no 0 (si fuera 0, la regularidad se indefiniría).
  const d0 = new Date(primer.getFullYear(), primer.getMonth(), primer.getDate()).getTime();
  const d1 = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate()).getTime();
  const periodo = Math.round((d1 - d0) / MS_DIA) + 1;

  // ── Sesiones y tiempo estimado ──
  let sesiones = 1;
  let minutos = 0;
  for (let i = 1; i < orden.length; i++) {
    const hueco = (orden[i].getTime() - orden[i - 1].getTime()) / MS_MINUTO;
    if (hueco > UMBRAL_SESION_MIN) {
      sesiones++; // empieza una sesión nueva: el hueco no cuenta como trabajo
    } else {
      // Dentro de la misma sesión, el hueco cuenta como tiempo de trabajo,
      // acotado para no inflar la estimación con pausas largas.
      minutos += Math.min(hueco, TOPE_HUECO_MIN);
    }
  }

  return {
    dias_activos: porDia.size,
    primer_dia: primer,
    ultimo_dia: ultimo,
    periodo_dias: periodo,
    sesiones,
    minutos_estimados: Math.round(minutos),
    minutos_por_sesion: sesiones ? Math.round(minutos / sesiones) : 0,
    // Proporción de días del periodo en los que hubo actividad.
    regularidad: periodo > 0 ? Math.round((porDia.size / periodo) * 1000) / 1000 : null,
    por_dia: [...porDia.entries()].map(([dia, eventos]) => ({ dia, eventos }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    por_semana: [...porSemana.entries()].map(([semana, eventos]) => ({ semana, eventos }))
      .sort((a, b) => a.semana.localeCompare(b.semana)),
    eventos: orden.length,
  };
}

/** Texto que acompaña a la estimación de tiempo, para no presentarla como medida directa. */
export const NOTA_TIEMPO_ESTIMADO =
  `Estimación, no medición directa: el sistema no sabe si el navegador quedó abierto sin nadie ` +
  `delante. Se suman los huecos entre eventos consecutivos de una misma sesión (eventos separados ` +
  `por menos de ${UMBRAL_SESION_MIN} min), acotando cada hueco a ${TOPE_HUECO_MIN} min para que una ` +
  `pausa larga no infle el total.`;
