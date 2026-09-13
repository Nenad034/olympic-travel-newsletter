import 'server-only';
import { createHash } from 'node:crypto';
import { getStore, mutate, newId, now } from './store';
import * as listmonk from './listmonk';
import { CURRENT_USER } from './campaigns';
import { LIST_B2B_OPS, LIST_B2B_PROMO, LIST_B2C } from './seed';
import type { Store, Subscriber, SubscriberEvent } from './types';

export const ACTOR_PORTAL = 'B2B portal';
export const ACTOR_BOOKING = 'booking sistem';

/** Dnevnik pretplatnika — isti obrazac kao `log()` za kampanje u `campaigns.ts`. */
function logSub(sub: Subscriber, actor: string, action: string, extra: Partial<SubscriberEvent> = {}) {
  sub.history ??= [];
  sub.history.push({ ...extra, at: now(), actor, action });
}

/** Suppression lista pamti hash, ne adresu — cilj je prepoznati ponovni unos, ne zadržati
 * podatak čije je brisanje zatraženo. */
export function emailHash(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/** Vraća zapis o brisanju ako je adresa na suppression listi. */
export function suppressionFor(email: string, store: Store = getStore()) {
  const h = emailHash(email);
  return store.suppressions?.find((s) => s.emailHash === h) ?? null;
}

/** Adresa u dnevniku koji nadživljava brisanje sme da ostane samo maskirana. */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  const head = user.slice(0, 1);
  const tail = user.length > 2 ? user.slice(-1) : '';
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}${tail}@${domain}`;
}

// Spec §7 — auto-subscribe: subscribe se okida iz izvornog sistema (B2B portal ili booking)
// preko webhook ruta u src/app/api/webhooks/*. Ručni unos i CSV uvoz su dodati kao izuzetak
// za prenos postojeće baze — na dnu fajla, sa obaveznim tragom pristanka.

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
    lists: [LIST_B2B_OPS, LIST_B2B_PROMO].map((l) => listmonk.resolveListId(getStore(), l)),
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
      if (existing.company !== input.company) {
        logSub(existing, ACTOR_PORTAL, 'Podatak ažuriran sa portala', {
          field: 'firma',
          from: existing.company,
          to: input.company,
        });
        existing.company = input.company;
      }
      if (existing.status !== 'ENABLED') {
        logSub(existing, ACTOR_PORTAL, 'Ponovna sinhronizacija sa portalom', {
          field: 'status',
          from: existing.status,
          to: 'ENABLED',
        });
        existing.status = 'ENABLED';
      }
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
      history: [],
    };
    logSub(sub, ACTOR_PORTAL, 'Prijava — kreiran portal nalog', { note: input.portalAccountId });
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
    lists: [listmonk.resolveListId(getStore(), LIST_B2C)],
    preconfirm: false, // pokreće Listmonk double opt-in mejl
    attribs: { booking_ref: input.bookingRef, source: 'booking', consent_at: now() },
  });
  return mutate((store) => {
    const existing = store.subscribers.find((s) => s.email === email);
    if (existing) {
      if (!existing.listIds.includes(LIST_B2C)) {
        existing.listIds.push(LIST_B2C);
        logSub(existing, ACTOR_BOOKING, 'Dodat na listu', {
          field: 'liste',
          to: LIST_B2C,
          note: input.bookingRef,
        });
      }
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
      history: [],
    };
    logSub(sub, ACTOR_BOOKING, 'Prijava uz označen pristanak', { note: input.bookingRef });
    store.subscribers.unshift(sub);
    return sub;
  });
}

/** Potvrda double opt-in linka (B2C). */
export function confirmDoubleOptin(id: string): Subscriber {
  return mutate((store) => {
    const s = store.subscribers.find((x) => x.id === id);
    if (!s) throw new Error('Pretplatnik ne postoji');
    if (s.status === 'UNCONFIRMED') {
      logSub(s, 'pretplatnik', 'Pristanak potvrđen (double opt-in)', {
        field: 'status',
        from: 'UNCONFIRMED',
        to: 'ENABLED',
      });
      s.status = 'ENABLED';
    }
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
    logSub(s, 'pretplatnik', 'Odjava sa liste', { field: 'liste', from: listId, note: list.name });
    return s;
  });
}

/** Pravo na brisanje na zahtev (ZZPL, spec §3.2) — potpuno uklanjanje zapisa. Zapis nestaje,
 * ali trag o samom brisanju ostaje u `subscriberAudit`, sa maskiranom adresom. */
export function deleteSubscriber(id: string, reason = 'zahtev kontakta'): void {
  mutate((store) => {
    const sub = store.subscribers.find((s) => s.id === id);
    if (!sub) throw new Error('Pretplatnik ne postoji');
    const h = emailHash(sub.email);
    if (!store.suppressions.some((s) => s.emailHash === h)) {
      store.suppressions.unshift({
        emailHash: h,
        at: now(),
        reason: reason.trim() || 'zahtev kontakta',
        actor: CURRENT_USER,
      });
    }
    store.subscriberAudit.unshift({
      at: now(),
      actor: CURRENT_USER,
      action: 'Obrisan na zahtev (pravo na brisanje)',
      subscriberId: sub.id,
      emailMasked: maskEmail(sub.email),
      note: `razlog: ${reason} · izvor ${sub.source} · dnevnik od ${sub.history?.length ?? 0} zapisa uklonjen sa zapisom`,
    });
    store.subscribers = store.subscribers.filter((s) => s.id !== id);
  });
}

export function pauseSubscriber(id: string, paused: boolean): Subscriber {
  return mutate((store) => {
    const s = store.subscribers.find((x) => x.id === id);
    if (!s) throw new Error('Pretplatnik ne postoji');
    const to = paused ? 'PAUSED' : 'ENABLED';
    if (s.status !== to) {
      logSub(s, CURRENT_USER, paused ? 'Slanje pauzirano (sunset)' : 'Slanje nastavljeno', {
        field: 'status',
        from: s.status,
        to,
      });
      s.status = to;
    }
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

// --- Ručni unos i CSV uvoz (marketing tim) ---------------------------------
// Odstupanje od prvobitnog spec §7 („nema ručnog unosa"): tim mora da može da prenese
// postojeću bazu i da doda kontakt čiji pristanak postoji van portala/bookinga. Cena tog
// ustupka je da svaki takav zapis nosi osnov pristanka, datum i referencu na dokaz —
// bez toga se zapis ne kreira. B2C i dalje prolazi kroz double opt-in.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LIST_ALIAS: Record<string, string> = {
  'b2b-operativna': LIST_B2B_OPS,
  'b2b-operativni': LIST_B2B_OPS,
  'b2b-ops': LIST_B2B_OPS,
  operativna: LIST_B2B_OPS,
  'b2b-promotivna': LIST_B2B_PROMO,
  'b2b-promotivni': LIST_B2B_PROMO,
  'b2b-promo': LIST_B2B_PROMO,
  promotivna: LIST_B2B_PROMO,
  b2c: LIST_B2C,
  'b2c-newsletter': LIST_B2C,
  newsletter: LIST_B2C,
};

/** Prihvata i pun id liste i kratku oznaku iz CSV-a. */
export function resolveListId(raw: string, store: Store = getStore()): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (store.lists.some((l) => l.id === v)) return v;
  return LIST_ALIAS[v] ?? null;
}

export interface ManualSubscriberInput {
  email: string;
  name: string;
  company?: string;
  listIds: string[];
  /** Kako je pristanak pribavljen (npr. „potpisan ugovor o saradnji"). */
  consentNote: string;
  /** Kad je pristanak dat — ISO ili `YYYY-MM-DD`. */
  consentAt: string;
  /** Referenca na dokaz (broj ugovora, ID zapisa u starom sistemu…). */
  sourceRef: string;
  addedBy: string;
  source?: 'RUCNI_UNOS' | 'IMPORT_CSV';
}

export async function addSubscriberManual(
  input: ManualSubscriberInput,
): Promise<{ subscriber: Subscriber; created: boolean }> {
  const store = getStore();
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const consentNote = input.consentNote.trim();
  const sourceRef = input.sourceRef.trim();
  const company = input.company?.trim() ?? '';

  if (!EMAIL_RE.test(email)) throw new Error(`Neispravna adresa: ${input.email.trim() || '(prazno)'}`);
  // Adresa obrisana na zahtev se ne vraća ručnim unosom — povratak ide kroz izvorni sistem,
  // gde kontakt sam daje novu saglasnost (portal nalog ili booking sa čekboksom).
  const suppressed = suppressionFor(email, store);
  if (suppressed)
    throw new Error(
      `Adresa je obrisana na zahtev ${new Date(suppressed.at).toLocaleDateString('sr-RS')} (${suppressed.reason}) — povratak samo kroz portal ili booking, uz novu saglasnost`,
    );
  if (!name) throw new Error('Ime je obavezno');
  if (!consentNote) throw new Error('Osnov pristanka je obavezan — bez njega zapis nema pravni trag');
  if (!sourceRef) throw new Error('Referenca na dokaz pristanka je obavezna');

  const listIds = [...new Set(input.listIds.map((l) => l.trim()).filter(Boolean))];
  if (listIds.length === 0) throw new Error('Izaberi bar jednu listu');
  for (const id of listIds) {
    if (!store.lists.some((l) => l.id === id)) throw new Error(`Lista ne postoji: ${id}`);
  }

  const consent = new Date(input.consentAt);
  if (!input.consentAt.trim() || Number.isNaN(consent.getTime()))
    throw new Error('Datum pristanka nije ispravan');
  if (consent.getTime() > Date.now() + 60_000)
    throw new Error('Datum pristanka ne može biti u budućnosti');

  // Dokumentovan pristanak ne zamenjuje potvrdu adrese — B2C ide na double opt-in i kad je uvezen.
  const needsDoubleOptin = listIds.some(
    (id) => store.lists.find((l) => l.id === id)?.optinMode === 'DOUBLE_OPT_IN',
  );

  await listmonk.upsertSubscriber({
    email,
    name,
    lists: listIds.map((l) => listmonk.resolveListId(getStore(), l)),
    preconfirm: !needsDoubleOptin,
    attribs: {
      company,
      source: input.source === 'IMPORT_CSV' ? 'import_csv' : 'rucni_unos',
      consent_at: consent.toISOString(),
      consent_note: consentNote,
      source_ref: sourceRef,
      added_by: input.addedBy,
    },
  });

  return mutate((s) => {
    const existing = s.subscribers.find((x) => x.email === email);
    if (existing) {
      // Ranija odjava preživljava uvoz — vraćanje odjavljenog na listu je kršenje opt-outa.
      for (const id of listIds) {
        if (!existing.listIds.includes(id) && !existing.unsubscribedFrom.includes(id)) {
          existing.listIds.push(id);
          logSub(existing, input.addedBy, 'Dodat na listu', { field: 'liste', to: id });
        }
      }
      if (company && existing.company !== company) {
        logSub(existing, input.addedBy, 'Podatak izmenjen', {
          field: 'firma',
          from: existing.company,
          to: company,
        });
        existing.company = company;
      }
      return { subscriber: existing, created: false };
    }
    const sub: Subscriber = {
      id: newId('sub'),
      email,
      name,
      company: company || undefined,
      listIds,
      status: needsDoubleOptin ? 'UNCONFIRMED' : 'ENABLED',
      source: input.source ?? 'RUCNI_UNOS',
      consentAt: consent.toISOString(),
      sourceRef,
      consentNote,
      addedBy: input.addedBy,
      lastOpenAt: null,
      createdAt: now(),
      unsubscribedFrom: [],
      history: [],
    };
    logSub(sub, input.addedBy, input.source === 'IMPORT_CSV' ? 'Uvezen iz CSV-a' : 'Ručni unos', {
      note: `${consentNote} · ${sourceRef}`,
    });
    if (needsDoubleOptin)
      logSub(sub, 'sistem', 'Poslata potvrda prijave (double opt-in)', {
        field: 'status',
        to: 'UNCONFIRMED',
      });
    s.subscribers.unshift(sub);
    return { subscriber: sub, created: true };
  });
}

export interface ImportReport {
  total: number;
  created: number;
  updated: number;
  errors: { line: number; email: string; message: string }[];
}

/** Zaglavlje CSV-a — svaka kolona prihvata nekoliko naziva (srpski i engleski). */
const CSV_COLUMNS: Record<string, string[]> = {
  email: ['email', 'e-mail', 'mejl', 'mail'],
  name: ['ime', 'naziv', 'name', 'ime i prezime'],
  company: ['firma', 'agencija', 'company', 'kompanija'],
  lists: ['liste', 'lista', 'lists', 'list'],
  consentAt: ['pristanak', 'pristanak_datum', 'datum_pristanka', 'consent_at', 'consent'],
  consentNote: ['osnov', 'osnov_pristanka', 'consent_note', 'napomena'],
  sourceRef: ['referenca', 'dokaz', 'source_ref', 'ref'],
};

export const CSV_HEADER = 'email,ime,firma,liste,pristanak,osnov,referenca';

/** Minimalni CSV parser: navodnici, udvojeni navodnik kao escape, `,` ili `;` kao separator. */
function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  const delim =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export async function importSubscribersCsv(
  text: string,
  opts: { addedBy: string; defaultListIds?: string[]; defaultConsentNote?: string },
): Promise<ImportReport> {
  const rows = parseDelimited(text.replace(/^﻿/, ''));
  if (rows.length < 2) throw new Error('CSV mora imati zaglavlje i bar jedan red');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const [key, names] of Object.entries(CSV_COLUMNS)) {
    idx[key] = header.findIndex((h) => names.includes(h));
  }
  if (idx.email === -1) throw new Error(`Zaglavlje nema kolonu „email“. Očekivano: ${CSV_HEADER}`);

  const store = getStore();
  const report: ImportReport = { total: 0, created: 0, updated: 0, errors: [] };
  const seen = new Set<string>();

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const at = (k: string) => (idx[k] >= 0 ? (cells[idx[k]] ?? '').trim() : '');
    const email = at('email');
    report.total++;
    // Zaglavlje je red 1, pa je broj reda u fajlu r + 1.
    const line = r + 1;
    try {
      if (seen.has(email.toLowerCase())) throw new Error('Duplikat unutar istog fajla');
      const rawLists = at('lists');
      const listIds = rawLists
        ? rawLists.split(/[;|]/).map((v) => {
            const id = resolveListId(v, store);
            if (!id) throw new Error(`Nepoznata lista: ${v.trim()}`);
            return id;
          })
        : (opts.defaultListIds ?? []);
      const res = await addSubscriberManual({
        email,
        name: at('name') || email.split('@')[0],
        company: at('company'),
        listIds,
        consentNote: at('consentNote') || opts.defaultConsentNote || '',
        consentAt: at('consentAt') || '',
        sourceRef: at('sourceRef') || `csv-uvoz red ${line}`,
        addedBy: opts.addedBy,
        source: 'IMPORT_CSV',
      });
      seen.add(email.toLowerCase());
      if (res.created) report.created++;
      else report.updated++;
    } catch (e) {
      report.errors.push({
        line,
        email,
        message: e instanceof Error ? e.message : 'Nepoznata greška',
      });
    }
  }
  return report;
}

export interface SubscriberPatch {
  email?: string;
  name?: string;
  company?: string;
  listIds?: string[];
  consentNote?: string;
  consentAt?: string;
  sourceRef?: string;
  /** Potvrda da se kontakt svesno vraća na listu sa koje se ranije odjavio. */
  allowResubscribe?: boolean;
  /** Ko upisuje izmenu — podrazumevano prijavljeni korisnik panela. */
  actor?: string;
}

/** Ispravka postojećeg zapisa. Trag pristanka za zapise iz portala/bookinga se ne dira —
 * on je ono što izvorni sistem tvrdi, a ne nešto što marketing tim naknadno podešava. */
export async function updateSubscriber(id: string, patch: SubscriberPatch): Promise<Subscriber> {
  const store = getStore();
  const current = store.subscribers.find((s) => s.id === id);
  if (!current) throw new Error('Pretplatnik ne postoji');

  const email = patch.email === undefined ? current.email : patch.email.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`Neispravna adresa: ${patch.email?.trim() || '(prazno)'}`);
  if (email !== current.email && store.subscribers.some((s) => s.id !== id && s.email === email))
    throw new Error(`Adresa ${email} već postoji u bazi`);

  const name = patch.name === undefined ? current.name : patch.name.trim();
  if (!name) throw new Error('Ime je obavezno');
  const company = patch.company === undefined ? (current.company ?? '') : patch.company.trim();

  const listIds =
    patch.listIds === undefined
      ? [...current.listIds]
      : [...new Set(patch.listIds.map((l) => l.trim()).filter(Boolean))];
  if (listIds.length === 0) throw new Error('Kontakt mora ostati na bar jednoj listi');
  for (const lid of listIds) {
    if (!store.lists.some((l) => l.id === lid)) throw new Error(`Lista ne postoji: ${lid}`);
  }
  const backOn = listIds.filter((lid) => current.unsubscribedFrom.includes(lid));
  if (backOn.length > 0 && !patch.allowResubscribe) {
    const names = backOn.map((lid) => store.lists.find((l) => l.id === lid)?.name ?? lid);
    throw new Error(`Kontakt se odjavio sa: ${names.join(', ')} — vraćanje traži izričitu potvrdu`);
  }

  const manual = current.source === 'RUCNI_UNOS' || current.source === 'IMPORT_CSV';
  let consentAt = current.consentAt;
  let consentNote = current.consentNote;
  let sourceRef = current.sourceRef;
  if (manual) {
    if (patch.consentAt !== undefined) {
      const d = new Date(patch.consentAt);
      if (!patch.consentAt.trim() || Number.isNaN(d.getTime()))
        throw new Error('Datum pristanka nije ispravan');
      if (d.getTime() > Date.now() + 60_000)
        throw new Error('Datum pristanka ne može biti u budućnosti');
      consentAt = d.toISOString();
    }
    if (patch.consentNote !== undefined) {
      consentNote = patch.consentNote.trim();
      if (!consentNote) throw new Error('Osnov pristanka ne sme da ostane prazan');
    }
    if (patch.sourceRef !== undefined) {
      sourceRef = patch.sourceRef.trim();
      if (!sourceRef) throw new Error('Referenca na dokaz ne sme da ostane prazna');
    }
  }

  // Nova lista sa double opt-in pravilom traži potvrdu adrese kao i kod prvog unosa.
  const added = listIds.filter((lid) => !current.listIds.includes(lid));
  const newDoubleOptin = added.some(
    (lid) => store.lists.find((l) => l.id === lid)?.optinMode === 'DOUBLE_OPT_IN',
  );

  await listmonk.upsertSubscriber({
    email,
    name,
    lists: listIds.map((l) => listmonk.resolveListId(getStore(), l)),
    preconfirm: !newDoubleOptin,
    attribs: { company, source: current.source.toLowerCase(), source_ref: sourceRef },
  });

  const actor = patch.actor ?? CURRENT_USER;
  return mutate((s) => {
    const sub = s.subscribers.find((x) => x.id === id);
    if (!sub) throw new Error('Pretplatnik ne postoji');
    const listName = (lid: string) => s.lists.find((l) => l.id === lid)?.name ?? lid;

    const scalars: [string, string, string][] = [
      ['email', sub.email, email],
      ['ime', sub.name, name],
      ['firma', sub.company ?? '', company],
      ['datum pristanka', sub.consentAt, consentAt],
      ['osnov pristanka', sub.consentNote ?? '', consentNote ?? ''],
      ['referenca', sub.sourceRef, sourceRef],
    ];
    for (const [field, from, to] of scalars) {
      if (from !== to) logSub(sub, actor, 'Podatak izmenjen', { field, from, to });
    }
    for (const lid of listIds.filter((x) => !sub.listIds.includes(x))) {
      logSub(
        sub,
        actor,
        sub.unsubscribedFrom.includes(lid) ? 'Vraćen na listu (izričita potvrda)' : 'Dodat na listu',
        { field: 'liste', to: lid, note: listName(lid) },
      );
    }
    for (const lid of sub.listIds.filter((x) => !listIds.includes(x))) {
      logSub(sub, actor, 'Uklonjen sa liste', { field: 'liste', from: lid, note: listName(lid) });
    }

    sub.email = email;
    sub.name = name;
    sub.company = company || undefined;
    sub.listIds = listIds;
    sub.unsubscribedFrom = sub.unsubscribedFrom.filter((lid) => !listIds.includes(lid));
    sub.consentAt = consentAt;
    sub.consentNote = consentNote;
    sub.sourceRef = sourceRef;
    if (newDoubleOptin && sub.status === 'ENABLED') {
      logSub(sub, 'sistem', 'Nova lista traži double opt-in', {
        field: 'status',
        from: 'ENABLED',
        to: 'UNCONFIRMED',
      });
      sub.status = 'UNCONFIRMED';
    }
    return sub;
  });
}
