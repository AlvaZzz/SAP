import { GraduationCap } from './icons';

/** Panel de marca lateral para login/registro. */
export function Marca() {
  return (
    <div className="hidden flex-col justify-between bg-gradient-to-br from-prexi-navy to-prexi-blue p-12 text-white md:flex">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><GraduationCap className="h-7 w-7" /></div>
        <div>
          <h1 className="text-3xl font-extrabold leading-none">PREXI</h1>
          <p className="text-blue-200">UPEA · Ingeniería de Sistemas</p>
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-3xl font-bold leading-snug">Aprende Python con un tutor de IA y gamificación.</h2>
        <p className="text-blue-100">
          Sistema adaptativo que mide tu nivel, ajusta los retos y te guía con ALEX mientras
          acumulas XP, rachas e insignias.
        </p>
      </div>
      <p className="text-xs text-blue-300">© {new Date().getFullYear()} PREXI · UPEA</p>
    </div>
  );
}
