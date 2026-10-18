'use client';

/**
 * SOLICITUDES — estudiantes que se registraron por su cuenta y piden entrar a
 * un paralelo del docente. Hasta que el docente acepte, no pueden rendir el
 * diagnóstico ni aparecen en sus listas.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, Skeleton, Badge } from '@/components/ui';
import { CheckCircle, X, Inbox, Users } from '@/components/icons';

interface Solicitud {
  id: number; nombre: string; ci: string | null; ru: string | null; email: string | null; fecha: string;
  paralelo: { id: number; nombre: string; materia: string; gestion: string } | null;
}
interface ParaleloOpcion { id: number; nombre: string; materia: string; gestion: string; inscritos: number }
interface Respuesta { solicitudes: Solicitud[]; paralelos: ParaleloOpcion[] }

function hace(f: string): string {
  const min = Math.floor((Date.now() - new Date(f).getTime()) / 60_000);
  if (min < 60) return min <= 1 ? 'Hace un momento' : `Hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Ayer' : `Hace ${d} días`;
}

export function Solicitudes({ onCambio }: { onCambio?: () => void }) {
  const [d, setD] = useState<Respuesta | null>(null);
  const [destino, setDestino] = useState<Record<number, string>>({});
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<number | 'todas' | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    const r = await api.get<Respuesta>('/docente/registro/solicitudes').catch(() => null);
    setD(r ?? { solicitudes: [], paralelos: [] });
    onCambio?.();
  }, [onCambio]);
  useEffect(() => { cargar(); }, [cargar]);

  const paraleloDe = (s: Solicitud) => destino[s.id] ?? (s.paralelo ? String(s.paralelo.id) : '');

  async function aceptar(s: Solicitud) {
    const pid = paraleloDe(s);
    if (!pid) { setError(`Elige en qué paralelo queda ${s.nombre}.`); return; }
    setOcupado(s.id); setError(''); setAviso('');
    try {
      await api.post(`/docente/registro/solicitudes/${s.id}/aceptar`, { paraleloId: Number(pid) });
      setAviso(`${s.nombre} ya está en el curso. Puede rendir su diagnóstico.`);
      await cargar();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo aceptar la solicitud.'); }
    finally { setOcupado(null); }
  }

  async function aceptarTodas() {
    if (!d || !confirm(`¿Aceptar las ${d.solicitudes.length} solicitudes, cada una en el paralelo que pidió?`)) return;
    setOcupado('todas'); setError(''); setAviso('');
    let fallidas = 0;
    for (const s of d.solicitudes) {
      const pid = paraleloDe(s);
      if (!pid) { fallidas += 1; continue; }
      await api.post(`/docente/registro/solicitudes/${s.id}/aceptar`, { paraleloId: Number(pid) }).catch(() => { fallidas += 1; });
    }
    if (fallidas) setError(`${fallidas} solicitud(es) no se pudieron aceptar: revísalas una por una.`);
    else setAviso('Todas las solicitudes fueron aceptadas.');
    await cargar(); setOcupado(null);
  }

  async function rechazar(s: Solicitud) {
    setOcupado(s.id); setError(''); setAviso('');
    try {
      await api.post(`/docente/registro/solicitudes/${s.id}/rechazar`, { motivo: motivo.trim() || undefined });
      setAviso(`Rechazaste la solicitud de ${s.nombre}. Verá tu mensaje y podrá pedir otro paralelo.`);
      setRechazando(null); setMotivo(''); await cargar();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo rechazar la solicitud.'); }
    finally { setOcupado(null); }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Estudiantes que se registraron por su cuenta. Acepta solo a quienes sí pertenecen a tu paralelo.</p>
        {d && d.solicitudes.length > 1 && <button onClick={aceptarTodas} disabled={ocupado !== null} className="btn-primary disabled:opacity-60"><CheckCircle className="h-4 w-4" /> {ocupado === 'todas' ? 'Aceptando…' : `Aceptar las ${d.solicitudes.length}`}</button>}
      </div>

      {d && d.paralelos.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {d.paralelos.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-muted">
              <Users className="h-3.5 w-3.5" /> {p.materia} · Paralelo {p.nombre}: <b className="text-fg">{p.inscritos} inscritos</b>
            </span>
          ))}
        </div>
      )}

      {aviso && <p className="mb-4 flex items-center gap-2 rounded-xl bg-prexi-green/10 px-4 py-3 text-sm text-prexi-green" role="status"><CheckCircle className="h-4 w-4 shrink-0" /> {aviso}</p>}
      {error && <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-prexi-red" role="alert">{error}</p>}

      {d === null ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        : d.solicitudes.length === 0 ? (
          <Card className="text-center">
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-subtle text-muted"><Inbox className="h-7 w-7" /></div>
            <h2 className="font-display text-lg font-bold text-fg">No hay solicitudes por revisar</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">Cuando un estudiante se registre por su cuenta y elija uno de tus paralelos, aparecerá aquí para que lo aceptes.</p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {d.solicitudes.map((s) => (
              <li key={s.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-bold text-fg">{s.nombre}</p>
                    <p className="text-sm text-muted">CI <b className="text-fg">{s.ci ?? '—'}</b>{s.ru ? <> · RU <b className="text-fg">{s.ru}</b></> : null}{s.email ? ` · ${s.email}` : ''}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                      Pide entrar a
                      {s.paralelo ? <Badge tone="blue">{s.paralelo.materia} · Paralelo {s.paralelo.nombre}</Badge> : <Badge tone="amber">sin paralelo</Badge>}
                      <span>· {hace(s.fecha)}</span>
                    </p>
                  </div>
                </div>

                {rechazando === s.id ? (
                  <div className="mt-4 rounded-xl border border-line bg-subtle/40 p-3">
                    <label className="mb-1.5 block text-sm font-medium text-fg" htmlFor={`motivo-${s.id}`}>¿Qué le decimos al estudiante? (opcional)</label>
                    <input id={`motivo-${s.id}`} className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} autoFocus
                      placeholder="Ej.: No figuras en mi lista del paralelo A. Revisa a qué paralelo perteneces." />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button onClick={() => { setRechazando(null); setMotivo(''); }} className="btn-ghost">Cancelar</button>
                      <button onClick={() => rechazar(s)} disabled={ocupado !== null} className="btn-ghost !border-prexi-red !text-prexi-red disabled:opacity-60">{ocupado === s.id ? 'Rechazando…' : 'Rechazar solicitud'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-3">
                    <label className="min-w-[220px] flex-1 text-sm">
                      <span className="mb-1 block font-medium text-fg">Queda en el paralelo</span>
                      <select className="input !py-2" value={paraleloDe(s)} onChange={(e) => setDestino({ ...destino, [s.id]: e.target.value })}>
                        {!paraleloDe(s) && <option value="">Elige un paralelo…</option>}
                        {d.paralelos.map((p) => <option key={p.id} value={p.id}>{p.materia} · Paralelo {p.nombre} ({p.inscritos} inscritos)</option>)}
                      </select>
                    </label>
                    <button onClick={() => { setRechazando(s.id); setMotivo(''); setError(''); }} disabled={ocupado !== null} className="btn-ghost disabled:opacity-60"><X className="h-4 w-4" /> Rechazar</button>
                    <button onClick={() => aceptar(s)} disabled={ocupado !== null} className="btn-primary disabled:opacity-60"><CheckCircle className="h-4 w-4" /> {ocupado === s.id ? 'Aceptando…' : 'Aceptar'}</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
