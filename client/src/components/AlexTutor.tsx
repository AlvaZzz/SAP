import { useState } from 'react';
import { api, ApiError } from '../lib/api';

interface Props {
  ejercicioId: number;
  contextoTema?: string;
  maxPistas: number;
  intentosFallidos: number;
}

/**
 * Panel del tutor ALEX. Llama solo a /api/ai/* — nunca a Gemini directamente.
 */
export function AlexTutor({ ejercicioId, contextoTema, maxPistas, intentosFallidos }: Props) {
  const [pregunta, setPregunta] = useState('');
  const [respuesta, setRespuesta] = useState<string | null>(null);
  const [pistas, setPistas] = useState<Record<number, string>>({});
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function preguntar() {
    if (!pregunta.trim()) return;
    setCargando(true);
    setError('');
    try {
      const r = await api.post<{ respuesta: string }>('/ai/asistente', {
        pregunta,
        contexto_tema: contextoTema,
      });
      setRespuesta(r.respuesta);
      setPregunta('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo contactar a ALEX');
    } finally {
      setCargando(false);
    }
  }

  async function pedirPista(nivel: 1 | 2 | 3) {
    setCargando(true);
    setError('');
    try {
      const r = await api.post<{ pista: string }>('/ai/pista', {
        ejercicio_id: ejercicioId,
        intentos_fallidos: intentosFallidos,
        nivel_pista: nivel,
      });
      setPistas((p) => ({ ...p, [nivel]: r.pista }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo obtener la pista');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="card bg-prexi-navy text-white">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-prexi-blue text-lg">🤖</div>
        <div>
          <p className="font-bold leading-tight">ALEX IA</p>
          <p className="text-xs text-blue-200">Tutor Inteligente</p>
        </div>
      </div>

      <div className="mb-4 rounded-xl bg-white/10 p-3 text-sm leading-relaxed">
        {respuesta ?? '¡Hola! Soy ALEX. Pregúntame sobre el concepto del ejercicio o pídeme una pista. No te daré la respuesta, pero te guiaré. 💡'}
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-500/20 px-3 py-2 text-xs text-red-100">{error}</p>}

      {/* Preguntar */}
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white placeholder:text-blue-200 outline-none focus:bg-white/20"
          placeholder="Escribe tu duda…"
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && preguntar()}
        />
        <button onClick={preguntar} disabled={cargando} className="rounded-lg bg-prexi-blue px-3 text-sm font-semibold disabled:opacity-50">
          ➤
        </button>
      </div>

      {/* Pistas escalonadas */}
      <p className="mb-2 text-xs font-semibold uppercase text-blue-300">Pistas</p>
      <div className="space-y-2">
        {([1, 2, 3] as const).map((nivel) => {
          const bloqueada = nivel > maxPistas;
          return (
            <div key={nivel} className="rounded-xl bg-white/5">
              <button
                disabled={bloqueada || cargando}
                onClick={() => pedirPista(nivel)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm disabled:opacity-40"
              >
                <span>
                  {bloqueada ? '🔒' : '💡'} Pista {nivel}
                  <span className="ml-1 text-xs text-blue-200">
                    {nivel === 1 ? '· Concepto' : nivel === 2 ? '· Dónde falla' : '· Casi-solución'}
                  </span>
                </span>
                <span className="text-blue-200">{pistas[nivel] ? '−' : '+'}</span>
              </button>
              {pistas[nivel] && <p className="px-3 pb-3 text-sm text-blue-50">{pistas[nivel]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
