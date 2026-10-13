'use client';

/**
 * Cuestionario de valoración del sistema (SUS para estudiantes, ISO/IEC 25010
 * para docentes y evaluadores). El backend decide qué ítems mostrar, valida que
 * la fase de evaluación esté habilitada y que solo se responda una vez.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, ProgressBar, Skeleton } from '@/components/ui';
import { CheckCircle, Lock, ClipboardList } from '@/components/icons';

interface Cuestionario {
  clave: string; titulo: string; descripcion: string; minutos: number;
  fase_activa: boolean; respondido: boolean; provisional: boolean;
  escala: { min: number; max: number; anclajes: { valor: number; etiqueta: string }[] };
  consentimiento: string;
  items: { id: string; texto: string; seccion: string | null }[];
}

export function CuestionarioInstrumento({ clave, volver }: { clave: 'SUS' | 'ISO25010'; volver: string }) {
  const [q, setQ] = useState<Cuestionario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [valores, setValores] = useState<Record<string, number>>({});
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Cuestionario>(`/instrumentos/${clave}`)
      .then(setQ)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el cuestionario.'))
      .finally(() => setCargando(false));
  }, [clave]);

  const respondidas = q ? q.items.filter((i) => valores[i.id] != null).length : 0;
  const completo = !!q && respondidas === q.items.length;

  // Agrupa los ítems por sección (característica), conservando el orden.
  const secciones = useMemo(() => {
    const out: { titulo: string | null; items: Cuestionario['items'] }[] = [];
    for (const item of q?.items ?? []) {
      const ultima = out[out.length - 1];
      if (ultima && ultima.titulo === item.seccion) ultima.items.push(item);
      else out.push({ titulo: item.seccion, items: [item] });
    }
    return out;
  }, [q]);

  async function enviar() {
    if (!q || !completo || !acepta) return;
    setEnviando(true); setError('');
    try {
      await api.post(`/instrumentos/${clave}`, {
        respuestas: q.items.map((i) => ({ itemId: i.id, valor: valores[i.id] })),
        aceptaConsentimiento: true,
      });
      setEnviado(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudieron guardar tus respuestas.');
    } finally { setEnviando(false); }
  }

  if (cargando) return <div className="space-y-4"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
  if (!q) return <Aviso icono={<Lock className="h-7 w-7" />} titulo="Cuestionario no disponible" texto={error || 'No se pudo cargar.'} volver={volver} />;

  if (enviado || q.respondido) {
    return (
      <Aviso
        icono={<CheckCircle className="h-7 w-7 text-prexi-green" />}
        titulo="¡Gracias por evaluar PREXI!"
        texto="Tus respuestas quedaron registradas. Este cuestionario solo se responde una vez."
        volver={volver}
      />
    );
  }
  if (!q.fase_activa) {
    return (
      <Aviso
        icono={<Lock className="h-7 w-7" />}
        titulo="La evaluación del sistema aún no está habilitada"
        texto="Se habilita al final del período de uso. Cuando esté disponible verás un aviso en tu pantalla de inicio."
        volver={volver}
      />
    );
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <PageHeader title={q.titulo} subtitle={`${q.descripcion} Te tomará unos ${q.minutos} minutos.`} />

      {q.provisional && (
        <p className="mb-4 rounded-xl border border-prexi-amber/40 bg-prexi-amber/10 px-4 py-3 text-sm text-fg">
          Versión de trabajo del cuestionario: los enunciados aún no fueron validados por juicio de expertos.
        </p>
      )}

      <Card className="mb-5">
        <p className="mb-2 text-sm font-semibold text-fg">Indica qué tan de acuerdo estás con cada afirmación</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {q.escala.anclajes.map((a) => <span key={a.valor}><b className="text-fg">{a.valor}</b> = {a.etiqueta}</span>)}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted"><span>Avance</span><span>{respondidas}/{q.items.length}</span></div>
          <ProgressBar value={q.items.length ? (respondidas / q.items.length) * 100 : 0} tone="blue" />
        </div>
      </Card>

      {secciones.map((s, si) => (
        <div key={s.titulo ?? si} className="mb-5">
          {s.titulo && <h2 className="mb-2 font-display text-lg font-bold text-fg">{s.titulo}</h2>}
          <div className="space-y-3">
            {s.items.map((item) => {
              const numero = q.items.indexOf(item) + 1;
              return (
                <Card key={item.id}>
                  <fieldset>
                    <legend className="mb-3 text-base font-medium leading-snug text-fg">
                      <span className="mr-1.5 text-muted">{numero}.</span>{item.texto}
                    </legend>
                    <div className="flex items-center justify-between gap-2">
                      <span className="hidden text-xs text-muted sm:block">En desacuerdo</span>
                      <div className="flex flex-1 justify-between gap-2 sm:flex-none sm:justify-center">
                        {q.escala.anclajes.map((a) => {
                          const activo = valores[item.id] === a.valor;
                          return (
                            <label key={a.valor} title={a.etiqueta}
                              className={`grid h-11 w-11 cursor-pointer place-items-center rounded-xl border text-sm font-bold transition focus-within:ring-2 focus-within:ring-prexi-blue ${activo
                                ? 'border-prexi-blue bg-prexi-blue text-accent-on'
                                : 'border-line bg-card text-fg hover:border-prexi-blue/50'}`}>
                              <input type="radio" name={item.id} value={a.valor} checked={activo}
                                onChange={() => setValores((v) => ({ ...v, [item.id]: a.valor }))}
                                className="sr-only" aria-label={`${a.valor}: ${a.etiqueta}`} />
                              {a.valor}
                            </label>
                          );
                        })}
                      </div>
                      <span className="hidden text-xs text-muted sm:block">De acuerdo</span>
                    </div>
                  </fieldset>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      <Card>
        <label className="flex cursor-pointer select-none items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" checked={acepta} onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line accent-prexi-blue" />
          <span>{q.consentimiento}</span>
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red">{error}</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {!completo ? `Te faltan ${q.items.length - respondidas} afirmación(es).` : !acepta ? 'Marca la casilla para poder enviar.' : 'Listo para enviar.'}
          </p>
          <button onClick={enviar} disabled={!completo || !acepta || enviando} className="btn-primary disabled:opacity-50">
            <ClipboardList className="h-4 w-4" /> {enviando ? 'Enviando…' : 'Enviar respuestas'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Aviso({ icono, titulo, texto, volver }: { icono: React.ReactNode; titulo: string; texto: string; volver: string }) {
  return (
    <Card className="mx-auto max-w-xl text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-subtle text-muted">{icono}</div>
      <h1 className="font-display text-xl font-bold text-fg">{titulo}</h1>
      <p className="mt-1 text-sm text-muted">{texto}</p>
      <Link href={volver} className="btn-primary mt-5 inline-flex">Volver</Link>
    </Card>
  );
}

/**
 * Tarjeta "Evalúa PREXI": aparece solo cuando la fase de evaluación está
 * habilitada y al usuario le queda un cuestionario por responder. No bloquea
 * nada: es una invitación.
 */
export function TarjetaEvaluarPrexi({ href }: { href: string }) {
  const [info, setInfo] = useState<{ minutos: number } | null>(null);

  useEffect(() => {
    api.get<{ pendientes: number; instrumentos: { respondido: boolean; minutos: number }[] }>('/instrumentos/estado')
      .then((r) => {
        const pendiente = r.instrumentos.find((i) => !i.respondido);
        setInfo(r.pendientes > 0 && pendiente ? { minutos: pendiente.minutos } : null);
      })
      .catch(() => undefined);
  }, []);

  if (!info) return null;
  return (
    <div className="mb-6 flex flex-col items-start gap-4 rounded-2xl border border-prexi-blue/30 bg-prexi-blue/10 p-5 sm:flex-row sm:items-center">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-prexi-blue text-accent-on"><ClipboardList className="h-6 w-6" /></div>
      <div className="flex-1">
        <h2 className="font-display text-lg font-bold text-fg">Evalúa PREXI ({info.minutos} min)</h2>
        <p className="text-sm text-muted">Tu opinión ayuda a validar el sistema. Es anónima, voluntaria y no afecta ninguna nota.</p>
      </div>
      <Link href={href} className="btn-primary shrink-0">Responder</Link>
    </div>
  );
}
