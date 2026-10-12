'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card } from '@/components/ui';
import { CuestionarioInstrumento } from '@/components/cuestionario-instrumento';

/**
 * Evaluación del sistema desde el rol docente:
 *  · habilita o cierra la FASE DE EVALUACIÓN (los estudiantes responden el SUS);
 *  · el docente responde el cuestionario de calidad ISO/IEC 25010.
 */
export default function DocenteEvaluarPrexiPage() {
  const [activa, setActiva] = useState<boolean | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [error, setError] = useState('');
  // Fuerza a recargar el cuestionario cuando cambia la fase.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    api.get<{ fase_activa: boolean }>('/instrumentos/estado').then((r) => setActiva(r.fase_activa)).catch(() => undefined);
  }, []);

  async function alternar() {
    if (activa === null) return;
    const nueva = !activa;
    const pregunta = nueva
      ? '¿Habilitar la evaluación del sistema? A los estudiantes les aparecerá el cuestionario de usabilidad (SUS) en su inicio.'
      : '¿Cerrar la evaluación del sistema? Nadie más podrá responder los cuestionarios.';
    if (!confirm(pregunta)) return;
    setAplicando(true); setError('');
    try {
      const r = await api.post<{ fase_activa: boolean }>('/instrumentos/fase', { activa: nueva });
      setActiva(r.fase_activa);
      setVersion((v) => v + 1);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'No se pudo actualizar.'); }
    finally { setAplicando(false); }
  }

  return (
    <div>
      <Card className="mx-auto mb-6 flex max-w-3xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-fg">Fase de evaluación del sistema</p>
          <p className="text-sm text-muted">
            {activa === null ? 'Cargando…' : activa
              ? 'Habilitada: los estudiantes ven el cuestionario de usabilidad en su inicio.'
              : 'Cerrada. Habilítala al final del período de uso; cada persona responde una sola vez.'}
          </p>
          {error && <p className="mt-1 text-sm text-prexi-red">{error}</p>}
        </div>
        <button onClick={alternar} disabled={activa === null || aplicando} className={activa ? 'btn-ghost' : 'btn-primary'}>
          {aplicando ? 'Aplicando…' : activa ? 'Cerrar evaluación' : 'Habilitar evaluación'}
        </button>
      </Card>

      <CuestionarioInstrumento key={version} clave="ISO25010" volver="/docente/dashboard" />
    </div>
  );
}
