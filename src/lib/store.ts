import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import type { Store } from './types';
import { buildSeed } from './seed';

// File-backed skladište (data/store.json) — zamena za Listmonk bazu dok se motor ne poveže
// (vidi `listmonk.ts`). Jedan JSON fajl, sinhrono čitanje/pisanje — dovoljno za interni
// alat sa nekoliko korisnika; nema konkurentnih pisanja izvan jednog Node procesa.

// Testovi pokazuju DATA_DIR na privremeni direktorijum da ne diraju razvojni store.json.
const DATA_DIR = process.env.NEWSLETTER_DATA_DIR ?? path.join(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

/** Direktorijum podataka — scheduler ovde drži i svoju bravu (`scheduler-lock.ts`). */
export function dataDir(): string {
  return DATA_DIR;
}

let cache: Store | null = null;

export function getStore(): Store {
  if (cache) return cache;
  try {
    if (fs.existsSync(STORE_PATH)) {
      cache = normalize(JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Store);
      return cache;
    }
  } catch {
    // oštećen fajl — kreni od semena
  }
  cache = buildSeed();
  persist();
  return cache;
}

/** Store zapisan pre uvođenja dnevnika nema ta polja — dopunjavamo ih umesto da rušimo čitanje. */
function normalize(store: Store): Store {
  store.subscriberAudit ??= [];
  store.suppressions ??= [];
  store.agentInvocations ??= [];
  // `??=` ovde ne valja: `null` je PUNOVAŽNA vrednost („bez granice"), a `??=` bi je prepisao
  // podrazumevanom. Dopunjava se samo polje koje zaista nedostaje.
  if (store.settings.agentDailyBudgetEur === undefined) store.settings.agentDailyBudgetEur = 5;
  if (store.settings.agentMonthlyBudgetEur === undefined) store.settings.agentMonthlyBudgetEur = 60;
  for (const s of store.subscribers) s.history ??= [];
  return store;
}

function persist() {
  if (!cache) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

/** Sve izmene idu kroz ovu funkciju — mutira store i odmah upisuje na disk. */
export function mutate<T>(fn: (store: Store) => T): T {
  const store = getStore();
  const result = fn(store);
  persist();
  return result;
}

/**
 * Odbacuje keš da sledeće čitanje ide sa diska. Potrebno kad aplikacija radi u VIŠE instanci:
 * druga instanca je u međuvremenu mogla da upiše izmene, a ovaj proces bi i dalje radio nad
 * svojom starom kopijom (i, u slučaju schedulera, ponovo poslao već poslatu kampanju).
 */
export function reloadStore(): void {
  cache = null;
}

export function resetStore(): void {
  cache = buildSeed();
  persist();
}

export function newId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}${rnd}`;
}

export function now(): string {
  return new Date().toISOString();
}
