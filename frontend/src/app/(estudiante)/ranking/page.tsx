'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui';
import { EmblemasGaleria } from '@/components/emblemas-galeria';
import { RangoIcon } from '@/components/rango-icon';
import { CountUp } from '@/components/count-up';
import { Trophy, TrendingUp, TrendingDown, Minus, Flame, Users } from '@/components/icons';

type Ambito = 'global' | 'paralelo';
type Periodo = 'temporada' | 'historico';

interface RangoRef { clave: string; nombre: string; svgKey: string; color: string }
interface Fila {
  posicion: number; usuario_id: number; nombre: string; xp: number;
  racha_dias: number; rango: RangoRef; movimiento: number | null; es_yo: boolean;
}
interface Respuesta {
  ambito: Ambito; periodo: Periodo; paralelo_disponible: boolean;
  temporada: { inicio: string; fin: string } | null;
  total_participantes: number; ranking: Fila[]; yo: Fila | null;
  /** Quién va justo arriba y cuánto falta. Lo resuelve el BACKEND, que conoce el
   *  orden completo: buscarlo en el top-20 dejaría sin rival a quien va 43.º. */
  rival: Fila | null; xp_para_subir: number | null;
}

/** Refresco del "en vivo": suficiente para sentirse vivo sin castigar al backend. */
const REFRESCO_MS = 45_000;

/**
 * RANKING — por TEMPORADA (semanal), por ámbito y con el rango cruzado.
 *
 * Por qué la temporada es la pestaña por defecto: el acumulado de por vida deja a
 * la mayoría sin nadie a quien alcanzar (en los datos reales el 1.º tenía más XP
 * que todos los demás juntos). La semana reabre la competencia para todos.
 *
 * Todo lo que se pinta viene calculado del backend: posiciones, XP del periodo,
 * movimiento y rango. Aquí no se ordena ni se suma nada.
 */
