import 'server-only';
import { getStore, mutate } from './store';
import type { MailingList, Store, Subscriber } from './types';

// Listmonk REST adapter (spec §2). Listmonk je "motor" u pozadini — ovaj modul je jedino
// mesto koje zna njegov API. Kad LISTMONK_URL nije podešen, sve operacije rade nad lokalnim
// mock stanjem (store.json) i vraćaju simulirane ID-jeve, tako da UI tok (kreiraj → test →
// odobri → zakaži) radi identično i bez motora.
//
// Provereno protiv Listmonk v6.2.0 (13.9.2026, docker/listmonk):
// - API prima SAMO API korisnika sa tokenom (`Authorization: token korisnik:token`); Basic auth
//   admin nalogom vraća 403 „invalid API credentials".
// - ID-jevi lista i šablona su Listmonk-ovi, ne naši: modul ih dobija sinhronizacijom
//   (`syncSetup`) i čuva u store-u (`MailingList.listmonkListId`, `Settings.listmonk*TemplateId`).
//   Bez sinhronizacije LIVE slanje odbija da krene — bolje jasna greška nego kampanja poslata
//   pogrešnoj listi.

export interface ListmonkCampaignPayload {
  name: string;
  subject: string;
  lists: number[];
  from_email: string;
  content_type: 'html';
  body: string;
  send_at?: string | null;
  headers?: Record<string, string>[];
  tags?: string[];
  template_id?: number;
  /** Listmonk traži kanal eksplicitno na test slanju („Unknown messenger" bez njega). */
  messenger: 'email';
}

export interface ListmonkResult {
  mode: 'LIVE' | 'MOCK';
  campaignId: number;
}

/** Nazivi pod kojima modul prepoznaje SVOJE objekte u Listmonk-u — po njima ih pronalazi pri
 * ponovnoj sinhronizaciji, pa se ne prave duplikati. */
export const TX_TEMPLATE_NAME = 'Olympic Travel — transakcioni omotač (modul M-27)';
export const CAMPAIGN_TEMPLATE_NAME = 'Olympic Travel — čist omotač (modul M-27)';

function config() {
  const url = process.env.LISTMONK_URL?.replace(/\/$/, '');
  const user = process.env.LISTMONK_API_USER ?? process.env.LISTMONK_USER;
  const token = process.env.LISTMONK_API_TOKEN ?? process.env.LISTMONK_PASSWORD;
  if (!url || !user || !token) return null;
  return { url, auth: `token ${user}:${token}` };
}

export function listmonkMode(): 'LIVE' | 'MOCK' {
  return config() ? 'LIVE' : 'MOCK';
}

