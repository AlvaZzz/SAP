import { useEffect, useState } from 'react';
import { api, tokenStore } from '../lib/api';

interface Estudiante {
  usuario_id: number;
  nombre: string;
  email: string;
  xp_total: number;
  racha_dias: number;
  posicion: number | null;
  ejercicios_completados: number;
  intentos_totales: number;
  precision_pct: number | null;
}

/** Descarga un archivo protegido enviando el token y forzando la descarga. */
async function descargar(path: string, nombre: string) {
  const res = await fetch(`/api${path}`, {
    headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` },
  });
  if (!res.ok) {
    alert('No se pudo generar el archivo');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherPage() {
  const [filas, setFilas] = useState<Estudiante[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ estudiantes: Estudiante[] }>('/reportes/estudiantes')
      .then((r) => setFilas(r.estudiantes))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-prexi-navy">Reportes de desempeño</h1>
          <p className="text-slate-500">Vista docente: progreso agregado por estudiante.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => descargar('/reportes/estudiantes/export/excel', 'prexi_estudiantes.xlsx')} className="btn-ghost">
            ⬇ Excel
          </button>
          <button onClick={() => descargar('/reportes/estudiantes/export/pdf', 'prexi_estudiantes.pdf')} className="btn-primary">
            ⬇ PDF
          </button>
        </div>
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="px-4 py-3">Estudiante</th>
              <th className="px-4 py-3">XP</th>
              <th className="px-4 py-3">Racha</th>
              <th className="px-4 py-3">Pos.</th>
              <th className="px-4 py-3">Completados</th>
              <th className="px-4 py-3">Intentos</th>
              <th className="px-4 py-3">Precisión</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.usuario_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{f.nombre}</p>
                  <p className="text-xs text-slate-400">{f.email}</p>
                </td>
                <td className="px-4 py-3 font-semibold text-prexi-blue">{f.xp_total}</td>
                <td className="px-4 py-3">🔥 {f.racha_dias}</td>
                <td className="px-4 py-3">{f.posicion ? `#${f.posicion}` : '—'}</td>
                <td className="px-4 py-3">{f.ejercicios_completados}</td>
                <td className="px-4 py-3">{f.intentos_totales}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      (f.precision_pct ?? 0) >= 70 ? 'bg-green-100 text-prexi-green' : 'bg-amber-100 text-prexi-amber'
                    }`}
                  >
                    {f.precision_pct != null ? `${f.precision_pct}%` : '—'}
                  </span>
                </td>
              </tr>
            ))}
            {filas.length === 0 && !error && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Sin datos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
