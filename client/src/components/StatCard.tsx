interface Props {
  icon: string;
  label: string;
  value: string | number;
  accent?: 'blue' | 'amber' | 'green' | 'navy';
}

const accents: Record<NonNullable<Props['accent']>, string> = {
  blue: 'bg-blue-50 text-prexi-blue',
  amber: 'bg-amber-50 text-prexi-amber',
  green: 'bg-green-50 text-prexi-green',
  navy: 'bg-slate-100 text-prexi-navy',
};

export function StatCard({ icon, label, value, accent = 'blue' }: Props) {
  return (
    <div className="card flex items-center gap-4 !p-4">
      <div className={`grid h-11 w-11 place-items-center rounded-xl text-lg ${accents[accent]}`}>{icon}</div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-prexi-navy">{value}</p>
      </div>
    </div>
  );
}
