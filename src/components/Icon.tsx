export default function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`codicon codicon-${name} ${className}`} aria-hidden="true" />;
}

/** Dve iste ikonice, blago preklopljene — "cela traka" strelice (skupi/proširi). */
export function IconDuo({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`} aria-hidden="true">
      <span className={`codicon codicon-${name}`} />
      <span className={`codicon codicon-${name} -ml-2`} />
    </span>
  );
}
