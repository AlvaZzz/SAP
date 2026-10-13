import { GraduationCap } from '@/components/icons';

/**
 * Logo PREXI: birrete (acento) + wordmark "PREXI" con la "XI" en naranja.
 * `subtitle` muestra "PLATAFORMA ADAPTATIVA CON IA".
 */
export function PrexiLogo({ subtitle = false, className = '' }: { subtitle?: boolean; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-prexi-blue text-accent-on shadow-glow">
        <GraduationCap className="h-6 w-6" />
      </div>
      <div className="min-w-0 leading-none">
        <p className="font-display text-2xl font-extrabold tracking-tight text-fg">
          PRE<span className="bg-gradient-to-r from-[#F97316] to-[#FB923C] bg-clip-text text-transparent">XI</span>
        </p>
        {subtitle && <p className="mt-1 text-2xs font-bold uppercase tracking-[0.18em] text-muted">Plataforma adaptativa con IA</p>}
      </div>
    </div>
  );
}
