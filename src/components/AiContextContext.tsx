'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AgentContextItem } from '@/lib/agent';

// „Dodaj u AI kontekst" — isti obrazac kao AiContextContext u Terminal Travel panelu: bilo koji
// red bilo kog ekrana može da priloži zapis razgovoru, bez posebnog ožičenja po stranici.
// Stavka je REFERENCA (čitljiva oznaka), ne sirov podatak — agent je razrešava svojim alatima,
// pa u prompt ne odlazi ništa što agent ne bi i sam smeo da pročita.

export type ContextItem = AgentContextItem & { id: string };

const MAX_ITEMS = 8;

interface Value {
  items: ContextItem[];
  addRecord: (type: AgentContextItem['type'], refLabel: string) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  atCapacity: boolean;
}

const Ctx = createContext<Value | null>(null);

/** `onFirstAdd` otvara prozor agenta — pojavljuje se čim ima šta da pokaže, kao desni panel. */
export function AiContextProvider({
  children,
  onFirstAdd,
}: {
  children: React.ReactNode;
  onFirstAdd?: () => void;
}) {
  const [items, setItems] = useState<ContextItem[]>([]);

  const addRecord = useCallback(
    (type: AgentContextItem['type'], refLabel: string) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        if (prev.some((i) => i.type === type && i.refLabel === refLabel)) return prev;
        if (prev.length === 0) onFirstAdd?.();
        return [...prev, { id: `${type}-${refLabel}-${Date.now()}`, type, refLabel }];
      });
    },
    [onFirstAdd],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({ items, addRecord, removeItem, clear, atCapacity: items.length >= MAX_ITEMS }),
    [items, addRecord, removeItem, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAiContext(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAiContext van AiContextProvider-a');
  return ctx;
}
