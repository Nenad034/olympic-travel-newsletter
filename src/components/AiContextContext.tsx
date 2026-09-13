'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { AgentContextItem, ImageMediaType } from '@/lib/agent';

// „Dodaj u kontekst agenta" — isti obrazac kao AiContextContext u Terminal Travel panelu: bilo
// koji red bilo kog ekrana može da priloži zapis razgovoru, bez posebnog ožičenja po stranici.
//
// `RECORD` je čitljiva REFERENCA, ne sirov podatak — agent je razrešava svojim alatima, pa u
// prompt ne odlazi ništa što agent ne bi i sam smeo da pročita. `FILE` i `IMAGE` su tranzientni:
// izvučen tekst dokumenta i base64 slika žive samo u stanju ovog pregledača i u jednom pozivu
// modelu — ne upisuju se u store niti na disk.

export type ContextItem = AgentContextItem & { id: string };

const MAX_ITEMS = 8;

interface Value {
  items: ContextItem[];
  addRecord: (refLabel: string) => void;
  addFile: (args: { label: string; content: string }) => void;
  addImage: (args: { label: string; imageData: string; imageMediaType: ImageMediaType }) => void;
  removeItem: (id: string) => void;
  clear: () => void;
  atCapacity: boolean;
}

const Ctx = createContext<Value | null>(null);

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** `onFirstAdd` prikazuje agenta — pojavljuje se čim ima šta da pokaže, kao desni panel. */
export function AiContextProvider({
  children,
  onFirstAdd,
}: {
  children: React.ReactNode;
  onFirstAdd?: () => void;
}) {
  const [items, setItems] = useState<ContextItem[]>([]);

  const addRecord = useCallback(
    (refLabel: string) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        if (prev.some((i) => i.type === 'RECORD' && i.refLabel === refLabel)) return prev;
        if (prev.length === 0) onFirstAdd?.();
        return [...prev, { id: newId('record'), type: 'RECORD', refLabel }];
      });
    },
    [onFirstAdd],
  );

  const addFile = useCallback(
    (args: { label: string; content: string }) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        if (prev.length === 0) onFirstAdd?.();
        return [...prev, { id: newId('file'), type: 'FILE', ...args }];
      });
    },
    [onFirstAdd],
  );

  const addImage = useCallback(
    (args: { label: string; imageData: string; imageMediaType: ImageMediaType }) => {
      setItems((prev) => {
        if (prev.length >= MAX_ITEMS) return prev;
        if (prev.length === 0) onFirstAdd?.();
        return [...prev, { id: newId('image'), type: 'IMAGE', ...args }];
      });
    },
    [onFirstAdd],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items,
      addRecord,
      addFile,
      addImage,
      removeItem,
      clear,
      atCapacity: items.length >= MAX_ITEMS,
    }),
    [items, addRecord, addFile, addImage, removeItem, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAiContext(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAiContext van AiContextProvider-a');
  return ctx;
}

/** Čitljiv naziv čipa — dokument i slika se označavaju, da se vidi šta je agent dobio. */
export function itemLabel(item: ContextItem): string {
  if (item.type === 'FILE') return `Fajl: ${item.label}`;
  if (item.type === 'IMAGE') return `Slika: ${item.label}`;
  return item.refLabel;
}

export function itemIcon(item: ContextItem): string {
  if (item.type === 'FILE') return 'file';
  if (item.type === 'IMAGE') return 'file-media';
  return 'symbol-number';
}
