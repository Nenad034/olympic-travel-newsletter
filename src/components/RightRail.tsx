'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';
import ThemeToggle from './ThemeToggle';
import { useTabs } from './TabsContext';

// Desna vertikalna traka — ogledalo ActivityBar-a: tema, "čeka odobrenje" inbox, desni panel.
export default function RightRail({
  rightPanelOpen,
  onToggleRightPanel,
  agentOpen,
  onToggleAgent,
}: {
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  agentOpen: boolean;
  onToggleAgent: () => void;
}) {
  const { openTab } = useTabs();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/summary', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { pendingApproval: number };
        setPending(body.pendingApproval);
      } catch {
        /* prazno */
      }
    }
    poll();
    const t = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <nav className="flex w-[43px] flex-shrink-0 flex-col items-center gap-1 bg-panel-2 py-1">
      <ThemeToggle />
      <button
        onClick={() => openTab('/kampanje?status=PENDING_APPROVAL', 'Čeka odobrenje')}
        title="Kampanje koje čekaju odobrenje (human-approval gate)"
        className="relative flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md bg-panel text-ink-faint hover:bg-panel2 hover:text-ink"
      >
        <Icon name="inbox" />
        {pending !== null && pending > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[11px] font-semibold leading-none text-accent-ink">
            {pending > 99 ? '99+' : pending}
          </span>
        )}
      </button>
      <button
        onClick={onToggleRightPanel}
        title="Desni panel — sažetak i pomoć"
        className={`flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md ${
          rightPanelOpen
            ? 'bg-accent-soft text-accent-strong'
            : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'
        }`}
      >
        <Icon name={rightPanelOpen ? 'layout-sidebar-right' : 'layout-sidebar-right-off'} />
      </button>
      <button
        onClick={() => openTab('/kampanje/nova', 'Nova kampanja')}
        title="Nova kampanja (agent priprema, čovek odobrava)"
        className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md bg-panel text-ink-faint hover:bg-panel2 hover:text-ink"
      >
        <Icon name="add" />
      </button>
      <div className="relative mt-auto flex-shrink-0">
        <button
          onClick={onToggleAgent}
          title="Agent — pitaj o stanju baze, kampanja i isporuke (ne izvršava radnje)"
          className={`flex h-[36px] w-[36px] items-center justify-center rounded-md ${
            agentOpen
              ? 'bg-accent-soft text-accent-strong'
              : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'
          }`}
        >
          <Icon name="sparkle" />
        </button>
      </div>
    </nav>
  );
}
