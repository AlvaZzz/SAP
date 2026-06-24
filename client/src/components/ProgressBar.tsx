interface Props {
  value: number; // 0-100
  color?: string;
}

export function ProgressBar({ value, color = '#2563eb' }: Props) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
      />
    </div>
  );
}
