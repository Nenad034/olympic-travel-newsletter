// Logotip "Olympic Travel" — isti vizuelni jezik kao Terminal Travel wordmark (Chakra Petch,
// brend narandžasta fiksna u sva tri moda), sa sopstvenim znakom: dva preklopljena prstena.

function Rings({ heightPx, className }: { heightPx: number; className?: string }) {
  return (
    <svg
      aria-hidden
      focusable="false"
      width={(heightPx * 84) / 60}
      height={heightPx}
      viewBox="0 0 84 60"
      className={`flex-shrink-0 ${className ?? ''}`}
    >
      <circle cx="26" cy="30" r="21" fill="none" stroke="var(--brand)" strokeWidth="8" />
      <circle cx="58" cy="30" r="21" fill="none" stroke="var(--brand)" strokeWidth="8" />
    </svg>
  );
}

export function BrandLogoFull({ heightPx }: { heightPx: number }) {
  return (
    <span className="flex flex-shrink-0 items-center gap-1.5">
      <Rings heightPx={heightPx} />
      <span
        className="font-brand truncate font-bold tracking-wide"
        style={{ color: 'var(--brand)', fontSize: heightPx * 0.7 }}
      >
        olympic travel
      </span>
    </span>
  );
}

export function BrandLogoShort({ heightPx }: { heightPx: number }) {
  return (
    <span className="flex flex-shrink-0 items-center">
      <Rings heightPx={heightPx} />
    </span>
  );
}
