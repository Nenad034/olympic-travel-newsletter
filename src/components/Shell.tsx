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
import AiChatBox from './AiChatBox';
import AiDockBottom from './AiDockBottom';
import { NAV_GROUPS, groupForPath } from '@/lib/nav';

const SIDEBAR_COLLAPSED_KEY = 'ot-newsletter-sidebar-collapsed';
const SIDEBAR_WIDTH_KEY = 'ot-newsletter-sidebar-width';
const RIGHT_OPEN_KEY = 'ot-newsletter-right-open';
const RIGHT_WIDTH_KEY = 'ot-newsletter-right-width';
const AI_DOCK_KEY = 'ot-newsletter-ai-dock';
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
  // Pozicija agenta. Dokovano polje je JEDNO: `AiChatBox` se montira tačno jednom (na dnu ovog
  // stabla) i FIZIČKI se premešta u aktivan slot — desni panel ili donji dok. Da se umesto toga
  // renderovao na dva mesta ili menjao odredište portala, React bi ga pri svakoj promeni
  // odmontirao i ponovo montirao, pa bi se izgubila istorija razgovora i nedovršen tekst u polju.
  //
  // Agent NEMA sopstveni „otvoren/zatvoren" prekidač (obrazac iz Terminal Travel panela, dizajn
  // dok. §6c.0): u desnom panelu je trajan deo panela i deli prostor sa brzim info, pa pristup
  // njemu kontroliše otvaranje samog panela. Sklapanje unutar panela radi `RightPanel.tsx`.
  const [aiDock, setAiDock] = useState<'right' | 'bottom'>('right');
  const [aiSlot, setAiSlot] = useState<HTMLDivElement | null>(null);
  const aiHostRef = useRef<HTMLDivElement | null>(null);

  // `useLayoutEffect`, pre iscrtavanja — sa običnim `useEffect` bi se polje na trenutak videlo
  // na svom polaznom (parkiranom) mestu.
  useLayoutEffect(() => {
    const host = aiHostRef.current;
    if (host && aiSlot && host.parentElement !== aiSlot) aiSlot.appendChild(host);
  }, [aiSlot, rightOpen]);

  const openRight = useCallback(() => {
    setRightOpen(true);
    try {
      localStorage.setItem(RIGHT_OPEN_KEY, '1');
    } catch {
      /* prazno */
    }
  }, []);

  function moveAiDock(next: 'right' | 'bottom') {
    setAiDock(next);
    setAiSlot(null); // stari slot nestaje iz DOM-a; novi se javi svojim callback ref-om
    if (next === 'right') openRight();
    try {
      localStorage.setItem(AI_DOCK_KEY, next);
    } catch {
      /* prazno */
    }
  }
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
      if (localStorage.getItem(AI_DOCK_KEY) === 'bottom') setAiDock('bottom');
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
      {/* Prvo prilaganje konteksta („#") otvara desni panel, jer se tamo agent i nalazi — osim
          kad je već u posebnom tabu ili u donjem doku, gde je i bez panela pred očima. */}
      <AiContextProvider
        onFirstAdd={() => {
          if (aiDock === 'right' && pathname !== '/ai-agent') openRight();
        }}
      >
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
          <div className="flex min-w-0 flex-1 flex-col">
            {/* `id` čita AiChatBox da automatski priloži vidljiv tekst otvorenog taba uz pitanje
                — jedno mesto umesto ožičenja svakog ekrana ponaosob. Donji dok je SUSED ovog
                elementa, ne njegov potomak: inače bi agent čitao sopstvenu istoriju razgovora. */}
            <main id="ot-main-content" className="min-h-0 flex-1 overflow-y-auto bg-bg">
              {children}
            </main>
            {aiDock === 'bottom' && (
              <AiDockBottom slotRef={setAiSlot} onMoveToRight={() => moveAiDock('right')} />
            )}
          </div>
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
                className="flex flex-shrink-0 flex-col overflow-hidden border-l border-border"
              >
                {/* Desni panel SAM deli svoj prostor između brzih info i agenta (prevlačiva
                    linija, sklapanje jednog od dva dela) — Shell mu samo daje širinu i slot. */}
                <RightPanel
                  onClose={toggleRight}
                  aiDock={aiDock}
                  aiSlotRef={setAiSlot}
                  onMoveAiToBottom={() => moveAiDock('bottom')}
                />
              </div>
            </>
          )}
          <RightRail rightPanelOpen={rightOpen} onToggleRightPanel={toggleRight} />
        </div>
        <StatusBar fullName={fullName} roleLabel={roleLabel} />
        <CommandPalette />
      </div>
      {/* JEDINI DOKOVANI `AiChatBox`, u stabilnom domaćinu koji se premešta u aktivan slot
          (poseban tab `/ai-agent` montira svoj primerak, sa sopstvenom istorijom).
          Dok nijedan slot ne postoji, domaćin stoji ovde parkiran: omotač je `fixed` i nulte
          veličine da parkirano polje ne doda visinu dokumentu (inače bi ispod statusne trake
          zjapio prazan prostor i pojavio se skrol). Ne `hidden` ni `display:none` — čvor mora
          ostati živ, jer se fizički premešta zajedno sa svojim stanjem. */}
      <div className="pointer-events-none fixed bottom-0 left-0 h-0 w-0 overflow-hidden">
        <div ref={aiHostRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          <AiChatBox />
        </div>
      </div>
      </AiContextProvider>
      </InspectorProvider>
    </TabsProvider>
  );
}
