'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Nivel, Ejercicio } from '@/lib/types';
import { CheckCircle, Lock, Play, RotateCcw, Lightbulb, ArrowRight, Code } from '@/components/icons';

export default function EjerciciosPage() {
  const router = useRouter();
  const [niveles, setNiveles] = useState<Nivel[]>([]);
  const [ejercicios, setEjercicios] = useState<Ejercicio[]>([]);
  const [resueltos, setResueltos] = useState<Set<number>>(new Set());
  const [puntos, setPuntos] = useState(0);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ niveles: Nivel[] }>('/niveles').then((r) => setNiveles(r.niveles)),
      api.get<{ ejercicios: Ejercicio[] }>('/ejercicios').then((r) => setEjercicios(r.ejercicios)),
      api.get<{ ids: number[] }>('/ejercicios/resueltos').then((r) => setResueltos(new Set(r.ids))),
      api.get<{ puntos: number }>('/gamificacion/resumen').then((r) => setPuntos(r.puntos)).catch(() => undefined),
    ]).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  const porNivel = useMemo(() => {
    const m = new Map<number, Ejercicio[]>();
    for (const e of ejercicios) { const a = m.get(e.nivelId) ?? []; a.push(e); m.set(e.nivelId, a); }
    return m;
  }, [ejercicios]);

  const nivelesOk = niveles.filter((n) => n.ejercicios_completados >= n.umbral).length;
  const totalEj = niveles.reduce((a, n) => a + n.total_ejercicios, 0);
  const totalComp = niveles.reduce((a, n) => a + Math.min(n.ejercicios_completados, n.total_ejercicios), 0);
  const globalPct = totalEj ? Math.round((totalComp / totalEj) * 100) : 0;
  const nivelActualId = [...niveles].sort((a, b) => a.numero - b.numero).find((n) => n.desbloqueado && n.ejercicios_completados < n.umbral)?.id ?? null;

  function continuar(nivelId: number) {
    const lista = porNivel.get(nivelId) ?? [];
    const pend = lista.find((e) => !resueltos.has(e.id)) ?? lista[0];
    if (pend) router.push(`/ejercicios/${pend.id}`);
  }

  if (cargando) return <div className="mx-auto max-w-5xl space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div>;

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <div className="card mb-7 border-0 bg-gradient-to-r from-prexi-navy to-prexi-blue text-white">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-[240px] flex-1">
            <h1 className="text-xl font-extrabold">Progreso general del curso</h1>
            <p className="mb-3 text-sm font-medium text-blue-100/80">{globalPct}% completado</p>
            <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${globalPct}%` }} /></div>
          </div>
          <div className="flex gap-6 text-center">
            <div><p className="text-[11px] uppercase text-blue-200/70">Ejercicios</p><p className="text-xl font-bold">{totalComp}/{totalEj}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">Niveles OK</p><p className="text-xl font-bold">{nivelesOk}</p></div>
            <div><p className="text-[11px] uppercase text-blue-200/70">XP Total</p><p className="text-xl font-bold">{puntos.toLocaleString()}</p></div>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-prexi-navy">Módulos de aprendizaje</h2>
      <p className="mb-5 text-slate-500">Avanza por los niveles para desbloquear nuevos desafíos de Python.</p>

      <div className="space-y-4">
        {[...niveles].sort((a, b) => a.numero - b.numero).map((n) => {
          const completo = n.ejercicios_completados >= n.umbral;
          const esActual = n.id === nivelActualId;
          const estado = completo ? 'completo' : n.desbloqueado ? (esActual ? 'actual' : 'enCurso') : 'bloqueado';
          const restantes = Math.max(0, n.umbral - n.ejercicios_completados);
          const lista = porNivel.get(n.id) ?? [];
          const Icono = completo ? CheckCircle : n.desbloqueado ? Code : Lock;
          const iconoBg = completo ? 'bg-green-100 text-prexi-green' : n.desbloqueado ? 'bg-blue-100 text-prexi-blue' : 'bg-slate-100 text-slate-400';
          const borde = completo ? 'border-l-prexi-green' : estado === 'actual' ? 'border-l-prexi-blue ring-1 ring-blue-200 bg-blue-50/40' : n.desbloqueado ? 'border-l-prexi-blue' : 'border-l-slate-200 opacity-70';
          return (
            <div key={n.id} className={`card card-hover border-l-4 ${borde}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3.5">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${iconoBg}`}><Icono className="h-5 w-5" /></div>
                  <div>
                    {completo && <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-prexi-green"><CheckCircle className="h-3 w-3" /> Completado</span>}
                    {estado === 'actual' && <span className="mb-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-prexi-blue">Actualmente aquí</span>}
                    <h3 className="text-lg font-bold text-prexi-navy">Nivel {n.numero}: {n.titulo}</h3>
                    <p className="text-sm text-slate-500">{n.descripcion}</p>
                  </div>
                </div>
                <div className="text-right">
                  {completo ? <button onClick={() => continuar(n.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-prexi-blue hover:underline"><RotateCcw className="h-4 w-4" /> Repasar</button>
                    : n.desbloqueado ? <span className="text-xs text-slate-500">{n.ejercicios_completados} de {n.umbral} completados</span>
                    : <span className="inline-flex items-center gap-1.5 text-xs text-slate-400"><Lock className="h-3.5 w-3.5" /> Requiere nivel anterior</span>}
                </div>
              </div>

              {n.desbloqueado && lista.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {lista.map((e) => {
                      const done = resueltos.has(e.id);
                      const actual = !done && esActual && lista.find((x) => !resueltos.has(x.id))?.id === e.id;
                      return (
                        <button key={e.id} onClick={() => router.push(`/ejercicios/${e.id}`)} title={e.titulo}
                          className={`grid h-9 w-9 place-items-center rounded-full text-xs transition hover:scale-110 ${done ? 'bg-prexi-green text-white' : actual ? 'bg-prexi-blue text-white ring-4 ring-blue-100 animate-pulse-soft' : 'bg-slate-100 text-slate-400'}`}>
                          {done ? <CheckCircle className="h-4 w-4" /> : <Play className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                  {!completo && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                      <p className="flex items-center gap-2 text-sm text-slate-600"><Lightbulb className="h-4 w-4 text-prexi-amber" /> {restantes > 0 ? `Completa ${restantes} ejercicio${restantes > 1 ? 's' : ''} más para desbloquear el siguiente nivel.` : 'Estás muy cerca de completar este nivel.'}</p>
                      <button onClick={() => continuar(n.id)} className="btn-primary !py-2">Continuar ejercicio <ArrowRight className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
