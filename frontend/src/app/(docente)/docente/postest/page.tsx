'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PageHeader, Card, Badge, Skeleton, EmptyState } from '@/components/ui';
import { GraduationCap, Users, CheckCircle, Lock } from '@/components/icons';

interface Paralelo { paralelo: string; total_estudiantes: number; habilitado: boolean; habilitado_en: string | null }

export default function DocentePostestPage() {
  const [paralelos, setParalelos] = useState<Paralelo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try { const r = await api.get<{ paralelos: Paralelo[] }>('/docente/postest'); setParalelos(r.paralelos); }
    catch { /* noop */ } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function alternar(p: Paralelo) {
    const nuevo = !p.habilitado;
    if (nuevo && !confirm(`¿Habilitar la evaluación final para el paralelo "${p.paralelo}" (${p.total_estudiantes} estudiantes)? Se les notificará y podrán rendirla.`)) return;
    if (!nuevo && !confirm(`¿Deshabilitar la evaluación final del paralelo "${p.paralelo}"? Los estudiantes ya no podrán entrar.`)) return;
    setAplicando(p.paralelo); setError('');
    try {
      await api.post('/docente/postest', { paralelo: p.paralelo, habilitado: nuevo });
      await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo actualizar'); }
    finally { setAplicando(null); }
  }

  const habilitados = paralelos.filter((p) => p.habilitado).length;

  return (
    <div className="animate-fade-up">
      <PageHeader title="Evaluación final" subtitle="Controla cuándo tus estudiantes pueden rendir el postest. Está deshabilitado por defecto: habilítalo al terminar la intervención." />

      <Card className="mb-6 flex flex-wrap items-center gap-4 bg-gradient-to-r from-prexi-navy-deep to-prexi-navy !text-white">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><GraduationCap className="h-6 w-6" /></div>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold">Postest bajo tu control</p>
          <p className="text-sm text-blue-100/80">{habilitados} de {paralelos.length} paralelo(s) con la evaluación habilitada.</p>
        </div>
      </Card>

      {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

      {cargando ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        : paralelos.length === 0 ? <EmptyState icon={<Users className="h-7 w-7" />} title="Sin paralelos registrados" hint="Cuando haya estudiantes con paralelo asignado, aparecerán aquí para controlar su evaluación final." />
          : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paralelos.map((p) => (
                <Card key={p.paralelo} hover className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-xl ${p.habilitado ? 'bg-prexi-green/15 text-prexi-green' : 'bg-subtle text-muted'}`}>
                        {p.habilitado ? <CheckCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-display text-lg font-bold text-fg">Paralelo {p.paralelo}</p>
                        <p className="flex items-center gap-1 text-xs text-muted"><Users className="h-3.5 w-3.5" /> {p.total_estudiantes} estudiante(s)</p>
                      </div>
                    </div>
                    <Badge tone={p.habilitado ? 'green' : 'slate'}>{p.habilitado ? 'Habilitado' : 'Bloqueado'}</Badge>
                  </div>
                  <button onClick={() => alternar(p)} disabled={aplicando === p.paralelo}
                    className={`w-full rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60 ${p.habilitado ? 'border border-line bg-card text-fg hover:bg-subtle' : 'bg-prexi-green text-white hover:opacity-90'}`}>
                    {aplicando === p.paralelo ? 'Aplicando…' : p.habilitado ? 'Deshabilitar evaluación' : 'Habilitar evaluación'}
                  </button>
                </Card>
              ))}
            </div>
          )}
    </div>
  );
}
