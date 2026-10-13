'use client';

import { BotonFlashcards } from '@/components/flashcards/boton-flashcards';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Award, CheckCircle, TrendingUp, ArrowRight, ClipboardList, Sparkles } from '@/components/icons';

type Nivel = 'basico' | 'intermedio' | 'avanzado';
interface TemaR {
  tema_id: number; unidad: number; numero: string; titulo: string;
  aciertos: number; total: number; puntaje: number; theta: number | null;
  nivel: Nivel; nivel_label: string;
}
interface Resultado {
  puntaje: number; nivel_inicial: number;
  nivel_adaptativo: Nivel; nivel_adaptativo_label: string;
  theta: number | null; aciertos: number; total: number;
  por_tema: TemaR[]; fortalezas: string[]; debilidades: string[];
}

// Paleta sobria por nivel (coherente con el resto del sistema).
const COLOR_NIVEL: Record<Nivel, string> = { basico: '#F59E0B', intermedio: '#3B82F6', avanzado: '#10B981' };
// Badge de nivel con tinte translúcido (funciona en claro y oscuro) y texto de
// alto contraste sobre ese tinte (tono 700 en claro / 300 en oscuro).
const BG_NIVEL: Record<Nivel, string> = {
  basico: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  intermedio: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  avanzado: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};

export default function ResultadoPage() {
  const router = useRouter();
  const [r, setR] = useState<Resultado | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ completado: boolean; resultado: Resultado | null }>('/pretest/estado')
      .then((e) => { if (!e.completado || !e.resultado) router.replace('/pretest'); else setR(e.resultado); })
      .catch(() => router.replace('/dashboard'))
      .finally(() => setCargando(false));
  }, [router]);

  // Agrupa los temas por unidad para el mapa de fortalezas/debilidades.
  const porUnidad = useMemo(() => {
    if (!r) return [];
    const map = new Map<number, TemaR[]>();
    for (const t of r.por_tema) { const arr = map.get(t.unidad) ?? []; arr.push(t); map.set(t.unidad, arr); }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([unidad, temas]) => ({ unidad, temas }));
  }, [r]);

  if (cargando || !r) return <div className="grid min-h-screen place-items-center bg-app text-muted">Cargando…</div>;
  const colorNivel = COLOR_NIVEL[r.nivel_adaptativo];

  return (
    <div className="min-h-screen bg-app p-4">
      <div className="mx-auto max-w-3xl py-8">
        {/* Resumen global */}
        <div className="card animate-fade-up text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-prexi-blue text-white"><Award className="h-7 w-7" /></div>
          <h1 className="text-2xl font-extrabold text-fg">¡Diagnóstico completado!</h1>
          <p className="mx-auto mt-1 max-w-md text-muted">Acertaste {r.aciertos} de {r.total} preguntas en {r.por_tema.length} temas.</p>

          <div className="my-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Gauge puntaje={r.puntaje} color={colorNivel} />
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Nivel inicial global</p>
              <span className="mt-1 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-base font-extrabold text-white" style={{ backgroundColor: colorNivel }}>{r.nivel_adaptativo_label}</span>
              {r.theta != null && <p className="mt-1 text-xs text-muted">habilidad estimada (θ): <b className="text-fg">{r.theta.toFixed(2)}</b></p>}
              <p className="mt-2 max-w-xs text-sm text-muted">
                Cada tema arranca en el nivel que muestra el mapa. Podrás <b className="text-fg">subir de nivel</b> tema por tema cuando te sientas listo.
              </p>
            </div>
          </div>

          <div className="grid gap-4 text-left sm:grid-cols-2">
            {/* Tinte translúcido (claro/oscuro) + texto de ALTO CONTRASTE del cuerpo
                (tono 900 en claro / 100 en oscuro), nunca gris claro. */}
            <div className="rounded-xl bg-emerald-500/10 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle className="h-4 w-4" /> Fortalezas</h3>
              <ul className="space-y-1 text-sm font-medium text-emerald-900 dark:text-emerald-100">{r.fortalezas.length ? r.fortalezas.map((c) => <li key={c}>• {c}</li>) : <li>Sigue practicando.</li>}</ul>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-4">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300"><TrendingUp className="h-4 w-4" /> A reforzar</h3>
              {r.debilidades.length ? (
                <ul className="space-y-1.5 text-sm font-medium text-amber-900 dark:text-amber-100">
                  {r.debilidades.map((c) => {
                    // Convierte la recomendación en ACCIÓN: enlaza al mazo de flashcards
                    // del tema débil (repaso libre, no puntúa). Se resuelve el tema por
                    // su título dentro de `por_tema`.
                    const tema = r.por_tema.find((t) => c === t.titulo || c.includes(t.titulo) || t.titulo.includes(c));
                    return (
                      <li key={c} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span>• {c}</span>
                        {tema && (
                          <BotonFlashcards compacto href={`/flashcards/tema/${tema.tema_id}?volver=/pretest/resultado`} />
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm font-medium text-amber-900 dark:text-amber-100">¡Excelente!</p>}
            </div>
          </div>
        </div>

        {/* Mapa detallado por unidad → tema */}
        <div className="card mt-5 animate-fade-up">
          <h2 className="mb-1 text-lg font-bold text-fg">Tu nivel por tema</h2>
          <p className="mb-4 text-sm text-muted">Este es el punto de partida de tu ruta adaptativa en cada tema del temario.</p>
          <div className="space-y-5">
            {porUnidad.map(({ unidad, temas }) => (
              <div key={unidad}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Unidad {unidad}</h3>
                <div className="space-y-2">
                  {temas.map((t) => (
                    <div key={t.tema_id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-fg">{t.numero} · {t.titulo}</p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${t.puntaje}%`, backgroundColor: COLOR_NIVEL[t.nivel] }} />
                        </div>
                      </div>
                      <span className="shrink-0 text-xs text-muted">{t.aciertos}/{t.total}</span>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${BG_NIVEL[t.nivel]}`}>{t.nivel_label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button onClick={() => router.push('/pretest/revision')} className="btn-ghost w-full sm:w-auto"><ClipboardList className="h-4 w-4" /> Revisar mis respuestas</button>
            <button onClick={() => router.push('/dashboard')} className="btn-primary w-full sm:w-auto">Ir a Mi Ruta de Aprendizaje <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Gauge({ puntaje, color }: { puntaje: number; color: string }) {
  const r = 52; const circ = useMemo(() => 2 * Math.PI * r, []);
  const offset = circ - (Math.min(100, Math.max(0, puntaje)) / 100) * circ;
  return (
    <svg width={140} height={140} viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="rgb(var(--line))" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      <text x="70" y="64" textAnchor="middle" fill="rgb(var(--fg))" fontSize="28" fontWeight="800">{puntaje}</text>
      <text x="70" y="86" textAnchor="middle" fill="rgb(var(--muted))" fontSize="11" fontWeight="600">PUNTOS</text>
    </svg>
  );
}
