'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Target, CheckCircle, ArrowRight, Code } from '@/components/icons';

interface Reto { id: number; titulo: string; categoria: string; estrellas: number; enunciado: string; xp: number; autor: string; fecha: string; estado: 'nuevo' | 'resuelto' }

export default function RetosPage() {
  const router = useRouter();
  const [retos, setRetos] = useState<Reto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api.get<{ retos: Reto[] }>('/retos').then((r) => setRetos(r.retos)).catch(() => undefined).finally(() => setCargando(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <h1 className="text-2xl font-extrabold text-prexi-navy">Retos del docente</h1>
      <p className="mb-5 text-slate-500">Desafíos extra publicados por tus docentes. Resuélvelos en la Zona de Práctica.</p>

      {cargando ? <div className="grid gap-4 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</div> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {retos.map((r) => (
            <div key={r.id} className="card card-hover flex flex-col">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-prexi-blue"><Code className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-prexi-blue">{r.categoria}</p>
                    <h3 className="font-bold text-prexi-navy">{r.titulo}</h3>
                  </div>
                </div>
                {r.estado === 'resuelto'
                  ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase text-prexi-green"><CheckCircle className="h-3 w-3" /> Resuelto</span>
                  : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-prexi-amber">Nuevo</span>}
              </div>
              <p className="mb-3 flex-1 text-sm text-slate-600 line-clamp-3">{r.enunciado}</p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400"><span className="text-prexi-amber">{'★'.repeat(r.estrellas)}</span> · +{r.xp} XP · {r.autor}</div>
                <button onClick={() => router.push(`/practica?reto=${r.id}`)} className="btn-primary !py-1.5 !px-3 text-sm">Resolver <ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
          {retos.length === 0 && <div className="card col-span-full flex items-center gap-3 text-slate-400"><Target className="h-5 w-5" /> Aún no hay retos publicados.</div>}
        </div>
      )}
    </div>
  );
}
