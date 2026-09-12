import 'server-only';
import { processDueCampaigns } from './campaigns';

// Zakazano slanje ne sme da zavisi od toga da li je neko otvorio stranicu. Ovaj tajmer se
// pokreće iz `src/instrumentation.ts` jednom po instanci servera i na interval obrađuje
// dospele kampanje. U LIVE režimu Listmonk sam šalje kampanje sa `send_at`; ono što ovde
// stvarno mora da se izvrši je operativni B2B tok, koji ide transakciono i nema `send_at`.

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 5_000;

/** Tajmer i zastavica žive na globalnom objektu — dev HMR ponovo učitava modul, a proces
 * ostaje isti, pa bi se inače pravio novi tajmer uz svaki reload. */
const state = globalThis as typeof globalThis & {
  __otNewsletterScheduler?: { timer: NodeJS.Timeout; running: boolean };
};

function intervalMs(): number {
  const raw = Number(process.env.SCHEDULER_INTERVAL_MS);
  return Number.isFinite(raw) && raw >= MIN_INTERVAL_MS ? raw : DEFAULT_INTERVAL_MS;
}

async function tick(): Promise<void> {
  const s = state.__otNewsletterScheduler;
  // Zaštita od preklapanja: transakciono slanje velike liste može da traje duže od intervala,
  // a dva tika nad istim kampanjama bi značila duplo slanje.
  if (!s || s.running) return;
  s.running = true;
  try {
    const processed = await processDueCampaigns();
    if (processed > 0) console.log(`[scheduler] obrađeno dospelih kampanja: ${processed}`);
  } catch (e) {
    console.error('[scheduler] greška pri obradi dospelih kampanja:', e);
  } finally {
    s.running = false;
  }
}

export function startScheduler(): void {
  if (state.__otNewsletterScheduler) return;
  const ms = intervalMs();
  const timer = setInterval(() => void tick(), ms);
  // Tajmer ne sme da drži proces u životu (npr. `next build` ili gašenje servera).
  timer.unref?.();
  state.__otNewsletterScheduler = { timer, running: false };
  console.log(`[scheduler] pokrenut, interval ${ms / 1000}s`);
  void tick();
}

export function stopScheduler(): void {
  const s = state.__otNewsletterScheduler;
  if (!s) return;
  clearInterval(s.timer);
  delete state.__otNewsletterScheduler;
}
