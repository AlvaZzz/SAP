import { Sparkles } from './icons';

export function Placeholder({ titulo }: { titulo: string }) {
  return (
    <div className="animate-fade-up">
      <h1 className="mb-5 font-display text-3xl font-extrabold tracking-tight text-fg">{titulo}</h1>
      <div className="card flex items-center gap-4">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-prexi-blue/10 text-prexi-blue-deep"><Sparkles className="h-7 w-7" /></div>
        <div>
          <p className="font-semibold text-fg">En construcción</p>
          <p className="text-sm text-muted">Esta vista se conecta a su endpoint en el siguiente sub-bloque. El backend ya está listo.</p>
        </div>
      </div>
    </div>
  );
}
