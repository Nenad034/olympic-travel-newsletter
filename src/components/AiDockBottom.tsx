'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { useTabs } from './TabsContext';

// Agent u DNU CENTRALNOG PANELA — druga moguća pozicija istog polja, kao Panel u VS Code.
// Stoji ispod sadržaja, iznad statusne trake, i zauzima SAMO širinu centralne kolone: ne ide
// ispod leve trake ni desnog panela.
//
// Ovo NIJE drugo polje za razgovor. Dokovani `AiChatBox` je jedan; ovde se samo prikazuje na
// drugom mestu (Shell.tsx fizički premešta njegov čvor u ovaj slot), pa se istorija razgovora ne
// gubi pri premeštanju. Dva odvojena dokovana polja bi se prvom izmenom razišla. Poseban tab
// `/ai-agent` JESTE zaseban razgovor — namerno, jer se sa tabom i zatvara.

const HEIGHT_KEY = 'ot-newsletter-ai-dock-height';
const DEFAULT_HEIGHT = 260;
const MIN_HEIGHT = 120;
const COLLAPSED_HEIGHT = 36;

export default function AiDockBottom({
  slotRef,
  onMoveToRight,
}: {
  /** Mesto u koje Shell.tsx premešta jedini dokovani `AiChatBox`. */
  slotRef: (el: HTMLDivElement | null) => void;
  onMoveToRight: () => void;
}) {
  const { openTab } = useTabs();
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(DEFAULT_HEIGHT);
  const dragAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem(HEIGHT_KEY));
    if (saved >= MIN_HEIGHT) setHeight(saved);
  }, []);

  const onPointerMove = useCallback((e: PointerEvent) => {
    // Vučenje NAGORE povećava visinu — dok raste ka sadržaju.
    setHeight(Math.max(MIN_HEIGHT, startHeight.current + (startY.current - e.clientY)));
  }, []);

  const onPointerUp = useCallback(() => {
    setDragging(false);
    dragAbort.current?.abort();
    dragAbort.current = null;
    setHeight((h) => {
      try {
        localStorage.setItem(HEIGHT_KEY, String(h));
      } catch {
        /* prazno */
      }
      return h;
    });
  }, []);

  // Ako se komponenta ukloni usred prevlačenja, osluškivači bi inače ostali na `window`.
  useEffect(() => () => dragAbort.current?.abort(), []);

  function onPointerDown(e: React.PointerEvent) {
    if (collapsed) return;
    setDragging(true);
    startY.current = e.clientY;
    startHeight.current = height;
    // Prekid prethodnog prevlačenja je obavezan, ne opreznost: `addEventListener` sa istom
    // funkcijom i istim tipom drugi put je duplikat koji se po specifikaciji zanemaruje —
    // zajedno sa svojim `signal`-om. Bez ovoga bi dva `pointerdown` bez `pointerup` između
    // (dvoklik, drhtaj ruke) ostavila osluškivač zauvek zakačen i dok bi se menjao na svaki
    // pokret miša.
    dragAbort.current?.abort();
    const ctrl = new AbortController();
    dragAbort.current = ctrl;
    window.addEventListener('pointermove', onPointerMove, { signal: ctrl.signal });
    window.addEventListener('pointerup', onPointerUp, { signal: ctrl.signal });
    // `pointercancel` — pregledač sam prekida pokazivač (sistemski meni, gubitak prozora).
    // Bez toga `pointerup` nikad ne stigne i prevlačenje ostaje „upaljeno".
    window.addEventListener('pointercancel', onPointerUp, { signal: ctrl.signal });
  }

  return (
    <div
      className="flex flex-shrink-0 flex-col overflow-hidden bg-panel"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
    >
      <div
        onPointerDown={onPointerDown}
        title={collapsed ? undefined : 'Prevuci za promenu visine'}
        className={`h-1.5 flex-shrink-0 border-t ${
          collapsed
            ? 'border-border'
            : `cursor-row-resize hover:border-accent ${dragging ? 'border-accent' : 'border-border'}`
        }`}
      />
      <div className="flex h-9 flex-shrink-0 items-center justify-between px-2 text-xs font-medium text-ink-faint">
        <span className="flex items-center gap-1.5">
          <Icon name="sparkle" className="text-accent-strong" /> Agent
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onMoveToRight}
            title="Vrati agenta u desni panel"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name="arrow-right" />
          </button>
          <button
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? 'Prikaži agenta' : 'Sklopi agenta'}
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} />
          </button>
          <button
            onClick={() => openTab('/ai-agent', 'AI agent')}
            title="Otvori agenta u posebnom tabu"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel-2 hover:text-ink"
          >
            <Icon name="screen-full" />
          </button>
        </div>
      </div>
      {/* Slot ostaje u DOM-u i kad je sklopljen (visina 0) — `AiChatBox` se ne sme ukloniti,
          inače nestaje istorija razgovora. */}
      <div
        ref={slotRef}
        className={collapsed ? 'h-0 overflow-hidden' : 'min-h-0 flex-1 overflow-hidden'}
      />
    </div>
  );
}