export class ListmonkError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(method: string, pathname: string, body?: unknown): Promise<T> {
  const cfg = config();
  if (!cfg) throw new Error('Listmonk nije konfigurisan');
  const res = await fetch(`${cfg.url}/api${pathname}`, {
    method,
    headers: { Authorization: cfg.auth, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as { data?: T; message?: string };
  if (!res.ok) {
    // Listmonk-ova poruka ide u dnevnik kampanje — „409" samo po sebi nikom ne pomaže.
    throw new ListmonkError(
      `Listmonk ${method} ${pathname} → ${res.status}${json.message ? `: ${json.message}` : ''}`,
      res.status,
    );
  }
  return json.data as T;
}

let mockCounter = 100;

/** Mock ID liste — stabilan iz stringa, da tok bez motora ima nešto smisleno u dnevniku. */
function mockListId(listId: string): number {
  let h = 0;
  for (const c of listId) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return h + 1;
}

/**
 * Listmonk ID naše liste. U LIVE režimu mora da postoji iz sinhronizacije — hash iz stringa
 * (mock) bi u pravom motoru pokazivao na tuđu ili nepostojeću listu.
 */
export function resolveListId(store: Store, listId: string): number {
  const list = store.lists.find((l) => l.id === listId);
  if (!list) throw new Error(`Lista ${listId} ne postoji`);
  if (!config()) return mockListId(listId);
  if (list.listmonkListId == null) {
    throw new Error(
      `Lista „${list.name}" nije povezana sa Listmonk-om — pokreni sinhronizaciju na ekranu SES i domeni`,
    );
  }
  return list.listmonkListId;
}

/** Kreira kampanju u Listmonk-u (status draft ili scheduled ako je `send_at` zadat). */
export async function createCampaign(payload: ListmonkCampaignPayload): Promise<ListmonkResult> {
  if (!config()) return { mode: 'MOCK', campaignId: ++mockCounter };
  const data = await call<{ id: number }>('POST', '/campaigns', {
    ...payload,
    type: 'regular',
    send_at: payload.send_at ?? undefined,
  });
  return { mode: 'LIVE', campaignId: data.id };
}

export async function updateCampaign(
  id: number,
  payload: Partial<ListmonkCampaignPayload>,
): Promise<void> {
  if (!config()) return;
  await call('PUT', `/campaigns/${id}`, payload);
}

/** Listmonk status prelazi: draft → scheduled / running / cancelled. */
export async function setCampaignStatus(
  id: number,
  status: 'draft' | 'scheduled' | 'running' | 'cancelled' | 'paused',
): Promise<void> {
  if (!config()) return;
  await call('PUT', `/campaigns/${id}/status`, { status });
}

export interface ListmonkCampaignState {
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'cancelled' | 'finished';
  sent: number;
  toSend: number;
  views: number;
  clicks: number;
  bounces: number;
}

/** Stanje kampanje u motoru — Listmonk šalje asinhrono, pa naš status prati njegov (`refreshLiveStatuses`). */
export async function getCampaign(id: number): Promise<ListmonkCampaignState | null> {
  if (!config()) return null;
  const c = await call<{
    status: ListmonkCampaignState['status'];
    sent: number;
    to_send: number;
    views: number;
    clicks: number;
    bounces: number;
  }>('GET', `/campaigns/${id}`);
  return { status: c.status, sent: c.sent, toSend: c.to_send, views: c.views, clicks: c.clicks, bounces: c.bounces };
}

/** Test slanje na internu listu (spec §5.2 korak 5) — Listmonk `POST /campaigns/{id}/test`. */
export async function sendTest(id: number, emails: string[], payload: ListmonkCampaignPayload) {
  if (!config()) return;
  await call('POST', `/campaigns/${id}/test`, { ...payload, subscribers: emails });
}

/**
 * Spec §3.1.1 — operativni B2B tok se NE šalje kao Listmonk "kampanja" (koja po defaultu dobija
 * unsubscribe link), nego kao transakcioni mejl (`POST /api/tx`, po primaocu). Transakcioni
 * mehanizam po prirodi nema unsubscribe link — nema ručnog uklanjanja po šablonu, ni rizika da
 * operativna poruka ode kroz pogrešan tip kampanje. Šablon je onaj koji `syncSetup` napravi
 * (`Settings.listmonkTxTemplateId`): renderuje `{{ .Tx.Data.subject }}` i `{{ .Tx.Data.body }}`.
 */
export async function sendTransactional(input: {
  emails: string[];
  subject: string;
  html: string;
  fromEmail: string;
  headers: Record<string, string>[];
  templateId: number | null | undefined;
}): Promise<ListmonkResult> {
  if (!config()) return { mode: 'MOCK', campaignId: ++mockCounter };
  if (input.templateId == null) {
    throw new Error('Transakcioni šablon nije povezan sa Listmonk-om — pokreni sinhronizaciju na ekranu SES i domeni');
  }
  await call('POST', '/tx', {
    subscriber_emails: input.emails,
    template_id: input.templateId,
    data: { subject: input.subject, body: input.html },
    headers: input.headers,
    from_email: input.fromEmail,
    content_type: 'html',
  });
  return { mode: 'LIVE', campaignId: ++mockCounter };
}

/**
 * Auto-subscribe (spec §7) — `POST /subscribers` sa `preconfirm_subscriptions` po toku.
 * Listmonk na postojeću adresu vraća 409, pa se tada ide na `PUT /subscribers/{id}` — isti
 * sadržaj, `lists` je ciljni skup listi (PUT ga postavlja, ne dodaje).
 */
export async function upsertSubscriber(input: {
  email: string;
  name: string;
  lists: number[];
  preconfirm: boolean;
  attribs: Record<string, unknown>;
  status?: 'enabled' | 'disabled' | 'blocklisted';
}): Promise<void> {
  if (!config()) return;
  const body = {
    email: input.email,
    name: input.name,
    status: input.status ?? 'enabled',
    lists: input.lists,
    preconfirm_subscriptions: input.preconfirm,
    attribs: input.attribs,
  };
  try {
    await call('POST', '/subscribers', body);
  } catch (e) {
    if (!(e instanceof ListmonkError) || e.status !== 409) throw e;
    const existing = await findSubscriber(input.email);
    if (!existing) throw e;
    await call('PUT', `/subscribers/${existing.id}`, body);
  }
}

/**
 * Test primaoci moraju da postoje kao pretplatnici u motoru — Listmonk `/campaigns/{id}/test`
 * inače vraća „No known subscribers to test". Upisuju se BEZ liste, da interni nalozi ne bi
 * završili u pravoj bazi primalaca; ime se uzima iz našeg store-a ako ga ima.
 */
export async function ensureSubscribers(store: Store, emails: string[]): Promise<void> {
  if (!config()) return;
  for (const email of emails) {
    const known = store.subscribers.find((s) => s.email === email);
    await upsertSubscriber({
      email,
      name: known?.name ?? email.split('@')[0],
      lists: known ? known.listIds.map((l) => resolveListId(store, l)) : [],
      preconfirm: true,
      attribs: { source: known?.source.toLowerCase() ?? 'interni_test' },
    });
  }
}

/** Naš status → Listmonk status pretplatnika (UNCONFIRMED je status PRETPLATE, ne pretplatnika:
 * pretplatnik je `enabled`, a `preconfirm: false` ostavlja pretplatu nepotvrđenom). */
function listmonkStatus(s: Subscriber): 'enabled' | 'disabled' | 'blocklisted' {
  if (s.status === 'BLOCKLISTED') return 'blocklisted';
  if (s.status === 'PAUSED') return 'disabled';
  return 'enabled';
}

async function findSubscriber(email: string): Promise<{ id: number } | null> {
  const q = encodeURIComponent(`subscribers.email = '${email.replace(/'/g, "''")}'`);
  const data = await call<{ results: { id: number }[] }>('GET', `/subscribers?query=${q}&per_page=1`);
  return data.results[0] ?? null;
}

export async function health(): Promise<{ mode: 'LIVE' | 'MOCK'; ok: boolean }> {
  if (!config()) return { mode: 'MOCK', ok: true };
  try {
    await call('GET', '/health');
    return { mode: 'LIVE', ok: true };
  } catch {
    return { mode: 'LIVE', ok: false };
  }
}

export interface SyncReport {
  lists: { id: string; name: string; listmonkListId: number; created: boolean }[];
  txTemplateId: number;
  campaignTemplateId: number;
  createdTemplates: string[];
  /** Pretplatnici preneti u motor (upsert) i oni koje motor nije prihvatio, sa razlogom. */
  subscribers: { synced: number; failed: { email: string; error: string }[] };
}

/**
 * Povezivanje sa motorom: za svaku našu listu pronađe (po imenu) ili napravi Listmonk listu, i
 * obezbedi dva šablona — transakcioni omotač za operativni tok i „čist" kampanjski omotač za
 * promotivni/B2C tok. Čist omotač je potreban jer Listmonk-ov podrazumevani šablon ume naš ceo
 * HTML da uvije u svoj raspored sa sopstvenim podnožjem; naši šabloni već nose `{{ UnsubscribeURL }}`.
 *
 * Idempotentno: ponovni poziv ne pravi duplikate, samo osveži ID-jeve u store-u. Poziva se ručno
 * sa ekrana SES i domeni — ne automatski pri startu, jer pravi objekte u tuđem sistemu.
 */
export async function syncSetup(): Promise<SyncReport> {
  if (!config()) throw new Error('Listmonk nije konfigurisan (LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN)');
  const store = getStore();

  const remote = await call<{ results: { id: number; name: string }[] }>('GET', '/lists?per_page=all');
  const lists: SyncReport['lists'] = [];
  for (const list of store.lists) {
    const found = remote.results.find((r) => r.name === list.name);
    if (found) {
      lists.push({ id: list.id, name: list.name, listmonkListId: found.id, created: false });
      continue;
    }
    const created = await call<{ id: number }>('POST', '/lists', {
      name: list.name,
      type: 'private',
      optin: optinFor(list),
      description: list.description,
      tags: [list.segment.toLowerCase()],
    });
    lists.push({ id: list.id, name: list.name, listmonkListId: created.id, created: true });
  }

  const templates = await call<{ id: number; name: string; type: string }[]>('GET', '/templates');
  const createdTemplates: string[] = [];
  async function ensureTemplate(name: string, body: Record<string, unknown>): Promise<number> {
    const found = templates.find((t) => t.name === name && t.type === body.type);
    if (found) return found.id;
    const created = await call<{ id: number }>('POST', '/templates', { name, ...body });
    createdTemplates.push(name);
    return created.id;
  }
  const txTemplateId = await ensureTemplate(TX_TEMPLATE_NAME, {
    type: 'tx',
    subject: '{{ .Tx.Data.subject }}',
    body: '{{ .Tx.Data.body }}',
  });
  const campaignTemplateId = await ensureTemplate(CAMPAIGN_TEMPLATE_NAME, {
    type: 'campaign',
    body: '{{ template "content" . }}',
  });

  const synced = mutate((s) => {
    for (const l of lists) {
      const target = s.lists.find((x) => x.id === l.id);
      if (target) target.listmonkListId = l.listmonkListId;
    }
    s.settings.listmonkTxTemplateId = txTemplateId;
    s.settings.listmonkCampaignTemplateId = campaignTemplateId;
    s.settings.listmonkSyncedAt = new Date().toISOString();
    return s;
  });

  // Postojeća baza pretplatnika → motor. Bez ovoga bi svaka kampanja otišla praznoj listi, a test
  // slanje bi bilo odbijeno. Upsert po adresi je idempotentan; jedan po jedan (Listmonk ima i
  // bulk uvoz preko fajla, ali ovde je bitno da svaka greška ima adresu i razlog).
  const subscribers: SyncReport['subscribers'] = { synced: 0, failed: [] };
  for (const sub of synced.subscribers) {
    try {
      await upsertSubscriber({
        email: sub.email,
        name: sub.name,
        lists: sub.listIds.map((l) => resolveListId(synced, l)),
        preconfirm: sub.status !== 'UNCONFIRMED',
        status: listmonkStatus(sub),
        attribs: { company: sub.company, source: sub.source.toLowerCase(), source_ref: sub.sourceRef },
      });
      subscribers.synced += 1;
    } catch (e) {
      subscribers.failed.push({ email: sub.email, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { lists, txTemplateId, campaignTemplateId, createdTemplates, subscribers };
}

/** Naš opt-in režim → Listmonk `optin`. Operativni tok (obavezan) i opt-out su `single`
 * (potvrda odmah, bez mejla); B2C traži `double` — Listmonk sam šalje potvrdni mejl. */
function optinFor(list: MailingList): 'single' | 'double' {
  return list.optinMode === 'DOUBLE_OPT_IN' ? 'double' : 'single';
}