export default function RankingPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [ambito, setAmbito] = useState<Ambito>('global');
  const [periodo, setPeriodo] = useState<Periodo>('temporada');
  const [cargando, setCargando] = useState(true);
  // Solo la primera carga muestra esqueletos; los refrescos no deben parpadear.
  const primeraCarga = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<Respuesta>(`/ranking?ambito=${ambito}&periodo=${periodo}&limite=20`);
      setDatos(r);
    } catch { /* se conserva lo último bueno */ }
    finally { primeraCarga.current = false; setCargando(false); }
  }, [ambito, periodo]);

  useEffect(() => {
    setCargando(primeraCarga.current);
    void cargar();
    const t = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(t);
  }, [cargar]);

  const ranking = datos?.ranking ?? [];
  const yo = datos?.yo ?? null;
  const podio = ranking.slice(0, 3);

  // Rival y distancia vienen calculados del backend (ver nota en Respuesta).
  const arriba = datos?.rival ?? null;
  const xpParaSubir = datos?.xp_para_subir ?? null;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Ranking"
        subtitle={periodo === 'temporada'
          ? 'Temporada semanal: el marcador vuelve a cero cada lunes.'
          : 'Acumulado histórico de todo tu recorrido.'}
      />

      {/* Pestañas: periodo y ámbito */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Grupo
          opciones={[{ v: 'temporada', l: 'Esta semana' }, { v: 'historico', l: 'Histórico' }]}
          valor={periodo} onCambio={(v) => setPeriodo(v as Periodo)} etiqueta="Periodo"
        />
        <Grupo
          opciones={[
            { v: 'global', l: 'Global' },
            { v: 'paralelo', l: 'Mi paralelo', deshabilitada: datos ? !datos.paralelo_disponible : false },
          ]}
          valor={ambito} onCambio={(v) => setAmbito(v as Ambito)} etiqueta="Ámbito"
        />
        {datos && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3.5 w-3.5" /> {datos.total_participantes} participantes
          </span>
        )}
      </div>

      {/* Si pidió su paralelo y no tiene, se dice; no se disfraza el global. */}
      {datos && !datos.paralelo_disponible && ambito === 'paralelo' && (
        <p role="status" className="mb-4 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm text-muted">
          Aún no tienes un paralelo asignado, así que se muestra el ranking global.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          {/* Podio */}
          {podio.length === 3 && (
            <div className="mb-6 grid grid-cols-3 items-end gap-3">
              {[podio[1], podio[0], podio[2]].map((r, i) => {
                const alturas = ['h-28', 'h-36', 'h-24'][i];
                const colores = ['from-slate-300 to-slate-400', 'from-amber-300 to-amber-500', 'from-amber-600 to-amber-700'][i];
                return (
                  <div key={r.usuario_id}
                    style={{ animationDelay: `${i * 90}ms` }}
                    className={`flex animate-fade-up flex-col items-center transition-transform duration-200 hover:-translate-y-1 ${r.es_yo ? 'drop-shadow-lg' : ''}`}>
                    <div className="relative mb-2">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue text-xl font-bold text-white shadow-lift">
                        {r.nombre.charAt(0)}
                      </div>
                      {/* Rango cruzado: el mismo sistema que la escalera de /progreso. */}
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 shadow">
                        <RangoIcon svgKey={r.rango.svgKey} color={r.rango.color} className="h-5 w-5" />
                      </span>
                    </div>
                    <p className="text-center text-sm font-semibold text-fg">{r.nombre.split(' ')[0]}</p>
                    <p className="mb-1 text-xs font-medium text-prexi-blue-deep">
                      <CountUp value={r.xp} format={(n) => n.toLocaleString('es-BO')} /> XP
                    </p>
                    <div className={`flex w-full ${alturas} items-start justify-center rounded-t-2xl bg-gradient-to-b ${colores} pt-2 text-2xl font-extrabold text-white`}>
                      #{r.posicion}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card !p-0">
            {cargando && <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>}

            {!cargando && ranking.map((r) => (
              <div key={r.usuario_id}
                className={`flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 transition last:border-0 ${
                  r.es_yo
                    ? 'border-l-4 border-l-prexi-blue bg-prexi-blue/10 ring-1 ring-inset ring-prexi-blue/30'
                    : 'hover:bg-subtle'
                }`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-8 shrink-0 text-center text-lg font-bold text-fg">#{r.posicion}</span>
                  <Movimiento n={r.movimiento} />
                  <div className="relative shrink-0">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-prexi-navy font-bold text-white">{r.nombre.charAt(0)}</div>
                    <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5">
                      <RangoIcon svgKey={r.rango.svgKey} color={r.rango.color} className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">
                      {r.nombre} {r.es_yo && <span className="text-xs text-prexi-blue-deep">(Tú)</span>}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-muted">
                      <span style={{ color: r.rango.color }}>{r.rango.nombre}</span>
                      <span aria-hidden>·</span>
                      <Flame className="h-3.5 w-3.5 text-prexi-amber" /> {r.racha_dias} d
                    </p>
                  </div>
                </div>
                <span className="shrink-0 font-display font-bold text-prexi-blue-deep">
                  <CountUp value={r.xp} format={(n) => n.toLocaleString('es-BO')} /> XP
                </span>
              </div>
            ))}

            {!cargando && ranking.length === 0 && (
              <p className="p-6 text-center text-sm text-muted">
                {periodo === 'temporada'
                  ? 'Nadie ha sumado XP esta semana todavía. Resuelve un ejercicio y serás el primero.'
                  : 'Sin datos de ranking aún.'}
              </p>
            )}
          </div>
        </div>

        {/* Aside: tu posición */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          {yo && (
            <div className="card border-0 bg-gradient-to-br from-prexi-navy to-prexi-navy-soft text-white">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Trophy className="h-6 w-6" /></div>
                <div>
                  <p className="text-sm text-blue-200">Tu posición</p>
                  <p className="font-display text-3xl font-extrabold">
                    #{yo.posicion} <span className="text-base font-semibold text-blue-200/80">de {datos?.total_participantes}</span>
                  </p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-blue-100/80">
                <RangoIcon svgKey={yo.rango.svgKey} color={yo.rango.color} className="h-5 w-5" />
                <span>{yo.rango.nombre}</span>
                <span aria-hidden>·</span>
                <span><CountUp value={yo.xp} format={(n) => n.toLocaleString('es-BO')} /> XP {periodo === 'temporada' ? 'esta semana' : 'acumulados'}</span>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-3 text-sm">
                {xpParaSubir != null && arriba
                  ? <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-green-300" /> Te faltan <b>{xpParaSubir} XP</b> para el puesto #{arriba.posicion}</span>
                  : <span className="flex items-center gap-1.5"><Trophy className="h-4 w-4 text-amber-300" /> Estás en lo más alto.</span>}
              </div>

              {periodo === 'temporada' && datos?.temporada && (
                <p className="mt-3 text-xs text-blue-200/70">
                  La temporada cierra el {new Date(datos.temporada.fin).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}.
                </p>
              )}
            </div>
          )}

          <div className="mt-6"><EmblemasGaleria /></div>
        </div>
      </div>
    </div>
  );
}

/** Grupo de pestañas accesible (radiogroup). */
function Grupo({ opciones, valor, onCambio, etiqueta }: {
  opciones: { v: string; l: string; deshabilitada?: boolean }[];
  valor: string; onCambio: (v: string) => void; etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-xl border border-line bg-subtle p-1">
      {opciones.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v}
          disabled={o.deshabilitada}
          onClick={() => onCambio(o.v)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            valor === o.v ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg'
          }`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/**
 * Puestos ganados o perdidos desde el corte anterior. `null` = sin referencia
 * previa (no se inventa un "0" que parecería estancamiento).
 */
function Movimiento({ n }: { n: number | null }) {
  if (n == null) return <span className="w-8 shrink-0" aria-hidden />;
  if (n === 0) {
    return (
      <span className="flex w-8 shrink-0 items-center justify-center text-muted" title="Sin cambios">
        <Minus className="h-3.5 w-3.5" /><span className="sr-only">Sin cambios</span>
      </span>
    );
  }
  const sube = n > 0;
  return (
    <span
      className={`flex w-8 shrink-0 items-center justify-center gap-0.5 text-xs font-bold ${sube ? 'text-prexi-green' : 'text-prexi-red'}`}
      title={sube ? `Subió ${n} puesto(s)` : `Bajó ${Math.abs(n)} puesto(s)`}>
      {sube ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {Math.abs(n)}
      <span className="sr-only">{sube ? `subió ${n}` : `bajó ${Math.abs(n)}`} puestos</span>
    </span>
  );
}
