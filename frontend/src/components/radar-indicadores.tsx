'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Habitos } from '@/lib/types';
import { Skeleton } from '@/components/ui';
import { TrendingUp, Layers, Flame, Bot, Target } from '@/components/icons';

/**
 * RADAR de los 5 INDICADORES del estudiante (resumen del perfil). Diseño propio:
 * un pentágono con anillos concéntricos, polígono de datos con degradado azul y
 * vértices marcados. Sin librerías ni assets de terceros (SVG a mano).
 *
 * Los 5 ejes normalizan a 0-100 datos REALES —los mismos de la vista de Progreso
 * y de la exportación del investigador—: aprendizaje (pretest→postest), dominio
 * (nivel por unidad), constancia (racha + días activos), autonomía (independencia
 * del tutor) y eficiencia (acierto). Enfoque siempre positivo.
 */

interface DatosProgreso { pretest_total: number | null; postest_total: number | null; ganancia: number | null }
interface UnidadDet { dominio_pct: number; temas: unknown[] }

interface Eje {
  clave: string;
  etiqueta: string;
  corto: string;
  valor: number; // 0-100
  color: string;
  icono: React.ReactNode;
  detalle: string; // valor legible (ej. "80 pts", "5 días")
  frase: string;   // qué significa / cómo mejorar
}

const AZUL = '#3B82F6';
const VERDE = '#10B981';
const AMBAR = '#F59E0B';
const VIOLETA = '#8B5CF6';
const CYAN = '#06B6D4';

