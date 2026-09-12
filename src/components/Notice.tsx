import Icon from './Icon';

const STYLE: Record<string, { cls: string; icon: string }> = {
  info: { cls: 'bg-accent-soft text-ink border-border', icon: 'info' },
  ok: { cls: 'bg-ok-bg text-ok border-border', icon: 'check' },
  warn: { cls: 'bg-warn-bg text-warn border-border', icon: 'warning' },
  danger: { cls: 'bg-danger-bg text-danger border-border', icon: 'error' },
};

export default function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: 'info' | 'ok' | 'warn' | 'danger';
  children: React.ReactNode;
  className?: string;
}) {
  const s = STYLE[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${s.cls} ${className}`}>
      <Icon name={s.icon} className="!text-[16px]" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
