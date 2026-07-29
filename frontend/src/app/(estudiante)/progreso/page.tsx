'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { api } from '@/lib/api';
import { NivelDificultad, NIVEL_COLOR, Habitos, Tendencia } from '@/lib/types';
import { Card, Skeleton, Select } from '@/components/ui';
import { RangoIcon } from '@/components/rango-icon';
import { Sparkline } from '@/components/sparkline';
import { TrendingUp, TrendingDown, Minus, Sparkles, Flame, Bot, Clock, Target } from '@/components/icons';

/**
 * VISTA DE PROGRESO — 5 indicadores que responden "¿cómo voy y qué hago para mejorar?".
 *
 * Se separa RESULTADO de PROCESO:
 *  Bloque A (cómo voy):    ① pretest→postest  ② dominio por unidad/tema
 *  Bloque B (cómo estudio): ③ constancia  ④ autonomía  ⑤ eficiencia
 *
 * Los desgloses por tema son HTML (barras horizontales con truncado + tooltip),
 * no ejes de categoría de un gráfico: así los nombres nunca pueden acabar en
 * vertical por más que se estreche el contenedor.
 */

interface Cat { categoria: string; pretest: number | null; postest: number | null; mejora: number | null; promedio_grupal: number | null }
interface Sesion { titulo: string; categoria: string; correcto: boolean; xp: number; tiempo_seg: number; fecha: string }
interface Datos { comparativa: Cat[]; pretest_total: number | null; postest_total: number | null; ganancia: number | null; sesiones: Sesion[] }

interface RangoInfo { clave: string; nombre: string; orden: number; svgKey: string; color: string }
interface RangoResumen {
  global: { puntaje: number; rango: RangoInfo; siguiente: { nombre: string; umbral: number; faltan: number } | null };
  unidades: { unidadId: number; numero: number; titulo: string; puntaje: number; rango: RangoInfo }[];
}
interface TemaDet { temaId: number; numero: string; titulo: string; total_ejercicios: number; dominio: number; promedio_grupal: number; nivel_alcanzado: NivelDificultad; nivel_alcanzado_label: string }
interface UnidadDet { unidadId: number; numero: number; titulo: string; temas: TemaDet[]; nivel_dominio: NivelDificultad; nivel_dominio_label: string; dominio_pct: number }

const AZUL = '#3B82F6';
const VERDE = '#10B981';

/* Insignia de nivel THEME-AWARE con contraste AA: tinte translúcido del color +
   TEXTO en un tono OSCURO del mismo color en claro (700) y CLARO en oscuro (300)
   — nunca el color puro (p. ej. ámbar #F59E0B sobre blanco no llega a AA). El punto
   de la insignia sí usa el color exacto del nivel, para casar con la barra. */
