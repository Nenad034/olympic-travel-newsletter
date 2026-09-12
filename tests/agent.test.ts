import { beforeEach, describe, expect, it } from 'vitest';
import { askAgent, looksLikeActionRequest } from '@/lib/agent';
import { addSubscriberManual } from '@/lib/subscribers';
import { LIST_B2B_OPS } from '@/lib/seed';
import { NAV_ITEMS } from '@/lib/nav';
import { getStore, resetStore } from '@/lib/store';

// Testovi rade u mock režimu (bez ANTHROPIC_API_KEY) — proveravaju granicu agenta i alate,
// ne jezički sloj. Granica je ista bez obzira da li odgovor sklapa model ili lokalni sloj.

beforeEach(() => {
  resetStore();
});

describe('prepoznavanje zahteva za radnju', () => {
  it('prepoznaje glagole radnje', () => {
    expect(looksLikeActionRequest('pošalji kampanju odmah')).toBe(true);
    expect(looksLikeActionRequest('odjavi ovog subagenta')).toBe(true);
    expect(looksLikeActionRequest('obriši zapis')).toBe(true);
  });

  it('ne proglašava svako pitanje zahtevom za radnju', () => {
    expect(looksLikeActionRequest('koliko ima aktivnih na B2C listi?')).toBe(false);
    expect(looksLikeActionRequest('kakvo je stanje isporuke?')).toBe(false);
  });
});

describe('askAgent', () => {
  it('odbija prazno pitanje', async () => {
    await expect(askAgent({ query: '   ' })).rejects.toThrow(/prazno/);
  });

  it('na zahtev za radnju kaže da je ne izvršava i nudi ekran za potvrdu', async () => {
    const r = await askAgent({ query: 'pošalji promo kampanju svim subagentima' });

    expect(r.answer).toMatch(/ne izvršavam/i);
    expect(r.suggestions.map((s) => s.href)).toContain('/kampanje/nova');
  });

  it('ne menja stanje — ni jedan zapis, kampanja ni podešavanje', async () => {
    const before = JSON.stringify({
      subscribers: getStore().subscribers,
      campaigns: getStore().campaigns,
      settings: getStore().settings,
    });

    await askAgent({ query: 'obriši sve pretplatnike i pošalji kampanju' });

    const after = JSON.stringify({
      subscribers: getStore().subscribers,
      campaigns: getStore().campaigns,
      settings: getStore().settings,
    });
    expect(after).toBe(before);
  });

  it('odgovara podacima iz baze kad se pita za konkretnu adresu', async () => {
    await addSubscriberManual({
      email: 'trazeni@agencija.rs',
      name: 'Trazeni Subagent',
      listIds: [LIST_B2B_OPS],
      consentNote: 'ugovor',
      consentAt: '2026-01-05',
      sourceRef: 'UG-30',
      addedBy: 'Test Tim',
    });

    const r = await askAgent({ query: 'šta znaš o trazeni@agencija.rs' });

    expect(r.answer).toContain('trazeni@agencija.rs');
    expect(r.answer).toContain('ENABLED');
    expect(r.suggestions.map((s) => s.href)).toContain('/pretplatnici');
  });

  it('kaže kad zapisa nema, umesto da izmisli odgovor', async () => {
    const r = await askAgent({ query: 'šta znaš o nepostojeca@nigde.rs' });

    expect(r.answer).toMatch(/Nema zapisa/i);
  });

  it('upisuje poziv u dnevnik, bez teksta upita', async () => {
    await askAgent({ query: 'kakvo je stanje baze?' });

    const log = getStore().agentInvocations;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actionCode: 'agent.upit', generatedBy: 'LOKALNO' });
    expect(log[0].tools.length).toBeGreaterThan(0);
    expect(JSON.stringify(log[0])).not.toContain('stanje baze?');
  });
});

describe('linkovi i priložen kontekst', () => {
  it('predlaže isključivo ekrane iz registra navigacije', async () => {
    const upiti = [
      'kakvo je stanje baze?',
      'ima li sudara termina?',
      'kakvo je stanje isporuke po domenima?',
      'pošalji kampanju odmah',
    ];

    for (const q of upiti) {
      const r = await askAgent({ query: q });
      for (const s of r.suggestions) {
        expect(NAV_ITEMS.some((i) => i.href === s.href && i.label === s.label)).toBe(true);
      }
    }
  });

  it('prima referencu, dokument i sliku kao kontekst bez padanja', async () => {
    const r = await askAgent({
      query: 'kakvo je stanje baze?',
      pageContent: 'Pretplatnici — 31 zapisa',
      contextItems: [
        { type: 'RECORD', refLabel: 'Bojan Ristić <rezervacije@siriustours.rs>' },
        { type: 'FILE', label: 'brif.txt', content: 'Rana rezervacija leto 2027.' },
        { type: 'IMAGE', label: 'ekran.png', imageData: 'AAAA', imageMediaType: 'image/png' },
      ],
    });

    expect(r.answer).toBeTruthy();
    expect(r.generatedBy).toBe('LOKALNO');
  });
});
