'use client';

/**
 * PIDEN RECUPERAR SU CONTRASEÑA — lo ve quien puede aprobarlo: el docente (sus
 * estudiantes) y el administrador (todos). Al aceptar, la persona puede poner su
 * nueva contraseña desde la pantalla donde la pidió. Se acepta solo si es quien
 * dice ser (por ejemplo, lo confirmaste en clase).
 */

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge } from '@/components/ui';
import { CheckCircle, KeyRound, X } from '@/components/icons';

interface Solicitud {
  id: number; fecha: string;
  persona: { id: number; nombre: string; rol: string; ci: string | null; ru: string | null; usuario: string | null; curso: string | null };
}

function hace(f: string): string {
  const min = Math.floor((Date.now() - new Date(f).getTime()) / 60_000);
  if (min < 60) return min <= 1 ? 'hace un momento' : `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? 'hora' : 'horas'}`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

const ROL: Record<string, string> = { estudiante: 'Estudiante', docente: 'Docente', investigador: 'Investigador', admin: 'Administrador' };

/** `ocultarVacio`: si no hay solicitudes no se muestra nada (para ponerlo arriba de otra lista). */
export function Recuperaciones({ ocultarVacio = false, onCambio }: { ocultarVacio?: boolean; onCambio?: (n: number) => void }) {
  const [lista, setLista] = useState<Solicitud[] | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const cargar = useCallback(async () => {
    const r = await api.get<{ solicitudes: Solicitud[] }>('/recuperaciones').catch(() => null);
    const l = r?.solicitudes ?? [];
    setLista(l); onCambio?.(l.length);
  }, [onCambio]);
  useEffect(() => { cargar(); }, [cargar]);

  async function resolver(s: Solicitud, aceptar: boolean) {
    setOcupado(s.id); setAviso(null);
    try {
      await api.post(`/recuperaciones/${s.id}/resolver`, { aceptar, ...(aceptar ? {} : { motivo }) });
      setAviso({ ok: true, texto: aceptar ? `Aceptado: ${s.persona.nombre} ya puede poner su nueva contraseña en la pantalla donde la pidió.` : `Rechazaste la solicitud de ${s.persona.nombre}.` });
      setRechazando(null); setMotivo('');
      await cargar();
    } catch (e) { setAviso({ ok: false, texto: e instanceof ApiError ? e.message : 'No se pudo resolver.' }); }
    finally { setOcupado(null); }
  }

  if (lista === null) return null;
  if (lista.length === 0 && ocultarVacio && !aviso) return null;

  return (
    <section className="mb-6 rounded-2xl border-2 border-prexi-amber/50 bg-prexi-amber/5 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-prexi-amber/20 text-prexi-amber"><KeyRound className="h-5 w-5" /></span>
        <h2 className="font-display text-lg font-bold text-fg">Piden recuperar su contraseña</h2>
        <Badge tone={lista.length ? 'amber' : 'green'}>{lista.length}</Badge>
      </div>
      <p className="mb-4 text-sm text-muted">Olvidaron su contraseña. <b className="text-fg">Acepta solo si es quien dice ser</b> (por ejemplo, te lo pidió en clase): al aceptar, podrá crear una nueva desde la pantalla donde la pidió.</p>

      {aviso && (
        <p className={`mb-3 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-sm text-fg ${aviso.ok ? 'border-prexi-green/40 bg-prexi-green/10' : 'border-red-500/40 bg-red-500/10'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </p>
      )}

      {lista.length === 0 ? <p className="text-sm text-muted">No hay solicitudes pendientes.</p> : (
        <ul className="space-y-2">
          {lista.map((s) => (
            <li key={s.id} className="rounded-xl border border-line bg-card px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[200px] flex-1">
                  <p className="font-semibold text-fg">{s.persona.nombre} <span className="text-xs font-normal text-muted">· {ROL[s.persona.rol] ?? s.persona.rol}</span></p>
                  <p className="text-xs text-muted">
                    {s.persona.usuario && <span className="font-mono">{s.persona.usuario}</span>}
                    {s.persona.ci ? ` · CI ${s.persona.ci}` : ''}{s.persona.curso ? ` · ${s.persona.curso}` : ''} · {hace(s.fecha)}
                  </p>
                </div>
                {rechazando !== s.id && (
                  <div className="flex gap-2">
                    <button onClick={() => resolver(s, true)} disabled={ocupado === s.id} className="btn-primary !px-3.5 !py-2 text-sm"><CheckCircle className="h-4 w-4" /> Aceptar</button>
                    <button onClick={() => { setRechazando(s.id); setMotivo(''); }} disabled={ocupado === s.id} className="btn-ghost !px-3.5 !py-2 text-sm"><X className="h-4 w-4" /> Rechazar</button>
                  </div>
                )}
              </div>
              {rechazando === s.id && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional), lo verá la persona" className="input min-w-[200px] flex-1 !py-2 text-sm" />
                  <button onClick={() => resolver(s, false)} disabled={ocupado === s.id} className="btn-ghost !px-3.5 !py-2 text-sm hover:!text-prexi-red">Rechazar</button>
                  <button onClick={() => setRechazando(null)} className="text-sm text-muted hover:text-fg">Cancelar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
