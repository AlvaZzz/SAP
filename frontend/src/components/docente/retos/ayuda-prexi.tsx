'use client';

import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { NivelDificultad, NIVEL_LABEL } from '@/lib/types';
import { Field, Input } from '@/components/ui';
import { Bot, Sparkles, Check, AlertTriangle } from '@/components/icons';
import { TIPOS_RETO, TipoReto } from './tipos';

export interface RetoPropuesto {
  titulo: string; enunciado: string; codigoInicial: string; ejemploEntrada: string; ejemploSalida: string;
  codigoCorregido: string; dondeEstaElBug: string;
}

/**
 * PREXI propone ideas de reto para el tema, el tipo y el nivel ya elegidos.
 * Elegir una solo RELLENA el formulario: el docente la revisa y la guarda él.
 */
export function AyudaPrexi({ tipo, temaId, temaNombre, nivel, hayContenido, onUsar }: {
  tipo: TipoReto; temaId: number; temaNombre: string; nivel: NivelDificultad;
  hayContenido: boolean; onUsar: (p: RetoPropuesto) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [indicacion, setIndicacion] = useState('');
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState('');
  const [propuestas, setPropuestas] = useState<RetoPropuesto[]>([]);
  const [usada, setUsada] = useState<number | null>(null);
  const esBug = tipo === 'bug';

  async function pedir() {
    setPidiendo(true); setError(''); setUsada(null);
    try {
      const r = await api.post<{ propuestas: RetoPropuesto[] }>('/docente/retos/sugerir', { tipo, temaId, nivel, indicacion: indicacion.trim() || undefined });
      setPropuestas(r.propuestas);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'PREXI no pudo proponer retos. Intenta de nuevo.'); }
    finally { setPidiendo(false); }
  }

  function usar(p: RetoPropuesto, i: number) {
    if (hayContenido && !confirm('Esto reemplaza lo que ya escribiste en el formulario. ¿Continuar?')) return;
    onUsar(p); setUsada(i);
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="mb-5 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-prexi-blue/50 bg-prexi-blue/5 p-4 text-left transition hover:bg-prexi-blue/10">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue/15 text-prexi-blue-deep"><Bot className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-fg">¿No sabes por dónde empezar? Pídele ideas a PREXI</span>
          <span className="block text-sm text-muted">Te propone 3 retos de «{TIPOS_RETO[tipo].nombre}» para {temaNombre}, nivel {NIVEL_LABEL[nivel]}. Eliges uno y lo ajustas a tu gusto.</span>
        </span>
        <Sparkles className="h-5 w-5 shrink-0 text-prexi-blue-deep" />
      </button>
    );
  }

  return (
    <div className="mb-5 rounded-2xl border border-prexi-blue/40 bg-prexi-blue/5 p-4">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-prexi-blue-deep" />
        <p className="text-sm text-fg">PREXI propone <b>3 retos de «{TIPOS_RETO[tipo].nombre}»</b> para <b>{temaNombre}</b>, nivel <b>{NIVEL_LABEL[nivel]}</b>, según la unidad a la que pertenece ese tema.</p>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] flex-1">
          <Field label="¿Alguna idea en particular? (opcional)" hint="Ej.: «que trate sobre notas de un curso» o «con precios de un mercado».">
            <Input value={indicacion} onChange={(e) => setIndicacion(e.target.value)} maxLength={400} placeholder="Déjalo vacío y PREXI elige el contexto" />
          </Field>
        </div>
        <button type="button" onClick={pedir} disabled={pidiendo} className="btn-primary disabled:opacity-60">
          <Sparkles className="h-4 w-4" /> {pidiendo ? 'PREXI está pensando…' : propuestas.length ? 'Pedir otras 3 ideas' : 'Pedir 3 ideas'}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="btn-ghost">Cerrar</button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-prexi-red" role="alert">{error}</p>}

      {propuestas.length > 0 && (
        <>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-prexi-amber/10 px-3 py-2 text-xs text-fg">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-prexi-amber" />
            <span>PREXI puede equivocarse. {esBug ? 'Antes de publicar, comprueba que la «salida correcta» sea de verdad la que imprime el código corregido: con ella se califica a los estudiantes.' : 'Revisa que el problema y su ejemplo sean correctos antes de publicar.'}</span>
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {propuestas.map((p, i) => (
              <div key={`${p.titulo}-${i}`} className={`flex flex-col rounded-xl border bg-card p-3 ${usada === i ? 'border-prexi-green' : 'border-line'}`}>
                <p className="font-bold text-fg">{p.titulo}</p>
                <p className="mt-1 text-sm text-muted">{p.enunciado}</p>
                {p.codigoInicial && <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-subtle p-2 font-mono text-xs text-fg">{p.codigoInicial}</pre>}
                {p.ejemploEntrada && <p className="mt-2 text-xs text-muted">Entrada: <code className="font-mono text-fg">{p.ejemploEntrada}</code></p>}
                {p.ejemploSalida && <p className="mt-1 text-xs text-muted">Salida {esBug ? 'correcta' : 'esperada'}: <code className="font-mono font-semibold text-prexi-green">{p.ejemploSalida}</code></p>}
                {(p.dondeEstaElBug || p.codigoCorregido) && (
                  <details className="mt-2 text-xs">
                    <summary className="cursor-pointer font-semibold text-prexi-blue-deep">{esBug ? 'Ver dónde está el error (solo tú lo ves)' : 'Ver una solución (solo tú la ves)'}</summary>
                    {p.dondeEstaElBug && <p className="mt-1 text-fg">{p.dondeEstaElBug}</p>}
                    {p.codigoCorregido && <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-subtle p-2 font-mono text-fg">{p.codigoCorregido}</pre>}
                  </details>
                )}
                <button type="button" onClick={() => usar(p, i)} className={`${usada === i ? 'btn-ghost' : 'btn-primary'} mt-3 w-full justify-center !py-2 text-sm`}>
                  {usada === i ? <><Check className="h-4 w-4" /> Copiada al formulario</> : 'Usar esta idea'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
