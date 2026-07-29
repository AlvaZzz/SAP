'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { Markdown } from '@/components/markdown';
import { BotonVoz } from '@/components/boton-voz';
import { GraduationCap, BookOpen, CheckCircle, Check, ArrowRight, Lock } from '@/components/icons';

interface UnidadRepaso {
  id: number; numero: number; titulo: string; repaso: string | null;
}

export default function PostestRepasoPage() {
  const { usuario } = useAuth();
  const router = useRouter();
  const [unidades, setUnidades] = useState<UnidadRepaso[]>([]);
  const [activa, setActiva] = useState(0);
  const [leidas, setLeidas] = useState<Set<number>>(new Set([0]));
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (usuario && usuario.rol !== 'estudiante') { router.replace('/dashboard'); return; }
    // Solo tiene sentido si el docente habilitó y aún no se completó el postest.
    api.get<{ habilitado: boolean; repasoCompletado: boolean; completado: boolean }>('/postest/estado')
      .then((e) => {
        if (e.completado) { router.replace('/postest/resultado'); return; }
        if (!e.habilitado) { router.replace('/dashboard'); return; }
        if (e.repasoCompletado) { router.replace('/postest'); return; }
        return api.get<{ unidades: UnidadRepaso[] }>('/postest/repaso').then((r) => setUnidades(r.unidades));
      })
      .catch(() => setError('No se pudo cargar el repaso.'))
      .finally(() => setCargando(false));
  }, [usuario, router]);

  const abrir = useCallback((i: number) => { setActiva(i); setLeidas((s) => new Set(s).add(i)); }, []);

  const comenzar = useCallback(async () => {
    setEnviando(true); setError('');
    try {
      await api.post('/postest/repaso/completar', {});
      router.replace('/postest');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo continuar. Intenta de nuevo.');
      setEnviando(false);
    }
  }, [router]);

  if (cargando) return <div className="grid min-h-screen place-items-center bg-app"><div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-prexi-blue" /></div>;
  if (!unidades.length) return <div className="grid min-h-screen place-items-center bg-app px-4 text-center text-muted">{error || 'Aún no hay contenido de repaso disponible.'}</div>;

  const todasLeidas = leidas.size >= unidades.length;
  const u = unidades[activa];

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-10 border-b border-line bg-card">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-2 font-extrabold text-fg"><GraduationCap className="h-6 w-6 text-prexi-blue-deep" /> Repaso antes de la evaluación final</div>
          <span className="ml-auto text-xs font-semibold text-muted">{leidas.size} de {unidades.length} unidades repasadas</span>
        </div>
        <div className="h-1 w-full bg-subtle"><div className="h-full rounded-r-full bg-prexi-blue transition-all" style={{ width: `${(leidas.size / unidades.length) * 100}%` }} /></div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 rounded-xl border border-prexi-blue/20 bg-prexi-blue/5 p-4 text-sm text-muted">
          <b className="text-fg">Antes de tu evaluación final</b>, repasa lo esencial de cada unidad del curso. Cuando hayas revisado las {unidades.length}, podrás comenzar.
        </div>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {unidades.map((un, i) => {
            const leida = leidas.has(i);
            const sel = i === activa;
            return (
              <button key={un.id} onClick={() => abrir(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${sel ? 'border-prexi-blue bg-prexi-blue text-white' : 'border-line bg-card text-muted hover:border-prexi-blue/40'}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${sel ? 'bg-white/25' : leida ? 'bg-prexi-green/15 text-prexi-green' : 'bg-subtle text-muted'}`}>
                  {leida && !sel ? <Check className="h-3 w-3" /> : un.numero}
                </span>
                <span className="hidden sm:inline">Unidad {un.numero}</span>
                <span className="sm:hidden">U{un.numero}</span>
              </button>
            );
          })}
        </div>

        <article className="card animate-fade-up">
          <div className="mb-3 flex flex-wrap items-start gap-3 border-b border-line pb-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-prexi-blue/10 text-prexi-blue-deep"><BookOpen className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-prexi-blue-deep">Unidad {u.numero} · Repaso</p>
              <h1 className="text-xl font-extrabold text-fg">{u.titulo}</h1>
            </div>
            {/* Escuchar el repaso (accesibilidad) */}
            {u.repaso && <BotonVoz texto={`Repaso de la Unidad ${u.numero}. ${u.titulo}. ${u.repaso}`} variante="boton" className="shrink-0" />}
          </div>
          {u.repaso
            ? <Markdown content={u.repaso} />
            : <p className="py-6 text-center text-sm text-muted">Esta unidad todavía no tiene repaso. Puedes continuar.</p>}
        </article>

        <div className="mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <button onClick={() => abrir(Math.max(0, activa - 1))} disabled={activa === 0} className="btn-ghost disabled:opacity-40">Anterior</button>
            <button onClick={() => abrir(Math.min(unidades.length - 1, activa + 1))} disabled={activa === unidades.length - 1} className="btn-ghost disabled:opacity-40">Siguiente <ArrowRight className="h-4 w-4" /></button>
          </div>
          <button onClick={comenzar} disabled={!todasLeidas || enviando}
            title={todasLeidas ? '' : 'Repasa todas las unidades para continuar'}
            className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {enviando ? 'Preparando…' : todasLeidas ? <>He repasado, ir a la evaluación final <CheckCircle className="h-4 w-4" /></> : <><Lock className="h-4 w-4" /> Repasa las {unidades.length} unidades</>}
          </button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
