'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Skeleton } from '@/components/ui';
import { EmblemasGaleria } from '@/components/emblemas-galeria';
import { RangoIcon } from '@/components/rango-icon';
import { CountUp } from '@/components/count-up';
import { Trophy, TrendingUp, TrendingDown, Minus, Flame, Users, Medal, ArrowRight, Target } from '@/components/icons';

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
const MEDALLA = ['#F59E0B', '#94A3B8', '#B45309']; // oro, plata, bronce
const xp = (n: number) => n.toLocaleString('es-BO');
const primerNombre = (n: string) => n.split(' ')[0];

/**
 * RANKING — por TEMPORADA (semanal), por ámbito y con el rango cruzado.
 *
 * Orden de la pantalla: primero TÚ (puesto y cuánto falta para subir), luego el
 * podio y al final la tabla. Todo viene calculado del backend: posiciones, XP
 * del periodo, movimiento y rango. Aquí no se ordena ni se suma nada.
 */
export default function RankingPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [ambito, setAmbito] = useState<Ambito>('global');
  const [periodo, setPeriodo] = useState<Periodo>('temporada');
  const [cargando, setCargando] = useState(true);
  // Solo la primera carga muestra esqueletos; los refrescos no deben parpadear.
  const primeraCarga = useRef(true);
  const miFila = useRef<HTMLLIElement>(null);

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
  const rival = datos?.rival ?? null;
  const falta = datos?.xp_para_subir ?? null;
  const lider = ranking[0]?.xp ?? 0;
  const enLista = !!yo && ranking.some((r) => r.es_yo);
  const semana = periodo === 'temporada';

  return (
    <div className="animate-fade-up">
      <PageHeader title="Ranking" subtitle={semana ? 'Gana XP resolviendo ejercicios y retos. El marcador vuelve a cero cada lunes.' : 'Todo el XP que acumulaste desde que empezaste.'} />

      {/* Qué marcador se mira */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Grupo etiqueta="Periodo" valor={periodo} onCambio={(v) => setPeriodo(v as Periodo)}
          opciones={[{ v: 'temporada', l: 'Esta semana' }, { v: 'historico', l: 'Desde siempre' }]} />
        <Grupo etiqueta="Ámbito" valor={ambito} onCambio={(v) => setAmbito(v as Ambito)}
          opciones={[{ v: 'global', l: 'Todos' }, { v: 'paralelo', l: 'Mi paralelo', deshabilitada: datos ? !datos.paralelo_disponible : false }]} />
        {datos && <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted"><Users className="h-3.5 w-3.5" /> {datos.total_participantes} participantes</span>}
      </div>

      {datos && !datos.paralelo_disponible && ambito === 'paralelo' && (
        <p role="status" className="mb-4 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm text-muted">Aún no tienes un paralelo asignado, así que se muestra el ranking de todos.</p>
      )}

      {/* 1 · Tú */}
      {yo && (
        <section className="card mb-6 border-0 bg-gradient-to-br from-prexi-navy to-prexi-navy-soft text-white">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-extrabold">#{yo.posicion}</div>
              <div>
                <p className="text-sm text-blue-200">Tu puesto {semana ? 'esta semana' : 'de siempre'}</p>
                <p className="font-display text-2xl font-extrabold leading-tight">{yo.posicion}.º <span className="text-base font-semibold text-blue-200/80">de {datos?.total_participantes}</span></p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-blue-100/85">
                  <RangoIcon svgKey={yo.rango.svgKey} color={yo.rango.color} className="h-4 w-4" /> {yo.rango.nombre}
                  <span aria-hidden>·</span> <CountUp value={yo.xp} format={xp} /> XP
                  <span aria-hidden>·</span> <Flame className="h-4 w-4 text-amber-300" /> {yo.racha_dias} {yo.racha_dias === 1 ? 'día' : 'días'} seguidos
                </p>
              </div>
            </div>

            <div className="min-w-[240px] flex-1">
              {rival && falta != null ? (
                <>
                  <p className="flex items-center gap-1.5 text-sm"><Target className="h-4 w-4 text-green-300" /> Te faltan <b>{xp(falta)} XP</b> para pasar a <b>{primerNombre(rival.nombre)}</b> (#{rival.posicion})</p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`Llevas ${yo.xp} de los ${rival.xp} XP de tu rival`}>
                    <div className="h-full rounded-full bg-green-400 transition-all duration-700" style={{ width: `${Math.max(4, Math.min(100, rival.xp > 0 ? (yo.xp / rival.xp) * 100 : 0))}%` }} />
                  </div>
                  <p className="mt-1 flex justify-between text-xs text-blue-200/75"><span>Tú: {xp(yo.xp)}</span><span>{primerNombre(rival.nombre)}: {xp(rival.xp)}</span></p>
                </>
              ) : (
                <p className="flex items-center gap-2 text-sm"><Trophy className="h-5 w-5 text-amber-300" /> Vas en primer lugar. Sigue sumando para que no te alcancen.</p>
              )}
            </div>

            <Link href="/ejercicios" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-prexi-navy transition hover:bg-blue-50">Ganar XP ahora <ArrowRight className="h-4 w-4" /></Link>
          </div>
          {semana && datos?.temporada && (
            <p className="mt-3 border-t border-white/10 pt-2.5 text-xs text-blue-200/75">La semana cierra el {new Date(datos.temporada.fin).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0">
          {/* 2 · Podio */}
          {podio.length === 3 && (
            <div className="mb-6 grid grid-cols-3 items-end gap-3">
              {[podio[1], podio[0], podio[2]].map((r, i) => {
                const lugar = [1, 0, 2][i]; // índice de medalla
                const alto = ['h-24', 'h-32', 'h-20'][i];
                return (
                  <div key={r.usuario_id} style={{ animationDelay: `${i * 90}ms` }}
                    className="flex min-w-0 animate-fade-up flex-col items-center transition-transform duration-200 hover:-translate-y-1">
                    {lugar === 0 && <Trophy className="mb-1 h-6 w-6" style={{ color: MEDALLA[0] }} aria-hidden />}
                    <div className="relative mb-2">
                      <div className={`grid place-items-center rounded-full bg-gradient-to-br from-prexi-navy to-prexi-blue font-bold text-white shadow-lift ${lugar === 0 ? 'h-16 w-16 text-2xl' : 'h-14 w-14 text-xl'}`}
                        style={{ boxShadow: `0 0 0 3px ${MEDALLA[lugar]}` }}>{r.nombre.charAt(0)}</div>
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5 shadow"><RangoIcon svgKey={r.rango.svgKey} color={r.rango.color} className="h-5 w-5" /></span>
                    </div>
                    <p className="w-full truncate text-center text-sm font-bold text-fg" title={r.nombre}>{primerNombre(r.nombre)}{r.es_yo && <span className="text-prexi-blue-deep"> (tú)</span>}</p>
                    <p className="mb-1.5 w-full truncate text-center text-xs font-semibold text-muted"><CountUp value={r.xp} format={xp} /> XP</p>
                    <div className={`flex w-full ${alto} items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-extrabold text-white`}
                      style={{ background: `linear-gradient(180deg, ${MEDALLA[lugar]}, ${MEDALLA[lugar]}B3)` }}>{r.posicion}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3 · Tabla */}
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-fg">Tabla de posiciones</h2>
            {enLista && <button onClick={() => miFila.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="text-sm font-semibold text-prexi-blue-deep hover:underline">Ir a mi puesto</button>}
          </div>
          <ol className="card !p-0">
            {cargando && <li className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</li>}

            {!cargando && ranking.map((r) => {
              const esRival = !!rival && r.usuario_id === rival.usuario_id;
              return (
                <li key={r.usuario_id} ref={r.es_yo ? miFila : undefined}
                  className={`relative overflow-hidden border-b border-line last:border-0 ${r.es_yo ? 'bg-prexi-blue/10 ring-1 ring-inset ring-prexi-blue/40' : 'hover:bg-subtle'}`}>
                  {/* Barra de fondo: su XP frente al del líder */}
                  <span aria-hidden className="absolute inset-y-0 left-0 bg-prexi-blue/[0.07]" style={{ width: `${lider > 0 ? (r.xp / lider) * 100 : 0}%` }} />
                  <div className="relative flex items-center gap-3 px-4 py-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center font-display text-lg font-extrabold text-fg">
                      {r.posicion <= 3 ? <Medal className="h-6 w-6" style={{ color: MEDALLA[r.posicion - 1] }} aria-label={`Puesto ${r.posicion}`} /> : r.posicion}
                    </span>
                    <Movimiento n={r.movimiento} />
                    <div className="relative shrink-0">
                      <div className="grid h-10 w-10 place-items-center rounded-full bg-prexi-navy font-bold text-white">{r.nombre.charAt(0)}</div>
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-card p-0.5"><RangoIcon svgKey={r.rango.svgKey} color={r.rango.color} className="h-4 w-4" /></span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 font-semibold text-fg">
                        <span className="truncate">{r.nombre}</span>
                        {r.es_yo && <span className="rounded-full bg-prexi-blue px-2 py-0.5 text-[10px] font-bold uppercase text-accent-on">Tú</span>}
                        {esRival && <span className="rounded-full bg-prexi-green/15 px-2 py-0.5 text-[10px] font-bold uppercase text-prexi-green">A quien alcanzar</span>}
                      </p>
                      <p className="flex items-center gap-1 truncate text-xs text-muted">
                        <span style={{ color: r.rango.color }}>{r.rango.nombre}</span>
                        {r.racha_dias > 0 && <><span aria-hidden>·</span><Flame className="h-3.5 w-3.5 text-prexi-amber" /> {r.racha_dias} {r.racha_dias === 1 ? 'día' : 'días'}</>}
                      </p>
                    </div>
                    <span className="shrink-0 text-right font-display font-bold text-prexi-blue-deep"><CountUp value={r.xp} format={xp} /> <span className="text-xs font-semibold text-muted">XP</span></span>
                  </div>
                </li>
              );
            })}

            {!cargando && ranking.length === 0 && (
              <li className="p-8 text-center">
                <Trophy className="mx-auto mb-2 h-8 w-8 text-muted" />
                <p className="font-semibold text-fg">{semana ? 'Nadie sumó XP esta semana todavía' : 'Aún no hay datos'}</p>
                {semana && <p className="mt-1 text-sm text-muted">Resuelve un ejercicio y serás el primero de la tabla.</p>}
                <Link href="/ejercicios" className="btn-primary mt-4">Ir a los ejercicios <ArrowRight className="h-4 w-4" /></Link>
              </li>
            )}
          </ol>
          {yo && !enLista && ranking.length > 0 && (
            <p className="mt-2 text-center text-xs text-muted">La tabla muestra los 20 primeros. Tú vas en el puesto {yo.posicion}.</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card mb-6">
            <h2 className="font-display text-lg font-bold text-fg">¿Cómo se gana XP?</h2>
            <ul className="mt-2 space-y-2 text-sm text-muted">
              <li className="flex gap-2"><span className="font-bold text-prexi-blue-deep">+</span> Resolver ejercicios de tus temas.</li>
              <li className="flex gap-2"><span className="font-bold text-prexi-blue-deep">+</span> Completar retos de programación.</li>
              <li className="flex gap-2"><Flame className="mt-0.5 h-4 w-4 shrink-0 text-prexi-amber" /> Entrar varios días seguidos mantiene tu racha.</li>
            </ul>
          </div>
          <EmblemasGaleria />
        </aside>
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
        <button key={o.v} type="button" role="radio" aria-checked={valor === o.v} disabled={o.deshabilitada} onClick={() => onCambio(o.v)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${valor === o.v ? 'bg-card text-fg shadow-sm' : 'text-muted hover:text-fg'}`}>
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
    return <span className="flex w-8 shrink-0 items-center justify-center text-muted" title="Sin cambios"><Minus className="h-3.5 w-3.5" /><span className="sr-only">Sin cambios</span></span>;
  }
  const sube = n > 0;
  return (
    <span className={`flex w-8 shrink-0 items-center justify-center gap-0.5 text-xs font-bold ${sube ? 'text-prexi-green' : 'text-prexi-red'}`}
      title={sube ? `Subió ${n} puesto(s)` : `Bajó ${Math.abs(n)} puesto(s)`}>
      {sube ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
      {Math.abs(n)}
      <span className="sr-only">{sube ? `subió ${n}` : `bajó ${Math.abs(n)}`} puestos</span>
    </span>
  );
}
