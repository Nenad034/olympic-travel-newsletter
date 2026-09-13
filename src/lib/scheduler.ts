import 'server-only';
import { processDueCampaigns, refreshLiveStatuses } from './campaigns';
import { reloadStore } from './store';
import { instanceId, tryAcquire } from './scheduler-lock';

// Zakazano slanje ne sme da zavisi od toga da li je neko otvorio stranicu. Ovaj tajmer se
// pokreće iz `src/instrumentation.ts` jednom po instanci servera i na interval obrađuje
// dospele kampanje. U LIVE režimu Listmonk sam šalje kampanje sa `send_at`; ono što ovde
// stvarno mora da se izvrši je operativni B2B tok, koji ide transakciono i nema `send_at`.
//
// VIŠE INSTANCI (spec §10.2, odluka 13.9.2026): tajmer je po instanci, pa bi dve instance iza
// istog balansera obradile istu dospelu kampanju i poslale je dvaput. Zato tik radi tek pošto
// uzme bravu na nivou skladišta (`scheduler-lock.ts`) — ne postoji „određena instanca" koja
// jedina šalje, jer bi njen pad zaustavio slanje dok je neko ne zameni ručno.

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;
/** Zakup mora da nadživi najduži tik (transakciono slanje velike liste ide mejl po mejl), a da
 * i dalje bude kratak u odnosu na ljudsku reakciju na pad instance. Produžava se dok posao traje. */
const LEASE_FACTOR = 5;
const MIN_LEASE_MS = 120_000;

/** Tajmer i zastavica žive na globalnom objektu — dev HMR ponovo učitava modul, a proces
 * ostaje isti, pa bi se inače pravio novi tajmer uz svaki reload. Tajmer NE sme da drži
 * zatvaranje nad `tick`-om iz modula koji ga je napravio: posle HMR-a bi zauvek vrteo staru
 * verziju koda (uočeno 13.9.2026 — novi `refreshLiveStatuses` se nije izvršavao do restarta).
 * Zato zove `state.__otNewsletterScheduler.tick`, koji svaki reload modula prepiše. */
const state = globalThis as typeof globalThis & {
  __otNewsletterScheduler?: { timer: NodeJS.Timeout; running: boolean; holder: string; tick: () => Promise<void> };
};
if (state.__otNewsletterScheduler) state.__otNewsletterScheduler.tick = tick;

function intervalMs(): number {
  const raw = Number(process.env.SCHEDULER_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= MIN_INTERVAL_MS ? raw : DEFAULT_INTERVAL_MS;
}

function leaseMs(): number {
  return Math.max(MIN_LEASE_MS, intervalMs() * LEASE_FACTOR);
}

async function tick(): Promise<void> {
  const s = state.__otNewsletterScheduler;
  // Zaštita od preklapanja UNUTAR ovog procesa: brava pokriva druge instance, ali se za
  // sopstveni tik koji još traje ne isplati ni dodirivati disk.
  if (!s || s.running) return;
  s.running = true;

  const lease = leaseMs();
  const held = tryAcquire(s.holder, lease);
  if (!held) {
    // Drugi radnik obrađuje isti posao — nema šta da se čeka, sledeći tik ionako stiže.
    s.running = false;
    return;
  }

  // Keš u memoriji je mogao da zastari dok je bravu držala druga instanca (npr. ona je već
  // poslala kampanju i upisala SENT). Bez ovoga bi brava sprečila istovremeno slanje, ali ne i
  // ponovljeno slanje odmah zatim.
  reloadStore();

  // Dug tik ne sme da izgubi bravu ispod sebe; zakup se produžava dok posao traje.
  const heartbeat = setInterval(() => held.renew(), Math.floor(lease / 3));
  heartbeat.unref?.();

  try {
    const processed = await processDueCampaigns();
    if (processed > 0) console.log(`[scheduler] obrađeno dospelih kampanja: ${processed}`);
    // Kampanje koje Listmonk šalje sam: preuzmi njegov status i brojke.
    const refreshed = await refreshLiveStatuses();
    if (refreshed > 0) console.log(`[scheduler] status preuzet iz Listmonk-a za kampanja: ${refreshed}`);
  } catch (e) {
    console.error('[scheduler] greška pri obradi dospelih kampanja:', e);
  } finally {
    clearInterval(heartbeat);
    held.release();
    s.running = false;
  }
}

export function startScheduler(): void {
  if (state.__otNewsletterScheduler) return;
  const ms = intervalMs();
  const timer = setInterval(() => void state.__otNewsletterScheduler?.tick(), ms);
  // Tajmer ne sme da drži proces u životu (npr. `next build` ili gašenje servera).
  timer.unref?.();
  state.__otNewsletterScheduler = { timer, running: false, holder: instanceId(), tick };
  console.log(`[scheduler] pokrenut, interval ${ms / 1000}s`);
  void tick();
}

export function stopScheduler(): void {
  const s = state.__otNewsletterScheduler;
  if (!s) return;
  clearInterval(s.timer);
  delete state.__otNewsletterScheduler;
}
