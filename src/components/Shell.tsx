'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import ActivityBar from './ActivityBar';
import RightRail from './RightRail';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import CommandPalette from './CommandPalette';
import { TabsProvider } from './TabsContext';
import { InspectorProvider, type InspectTarget } from './InspectorContext';
import { AiContextProvider } from './AiContextContext';
import AiAgentBox from './AiAgentBox';
import { NAV_GROUPS, groupForPath } from '@/lib/nav';

const SIDEBAR_COLLAPSED_KEY = 'ot-newsletter-sidebar-collapsed';
const SIDEBAR_WIDTH_KEY = 'ot-newsletter-sidebar-width';
const RIGHT_OPEN_KEY = 'ot-newsletter-right-open';
const RIGHT_WIDTH_KEY = 'ot-newsletter-right-width';
const DEFAULT_SIDEBAR_WIDTH = 224;
const MIN_W = 180;
const MAX_W = 420;
const DEFAULT_RIGHT_WIDTH = 300;
// Desni panel nosi brze info o zapisu (duže vrednosti, dnevnik izmena), pa ide šire od leve
// trake; gornja granica je da centralni panel — glavni radni prostor — ostane čitljiv.
const MIN_RIGHT_W = 240;
const MAX_RIGHT_W = 560;

// Raspored (VS Code obrazac, preuzet iz Terminal Travel panela):
//   [TopBar: logo | tabovi]
//   [ActivityBar][Sidebar (prevlačiva)][main][RightPanel][RightRail]
//   [StatusBar]
// Koren `h-screen overflow-hidden` — SVE skrolovanje je unutar <main> i bočnih panela.
export default function Shell({
  fullName,
  roleLabel,
  children,
  sidebarSummary,
}: {
  fullName: string;
  roleLabel: string;
  children: React.ReactNode;
  sidebarSummary?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
  const [activeGroupId, setActiveGroupId] = useState(() => groupForPath(pathname).id);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [leftColumnWidth, setLeftColumnWidth] = useState(43 + DEFAULT_SIDEBAR_WIDTH);
  const leftColRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
      const w = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (w >= MIN_W && w <= MAX_W) setWidth(w);
      setRightOpen(localStorage.getItem(RIGHT_OPEN_KEY) === '1');
      const rw = Number(localStorage.getItem(RIGHT_WIDTH_KEY));
      if (rw >= MIN_RIGHT_W && rw <= MAX_RIGHT_W) setRightWidth(rw);
    } catch {
      /* prazno */
    }
  }, []);

  // Promena putanje (klik u drugoj grupi preko palete/taba) prati grupu u ActivityBar-u.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setActiveGroupId(groupForPath(pathname).id);
    // Selekcija pripada stranici na kojoj je napravljena — druga putanja je ne nasleđuje.
    if (inspectTarget) setInspectTarget(null);
  }

  useLayoutEffect(() => {
    const el = leftColRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLeftColumnWidth(el.getBoundingClientRect().width));
    ro.observe(el);
    setLeftColumnWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  function toggleCollapse() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '0' : '1');
      } catch {
        /* prazno */
      }
      return !v;
    });
  }

  // Klik na zapis puni desni panel i otvara ga ako je bio zatvoren — brze info bez navigacije.
  const inspect = useCallback((target: InspectTarget | null) => {
    setInspectTarget(target);
    if (!target) return;
    setRightOpen(true);
    try {
      localStorage.setItem(RIGHT_OPEN_KEY, '1');
    } catch {
      /* prazno */
    }
  }, []);

  const inspector = useMemo(() => ({ target: inspectTarget, inspect }), [inspectTarget, inspect]);

  function toggleRight() {
    setRightOpen((v) => {
      try {
        localStorage.setItem(RIGHT_OPEN_KEY, v ? '0' : '1');
      } catch {
        /* prazno */
      }
      return !v;
    });
  }

  /** Prevlačenje ivice panela. `side` određuje smer: leva traka raste udesno, desni panel ulevo. */
  function startResize(
    e: React.MouseEvent,
    opts: {
      side: 'left' | 'right';
      startWidth: number;
      min: number;
      max: number;
      apply: (w: number) => void;
      storageKey: string;
    },
  ) {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    let last = opts.startWidth;
    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const delta = opts.side === 'left' ? ev.clientX - startX : startX - ev.clientX;
      last = Math.min(opts.max, Math.max(opts.min, opts.startWidth + delta));
      opts.apply(last);
    }
    function onUp() {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try {
        localStorage.setItem(opts.storageKey, String(last));
      } catch {
        /* prazno */
      }
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  /** Dvoklik na ivicu vraća podrazumevanu širinu — izlaz iz slučajno razvučenog panela. */
  function resetWidth(setter: (w: number) => void, value: number, storageKey: string) {
    setter(value);
    try {
      localStorage.setItem(storageKey, String(value));
    } catch {
      /* prazno */
    }
  }

  const activeGroup = NAV_GROUPS.find((g) => g.id === activeGroupId) ?? NAV_GROUPS[0];

  return (
    <TabsProvider>
      <InspectorProvider value={inspector}>
      <AiContextProvider onFirstAdd={() => setAgentOpen(true)}>
      <div className="flex h-screen flex-col overflow-hidden bg-bg text-ink">
        <TopBar leftColumnWidth={leftColumnWidth} />
        <div className="flex min-h-0 flex-1">
          <div ref={leftColRef} className="flex flex-shrink-0">
            <ActivityBar
              groups={NAV_GROUPS}
              activeGroupId={activeGroupId}
              onSelectGroup={(id) => {
                setActiveGroupId(id);
                if (collapsed) toggleCollapse();
              }}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
            />
            {!collapsed && (
              <>
                <div style={{ width }} className="flex-shrink-0 overflow-hidden">
                  <Sidebar
                    activeGroup={activeGroup}
                    onCollapse={toggleCollapse}
                    collapsed={collapsed}
                    summary={sidebarSummary}
                  />
                </div>
                <div
                  onMouseDown={(e) =>
                    startResize(e, {
                      side: 'left',
                      startWidth: width,
                      min: MIN_W,
                      max: MAX_W,
                      apply: setWidth,
                      storageKey: SIDEBAR_WIDTH_KEY,
                    })
                  }
                  onDoubleClick={() =>
                    resetWidth(setWidth, DEFAULT_SIDEBAR_WIDTH, SIDEBAR_WIDTH_KEY)
                  }
                  title="Prevuci da promeniš širinu (dvoklik vraća podrazumevanu)"
                  className="w-1 flex-shrink-0 cursor-col-resize bg-panel-2 hover:bg-accent"
                />
              </>
            )}
          </div>
          <main className="min-w-0 flex-1 overflow-y-auto bg-bg">{children}</main>
          {rightOpen && (
            <>
              <div
                onMouseDown={(e) =>
                  startResize(e, {
                    side: 'right',
                    startWidth: rightWidth,
                    min: MIN_RIGHT_W,
                    max: MAX_RIGHT_W,
                    apply: setRightWidth,
                    storageKey: RIGHT_WIDTH_KEY,
                  })
                }
                onDoubleClick={() =>
                  resetWidth(setRightWidth, DEFAULT_RIGHT_WIDTH, RIGHT_WIDTH_KEY)
                }
                title="Prevuci da promeniš širinu (dvoklik vraća podrazumevanu)"
                className="w-1 flex-shrink-0 cursor-col-resize bg-panel-2 hover:bg-accent"
              />
              <div
                style={{ width: rightWidth }}
                className="flex-shrink-0 overflow-hidden border-l border-border"
              >
                <RightPanel onClose={toggleRight} />
              </div>
            </>
          )}
          <RightRail
            rightPanelOpen={rightOpen}
            onToggleRightPanel={toggleRight}
            agentOpen={agentOpen}
            onToggleAgent={() => setAgentOpen((v) => !v)}
          />
        </div>
        <StatusBar fullName={fullName} roleLabel={roleLabel} />
        <CommandPalette />
        {/* Prozor agenta lebdi iznad radnog prostora, ne oduzima mu širinu — razgovor prati
            ono što je na ekranu, pa ekran mora da ostane vidljiv. */}
        {agentOpen && (
          <div className="fixed bottom-[30px] right-[51px] z-40 flex h-[520px] max-h-[calc(100vh-80px)] w-[380px] max-w-[calc(100vw-70px)] overflow-hidden rounded-lg border border-border shadow-lg">
            <AiAgentBox onClose={() => setAgentOpen(false)} />
          </div>
        )}
      </div>
      </AiContextProvider>
      </InspectorProvider>
    </TabsProvider>
  );
}
