'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { EntregaReto } from '@/lib/types';
import { PageHeader, Card, Badge, Skeleton, Modal, Field, Input, Textarea, EmptyState } from '@/components/ui';
import { CodeBlock } from '@/components/code-block';
import { ClipboardList, CheckCircle, AlertTriangle, User, Bot, Clock } from '@/components/icons';

export default function DocenteRevisionesPage() {
  const [entregas, setEntregas] = useState<EntregaReto[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [cargando, setCargando] = useState(true);

  // Modal de revisión.
  const [revisar, setRevisar] = useState<EntregaReto | null>(null);
  const [aprobado, setAprobado] = useState(true);
  const [xp, setXp] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [sugiriendo, setSugiriendo] = useState(false);

  const cargar = useCallback(async (todas = verTodas) => {
    setCargando(true);
    try {
      const r = await api.get<{ entregas: EntregaReto[] }>(`/docente/revisiones${todas ? '?todas=1' : ''}`);
      setEntregas(r.entregas);
    } catch { /* noop */ } finally { setCargando(false); }
  }, [verTodas]);
  useEffect(() => { cargar(verTodas); }, [cargar, verTodas]);

  function abrir(e: EntregaReto) {
    setRevisar(e); setAprobado(true); setXp(e.xpSugerido); setFeedback(e.feedback ?? ''); setError('');
  }

  async function sugerir() {
    if (!revisar) return;
    setSugiriendo(true); setError('');
    try {
      const r = await api.post<{ sugerencia: string }>(`/docente/revisiones/${revisar.retoId}/${revisar.estudianteId}/sugerir`, { aprobado });
      setFeedback(r.sugerencia);
    } catch (err) { setError(err instanceof ApiError ? err.message : 'El tutor PREXI no pudo sugerir feedback ahora.'); }
    finally { setSugiriendo(false); }
  }

  async function enviar() {
    if (!revisar) return;
    setEnviando(true); setError('');
    try {
      await api.post(`/docente/revisiones/${revisar.retoId}/${revisar.estudianteId}`, {
        aprobado, xp: aprobado ? xp : 0, feedback: feedback.trim() || undefined,
      });
      setRevisar(null); await cargar();
    } catch (err) { setError(err instanceof ApiError ? err.message : 'No se pudo enviar la revisión'); }
    finally { setEnviando(false); }
  }

  const fecha = (f: string | null) => (f ? new Date(f).toLocaleString('es-BO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const pendientes = entregas.filter((e) => e.estado === 'pendiente_revision');

  return (
    <div className="animate-fade-up">
      <PageHeader title="Revisión de retos" subtitle="Califica las entregas de tus estudiantes, otorga XP y envía retroalimentación."
        action={
          <div className="flex rounded-xl border border-line p-1 text-sm">
            <button onClick={() => setVerTodas(false)} className={`rounded-lg px-3 py-1.5 font-medium transition ${!verTodas ? 'bg-prexi-blue text-white' : 'text-muted hover:bg-subtle'}`}>Pendientes</button>
            <button onClick={() => setVerTodas(true)} className={`rounded-lg px-3 py-1.5 font-medium transition ${verTodas ? 'bg-prexi-blue text-white' : 'text-muted hover:bg-subtle'}`}>Todas</button>
          </div>
        } />

      {cargando ? <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        : entregas.length === 0 ? (
          <EmptyState icon={<ClipboardList className="h-7 w-7" />}
            title={verTodas ? 'Aún no hay entregas' : 'No hay entregas pendientes'}
            hint={verTodas ? 'Cuando un estudiante entregue un reto, aparecerá aquí.' : 'Todas las entregas están revisadas.'} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entregas.map((e) => (
              <Card key={`${e.retoId}-${e.estudianteId}`} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display font-bold text-fg">{e.retoTitulo}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted"><User className="h-3.5 w-3.5" /> {e.estudiante}</p>
                  </div>
                  <EstadoEntregaBadge estado={e.estado} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted">
                  <Badge tone="blue">{e.categoria}</Badge>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {fecha(e.entregado_en)}</span>
                </div>
                {e.estado !== 'pendiente_revision' && e.feedback && (
                  <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted line-clamp-2"><b className="text-fg">Feedback:</b> {e.feedback}</p>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-muted">{e.estado === 'aprobado' ? `+${e.xp_obtenido} XP otorgados` : `Máx. +${e.xpSugerido} XP`}</span>
                  <button onClick={() => abrir(e)} className="btn-primary !py-1.5 !px-3.5 text-sm">
                    {e.estado === 'pendiente_revision' ? 'Revisar' : 'Ver'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

      {!cargando && !verTodas && pendientes.length > 0 && (
        <p className="mt-4 text-sm text-muted">{pendientes.length} entrega{pendientes.length === 1 ? '' : 's'} pendiente{pendientes.length === 1 ? '' : 's'} de revisión.</p>
      )}

      {/* Modal de calificación */}
      <Modal open={!!revisar} onClose={() => setRevisar(null)} size="lg"
        title={revisar ? `Revisar: ${revisar.retoTitulo}` : 'Revisar entrega'}
        footer={revisar?.estado === 'pendiente_revision' ? <>
          <button onClick={() => setRevisar(null)} className="btn-ghost">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="btn-primary">{enviando ? 'Enviando…' : 'Enviar revisión'}</button>
        </> : <button onClick={() => setRevisar(null)} className="btn-ghost">Cerrar</button>}>
        {revisar && (
          <div className="space-y-4">
            <p className="flex items-center gap-1.5 text-sm text-muted"><User className="h-4 w-4" /> {revisar.estudiante} · {revisar.email}</p>

            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Enunciado del reto</p>
              <p className="rounded-xl bg-prexi-blue/10 px-4 py-2.5 text-sm text-fg">{revisar.enunciado}</p>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">Código entregado</p>
              <CodeBlock code={revisar.codigo || '(sin código)'} />
            </div>

            {revisar.estado !== 'pendiente_revision' ? (
              <div className="rounded-xl border border-line p-4">
                <EstadoEntregaBadge estado={revisar.estado} />
                <p className="mt-2 text-sm text-fg"><b>XP otorgado:</b> {revisar.xp_obtenido}</p>
                {revisar.feedback && <p className="mt-1 text-sm text-muted"><b className="text-fg">Feedback:</b> {revisar.feedback}</p>}
              </div>
            ) : (
              <>
                {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}

                <div>
                  <p className="mb-1.5 text-sm font-medium text-fg">Resultado</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setAprobado(true)}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${aprobado ? 'border-prexi-green bg-emerald-500/10 text-prexi-green' : 'border-line text-muted hover:bg-subtle'}`}>
                      <CheckCircle className="h-4 w-4" /> Aprobado
                    </button>
                    <button type="button" onClick={() => setAprobado(false)}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${!aprobado ? 'border-prexi-amber bg-amber-500/10 text-prexi-amber' : 'border-line text-muted hover:bg-subtle'}`}>
                      <AlertTriangle className="h-4 w-4" /> Necesita mejorar
                    </button>
                  </div>
                </div>

                {aprobado && (
                  <Field label={`XP a otorgar (máx. ${revisar.xpSugerido})`} hint="Se suma al ranking del estudiante al aprobar.">
                    <Input type="number" min={0} max={revisar.xpSugerido} value={xp}
                      onChange={(ev) => setXp(Math.min(revisar.xpSugerido, Math.max(0, Number(ev.target.value))))} />
                  </Field>
                )}

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm font-medium text-fg">Feedback para el estudiante</span>
                    <button type="button" onClick={sugerir} disabled={sugiriendo}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-prexi-blue/10 px-2.5 py-1 text-xs font-semibold text-prexi-blue-deep transition hover:bg-prexi-blue/20 disabled:opacity-50">
                      <Bot className="h-3.5 w-3.5" /> {sugiriendo ? 'Pensando…' : 'Sugerir con el tutor PREXI'}
                    </button>
                  </div>
                  <Textarea value={feedback} onChange={(ev) => setFeedback(ev.target.value)} className="min-h-[120px]"
                    placeholder={aprobado ? '¡Buen trabajo! Tu solución es correcta porque…' : 'Revisa el manejo de… e inténtalo de nuevo.'} />
                  <p className="mt-1 text-xs text-muted">El tutor PREXI solo sugiere un borrador; tú decides el texto final. Se envía como notificación.</p>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function EstadoEntregaBadge({ estado }: { estado: EntregaReto['estado'] }) {
  if (estado === 'aprobado') return <Badge tone="green"><CheckCircle className="h-3 w-3" /> Aprobado</Badge>;
  if (estado === 'necesita_mejorar') return <Badge tone="amber"><AlertTriangle className="h-3 w-3" /> A mejorar</Badge>;
  return <Badge tone="blue"><Clock className="h-3 w-3" /> Pendiente</Badge>;
}