const NIVEL_BADGE: Record<NivelDificultad, string> = {
  basico: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  intermedio: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  avanzado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export default function ProgresoPage() {
  const [d, setD] = useState<Datos | null>(null);
  const [rangos, setRangos] = useState<RangoResumen | null>(null);
  const [detalle, setDetalle] = useState<UnidadDet[]>([]);
  const [habitos, setHabitos] = useState<Habitos | null>(null);
  const [unidadSel, setUnidadSel] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Datos>('/progreso').then(setD).catch(() => undefined),
      api.get<RangoResumen>('/gamificacion/rangos').then(setRangos).catch(() => undefined),
      api.get<Habitos>('/progreso/habitos').then(setHabitos).catch(() => undefined),
      api.get<{ unidades: UnidadDet[] }>('/progreso/detalle').then((r) => {
        setDetalle(r.unidades);
        if (r.unidades.length) setUnidadSel(r.unidades[0].unidadId);
      }).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  if (cargando) return <div className="space-y-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (!d) return null;

  const unidadActual = detalle.find((u) => u.unidadId === unidadSel) ?? null;

  return (
    <div className="animate-fade-up">
      {/* ══ BLOQUE A — CÓMO VOY (resultado) ══ */}
      <BannerAprendizaje d={d} rangos={rangos} />

      <div className="mt-6" data-tour="progreso-dominio">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-fg">② Dominio por unidad</h2>
            <p className="mt-0.5 text-sm text-muted">Tu nivel actual y qué tema conviene reforzar.</p>
          </div>
          {detalle.length > 0 && (
            <Select
              aria-label="Elegir unidad"
              value={unidadSel ?? ''}
              onChange={(e) => setUnidadSel(Number(e.target.value))}
              className="w-full min-w-0 sm:!w-auto sm:max-w-xs"
            >
              {detalle.map((u) => <option key={u.unidadId} value={u.unidadId}>Unidad {u.numero}: {u.titulo}</option>)}
            </Select>
          )}
        </div>
        {unidadActual
          ? <DominioUnidad unidad={unidadActual} rangos={rangos} />
          : <Card><p className="py-10 text-center text-sm text-muted">Aún no hay unidades con ejercicios publicados.</p></Card>}
      </div>

      {/* ══ BLOQUE B — CÓMO ESTUDIO (proceso) ══ */}
      <div data-tour="progreso-habitos">
        <div className="mb-4 mt-10">
          <h2 className="font-display text-xl font-bold text-fg">Cómo estudias</h2>
          <p className="mt-0.5 text-sm text-muted">Tus hábitos. No son una nota: describen cómo trabajas y en qué estás mejorando.</p>
        </div>

        {habitos ? (
          <div className="grid gap-6 lg:grid-cols-3">
            <Constancia h={habitos} />
            <Autonomia h={habitos} />
            <Eficiencia h={habitos} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}</div>
        )}
      </div>

      {/* Sesiones recientes */}
      <h2 className="mb-4 mt-10 font-display text-xl font-bold text-fg">Sesiones recientes</h2>
      <div className="card overflow-hidden !p-0">
        {d.sesiones.length === 0 && <p className="p-6 text-center text-sm text-muted">Aún no tienes actividad registrada. Resuelve tu primer ejercicio para verla aquí.</p>}
        {d.sesiones.map((s, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 transition last:border-0 hover:bg-subtle">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.correcto ? 'bg-prexi-green' : 'bg-prexi-red'}`} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg" title={s.titulo}>{s.titulo}</p>
                <p className="truncate text-xs text-muted">{s.categoria} · {new Date(s.fecha).toLocaleDateString('es-BO')}</p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-prexi-blue-deep">+{s.xp} XP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════ ① PROGRESO DE APRENDIZAJE (pretest → postest) ══════════ */

function BannerAprendizaje({ d, rangos }: { d: Datos; rangos: RangoResumen | null }) {
  const hayPost = d.postest_total != null;
  const mejoras = d.comparativa.filter((c) => (c.mejora ?? 0) > 0);

  return (
    <section className="card border-0 bg-gradient-to-r from-prexi-navy-deep to-prexi-navy text-white" data-tour="progreso-banner">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide">① Progreso de aprendizaje</span>
          <h1 className="mt-2 font-display text-2xl font-extrabold">Tu crecimiento en el curso</h1>
          <p className="text-sm text-blue-100/80">Comparación entre tu evaluación inicial y la final.</p>
        </div>

        {/* Pretest → Postest → Δ */}
        <div className="flex flex-wrap items-center gap-5">
          <Marcador etiqueta="Pretest" valor={d.pretest_total ?? '—'} />
          <span aria-hidden className="text-2xl text-blue-200/50">→</span>
          <Marcador etiqueta="Postest" valor={hayPost ? d.postest_total! : '—'} />
          {hayPost ? (
            <div className="rounded-2xl bg-prexi-green px-5 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <TrendingUp className="h-5 w-5" />
                <p className="font-display text-2xl font-extrabold">{d.ganancia != null && d.ganancia >= 0 ? '+' : ''}{d.ganancia}</p>
              </div>
              <p className="text-[11px] text-green-50">puntos de mejora</p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 px-5 py-3 text-center text-xs text-blue-100/80">
              Postest disponible<br />al avanzar el curso
            </div>
          )}
        </div>
      </div>

      {/* Qué significa */}
      <p className="mt-4 border-t border-white/10 pt-3 text-sm text-blue-100/85">
        {hayPost && d.ganancia != null
          ? d.ganancia > 0
            ? <>Subiste <b className="text-white">{d.ganancia} puntos</b> desde tu diagnóstico inicial{mejoras.length > 0 && <> — creciste sobre todo en <b className="text-white">{mejoras.map((m) => m.categoria).join(', ')}</b></>}.</>
            : <>Tu puntaje final quedó parejo al inicial. Revisa abajo qué temas conviene reforzar.</>
          : <>Aquí verás cuánto creciste cuando rindas la evaluación final. Mientras tanto, tu avance real se refleja en el dominio por unidad.</>}
      </p>

      {/* Rango (identidad de gamificación, compacto) */}
      {rangos && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3">
          <RangoIcon svgKey={rangos.global.rango.svgKey} color={rangos.global.rango.color} className="h-8 w-8 shrink-0" />
          <p className="text-sm">
            <span className="text-blue-200/70">Tu rango:</span> <b>{rangos.global.rango.nombre}</b>
          </p>
          {rangos.global.siguiente ? (
            // w-full en móvil: la barra + su etiqueta piden ~220px juntas y, al
            // competir en la misma línea con el rango, desbordaban la pantalla.
            <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:flex-1">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-prexi-amber transition-all" style={{ width: `${Math.min(100, Math.round((rangos.global.puntaje / rangos.global.siguiente.umbral) * 100))}%` }} />
              </div>
              <span className="min-w-0 text-[11px] text-blue-100/70">{rangos.global.puntaje}/{rangos.global.siguiente.umbral} pts → {rangos.global.siguiente.nombre}</span>
            </div>
          ) : <span className="text-[11px] text-amber-200/90">¡Rango máximo alcanzado!</span>}
        </div>
      )}
    </section>
  );
}

function Marcador({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-200/70">{etiqueta}</p>
      <p className="font-display text-3xl font-extrabold">{valor}</p>
    </div>
  );
}

/* ══════════ ② DOMINIO POR UNIDAD ══════════ */

function DominioUnidad({ unidad, rangos }: { unidad: UnidadDet; rangos: RangoResumen | null }) {
  const reduce = useReducedMotion();
  if (unidad.temas.length === 0) {
    return <Card><p className="py-10 text-center text-sm text-muted">Esta unidad aún no tiene temas con ejercicios publicados.</p></Card>;
  }
  // Orden por número de tema (natural: 1.2 antes que 1.10).
  const temas = [...unidad.temas].sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true }));
  const fuerte = [...temas].sort((a, b) => b.dominio - a.dominio)[0];
  const debil = [...temas].sort((a, b) => a.dominio - b.dominio)[0];
  const ru = rangos?.unidades.find((x) => x.unidadId === unidad.unidadId);
  const colorUnidadNivel = NIVEL_COLOR[unidad.nivel_dominio];
  const dominioUnidad = Math.round(unidad.dominio_pct);

  return (
    <Card>
      {/* ── Encabezado: nivel global + rango + dominio de la unidad ── */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-4 border-b border-line pb-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tu nivel en esta unidad</p>
          {/* Tamaño equilibrado (2xl, no 3xl): destaca sin aplastar al rango ni a la barra. */}
          <p className="mt-1 flex items-center gap-2 font-display text-2xl font-extrabold leading-none" style={{ color: colorUnidadNivel }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorUnidadNivel }} />
            {unidad.nivel_dominio_label}
          </p>
          <p className="mt-1 text-[11px] text-muted">Combina tu nivel en cada tema · no cuántos ejercicios hiciste</p>
        </div>

        {ru && (
          <div className="flex items-center gap-2.5 rounded-xl border border-line bg-subtle px-3 py-2">
            <RangoIcon svgKey={ru.rango.svgKey} color={ru.rango.color} className="h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Rango</p>
              <p className="truncate text-sm font-bold text-fg">{ru.rango.nombre}</p>
            </div>
          </div>
        )}

        <div className="w-full sm:w-64">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-medium text-muted">Dominio de la unidad</span>
            <span className="font-display text-sm font-extrabold text-fg" style={{ fontVariantNumeric: 'tabular-nums' }}>{dominioUnidad}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${colorUnidadNivel}22` }}
            role="progressbar" aria-valuenow={dominioUnidad} aria-valuemin={0} aria-valuemax={100} aria-label={`Dominio de la unidad: ${dominioUnidad}%`}>
            <motion.div className="h-full rounded-full" style={{ backgroundColor: colorUnidadNivel }}
              initial={{ width: reduce ? `${dominioUnidad}%` : 0 }} animate={{ width: `${dominioUnidad}%` }} transition={{ duration: 0.9, ease: 'easeOut' }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">Alcanza <b className="text-fg">Intermedio</b> para desbloquear la siguiente unidad.</p>
        </div>
      </div>

      {/* ── Desglose por tema: barra CON EL COLOR DE SU NIVEL (rompe la monotonía y
             casa con la insignia) + marca visible del promedio del grupo ── */}
      <div className="mt-5 divide-y divide-line/60">
        {temas.map((t) => (
          <FilaTema key={t.temaId} t={t} reduce={!!reduce} />
        ))}
      </div>

      {/* Leyenda con las marcas reales */}
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full" style={{ background: `linear-gradient(90deg, ${NIVEL_COLOR.basico}, ${NIVEL_COLOR.intermedio}, ${NIVEL_COLOR.avanzado})` }} />
          Tu dominio <span className="text-faint">(el color indica tu nivel)</span>
        </span>
        <span className="inline-flex items-center gap-1.5"><MarcaGrupo /> Promedio del grupo</span>
      </p>

      {/* Cierre destacado: lo accionable */}
      {fuerte && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-prexi-blue/20 bg-prexi-blue/10 p-3.5 text-sm text-fg">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-prexi-blue-deep" />
          <span>
            Tu punto más fuerte es <b>{fuerte.titulo}</b> ({Math.round(fuerte.dominio)}%).
            {debil && fuerte.temaId !== debil.temaId && <> Refuerza <b>{debil.titulo}</b> ({Math.round(debil.dominio)}%) para subir de nivel en la unidad.</>}
          </span>
        </div>
      )}
    </Card>
  );
}

/** Una fila de tema: chip nº + nombre + insignia de nivel · barra del color del
 *  nivel (animada) con marca del promedio del grupo · porcentaje con etiqueta. */
function FilaTema({ t, reduce }: { t: TemaDet; reduce: boolean }) {
  const color = NIVEL_COLOR[t.nivel_alcanzado];
  const dominio = Math.round(t.dominio);
  const prom = Math.round(t.promedio_grupal);

  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-bold text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{t.numero}</span>
          <span className="truncate text-sm font-semibold text-fg" title={t.titulo}>{t.titulo}</span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${NIVEL_BADGE[t.nivel_alcanzado]}`}
            title={`Tu nivel de dificultad en este tema: ${t.nivel_alcanzado_label}`}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} /> {t.nivel_alcanzado_label}
          </span>
        </span>
        {/* Porcentaje grande + etiqueta que aclara QUÉ es. */}
        <span className="shrink-0 text-right leading-none">
          <span className="block font-display text-base font-extrabold text-fg" style={{ fontVariantNumeric: 'tabular-nums' }}>{dominio}%</span>
          <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted">dominio</span>
        </span>
      </div>

      {/* Barra delgada (6px) redondeada, track muy tenue del color; llenado 0→valor. */}
      <div className="relative">
        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: `${color}1f` }}
          role="progressbar" aria-valuenow={dominio} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${t.numero} ${t.titulo}: dominio ${dominio}% (nivel ${t.nivel_alcanzado_label})`}>
          <motion.div className="h-full rounded-full" style={{ backgroundColor: color }}
            initial={{ width: reduce ? `${dominio}%` : 0 }} animate={{ width: `${dominio}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
        </div>
        {/* Marca del promedio del grupo: tick de alto contraste (fg) con halo del
            fondo para separarse de la barra, y tooltip al pasar el cursor. */}
        <span
          className="absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-help flex-col items-center"
          style={{ left: `${Math.min(100, Math.max(0, prom))}%` }}
          title={`Promedio del grupo: ${prom}%`}
        >
          <span className="h-3 w-[3px] rounded-full ring-1 ring-[rgb(var(--card))]" style={{ backgroundColor: 'rgb(var(--fg))' }} />
        </span>
      </div>
    </div>
  );
}

