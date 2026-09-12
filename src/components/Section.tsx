import Icon from './Icon';

/** Kartica sekcije: "utonula" traka naslova (tamnija) + svetliji sadržaj ispod. */
export default function Section({
  title,
  icon,
  actions,
  children,
  className = '',
  bodyClassName = '',
}: {
  title: string;
  icon?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-border bg-panel ${className}`}>
      <div className="section-head">
        {icon && <Icon name={icon} className="!text-[16px]" />}
        <span className="flex-1 truncate">{title}</span>
        {actions}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
