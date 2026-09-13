import 'server-only';
import type { AgentInvocation, Store } from './types';

// Budžet potrošnje AI agenta (spec §10.2, odluka 13.9.2026). Do sada je postojao samo dnevnik
// poziva — uvid u potrošnju bez ijedne granice, pa je jedan zaglavljen razgovor ili petlja u
// pozivima mogao da troši bez kraja. Mehanizam je preuzet iz Terminal Travel M18
// (`ai-agent-budgets` + `agent-invocations/pricing.ts`), sveden na ono što ovaj modul ima:
// jedan agent, jedan nalog, file-backed store.
//
// Dve razlike u odnosu na M18, obe namerne:
//  1. Potrošnja se NE broji u posebnom brojaču nego se SABIRA iz dnevnika poziva. Dnevnik ionako
//     nosi tokene i vreme svakog poziva; poseban brojač bi bio drugi izvor istine koji sa njim
//     može da se raziđe (a tek bi ga trebalo i „rolovati" na početku perioda).
//  2. Prekoračen budžet ne gasi agenta nego ga vraća na LOKALNI odgovor — isti alati i isti
//     podaci, bez jezičkog sloja i bez troška. Modul time ostaje upotrebljiv, a korisnik na
//     ekranu vidi zašto odgovor izgleda drugačije.

/** Cene po milionu tokena, u EUR (grubo iz USD cenovnika, ~0.92 EUR/USD). Aproksimacija za
 * interno praćenje, ne faktura — ažurirati uz zvaničan cenovnik. Isti brojevi kao M18. */
const PRICE_PER_MILLION_TOKENS_EUR: Record<string, { input: number; output: number }> = {
  'claude-opus-5': { input: 4.6, output: 23 },
  'claude-sonnet-5': { input: 2.76, output: 13.8 },
  'claude-haiku-4-5-20251001': { input: 0.92, output: 4.6 },
};

/** Nepoznat model se ne računa kao besplatan — konzervativna pretpostavka, kao u M18. */
const DEFAULT_PRICE = { input: 1, output: 5 };

export function estimateCostEur(
  model: string | null,
  inputTokens: number,
  outputTokens: number,
): number {
  if (!model) return 0; // LOKALNO — nijedan poziv ka provajderu nije ni otišao
  const price = PRICE_PER_MILLION_TOKENS_EUR[model] ?? DEFAULT_PRICE;
  const cost = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimala
}

export type BudgetPeriod = 'DNEVNI' | 'MESECNI';

/** Granice tekućeg perioda u UTC — uvek pun dan/mesec, isto pravilo kao M18 `periodBounds`. */
export function periodStart(period: BudgetPeriod, at: Date = new Date()): Date {
  return period === 'DNEVNI'
    ? new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()))
    : new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}

export interface BudgetWindow {
  period: BudgetPeriod;
  /** `null` = bez granice (vlasnikova odluka da se ne ograničava taj period). */
  limitEur: number | null;
  spentEur: number;
  /** `null` kad nema granice. */
  remainingEur: number | null;
  exceeded: boolean;
  pozivi: number;
}

export interface AgentBudgetState {
  daily: BudgetWindow;
  monthly: BudgetWindow;
  /** Bar jedan period prekoračen — poziv ka modelu se ne šalje. */
  blocked: boolean;
  /** Rečenica za korisnika; `null` kad ništa nije prekoračeno. */
  reason: string | null;
}

function spentSince(invocations: AgentInvocation[], since: Date): { eur: number; count: number } {
  let eur = 0;
  let count = 0;
  for (const inv of invocations) {
    // Dnevnik je poređan od najnovijeg, ali se ne oslanjamo na redosled — jedan prolaz svejedno.
    if (new Date(inv.at).getTime() < since.getTime()) continue;
    if (inv.generatedBy !== 'CLAUDE') continue;
    count += 1;
    eur += inv.costEur ?? estimateCostEur(inv.model, inv.inputTokens, inv.outputTokens);
  }
  return { eur: Math.round(eur * 1_000_000) / 1_000_000, count };
}

function windowFor(
  store: Store,
  period: BudgetPeriod,
  limitEur: number | null,
  at: Date,
): BudgetWindow {
  const { eur, count } = spentSince(store.agentInvocations ?? [], periodStart(period, at));
  const limit = limitEur && limitEur > 0 ? limitEur : null;
  return {
    period,
    limitEur: limit,
    spentEur: eur,
    remainingEur: limit === null ? null : Math.max(0, Math.round((limit - eur) * 1_000_000) / 1_000_000),
    exceeded: limit !== null && eur >= limit,
    pozivi: count,
  };
}

function eur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

export function budgetState(store: Store, at: Date = new Date()): AgentBudgetState {
  const daily = windowFor(store, 'DNEVNI', store.settings.agentDailyBudgetEur, at);
  const monthly = windowFor(store, 'MESECNI', store.settings.agentMonthlyBudgetEur, at);
  const blocked = daily.exceeded || monthly.exceeded;
  const which = monthly.exceeded ? monthly : daily;
  return {
    daily,
    monthly,
    blocked,
    reason: blocked
      ? `${which.period === 'DNEVNI' ? 'Dnevni' : 'Mesečni'} budžet agenta (${eur(which.limitEur!)}) je potrošen — ${eur(which.spentEur)} u ${which.pozivi} poziva.`
      : null,
  };
}
