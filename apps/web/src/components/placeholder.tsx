import { Sparkles } from './icons';

export function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <h1 className="mb-4 text-2xl font-extrabold text-prexi-navy">{titulo}</h1>
      <div className="card flex items-center gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-prexi-blue"><Sparkles className="h-6 w-6" /></div>
        <div>
          <p className="font-semibold text-prexi-navy">En construcción</p>
          <p className="text-sm text-slate-500">Esta vista se conecta a su endpoint en el siguiente sub-bloque. El backend ya está listo.</p>
        </div>
      </div>
    </div>
  );
}
