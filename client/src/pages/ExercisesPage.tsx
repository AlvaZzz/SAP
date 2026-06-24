import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { DashboardData, EjercicioPublico, Nivel } from '../lib/types';
import { CheckCircle, Lock, Play, RotateCcw, Lightbulb, ArrowRight, Code } from '../components/icons';

interface Intento { ejercicio_id: number; correcto: boolean }

export default function ExercisesPage() {
  const navigate = useNavigate();
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [ejercicios, setEjercicios] = useState<EjercicioPublico[]>([]);
  const [resueltos, setResueltos] = useState<Set<number>>(new Set());
  const [dash, setDash] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get<{ niveles: Nivel[] }>('/niveles').then((r) => setNiveles(r.niveles)).catch(() => undefined);
    api.get<{ ejercicios: EjercicioPublico[] }>('/ejercicios').then((r) => setEjercicios(r.ejercicios)).catch(() => undefined);
    api.get<{ intentos: Intento[] }>('/intentos/mios')
      .then((r) => setResueltos(new Set(r.intentos.filter((i) => i.correcto).map((i) => i.ejercicio_id))))
      .catch(() => undefined);
    api.get<DashboardData>('/dashboard').then(setDash).catch(() => undefined);
  }, []);

  const ejerciciosPorNivel = useMemo(() => {
    const map = new Map<number, EjercicioPublico[]>();
    for (const e of ejercicios) {
      const arr = map.get(e.nivel_id) ?? [];
      arr.push(e);
      map.set(e.nivel_id, arr);
    }
    return map;
  }, [ejercicios]);

  const nivelesOk = niveles.filter((n) => n.ejercicios_completados >= n.umbral).length;
  const totalEj = niveles.reduce((a, n) => a + n.total_ejercicios, 0);
  const totalComp = niveles.reduce((a, n) => a + Math.min(n.ejercicios_completados, n.total_ejercicios), 0);
  const globalPct = totalEj ? Math.round((totalComp / totalEj) * 100) : 0;

  // Nivel "actual": el primero desbloqueado que aún no está completo.
  const nivelActualId = useMemo(() => {
    const ordenado = [...niveles].sort((a, b) => a.numero - b.numero);
    return ordenado.find((n) => n.desbloqueado && n.ejercicios_completados < n.umbral)?.id ?? null;
  }, [niveles]);

  function continuarNivel(nivelId: number) {
    const lista = ejerciciosPorNivel.get(nivelId) ?? [];
    const pendiente = lista.find((e) => !resueltos.has(e.id)) ?? lista[0];
    if (pendiente) navigate(`/ejercicios/${pendiente.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Banner de progreso general */}
      <div className="card mb-7 border-0 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-[240px] flex-1">
            <h1 className="text-xl font-extrabold">Progreso general del curso</h1>
            <p className="mb-3 text-sm font-medium text-blue-100/80">{globalPct}% completado</p>
            <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${globalPct}%` }} />
            </div>
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="text-[11px] uppercase text-blue-200/70">Ejercicios</p><p className="text-xl font-bold">{totalComp}/{totalEj}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">Niveles OK</p><p className="text-xl font-bold">{nivelesOk}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">XP Total</p><p className="text-xl font-bold">{dash ? dash.puntos.toLocaleString() : '—'}</p></div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-prexi-navy">Módulos de aprendizaje</h2>
      <p className="mb-5 text-slate-500">Avanza por los niveles para desbloquear nuevos desafíos de programación.</p>

      <div className="space-y-4">
        {[...niveles].sort((a, b) => a.numero - b.numero).map((n) => {
          const completo = n.ejercicios_completados >= n.umbral;
          const esActual = n.id === nivelActualId;
          const restantes = Math.max(0, n.umbral - n.ejercicios_completados);
          return (
            <NivelCard
              key={n.id}
              nivel={n}
              estado={completo ? 'completo' : n.desbloqueado ? (esActual ? 'actual' : 'enCurso') : 'bloqueado'}
              restantes={restantes}
              onContinuar={() => continuarNivel(n.id)}
              onRepasar={() => continuarNivel(n.id)}
            />
          );
        })}
        {niveles.length === 0 && <p className="text-sm text-slate-400">Cargando módulos…</p>}
      </div>
    </div>
  );
}

type Estado = 'completo' | 'actual' | 'enCurso' | 'bloqueado';

function NivelCard({
  nivel, estado, restantes, onContinuar, onRepasar,
}: {
  nivel: Nivel;
  estado: Estado;
  restantes: number;
  onContinuar: () => void;
  onRepasar: () => void;
}) {
  const borde =
    estado === 'completo' ? 'border-l-prexi-green'
    : estado === 'actual' ? 'border-l-prexi-blue ring-1 ring-blue-200 bg-blue-50/40'
    : estado === 'bloqueado' ? 'border-l-slate-200 opacity-70'
    : 'border-l-prexi-blue';

  const Icono = estado === 'completo' ? CheckCircle : estado === 'bloqueado' ? Lock : Code;
  const iconoBg =
    estado === 'completo' ? 'bg-green-100 text-prexi-green'
    : estado === 'bloqueado' ? 'bg-slate-100 text-slate-400'
    : 'bg-blue-100 text-prexi-blue';

  // Nodos de progreso (uno por ejercicio hasta el umbral).
  const total = Math.max(nivel.umbral, nivel.total_ejercicios);
  const hechos = nivel.ejercicios_completados;

  return (
    <div className={`card border-l-4 ${borde}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3.5">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconoBg}`}>
            <Icono className="h-5 w-5" />
          </div>
          <div>
            {estado === 'completo' && (
              <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-prexi-green">
                <CheckCircle className="h-3 w-3" /> Completado
              </span>
            )}
            {estado === 'actual' && (
              <span className="mb-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-prexi-blue">
                Actualmente aquí
              </span>
            )}
            <h3 className="text-lg font-bold text-prexi-navy">Nivel {nivel.numero}: {nivel.titulo}</h3>
            <p className="text-sm text-slate-500">{nivel.descripcion}</p>
          </div>
        </div>

        <div className="text-right">
          {estado === 'completo' ? (
            <button onClick={onRepasar} className="inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-blue hover:underline">
              <RotateCcw className="h-4 w-4" /> Repasar
            </button>
          ) : estado === 'bloqueado' ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Lock className="h-3.5 w-3.5" /> Requiere nivel anterior</span>
          ) : (
            <span className="text-xs text-slate-500">{hechos} de {nivel.umbral} completados</span>
          )}
        </div>
      </div>

      {/* Nodos + acción del nivel actual */}
      {(estado === 'actual' || estado === 'enCurso') && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {Array.from({ length: total }).map((_, i) => {
              const done = i < hechos;
              const current = i === hechos;
              return (
                <div
                  key={i}
                  className={`grid h-8 w-8 place-items-center rounded-full text-xs ${
                    done ? 'bg-prexi-green text-white'
                    : current ? 'bg-prexi-blue text-white ring-4 ring-blue-100'
                    : 'bg-slate-100 text-slate-300'
                  }`}
                >
                  {done ? <CheckCircle className="h-4 w-4" /> : current ? <Play className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Lightbulb className="h-4 w-4 text-prexi-amber" />
              {restantes > 0
                ? `Completa ${restantes} ejercicio${restantes > 1 ? 's' : ''} más para desbloquear el siguiente nivel.`
                : 'Estás muy cerca de completar este nivel.'}
            </p>
            <button onClick={onContinuar} className="btn-primary !py-2">
              Continuar ejercicio <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
