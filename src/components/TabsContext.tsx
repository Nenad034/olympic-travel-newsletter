'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Tabovi centralnog panela (VS Code obrazac, preuzet iz Terminal Travel panela): svaka sekcija
// iz leve trake otvara tab; drill-down (lista → zapis) ostaje u istom tabu (`navigateInTab`).
// Stanje preživljava osvežavanje (sessionStorage); zakačeni tabovi i gašenje (localStorage).

export interface OpenTab {
  id: string;
  path: string;
  label: string;
  pinned?: boolean;
}

interface TabsContextValue {
  tabs: OpenTab[];
  activeTabId: string;
  openTab: (path: string, label: string, opts?: { forceNew?: boolean }) => void;
  navigateInTab: (path: string, label: string) => void;
  setActiveTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeAllTabs: () => void;
  togglePin: (id: string) => void;
  reorderTabs: (draggedId: string, targetId: string) => void;
  registerLabel: (path: string, label: string) => void;
  /** Tabovi su učitani iz storage-a — `useRegisterTab` čeka ovo, jer efekat deteta (stranice)
   * inače stigne PRE hidratacije roditelja i ne nađe tab za svoju putanju. */
  hydrated: boolean;
}

function newTabId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `t${Date.now()}${Math.random()}`;
}

const TabsCtx = createContext<TabsContextValue | null>(null);

const STORAGE_KEY = 'ot-newsletter-tabs';
const PINNED_STORAGE_KEY = 'ot-newsletter-pinned-tabs';
const HOME_LABEL = 'Početna';

export function TabsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<OpenTab[]>([{ id: 'home', path: '/', label: HOME_LABEL }]);
  const [activeTabId, setActiveTabId] = useState('home');
  const [hydrated, setHydrated] = useState(false);
  const tabsRef = useRef(tabs);
  const activeRef = useRef(activeTabId);
  useEffect(() => {
    activeRef.current = activeTabId;
  }, [activeTabId]);

  function commitTabs(next: OpenTab[]) {
    tabsRef.current = next;
    setTabs(next);
  }

  useEffect(() => {
    let restored: OpenTab[] | null = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) restored = JSON.parse(raw) as OpenTab[];
    } catch {
      /* prazno */
    }
    let base =
      restored && restored.length > 0 ? restored : [{ id: 'home', path: '/', label: HOME_LABEL }];
    try {
      const rawPinned = localStorage.getItem(PINNED_STORAGE_KEY);
      if (rawPinned) {
        const pinned = JSON.parse(rawPinned) as OpenTab[];
        for (const p of pinned) {
          const existing = base.find((t) => t.path === p.path);
          base = existing
            ? base.map((t) => (t.path === p.path ? { ...t, pinned: true } : t))
            : [...base, { ...p, pinned: true }];
        }
      }
    } catch {
      /* prazno */
    }
    // Trenutna putanja mora imati svoj tab (direktan ulaz preko URL-a).
    if (!base.find((t) => t.path === pathname)) {
      base = [...base, { id: newTabId(), path: pathname, label: 'Stranica' }];
    }
    commitTabs(base);
    const match = base.find((t) => t.path === pathname) ?? base[0];
    setActiveTabId(match.id);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
      const pinned = tabs.filter((t) => t.pinned).map(({ id, path, label }) => ({ id, path, label }));
      localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(pinned));
    } catch {
      /* prazno */
    }
  }, [tabs, hydrated]);

  // Navigacija browser dugmadima (nazad/napred) — usaglasi aktivan tab sa putanjom.
  useEffect(() => {
    if (!hydrated) return;
    const active = tabsRef.current.find((t) => t.id === activeRef.current);
    if (active && active.path === pathname) return;
    const existing = tabsRef.current.find((t) => t.path === pathname);
    if (existing) {
      setActiveTabId(existing.id);
    } else if (active) {
      commitTabs(tabsRef.current.map((t) => (t.id === active.id ? { ...t, path: pathname } : t)));
    }
  }, [pathname, hydrated]);

  const openTab = useCallback(
    (path: string, label: string, opts?: { forceNew?: boolean }) => {
      if (!opts?.forceNew) {
        const existing = tabsRef.current.find((t) => t.path === path);
        if (existing) {
          if (existing.label !== label) {
            commitTabs(tabsRef.current.map((t) => (t.id === existing.id ? { ...t, label } : t)));
          }
          setActiveTabId(existing.id);
          if (path !== pathname) router.push(path);
          return;
        }
      }
      const id = newTabId();
      commitTabs([...tabsRef.current, { id, path, label }]);
      setActiveTabId(id);
      if (path !== pathname) router.push(path);
    },
    [pathname, router],
  );

  const navigateInTab = useCallback(
    (path: string, label: string) => {
      const prev = tabsRef.current;
      const idx = prev.findIndex((t) => t.id === activeRef.current);
      if (idx === -1) {
        const id = newTabId();
        setActiveTabId(id);
        commitTabs([...prev, { id, path, label }]);
      } else {
        const next = [...prev];
        next[idx] = { ...next[idx], path, label };
        commitTabs(next);
      }
      router.push(path);
    },
    [router],
  );

  const registerLabel = useCallback((path: string, label: string) => {
    const prev = tabsRef.current;
    const t = prev.find((x) => x.path === path);
    if (!t || t.label === label) return;
    commitTabs(prev.map((x) => (x.path === path ? { ...x, label } : x)));
  }, []);

  const setActiveTab = useCallback((id: string) => setActiveTabId(id), []);

  const closeTab = useCallback(
    (id: string) => {
      const prev = tabsRef.current;
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1 || prev.length === 1 || prev[idx].pinned) return;
      const next = prev.filter((t) => t.id !== id);
      commitTabs(next);
      if (id === activeRef.current) {
        const fallback = next[Math.max(0, idx - 1)];
        setActiveTabId(fallback.id);
        router.push(fallback.path);
      }
    },
    [router],
  );

  const closeAllTabs = useCallback(() => {
    const prev = tabsRef.current;
    const keep = prev.filter((t) => t.pinned || t.path === '/');
    const next = keep.length ? keep : [{ id: 'home', path: '/', label: HOME_LABEL }];
    commitTabs(next);
    if (!next.find((t) => t.id === activeRef.current)) {
      setActiveTabId(next[0].id);
      router.push(next[0].path);
    }
  }, [router]);

  const togglePin = useCallback((id: string) => {
    commitTabs(tabsRef.current.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)));
  }, []);

  const reorderTabs = useCallback((draggedId: string, targetId: string) => {
    const prev = tabsRef.current;
    const from = prev.findIndex((t) => t.id === draggedId);
    const to = prev.findIndex((t) => t.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    commitTabs(next);
  }, []);

  return (
    <TabsCtx.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        navigateInTab,
        setActiveTab,
        closeTab,
        closeAllTabs,
        togglePin,
        reorderTabs,
        registerLabel,
        hydrated,
      }}
    >
      {children}
    </TabsCtx.Provider>
  );
}

export function useTabs(): TabsContextValue {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('useTabs van TabsProvider-a');
  return ctx;
}

/** Stranica registruje naslov svog taba (server komponente to rade preko `RegisterTab`). */
export function useRegisterTab(label: string) {
  const pathname = usePathname();
  const { registerLabel, hydrated } = useTabs();
  useEffect(() => {
    if (hydrated) registerLabel(pathname, label);
  }, [pathname, label, registerLabel, hydrated]);
}
