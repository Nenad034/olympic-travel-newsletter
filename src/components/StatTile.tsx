import Icon from './Icon';

const TONE: Record<string, string> = {
  neutral: 'text-ink',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  accent: 'text-accent',
};

export default function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
}) {
  return (
    <div className="rounded-lg border border-border bg-panel p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {label}
        </span>
        {icon && (
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
            <Icon name={icon} className="!text-[16px]" />
          </span>
        )}
      </div>
      <div className={`mt-1 font-mono text-2xl font-semibold ${TONE[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>}
    </div>
  );
}
