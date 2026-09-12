'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';
import { NAV_ITEMS } from '@/lib/nav';

interface CampaignHit {
  id: string;
  name: string;
  status: string;
}

// "Traži ili izvrši" (Ctrl+T) — sekcije modula + kampanje po nazivu.
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignHit[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openTab } = useTabs();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    setTimeout(() => inputRef.current?.focus(), 0);
    fetch('/api/campaigns', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: CampaignHit[]) => setCampaigns(list))
      .catch(() => setCampaigns([]));
  }, [open]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const nav = NAV_ITEMS.filter(
      (i) => !needle || i.label.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle),
    ).map((i) => ({ key: `nav-${i.id}`, label: i.label, sub: i.description, icon: i.icon, href: i.href }));
    const cmp = (needle ? campaigns.filter((c) => c.name.toLowerCase().includes(needle)) : campaigns.slice(0, 5)).map(
      (c) => ({ key: `cmp-${c.id}`, label: c.name, sub: `kampanja · ${c.status}`, icon: 'mail', href: `/kampanje/${c.id}` }),
    );
    return [...nav, ...cmp].slice(0, 12);
  }, [q, campaigns]);

  if (!open) return null;

  function go(i: number) {
    const r = results[i];
    if (!r) return;
    openTab(r.href, r.label);
    setOpen(false);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 pt-[12vh]" onClick={() => setOpen(false)}>
      <div
        className="w-[560px] max-w-[92vw] animate-scale-in overflow-hidden rounded-lg border border-border bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="text-ink-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, results.length - 1));
              if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
              if (e.key === 'Enter') go(idx);
            }}
            placeholder="Sekcija, kampanja…"
            className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-border px-1 text-[10px] text-ink-faint">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-faint">Nema rezultata.</li>}
          {results.map((r, i) => (
            <li key={r.key}>
              <button
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-xs ${
                  i === idx ? 'bg-accent-soft text-ink' : 'text-ink-dim hover:bg-panel-2'
                }`}
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
                  <Icon name={r.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label}</span>
                  <span className="block truncate text-[10px] text-ink-faint">{r.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