export function RadarIndicadores() {
  const [prog, setProg] = useState<DatosProgreso | null>(null);
  const [unidades, setUnidades] = useState<UnidadDet[] | null>(null);
  const [habitos, setHabitos] = useState<Habitos | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<DatosProgreso>('/progreso').then(setProg).catch(() => undefined),
      api.get<{ unidades: UnidadDet[] }>('/progreso/detalle').then((r) => setUnidades(r.unidades)).catch(() => undefined),
      api.get<Habitos>('/progreso/habitos').then(setHabitos).catch(() => undefined),
    ]).finally(() => setCargando(false));
  }, []);

  const ejes = useMemo<Eje[] | null>(() => {
    if (!prog || !unidades || !habitos) return null;

    // ① APRENDIZAJE — nivel de la evaluación (postest si existe, si no pretest).
    const hayPost = prog.postest_total != null;
    const aprendizaje = clamp(prog.postest_total ?? prog.pretest_total ?? 0);
    const aprFrase = hayPost && prog.ganancia != null
      ? prog.ganancia > 0
        ? `Creciste +${prog.ganancia} pts desde tu diagnóstico. ¡Vas en la dirección correcta!`
        : 'Tu postest quedó parejo al inicial. Refuerza los temas más flojos.'
      : 'Aún no rindes el postest. Tu diagnóstico marca tu punto de partida.';
    const aprDetalle = hayPost ? `${prog.postest_total} pts` : prog.pretest_total != null ? `${prog.pretest_total} pts` : '—';

    // ② DOMINIO — promedio del dominio de las unidades con temas publicados.
    const conTemas = unidades.filter((u) => u.temas.length > 0);
    const dominio = conTemas.length ? clamp(Math.round(conTemas.reduce((s, u) => s + u.dominio_pct, 0) / conTemas.length)) : 0;

    // ③ CONSTANCIA — combina días activos de la semana y racha (ambos suman).
    const { racha_dias, dias_activos_semana } = habitos.constancia;
    const constancia = clamp(Math.round((dias_activos_semana / 7) * 60 + (Math.min(racha_dias, 7) / 7) * 40));
    const consFrase = racha_dias >= 3
      ? `Racha de ${racha_dias} días. La constancia es lo que más mueve tu aprendizaje.`
      : dias_activos_semana > 0
        ? 'Practicaste esta semana. Un poco cada día enciende tu racha.'
        : 'Resuelve un ejercicio hoy para empezar tu racha.';

    // ④ AUTONOMÍA — % de ejercicios resueltos sin pistas.
    const autonomia = clamp(habitos.autonomia.sin_pistas_pct);
    const autFrase = habitos.autonomia.tendencia === 'baja'
      ? 'Cada vez resuelves más por tu cuenta. ¡Ganas independencia!'
      : 'Pedir pistas cuando las necesitas también es aprender. Intenta primero por tu cuenta.';

    // ⑤ EFICIENCIA — tasa de acierto (el tiempo es info, no meta).
    const eficiencia = clamp(habitos.eficiencia.tasa_acierto);
    const efiFrase = habitos.eficiencia.tendencia_tasa === 'sube'
      ? 'Aciertas más que al empezar: los conceptos te están calando.'
      : 'Tómate tu tiempo para pensar cada respuesta; la soltura llega con la práctica.';

    return [
      { clave: 'aprendizaje', etiqueta: 'Aprendizaje', corto: 'Aprendizaje', valor: aprendizaje, color: AZUL, icono: <TrendingUp className="h-4 w-4" />, detalle: aprDetalle, frase: aprFrase },
      { clave: 'dominio', etiqueta: 'Dominio', corto: 'Dominio', valor: dominio, color: VERDE, icono: <Layers className="h-4 w-4" />, detalle: `${dominio}%`, frase: 'Tu nivel promedio en los temas del curso. Sube de nivel en cada tema para aumentarlo.' },
      { clave: 'constancia', etiqueta: 'Constancia', corto: 'Constancia', valor: constancia, color: AMBAR, icono: <Flame className="h-4 w-4" />, detalle: `${racha_dias} ${racha_dias === 1 ? 'día' : 'días'}`, frase: consFrase },
      { clave: 'autonomia', etiqueta: 'Autonomía', corto: 'Autonomía', valor: autonomia, color: VIOLETA, icono: <Bot className="h-4 w-4" />, detalle: `${autonomia}%`, frase: autFrase },
      { clave: 'eficiencia', etiqueta: 'Eficiencia', corto: 'Eficiencia', valor: eficiencia, color: CYAN, icono: <Target className="h-4 w-4" />, detalle: `${eficiencia}%`, frase: efiFrase },
    ];
  }, [prog, unidades, habitos]);

  if (cargando) return <div className="card mb-6"><Skeleton className="h-64" /></div>;
  if (!ejes) return null;

  return (
    <section className="card mb-6" aria-label="Resumen de tus 5 indicadores">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold text-fg sm:text-xl">Tu perfil de aprendizaje</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">5 indicadores · datos reales</span>
      </div>
      <p className="mb-4 text-sm text-muted">Cómo vas en resultado (aprendizaje y dominio) y en hábitos (constancia, autonomía y eficiencia), de un vistazo.</p>

      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        {/* Radar (pentágono) */}
        <div className="mx-auto w-full max-w-[340px]">
          <Pentagono ejes={ejes} />
        </div>

        {/* 5 mini-tarjetas */}
        <div className="grid gap-3 sm:grid-cols-2">
          {ejes.map((e) => (
            <div key={e.clave} className="rounded-xl border border-line bg-subtle/40 p-3.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-bold text-fg">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: `${e.color}1f`, color: e.color }}>{e.icono}</span>
                  <span className="truncate">{e.etiqueta}</span>
                </span>
                <span className="shrink-0 font-display text-lg font-extrabold" style={{ color: e.color }}>{e.detalle}</span>
              </div>
              {/* Barra 0-100 del eje */}
              <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                <div className="h-full rounded-full transition-all" style={{ width: `${e.valor}%`, backgroundColor: e.color }} />
              </div>
              <p className="text-[11px] leading-snug text-muted">{e.frase}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Pentágono radar original (SVG). 5 vértices, anillos concéntricos y polígono de datos. */
function Pentagono({ ejes }: { ejes: Eje[] }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // El viewBox es MÁS ANCHO que alto: las etiquetas laterales ("Dominio",
  // "Eficiencia") se anclan afuera del pentágono y se recortaban con un lienzo
  // cuadrado. El pentágono queda centrado; el ancho extra es margen para el texto.
  const W = 360;
  const H = 300;
  const cx = W / 2;
  const cy = H / 2 + 6;
  const R = 104; // radio máximo (100%)
  const n = ejes.length;

  // Vértice i en el radio r (0-1), empezando arriba y en sentido horario.
  const punto = (i: number, r: number) => {
    const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
    return [cx + Math.cos(ang) * R * r, cy + Math.sin(ang) * R * r] as const;
  };
  const poligono = (r: number | number[]) =>
    ejes.map((_, i) => punto(i, Array.isArray(r) ? r[i] : r).join(',')).join(' ');

  const anillos = [0.25, 0.5, 0.75, 1];
  const datos = ejes.map((e) => Math.max(0.04, e.valor / 100)); // piso visible aunque sea 0

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
      aria-label={`Radar: ${ejes.map((e) => `${e.etiqueta} ${e.valor} por ciento`).join(', ')}`}>
      <defs>
        <linearGradient id={`rad${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={AZUL} stopOpacity={0.5} />
          <stop offset="100%" stopColor={AZUL} stopOpacity={0.18} />
        </linearGradient>
      </defs>

      {/* Anillos concéntricos + radios */}
      {anillos.map((r) => (
        <polygon key={r} points={poligono(r)} fill="none" stroke="rgb(var(--line))" strokeWidth={1} />
      ))}
      {ejes.map((_, i) => {
        const [x, y] = punto(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(var(--line))" strokeWidth={1} />;
      })}

      {/* Polígono de datos */}
      <polygon points={poligono(datos)} fill={`url(#rad${uid})`} stroke={AZUL} strokeWidth={2} strokeLinejoin="round" />

      {/* Vértices marcados con el color del eje */}
      {ejes.map((e, i) => {
        const [x, y] = punto(i, datos[i]);
        return <circle key={e.clave} cx={x} cy={y} r={4} fill={e.color} stroke="rgb(var(--card))" strokeWidth={1.5} />;
      })}

      {/* Etiquetas (SIEMPRE horizontales; anchor según la posición) */}
      {ejes.map((e, i) => {
        const [x, y] = punto(i, 1.16);
        const anchor = Math.abs(x - cx) < 8 ? 'middle' : x > cx ? 'start' : 'end';
        return (
          <text key={e.clave} x={x} y={y} textAnchor={anchor} dominantBaseline="middle"
            className="fill-[rgb(var(--muted))]" style={{ fontSize: 11, fontWeight: 700 }}>
            {e.corto}
          </text>
        );
      })}
    </svg>
  );
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
