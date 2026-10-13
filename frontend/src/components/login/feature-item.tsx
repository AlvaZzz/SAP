import type { ComponentType } from 'react';

/** Un beneficio del hero: ícono en cuadrado con glow + título + descripción. */
export function FeatureItem({ icon: Icon, title, desc, glow }: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  /** Color del glow/ícono (acento del beneficio). */
  glow: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-line lg:h-[54px] lg:w-[54px] lg:rounded-2xl"
        style={{ color: glow, backgroundColor: `${glow}1F`, boxShadow: `0 6px 22px -8px ${glow}80` }}
      >
        <Icon className="h-[22px] w-[22px] lg:h-7 lg:w-7" />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold text-fg lg:text-base">{title}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted lg:mt-1 lg:text-sm">{desc}</p>
      </div>
    </div>
  );
}
