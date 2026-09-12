import 'server-only';
import { getStore, mutate, newId, now } from './store';
import * as listmonk from './listmonk';
import { listIdNumber } from './campaigns';
import { LIST_B2B_OPS, LIST_B2B_PROMO, LIST_B2C } from './seed';
import type { Store, Subscriber } from './types';

// Spec §7 — auto-subscribe. Nema ručnog unosa: subscribe se uvek okida iz izvornog sistema
// (B2B portal ili booking) preko webhook ruta u src/app/api/webhooks/*.

export async function subscribeFromPortal(input: {
  email: string;
  name: string;
  company: string;
  portalAccountId: string;
}): Promise<Subscriber> {
  const email = input.email.trim().toLowerCase();
  await listmonk.upsertSubscriber({
    email,
    name: input.name,
    lists: [listIdNumber(LIST_B2B_OPS), listIdNumber(LIST_B2B_PROMO)],
    preconfirm: true, // B2B: nema double opt-in, poslovni kontekst
    attribs: { company: input.company, portal_account_id: input.portalAccountId, source: 'portal' },
  });
  return mutate((store) => {
    const existing = store.subscribers.find((s) => s.email === email);
    if (existing) {
      // Operativna lista je obavezna — vraća se i ako je ranije bio uklonjen; promotivnu ne
      // vraćamo ako se sam odjavio (odjava mora da preživi ponovnu sinhronizaciju).
      if (!existing.listIds.includes(LIST_B2B_OPS)) existing.listIds.push(LIST_B2B_OPS);
      if (
        !existing.listIds.includes(LIST_B2B_PROMO) &&
        !existing.unsubscribedFrom.includes(LIST_B2B_PROMO)
      )
        existing.listIds.push(LIST_B2B_PROMO);
      existing.company = input.company;
      existing.status = 'ENABLED';
      return existing;
    }
    const sub: Subscriber = {
      id: newId('sub'),
      email,
      name: input.name,
      company: input.company,
      listIds: [LIST_B2B_OPS, LIST_B2B_PROMO],
      status: 'ENABLED',
      source: 'PORTAL',
      consentAt: now(),
      sourceRef: input.portalAccountId,
      lastOpenAt: null,
      createdAt: now(),
      unsubscribedFrom: [],
    };
    store.subscribers.unshift(sub);
    return sub;
  });
}

export async function subscribeFromBooking(input: {
  email: string;
  name: string;
  bookingRef: string;
  consent: boolean;
}): Promise<Subscriber | null> {
  // Spec §3.2 — bez označenog čekboksa nema prijave. Nikad prećutna saglasnost.
  if (!input.consent) return null;
  const email = input.email.trim().toLowerCase();
  await listmonk.upsertSubscriber({
    email,
    name: input.name,
    lists: [listIdNumber(LIST_B2C)],
    preconfirm: false, // pokreće Listmonk double opt-in mejl
    attribs: { booking_ref: input.bookingRef, source: 'booking', consent_at: now() },
  });
  return mutate((store) => {
    const existing = store.subscribers.find((s) => s.email === email);
    if (existing) {
      if (!existing.listIds.includes(LIST_B2C)) existing.listIds.push(LIST_B2C);
      return existing;
    }
    const sub: Subscriber = {
      id: newId('sub'),
      email,
      name: input.name,
      listIds: [LIST_B2C],
      status: 'UNCONFIRMED',
      source: 'BOOKING',
      consentAt: now(),
      sourceRef: input.bookingRef,
      lastOpenAt: null,
      createdAt: now(),
      unsubscribedFrom: [],
    };
    store.subscribers.unshift(sub);
    return sub;
  });
}

/** Potvrda double opt-in linka (B2C). */
export function confirmDoubleOptin(id: string): Subscriber {
  return mutate((store) => {
    const s = store.subscribers.find((x) => x.id === id);
    if (!s) throw new Error('Pretplatnik ne postoji');
    if (s.status === 'UNCONFIRMED') s.status = 'ENABLED';
    return s;
  });
}

/** Odjava sa jedne liste — operativni B2B tok nema odjavu (spec §3.1). */
export function unsubscribeFromList(id: string, listId: string): Subscriber {
  return mutate((store) => {
    const s = store.subscribers.find((x) => x.id === id);
    if (!s) throw new Error('Pretplatnik ne postoji');
    const list = store.lists.find((l) => l.id === listId);
    if (!list) throw new Error('Lista ne postoji');
    if (!list.unsubscribeAllowed) throw new Error('Operativni tok ne podržava odjavu');
    s.listIds = s.listIds.filter((l) => l !== listId);
    if (!s.unsubscribedFrom.includes(listId)) s.unsubscribedFrom.push(listId);
    return s;
  });
}

/** Pravo na brisanje na zahtev (ZZPL, spec §3.2) — potpuno uklanjanje zapisa. */
export function deleteSubscriber(id: string): void {
  mutate((store) => {
    store.subscribers = store.subscribers.filter((s) => s.id !== id);
  });
}

export function pauseSubscriber(id: string, paused: boolean): Subscriber {
  return mutate((store) => {
    const s = store.subscribers.find((x) => x.id === id);
    if (!s) throw new Error('Pretplatnik ne postoji');
    s.status = paused ? 'PAUSED' : 'ENABLED';
    return s;
  });
}

/** Spec §8 — sunset kandidati: bez otvaranja `sunsetMonths` meseci, na B2C ili B2B promo toku. */
export function sunsetCandidates(store: Store = getStore()): Subscriber[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - store.settings.sunsetMonths);
  return store.subscribers.filter((s) => {
    if (s.status !== 'ENABLED') return false;
    const promoOrB2c = s.listIds.includes(LIST_B2B_PROMO) || s.listIds.includes(LIST_B2C);
    if (!promoOrB2c) return false;
    const last = s.lastOpenAt ? new Date(s.lastOpenAt) : new Date(s.createdAt);
    return last < cutoff;
  });
}
