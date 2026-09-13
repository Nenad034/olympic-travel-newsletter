import { beforeEach, describe, expect, it } from 'vitest';
import { budgetState, estimateCostEur, periodStart } from '@/lib/agent-budget';
import { getStore, mutate, resetStore } from '@/lib/store';
import type { AgentInvocation } from '@/lib/types';

beforeEach(() => {
  resetStore();
});

function poziv(at: string, costEur: number): AgentInvocation {
  return {
    at,
    actionCode: 'agent.upit',
    generatedBy: 'CLAUDE',
    model: 'claude-opus-5',
    inputTokens: 0,
    outputTokens: 0,
    costEur,
    latencyMs: 100,
    iterations: 1,
    tools: [],
  };
}

describe('procena troška', () => {
  it('računa po cenovniku modela', () => {
    // 1M ulaznih + 1M izlaznih tokena za claude-opus-5 = 4,6 + 23 EUR.
    expect(estimateCostEur('claude-opus-5', 1_000_000, 1_000_000)).toBeCloseTo(27.6, 6);
  });

  it('lokalan odgovor ne košta ništa — nijedan poziv nije ni otišao', () => {
    expect(estimateCostEur(null, 5_000, 5_000)).toBe(0);
  });

  it('nepoznat model se ne računa kao besplatan', () => {
    expect(estimateCostEur('neki-budući-model', 1_000_000, 0)).toBeGreaterThan(0);
  });
});

describe('granice perioda', () => {
  it('dnevni period počinje u ponoć UTC', () => {
    expect(periodStart('DNEVNI', new Date('2026-09-13T22:45:00Z')).toISOString()).toBe(
      '2026-09-13T00:00:00.000Z',
    );
  });

  it('mesečni period počinje prvog u mesecu', () => {
    expect(periodStart('MESECNI', new Date('2026-09-13T22:45:00Z')).toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    );
  });
});

describe('stanje budžeta', () => {
  it('sabira samo pozive iz tekućeg perioda', () => {
    const at = new Date('2026-09-13T10:00:00Z');
    mutate((s) => {
      s.settings.agentDailyBudgetEur = 10;
      s.settings.agentMonthlyBudgetEur = 100;
      s.agentInvocations = [
        poziv('2026-09-13T09:00:00Z', 2),
        poziv('2026-09-12T09:00:00Z', 5), // juče — ulazi u mesec, ne u dan
        poziv('2026-08-30T09:00:00Z', 40), // prošli mesec — ne ulazi nigde
      ];
    });

    const state = budgetState(getStore(), at);

    expect(state.daily.spentEur).toBe(2);
    expect(state.daily.pozivi).toBe(1);
    expect(state.monthly.spentEur).toBe(7);
    expect(state.blocked).toBe(false);
    expect(state.daily.remainingEur).toBe(8);
  });

  it('lokalni odgovori se ne naplaćuju', () => {
    mutate((s) => {
      s.settings.agentDailyBudgetEur = 1;
      s.agentInvocations = [
        { ...poziv(new Date().toISOString(), 0), generatedBy: 'LOKALNO', model: null },
      ];
    });

    expect(budgetState(getStore()).daily.pozivi).toBe(0);
  });

  it('dostignuta granica blokira sledeći poziv ka modelu i kaže zašto', () => {
    mutate((s) => {
      s.settings.agentDailyBudgetEur = 3;
      s.agentInvocations = [poziv(new Date().toISOString(), 3)];
    });

    const state = budgetState(getStore());

    expect(state.daily.exceeded).toBe(true);
    expect(state.blocked).toBe(true);
    expect(state.reason).toMatch(/Dnevni budžet/);
    expect(state.daily.remainingEur).toBe(0);
  });

  it('bez granice („null") potrošnja se prati, ali ništa ne blokira', () => {
    mutate((s) => {
      s.settings.agentDailyBudgetEur = null;
      s.settings.agentMonthlyBudgetEur = null;
      s.agentInvocations = [poziv(new Date().toISOString(), 999)];
    });

    const state = budgetState(getStore());

    expect(state.blocked).toBe(false);
    expect(state.daily.limitEur).toBeNull();
    expect(state.daily.spentEur).toBe(999);
  });

  it('stariji zapisi bez upisanog troška se procenjuju iz tokena', () => {
    mutate((s) => {
      s.settings.agentDailyBudgetEur = 10;
      const stari = poziv(new Date().toISOString(), 0) as Partial<AgentInvocation>;
      delete stari.costEur;
      stari.inputTokens = 1_000_000;
      s.agentInvocations = [stari as AgentInvocation];
    });

    expect(budgetState(getStore()).daily.spentEur).toBeCloseTo(4.6, 6);
  });
});
