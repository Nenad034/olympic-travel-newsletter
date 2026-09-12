// Formatiranje datuma/vremena za srpski interni tim (klijent + server bezbedno).

const TZ = 'Europe/Belgrade';

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('sr-RS', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('sr-RS', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('sr-RS', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

/** Relativno: "pre 3 dana", "za 2 sata". */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const min = Math.round(abs / 60000);
  const h = Math.round(abs / 3600000);
  const d = Math.round(abs / 86400000);
  let s: string;
  if (min < 1) s = 'upravo';
  else if (min < 60) s = `${min} min`;
  else if (h < 48) s = `${h} h`;
  else s = `${d} dana`;
  if (s === 'upravo') return s;
  return diff < 0 ? `pre ${s}` : `za ${s}`;
}

/** Vrednost za <input type="datetime-local"> u lokalnoj zoni. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function pct(part: number, total: number): string {
  if (!total) return '—';
  return `${Math.round((part / total) * 1000) / 10}%`;
}