/** Marca del promedio del grupo para la leyenda (misma forma que en las barras). */
function MarcaGrupo() {
  return <span className="inline-block h-3 w-[3px] rounded-full ring-1 ring-[rgb(var(--card))]" style={{ backgroundColor: 'rgb(var(--fg))' }} />;
}

/* ══════════ ③ CONSTANCIA ══════════ */

function Constancia({ h }: { h: Habitos }) {
  const { racha_dias, dias, dias_activos_semana } = h.constancia;
  const max = Math.max(1, ...dias.map((x) => x.resueltos));
  const diaCorto = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'short' }).replace('.', '');

  const mensaje = racha_dias >= 3
    ? `Llevas ${racha_dias} días seguidos. La constancia es lo que más mueve tu aprendizaje.`
    : racha_dias > 0
      ? 'Ya empezaste tu racha. Practicar un poco cada día rinde más que una maratón.'
      : dias_activos_semana > 0
        ? 'Practicaste esta semana, pero sin días seguidos. Un ejercicio diario basta para encender tu racha.'
        : 'Resuelve un ejercicio hoy para empezar tu racha.';

  return (
    <IndicadorCard
      n="③" titulo="Constancia" icono={<Flame className="h-5 w-5" />}
      dato={<>{racha_dias} <span className="text-lg font-bold text-muted">{racha_dias === 1 ? 'día' : 'días'}</span></>}
      pie="de racha"
    >
      {/* Barras verticales limpias: etiquetas de día cortas, siempre horizontales */}
      <div className="mt-4 flex h-24 items-end justify-between gap-1.5" role="img" aria-label={`Ejercicios resueltos por día: ${dias.map((x) => `${diaCorto(x.dia)} ${x.resueltos}`).join(', ')}`}>
        {dias.map((x) => (
          <div key={x.dia} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-semibold text-muted">{x.resueltos || ''}</span>
            <div
              className={`w-full rounded-t-md transition-all ${x.resueltos ? 'bg-prexi-blue' : 'bg-subtle'}`}
              style={{ height: `${x.resueltos ? Math.max(8, (x.resueltos / max) * 100) : 4}%` }}
              title={`${diaCorto(x.dia)}: ${x.resueltos} resueltos`}
            />
            <span className="w-full truncate text-center text-[10px] text-muted">{diaCorto(x.dia)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">{mensaje}</p>
    </IndicadorCard>
  );
}

/* ══════════ ④ AUTONOMÍA ══════════ */

function Autonomia({ h }: { h: Habitos }) {
  const { sin_pistas_pct, total_consultas, total_pistas, serie, tendencia } = h.autonomia;
  // La serie se invierte visualmente: MENOS pistas debe leerse como línea que
  // sube (progreso). Sin esto, "mejorar" se dibujaría hacia abajo.
  const valores = serie.map((s) => s.sin_pistas_pct);

  const mensaje = tendencia === 'baja'
    ? 'Cada vez resuelves más por tu cuenta: necesitas menos pistas que al empezar.'
    : tendencia === 'estable'
      ? 'Mantienes un apoyo estable en ALVARO. Pedir ayuda cuando la necesitas es parte de aprender.'
      : tendencia === 'sube'
        ? 'Últimamente te apoyas más en las pistas — normal si los temas se pusieron más difíciles. Úsalas para entender, no para avanzar.'
        : 'Cuando resuelvas más ejercicios verás aquí si ganas independencia.';

  return (
    <IndicadorCard
      n="④" titulo="Autonomía" icono={<Bot className="h-5 w-5" />}
      dato={<>{sin_pistas_pct}<span className="text-lg font-bold text-muted">%</span></>}
      pie="resuelto sin pistas"
      insignia={<ChipTendencia t={tendencia} bueno="baja" etiquetaBuena="Ganando independencia" etiquetaMala="Más apoyo" />}
    >
      {valores.length >= 2 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold text-muted">Ejercicios sin pistas, conforme avanzas</p>
          <div className="flex items-end gap-2">
            <Sparkline values={valores} color={VERDE} className="!w-full" />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] text-muted"><span>Primeros</span><span>Últimos</span></div>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">{mensaje}</p>
      <p className="mt-2 text-[11px] text-muted">
        {total_pistas} {total_pistas === 1 ? 'pista' : 'pistas'} · {total_consultas} {total_consultas === 1 ? 'consulta' : 'consultas'} a ALVARO
      </p>
    </IndicadorCard>
  );
}

/* ══════════ ⑤ EFICIENCIA ══════════ */

function Eficiencia({ h }: { h: Habitos }) {
  const { tasa_acierto, tiempo_medio_seg, serie, tendencia_tasa, total_intentos } = h.eficiencia;
  const valores = serie.map((s) => s.tasa_acierto);

  const mensaje = tendencia_tasa === 'sube'
    ? 'Aciertas más que al empezar: señal de que los conceptos te están calando.'
    : tendencia_tasa === 'estable'
      ? 'Tu tasa de acierto se mantiene estable conforme suben de dificultad los ejercicios.'
      : tendencia_tasa === 'baja'
        ? 'Tu tasa bajó un poco, algo esperable al subir de nivel. Revisa el tema más flojo de arriba.'
        : 'Con más ejercicios resueltos verás aquí cómo evoluciona tu acierto.';

  return (
    <IndicadorCard
      n="⑤" titulo="Eficiencia" icono={<Target className="h-5 w-5" />}
      dato={<>{tasa_acierto}<span className="text-lg font-bold text-muted">%</span></>}
      pie={`de acierto · ${total_intentos} ${total_intentos === 1 ? 'intento' : 'intentos'}`}
      insignia={<ChipTendencia t={tendencia_tasa} bueno="sube" etiquetaBuena="Aciertas más" etiquetaMala="Más difícil" />}
    >
      {valores.length >= 2 && (
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold text-muted">Tasa de acierto, conforme avanzas</p>
          <Sparkline values={valores} color={AZUL} className="!w-full" />
          <div className="mt-0.5 flex justify-between text-[10px] text-muted"><span>Primeros</span><span>Últimos</span></div>
        </div>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">{mensaje}</p>

      {/* El TIEMPO es información, NUNCA una meta: sin flechas de "mejora", sin
          comparaciones y con un encuadre que no premie apurarse. */}
      {tiempo_medio_seg != null && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-subtle p-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <p className="text-[11px] leading-relaxed text-muted">
            Dedicas <b className="text-fg">{formatoTiempo(tiempo_medio_seg)}</b> a cada ejercicio, en promedio.
            No es una marca que batir: conforme dominas un tema lo resuelves con más soltura. Tomarte tu tiempo para pensar es parte de aprender.
          </p>
        </div>
      )}
    </IndicadorCard>
  );
}

/* ══════════ Piezas compartidas ══════════ */

/** Tarjeta de indicador: título, dato principal grande y explicación. */
function IndicadorCard({ n, titulo, icono, dato, pie, insignia, children }: {
  n: string; titulo: string; icono: React.ReactNode; dato: React.ReactNode; pie: string;
  insignia?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      {/* El título manda: `flex-1` le reserva el ancho y `min-w-[9rem]` obliga a
          la insignia a bajar de línea cuando no cabe. Sin esto, la insignia
          (shrink-0) se quedaba con el ancho y el título quedaba recortado a unos
          píxeles, ilegible.
          Estos títulos son cortos y fijos, así que NO se truncan: si el ancho
          aprieta, fluyen a dos líneas. Truncar aquí escondería texto sin ganar nada
          (el truncado + tooltip se reserva para los nombres de tema, que sí son largos). */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-[9rem] flex-1 items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep">{icono}</div>
          <h3 className="min-w-0 flex-1 font-display text-base font-bold leading-tight text-fg">
            <span className="text-muted">{n}</span> {titulo}
          </h3>
        </div>
        {insignia}
      </div>
      <p className="font-display text-4xl font-extrabold leading-none text-fg" style={{ fontVariantNumeric: 'tabular-nums' }}>{dato}</p>
      <p className="mt-1 text-xs text-muted">{pie}</p>
      {children}
    </Card>
  );
}

/**
 * Chip de tendencia. `bueno` dice qué dirección es la deseable para ESTE
 * indicador: en autonomía lo bueno es que BAJE (menos pistas); en acierto, que
 * SUBA. Así el color/ícono no dependen del signo del número sino del significado.
 */
function ChipTendencia({ t, bueno, etiquetaBuena, etiquetaMala }: {
  t: Tendencia; bueno: 'baja' | 'sube'; etiquetaBuena: string; etiquetaMala: string;
}) {
  if (t === 'sin_datos') return null;
  if (t === 'estable') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-bold text-muted">
        <Minus className="h-3 w-3" /> Estable
      </span>
    );
  }
  const positivo = t === bueno;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
      positivo ? 'bg-emerald-500/15 text-prexi-green' : 'bg-amber-500/15 text-prexi-amber'}`}>
      {t === 'baja' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {positivo ? etiquetaBuena : etiquetaMala}
    </span>
  );
}

/** Segundos → "2 min 30 s" / "45 s". */
function formatoTiempo(seg: number): string {
  if (seg < 60) return `${seg} s`;
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
