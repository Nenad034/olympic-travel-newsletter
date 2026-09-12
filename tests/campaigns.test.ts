import { beforeEach, describe, expect, it } from 'vitest';
import {
  approve,
  createCampaign,
  processDueCampaigns,
  scheduleConflicts,
  sendTestEmail,
  submitForApproval,
  updateDraft,
} from '@/lib/campaigns';
import { LIST_B2B_OPS, LIST_B2B_PROMO } from '@/lib/seed';
import { getStore, mutate, resetStore } from '@/lib/store';
import type { Campaign, Store } from '@/lib/types';

function minutesFromNow(m: number): string {
  return new Date(Date.now() + m * 60_000).toISOString();
}

/** Minimalni store za `scheduleConflicts` — funkcija čita samo kampanje i podešeni razmak. */
function storeWithSchedule(sendAts: (string | null)[], minGapMinutes = 60): Store {
  const campaigns = sendAts.map(
    (sendAt, i) =>
      ({
        id: `cmp-${i}`,
        name: `Kampanja ${i}`,
        status: sendAt ? 'SCHEDULED' : 'DRAFT',
        sendAt,
      }) as Campaign,
  );
  return { campaigns, settings: { minGapMinutes } } as Store;
}

beforeEach(() => {
  resetStore();
});

describe('sudar termina kampanja (spec §6.2)', () => {
  it('prijavljuje par zakazan bliže od podešenog razmaka', () => {
    const store = storeWithSchedule([minutesFromNow(60), minutesFromNow(90)]);

    const conflicts = scheduleConflicts(store);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].gapMinutes).toBe(30);
    expect([conflicts[0].a.id, conflicts[0].b.id]).toEqual(['cmp-0', 'cmp-1']);
  });

  it('ne prijavlja ništa kad je razmak tačno na pragu ili veći', () => {
    expect(scheduleConflicts(storeWithSchedule([minutesFromNow(60), minutesFromNow(120)]))).toEqual(
      [],
    );
    expect(scheduleConflicts(storeWithSchedule([minutesFromNow(60), minutesFromNow(240)]))).toEqual(
      [],
    );
  });

  it('poredi susedne termine po redosledu, ne redosledu unosa', () => {
    const store = storeWithSchedule([minutesFromNow(300), minutesFromNow(60), minutesFromNow(80)]);

    const conflicts = scheduleConflicts(store);

    expect(conflicts).toHaveLength(1);
    expect([conflicts[0].a.id, conflicts[0].b.id]).toEqual(['cmp-1', 'cmp-2']);
  });

  it('ignoriše kampanje koje nisu zakazane', () => {
    expect(scheduleConflicts(storeWithSchedule([minutesFromNow(60), null]))).toEqual([]);
  });

  it('prati prag iz podešavanja, ne fiksnu vrednost', () => {
    const sendAts = [minutesFromNow(60), minutesFromNow(100)];

    expect(scheduleConflicts(storeWithSchedule(sendAts, 30))).toEqual([]);
    expect(scheduleConflicts(storeWithSchedule(sendAts, 60))).toHaveLength(1);
  });
});

describe('tok odobravanja', () => {
  async function spremnaZaOdobrenje(listId = LIST_B2B_PROMO) {
    const store = getStore();
    const template = store.templates.find(
      (t) => t.audience === (listId === LIST_B2B_PROMO ? 'B2B' : 'B2B'),
    )!;
    const c = createCampaign({
      name: 'Test kampanja',
      listId,
      templateId: template.id,
      brief: 'Ulazni podaci za test.',
    });
    const data = Object.fromEntries(template.placeholders.map((p) => [p.key, 'vrednost']));
    updateDraft(c.id, { subject: 'Naslov', contentData: data });
    submitForApproval(c.id);
    await sendTestEmail(c.id, ['marketing@olympic.rs']);
    return c.id;
  }

  it('odbija termin u prošlosti', async () => {
    const id = await spremnaZaOdobrenje();

    await expect(approve(id, minutesFromNow(-120))).rejects.toThrow(/prošlosti/);
  });

  it('traži test slanje pre odobrenja', () => {
    const store = getStore();
    const template = store.templates.find((t) => t.audience === 'B2B')!;
    const c = createCampaign({
      name: 'Bez testa',
      listId: LIST_B2B_PROMO,
      templateId: template.id,
      brief: 'Brif.',
    });
    updateDraft(c.id, {
      subject: 'Naslov',
      contentData: Object.fromEntries(template.placeholders.map((p) => [p.key, 'vrednost'])),
    });
    submitForApproval(c.id);

    return expect(approve(c.id, null)).rejects.toThrow(/test/i);
  });

  it('izmena sadržaja posle slanja na odobrenje vraća kampanju u nacrt', async () => {
    const id = await spremnaZaOdobrenje();
    expect(getStore().campaigns.find((c) => c.id === id)!.status).toBe('PENDING_APPROVAL');

    const after = updateDraft(id, { subject: 'Drugi naslov' });

    expect(after.status).toBe('DRAFT');
    expect(after.history.at(-1)!.action).toMatch(/vraćeno u nacrt/i);
  });

  it('operativni B2B tok ide transakciono, promotivni kao kampanja (spec §3.1.1)', () => {
    const store = getStore();
    const template = store.templates.find((t) => t.audience === 'B2B')!;
    const ops = createCampaign({
      name: 'Operativna',
      listId: LIST_B2B_OPS,
      templateId: template.id,
      brief: 'Brif.',
    });
    const promo = createCampaign({
      name: 'Promotivna',
      listId: LIST_B2B_PROMO,
      templateId: template.id,
      brief: 'Brif.',
    });

    expect(ops.deliveryMode).toBe('TRANSAKCIONO');
    expect(promo.deliveryMode).toBe('KAMPANJA');
  });
});

describe('processDueCampaigns', () => {
  it('šalje zakazanu kampanju kojoj je termin prošao i ostavlja buduću na miru', () => {
    const [dospela, buduca] = mutate((s) => {
      const [a, b] = s.campaigns.filter((c) => c.status === 'SCHEDULED').slice(0, 2);
      a.sendAt = minutesFromNow(-5);
      b.sendAt = minutesFromNow(120);
      return [a.id, b.id];
    });

    processDueCampaigns();

    const store = getStore();
    expect(store.campaigns.find((c) => c.id === dospela)!.status).toBe('SENT');
    expect(store.campaigns.find((c) => c.id === buduca)!.status).toBe('SCHEDULED');
  });

  it('ne šalje istu kampanju dvaput', () => {
    const id = mutate((s) => {
      const c = s.campaigns.find((x) => x.status === 'SCHEDULED')!;
      c.sendAt = minutesFromNow(-5);
      return c.id;
    });

    processDueCampaigns();
    const prviPut = getStore().campaigns.find((c) => c.id === id)!.sentAt;
    processDueCampaigns();

    expect(getStore().campaigns.find((c) => c.id === id)!.sentAt).toBe(prviPut);
  });
});
