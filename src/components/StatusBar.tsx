'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

interface Health {
  listmonk: { mode: 'LIVE' | 'MOCK'; ok: boolean };
  claude: boolean;
  pendingApproval: number;
  scheduled: number;
}

// Donja traka: nalog, status motora (Listmonk) i Claude API, "traži ili izvrši" na sredini,
// sat i okruženje desno — ista visina (43px) kao gornja traka.
export default function StatusBar({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [down, setDown] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/summary', { cache: 'no-store' });
        if (cancelled) return;
        if (!res.ok) {
          setDown(true);
          return;
        }
        setHealth((await res.json()) as Health);
        setDown(false);
      } catch {
        if (!cancelled) setDown(true);
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const tz =
    now?.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) ??
    '';
  const env = process.env.NODE_ENV === 'production' ? 'PRODUKCIJA' : 'TEST';
  const motorOk = health ? health.listmonk.ok : !down;

  return (
    <footer className="relative flex h-[43px] flex-shrink-0 items-center gap-3 bg-bar px-2 text-[11px] text-ink-faint">
      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', ctrlKey: true }))}
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-border bg-panel-2 px-2 py-1 font-mono text-ink-faint hover:border-accent hover:text-ink"
      >
        <Icon name="search" />
        traži ili izvrši
        <kbd className="rounded border border-border bg-panel px-1 text-[11px]">Ctrl T</kbd>
      </button>
      <span title={roleLabel}>
        {fullName} <span className="text-ink-faint">· {roleLabel}</span>
      </span>
      <span className="flex items-center gap-1" title="Listmonk motor">
        <span
          className={`h-1.5 w-1.5 rounded-full ${down ? 'bg-danger' : motorOk ? 'bg-ok' : 'bg-warn'}`}
        />
        {down
          ? 'Nema veze'
          : health
            ? `Listmonk: ${health.listmonk.mode === 'LIVE' ? 'povezan' : 'mock'}`
            : 'Provera...'}
      </span>
      {health && (
        <span className="flex items-center gap-1" title="Claude API — punjenje šablona">
          <span className={`h-1.5 w-1.5 rounded-full ${health.claude ? 'bg-ok' : 'bg-warn'}`} />
          {health.claude ? 'Claude API: aktivan' : 'Claude API: lokalni popunjivač'}
        </span>
      )}
      <span className="flex-1" />
      {health && (
        <span title="Zakazane kampanje / čeka odobrenje">
          zakazano {health.scheduled} · na odobrenju {health.pendingApproval}
        </span>
      )}
      {tz && <span title="Vreme na ovom računaru">{tz}</span>}
      <span
        className="rounded border border-border px-1 font-mono text-[11px]"
        title="Okruženje na koje je ovaj panel povezan"
      >
        {env}
      </span>
    </footer>
  );
}
