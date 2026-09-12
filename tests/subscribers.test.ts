import { beforeEach, describe, expect, it } from 'vitest';
import {
  addSubscriberManual,
  importSubscribersCsv,
  unsubscribeFromList,
  updateSubscriber,
} from '@/lib/subscribers';
import { LIST_B2B_OPS, LIST_B2B_PROMO, LIST_B2C } from '@/lib/seed';
import { getStore, resetStore } from '@/lib/store';

const TIM = 'Test Tim';

function byEmail(email: string) {
  const s = getStore().subscribers.find((x) => x.email === email);
  if (!s) throw new Error(`nema zapisa za ${email}`);
  return s;
}

beforeEach(() => {
  resetStore();
});

describe('CSV uvoz', () => {
  it('prihvata zarez kao separator i više lista u jednom polju', async () => {
    const csv = [
      'email,ime,firma,liste,pristanak,osnov,referenca',
      'nova@agencija.rs,Nova Agencija,Nova d.o.o.,b2b-operativna|b2b-promotivna,2026-02-14,ugovor,UG-1',
    ].join('\n');

    const r = await importSubscribersCsv(csv, { addedBy: TIM });

    expect(r).toMatchObject({ total: 1, created: 1, updated: 0 });
    expect(r.errors).toEqual([]);
    const sub = byEmail('nova@agencija.rs');
    expect(sub.listIds).toEqual([LIST_B2B_OPS, LIST_B2B_PROMO]);
    expect(sub.source).toBe('IMPORT_CSV');
    expect(sub.consentNote).toBe('ugovor');
  });

  it('prihvata tačku-zarez kao separator kolona', async () => {
    const csv = [
      'email;ime;firma;liste;pristanak;osnov;referenca',
      'druga@agencija.rs;Druga Agencija;Druga d.o.o.;b2b-operativna;2026-03-01;ugovor;UG-2',
    ].join('\n');

    const r = await importSubscribersCsv(csv, { addedBy: TIM });

    expect(r.created).toBe(1);
    expect(byEmail('druga@agencija.rs').listIds).toEqual([LIST_B2B_OPS]);
  });

  it('odbija neispravne redove pojedinačno, sa brojem reda, i pušta ostatak fajla', async () => {
    const csv = [
      'email,ime,liste,pristanak,osnov,referenca',
      'dobra@agencija.rs,Dobra,b2b-operativna,2026-02-14,ugovor,UG-3',
      'nije-adresa,Loša,b2b-operativna,2026-02-14,ugovor,UG-4',
      'bez.datuma@agencija.rs,Bez Datuma,b2b-operativna,,ugovor,UG-5',
      'nepoznata.lista@agencija.rs,Nepoznata,ne-postoji,2026-02-14,ugovor,UG-6',
      'bez.osnova@agencija.rs,Bez Osnova,b2b-operativna,2026-02-14,,UG-7',
    ].join('\n');

    const r = await importSubscribersCsv(csv, { addedBy: TIM });

    expect(r.total).toBe(5);
    expect(r.created).toBe(1);
    // Broj reda je broj linije u fajlu, sa zaglavljem kao redom 1.
    expect(r.errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
    expect(r.errors[0].message).toMatch(/Neispravna adresa/);
    expect(r.errors[1].message).toMatch(/Datum pristanka/);
    expect(r.errors[2].message).toMatch(/Nepoznata lista/);
    expect(r.errors[3].message).toMatch(/Osnov pristanka/);
    expect(getStore().subscribers.some((s) => s.email === 'bez.datuma@agencija.rs')).toBe(false);
  });

  it('prijavljuje duplikat unutar istog fajla umesto da ga uveze dvaput', async () => {
    const csv = [
      'email,ime,liste,pristanak,osnov,referenca',
      'ista@agencija.rs,Ista,b2b-operativna,2026-02-14,ugovor,UG-8',
      'ista@agencija.rs,Ista Opet,b2b-operativna,2026-02-14,ugovor,UG-9',
    ].join('\n');

    const r = await importSubscribersCsv(csv, { addedBy: TIM });

    expect(r.created).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toMatchObject({ line: 3, message: 'Duplikat unutar istog fajla' });
  });

  it('odjava preživljava uvoz — uvezeni red ne vraća kontakt na listu sa koje se odjavio', async () => {
    const email = 'odjavljen@agencija.rs';
    const { subscriber } = await addSubscriberManual({
      email,
      name: 'Odjavljen Subagent',
      listIds: [LIST_B2B_OPS, LIST_B2B_PROMO],
      consentNote: 'ugovor',
      consentAt: '2026-01-10',
      sourceRef: 'UG-10',
      addedBy: TIM,
    });
    unsubscribeFromList(subscriber.id, LIST_B2B_PROMO);

    const csv = [
      'email,ime,liste,pristanak,osnov,referenca',
      `${email},Odjavljen Subagent,b2b-operativna|b2b-promotivna,2026-01-10,ugovor,UG-10`,
    ].join('\n');
    const r = await importSubscribersCsv(csv, { addedBy: TIM });

    expect(r).toMatchObject({ created: 0, updated: 1 });
    const after = byEmail(email);
    expect(after.listIds).toEqual([LIST_B2B_OPS]);
    expect(after.unsubscribedFrom).toContain(LIST_B2B_PROMO);
  });
});

describe('ručni unos', () => {
  it('ne kreira zapis bez osnova pristanka', async () => {
    await expect(
      addSubscriberManual({
        email: 'bez.osnova@agencija.rs',
        name: 'Bez Osnova',
        listIds: [LIST_B2B_OPS],
        consentNote: '   ',
        consentAt: '2026-02-14',
        sourceRef: 'UG-11',
        addedBy: TIM,
      }),
    ).rejects.toThrow(/Osnov pristanka/);
  });

  it('B2C unos ulazi kao UNCONFIRMED i čeka double opt-in', async () => {
    const { subscriber } = await addSubscriberManual({
      email: 'putnik@gmail.com',
      name: 'Putnik Putnikovic',
      listIds: [LIST_B2C],
      consentNote: 'čekboks na sajmu',
      consentAt: '2026-04-02',
      sourceRef: 'SAJAM-1',
      addedBy: TIM,
    });

    expect(subscriber.status).toBe('UNCONFIRMED');
  });
});

describe('updateSubscriber — tri zaštite', () => {
  async function noviB2B(email = 'izmena@agencija.rs') {
    const { subscriber } = await addSubscriberManual({
      email,
      name: 'Izmena Test',
      listIds: [LIST_B2B_OPS, LIST_B2B_PROMO],
      consentNote: 'ugovor',
      consentAt: '2026-01-05',
      sourceRef: 'UG-12',
      addedBy: TIM,
    });
    return subscriber;
  }

  it('odbija vraćanje na listu sa koje se kontakt odjavio bez izričite potvrde', async () => {
    const sub = await noviB2B();
    unsubscribeFromList(sub.id, LIST_B2B_PROMO);

    await expect(
      updateSubscriber(sub.id, { listIds: [LIST_B2B_OPS, LIST_B2B_PROMO] }),
    ).rejects.toThrow(/izričitu potvrdu/);
    expect(byEmail(sub.email).listIds).toEqual([LIST_B2B_OPS]);
  });

  it('vraća kontakt na listu kad je potvrda data i briše zapis o odjavi', async () => {
    const sub = await noviB2B('potvrda@agencija.rs');
    unsubscribeFromList(sub.id, LIST_B2B_PROMO);

    const after = await updateSubscriber(sub.id, {
      listIds: [LIST_B2B_OPS, LIST_B2B_PROMO],
      allowResubscribe: true,
    });

    expect(after.listIds).toEqual([LIST_B2B_OPS, LIST_B2B_PROMO]);
    expect(after.unsubscribedFrom).toEqual([]);
    expect(after.history.at(-1)).toMatchObject({ action: 'Vraćen na listu (izričita potvrda)' });
  });

  it('dodavanje liste sa double opt-in pravilom vraća zapis u UNCONFIRMED', async () => {
    const sub = await noviB2B('dvostruka@agencija.rs');
    expect(sub.status).toBe('ENABLED');

    const after = await updateSubscriber(sub.id, {
      listIds: [LIST_B2B_OPS, LIST_B2B_PROMO, LIST_B2C],
    });

    expect(after.status).toBe('UNCONFIRMED');
  });

  it('ne dozvoljava da kontakt ostane bez ijedne liste', async () => {
    const sub = await noviB2B('bez.liste@agencija.rs');

    await expect(updateSubscriber(sub.id, { listIds: [] })).rejects.toThrow(/bar jednoj listi/);
    expect(byEmail(sub.email).listIds).toHaveLength(2);
  });

  it('odbija adresu koju već koristi drugi zapis', async () => {
    const prvi = await noviB2B('prvi@agencija.rs');
    await noviB2B('drugi@agencija.rs');

    await expect(updateSubscriber(prvi.id, { email: 'drugi@agencija.rs' })).rejects.toThrow(
      /već postoji/,
    );
  });
});
