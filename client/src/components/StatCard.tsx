import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'blue' | 'amber' | 'green' | 'orange';
}

const accents: Record<NonNullable<Props['accent']>, string> = {
  blue: 'bg-blue-50 text-prexi-blue',
  amber: 'bg-amber-50 text-prexi-amber',
  green: 'bg-green-50 text-prexi-green',
  orange: 'bg-orange-50 text-orange-500',
};

export function StatCard({ icon, label, value, hint, accent = 'blue' }: Props) {
  return (
    <div className="card flex items-center gap-4 !p-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${accents[accent]}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-extrabold leading-tight text-prexi-navy">{value}</p>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
