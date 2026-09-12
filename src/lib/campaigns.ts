import 'server-only';
import { getStore, mutate, newId, now } from './store';
import { fillTemplate } from './claude';
import * as listmonk from './listmonk';
import { missingPlaceholders, renderTemplate } from './email-templates';
import type { Campaign, CampaignStatus, MailingList, Segment, Store, Template } from './types';

// Tok kampanje (spec §5.2 + §6): DRAFT → (Claude popuni) → PENDING_APPROVAL → APPROVED →
// SCHEDULED | RUNNING → SENT. Otkazivanje moguće do početka slanja. Human-approval gate je
// jedini prelaz ka Listmonk-u — bez `approve` ništa ne odlazi ka motoru.

export const CURRENT_USER = 'Milena Vasić';

export function listIdNumber(listId: string): number {
  // Listmonk koristi numeričke ID-jeve lista; mapiramo stabilno iz stringa.
  let h = 0;
  for (const c of listId) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return h + 1;
}

function requireCampaign(store: Store, id: string): Campaign {
  const c = store.campaigns.find((x) => x.id === id);
  if (!c) throw new Error('Kampanja ne postoji');
  return c;
}
function requireList(store: Store, id: string): MailingList {
  const l = store.lists.find((x) => x.id === id);
  if (!l) throw new Error('Lista ne postoji');
  return l;
}
function requireTemplate(store: Store, id: string): Template {
  const t = store.templates.find((x) => x.id === id);
  if (!t) throw new Error('Šablon ne postoji');
  return t;
}

function log(c: Campaign, action: string, note?: string, actor = CURRENT_USER) {
  c.history.push({ at: now(), actor, action, note });
  c.updatedAt = now();
}

function assertStatus(c: Campaign, allowed: CampaignStatus[], what: string) {
  if (!allowed.includes(c.status)) {
    throw new Error(`${what} nije moguće u statusu "${c.status}"`);
  }
}

export function renderCampaignHtml(store: Store, c: Campaign): string {
  const tpl = requireTemplate(store, c.templateId);
  const list = requireList(store, c.listId);
  return renderTemplate(tpl.html, c.contentData, { unsubscribeAllowed: list.unsubscribeAllowed });
}

export function createCampaign(input: {
  name: string;
  listId: string;
  templateId: string;
  brief: string;
}): Campaign {
  return mutate((store) => {
    const list = requireList(store, input.listId);
    requireTemplate(store, input.templateId);
    const c: Campaign = {
      id: newId('cmp'),
      name: input.name.trim(),
      subject: '',
      listId: list.id,
      segment: list.segment,
      templateId: input.templateId,
      status: 'DRAFT',
      brief: input.brief.trim(),
      contentData: {},
      bodyHtml: null,
      generatedBy: null,
      testSentAt: null,
      testRecipients: [],
      approvedBy: null,
      approvedAt: null,
      sendAt: null,
      sentAt: null,
      listmonkCampaignId: null,
      deliveryMode: list.unsubscribeAllowed ? 'KAMPANJA' : 'TRANSAKCIONO',
      stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
      history: [],
      createdBy: CURRENT_USER,
      createdAt: now(),
      updatedAt: now(),
    };
    log(c, 'Nacrt kreiran');
    store.campaigns.unshift(c);
    return c;
  });
}

export function updateDraft(
  id: string,
  patch: { name?: string; subject?: string; brief?: string; contentData?: Record<string, string> },
): Campaign {
  return mutate((store) => {
    const c = requireCampaign(store, id);
    assertStatus(c, ['DRAFT', 'PENDING_APPROVAL'], 'Izmena sadržaja');
    if (patch.name !== undefined) c.name = patch.name.trim();
    if (patch.subject !== undefined) c.subject = patch.subject.trim();
    if (patch.brief !== undefined) c.brief = patch.brief.trim();
    if (patch.contentData) {
      c.contentData = { ...c.contentData, ...patch.contentData };
      if (c.generatedBy === null) c.generatedBy = 'RUCNO';
    }
    c.bodyHtml = renderCampaignHtml(store, c);
    // Svaka izmena sadržaja posle slanja na odobrenje vraća kampanju u nacrt — odobrava se
    // tačno ono što je pregledano, ne kasnija verzija.
    if (c.status === 'PENDING_APPROVAL') {
      c.status = 'DRAFT';
      log(c, 'Sadržaj izmenjen — vraćeno u nacrt');
    } else {
      log(c, 'Sadržaj izmenjen');
    }
    return c;
  });
}

/** Spec §5.2 korak 1–2: Claude API popunjava placeholder-e. */
export async function generateContent(id: string): Promise<Campaign> {
  const store = getStore();
  const c = requireCampaign(store, id);
  assertStatus(c, ['DRAFT', 'PENDING_APPROVAL'], 'Generisanje sadržaja');
  const tpl = requireTemplate(store, c.templateId);
  const result = await fillTemplate({
    segment: c.segment,
    campaignName: c.name,
    brief: c.brief,
    placeholders: tpl.placeholders,
    existing: c.contentData,
  });
  return mutate((s) => {
    const cc = requireCampaign(s, id);
    cc.contentData = { ...cc.contentData, ...result.data };
    if (!cc.subject) cc.subject = result.subject;
    cc.generatedBy = result.generatedBy;
    cc.bodyHtml = renderCampaignHtml(s, cc);
    cc.status = 'DRAFT';
    log(
      cc,
      'Šablon popunjen sadržajem',
      result.generatedBy === 'CLAUDE' ? `Claude API (${result.model})` : 'lokalni popunjivač (bez API ključa)',
      result.generatedBy === 'CLAUDE' ? 'Claude API' : 'Lokalni popunjivač',
    );
    return cc;
  });
}

export function submitForApproval(id: string): Campaign {
  return mutate((store) => {
    const c = requireCampaign(store, id);
    assertStatus(c, ['DRAFT'], 'Slanje na odobrenje');
    const tpl = requireTemplate(store, c.templateId);
    const missing = missingPlaceholders(tpl.placeholders, c.contentData);
    if (missing.length) throw new Error(`Nepopunjena polja: ${missing.join(', ')}`);
    if (!c.subject) throw new Error('Naslov (subject) mejla je obavezan');
    c.bodyHtml = renderCampaignHtml(store, c);
    c.status = 'PENDING_APPROVAL';
    log(c, 'Poslato na odobrenje');
    return c;
  });
}

/** Spec §5.2 korak 5 — test slanje na internu listu pre pune baze. */
export async function sendTestEmail(id: string, recipients: string[]): Promise<Campaign> {
  const store = getStore();
  const c = requireCampaign(store, id);
  assertStatus(c, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'], 'Test slanje');
  const emails = recipients.map((e) => e.trim()).filter(Boolean);
  if (!emails.length) throw new Error('Unesite bar jednog test primaoca');
  const payload = buildPayload(store, c);
  if (c.deliveryMode === 'TRANSAKCIONO') {
    // Operativni tok nema Listmonk kampanju — test ide istim transakcionim kanalom (§3.1.1).
    const list = requireList(store, c.listId);
    await listmonk.sendTransactional({
      emails,
      subject: `[TEST] ${c.subject}`,
      html: payload.body,
      fromEmail: `Olympic Travel <obavestenja@${list.sendingDomain}>`,
      headers: payload.headers ?? [],
    });
  } else if (c.listmonkCampaignId) {
    await listmonk.sendTest(c.listmonkCampaignId, emails, payload);
  }
  return mutate((s) => {
    const cc = requireCampaign(s, id);
    cc.testSentAt = now();
    cc.testRecipients = emails;
    log(cc, 'Test slanje', `${emails.length} primalaca: ${emails.join(', ')}`);
    return cc;
  });
}

function buildPayload(store: Store, c: Campaign): listmonk.ListmonkCampaignPayload {
  const list = requireList(store, c.listId);
  return {
    name: c.name,
    subject: c.subject,
    lists: [listIdNumber(list.id)],
    from_email: `Olympic Travel <newsletter@${list.sendingDomain}>`,
    content_type: 'html',
    body: c.bodyHtml ?? renderCampaignHtml(store, c),
    send_at: c.sendAt,
    headers: [{ 'X-SES-CONFIGURATION-SET': list.configurationSet }],
    tags: [c.segment.toLowerCase()],
  };
}

function activeRecipients(store: Store, listId: string): string[] {
  return store.subscribers
    .filter((sub) => sub.listIds.includes(listId) && sub.status === 'ENABLED')
    .map((sub) => sub.email);
}

/**
 * Spec §3.1.1 — operativni B2B tok se šalje transakciono (`/api/tx`, po primaocu, bez
 * unsubscribe linka), ne kao Listmonk kampanja. Vraća simbolički ID pošiljke za dnevnik.
 */
async function sendTransactionalNow(store: Store, c: Campaign): Promise<listmonk.ListmonkResult> {
  const list = requireList(store, c.listId);
  return listmonk.sendTransactional({
    emails: activeRecipients(store, c.listId),
    subject: c.subject,
    html: c.bodyHtml ?? renderCampaignHtml(store, c),
    fromEmail: `Olympic Travel <obavestenja@${list.sendingDomain}>`,
    headers: [{ 'X-SES-CONFIGURATION-SET': list.configurationSet }],
  });
}

/**
 * Human-approval gate (spec §5.2 korak 3, §6.3). Odobrava se sadržaj I termin zajedno:
 * `sendAt = null` → pošalji odmah, inače → SCHEDULED.
 *
 * KAMPANJA (promo/B2C): Listmonk kampanja sa `send_at` — motor sam zakazuje i šalje.
 * TRANSAKCIONO (operativni tok, §3.1.1): Listmonk `/api/tx` nema zakazivanje, pa zakazano
 * slanje pokreće `processDueCampaigns` kad termin prođe; sadržaj je zaključan od odobrenja.
 */
export async function approve(id: string, sendAt: string | null): Promise<Campaign> {
  const store = getStore();
  const c = requireCampaign(store, id);
  assertStatus(c, ['PENDING_APPROVAL'], 'Odobravanje');
  if (!c.testSentAt) throw new Error('Pre odobrenja pošaljite test na internu listu');
  if (sendAt && new Date(sendAt).getTime() < Date.now() - 60_000) {
    throw new Error('Termin slanja je u prošlosti');
  }
  const payload = buildPayload(store, { ...c, sendAt });
  const transactional = c.deliveryMode === 'TRANSAKCIONO';

  let result: listmonk.ListmonkResult | null = null;
  if (transactional) {
    if (!sendAt) result = await sendTransactionalNow(store, { ...c, bodyHtml: payload.body });
  } else {
    result = await listmonk.createCampaign(payload);
    await listmonk.setCampaignStatus(result.campaignId, sendAt ? 'scheduled' : 'running');
  }

  return mutate((s) => {
    const cc = requireCampaign(s, id);
    cc.approvedBy = CURRENT_USER;
    cc.approvedAt = now();
    cc.listmonkCampaignId = result?.campaignId ?? null;
    cc.bodyHtml = payload.body;
    if (sendAt) {
      cc.sendAt = sendAt;
      cc.status = 'SCHEDULED';
      log(cc, 'Odobreno i zakazano', `${formatSr(sendAt)}${transactional ? ' · transakciono slanje' : ''}`);
    } else {
      cc.status = 'RUNNING';
      log(
        cc,
        'Odobreno — pošalji odmah',
        transactional ? 'transakciono (/api/tx), bez unsubscribe linka' : `Listmonk kampanja #${result!.campaignId}`,
      );
      // Transakciono slanje je sinhrono; mock motor "završava" i kampanje odmah.
      if (transactional || result?.mode === 'MOCK') finishSend(s, cc);
    }
    return cc;
  });
}

/** Spec §6.1/§6.3 — izmena termina posle odobrenja ne traži ponovno odobrenje sadržaja. */
export async function reschedule(id: string, sendAt: string): Promise<Campaign> {
  const store = getStore();
  const c = requireCampaign(store, id);
  assertStatus(c, ['SCHEDULED'], 'Promena termina');
  if (new Date(sendAt).getTime() < Date.now() - 60_000) throw new Error('Termin je u prošlosti');
  if (c.listmonkCampaignId) {
    await listmonk.updateCampaign(c.listmonkCampaignId, { send_at: sendAt });
    await listmonk.setCampaignStatus(c.listmonkCampaignId, 'scheduled');
  }
  return mutate((s) => {
    const cc = requireCampaign(s, id);
    cc.sendAt = sendAt;
    log(cc, 'Termin promenjen', formatSr(sendAt));
    return cc;
  });
}

export async function cancel(id: string): Promise<Campaign> {
  const store = getStore();
  const c = requireCampaign(store, id);
  assertStatus(c, ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED'], 'Otkazivanje');
  if (c.listmonkCampaignId) await listmonk.setCampaignStatus(c.listmonkCampaignId, 'cancelled');
  return mutate((s) => {
    const cc = requireCampaign(s, id);
    cc.status = 'CANCELLED';
    cc.sendAt = null;
    log(cc, 'Otkazano');
    return cc;
  });
}

export function deleteCampaign(id: string): void {
  mutate((store) => {
    const c = requireCampaign(store, id);
    assertStatus(c, ['DRAFT', 'CANCELLED'], 'Brisanje');
    store.campaigns = store.campaigns.filter((x) => x.id !== id);
  });
}

/**
 * Scheduler za dospele zakazane kampanje — poziva se pri svakom čitanju (layout, /api/summary).
 * TRANSAKCIONO: stvarno šalje preko `/api/tx` (Listmonk nema send_at za tx mejlove).
 * KAMPANJA u mock režimu: simulira završetak; u LIVE režimu Listmonk sam šalje, ovde se ne dira.
 */
export function processDueCampaigns(): void {
  const store = getStore();
  const due = store.campaigns.filter(
    (c) => c.status === 'SCHEDULED' && c.sendAt && new Date(c.sendAt).getTime() <= Date.now(),
  );
  if (!due.length) return;
  const live = listmonk.listmonkMode() === 'LIVE';
  const toFinish = due.filter((c) => c.deliveryMode === 'TRANSAKCIONO' || !live);
  if (!toFinish.length) return;
  // Transakciono slanje ide asinhrono ka motoru; lokalno stanje se odmah prebacuje u SENT da
  // dva paralelna čitanja ne pošalju istu kampanju dvaput.
  const pending = mutate((s) => {
    const out: Campaign[] = [];
    for (const d of toFinish) {
      const c = requireCampaign(s, d.id);
      finishSend(s, c);
      if (c.deliveryMode === 'TRANSAKCIONO' && live) out.push(c);
    }
    return out;
  });
  for (const c of pending) {
    void sendTransactionalNow(store, c).catch((e: unknown) => {
      mutate((s) => {
        const cc = requireCampaign(s, c.id);
        log(cc, 'Greška pri transakcionom slanju', e instanceof Error ? e.message : String(e), 'Listmonk');
      });
    });
  }
}

function finishSend(store: Store, c: Campaign) {
  const recipients = activeRecipients(store, c.listId).length;
  const opened = Math.round(recipients * (c.segment === 'B2C' ? 0.42 : 0.78));
  c.stats = {
    sent: recipients,
    delivered: recipients,
    opened,
    clicked: Math.round(opened * 0.45),
    bounced: 0,
    complaints: 0,
  };
  c.status = 'SENT';
  c.sentAt = now();
  log(c, 'Poslato', `${recipients} primalaca${c.deliveryMode === 'TRANSAKCIONO' ? ' · transakciono' : ''}`, 'Listmonk');
}

export function formatSr(iso: string): string {
  return new Date(iso).toLocaleString('sr-RS', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Belgrade',
  });
}

/** Spec §6.2 — upozorenje kad su dve veće kampanje zakazane preblizu. */
export interface ScheduleConflict {
  a: Campaign;
  b: Campaign;
  gapMinutes: number;
}

export function scheduleConflicts(store: Store): ScheduleConflict[] {
  const scheduled = store.campaigns
    .filter((c) => c.status === 'SCHEDULED' && c.sendAt)
    .sort((x, y) => new Date(x.sendAt!).getTime() - new Date(y.sendAt!).getTime());
  const out: ScheduleConflict[] = [];
  for (let i = 1; i < scheduled.length; i++) {
    const a = scheduled[i - 1];
    const b = scheduled[i];
    const gap = (new Date(b.sendAt!).getTime() - new Date(a.sendAt!).getTime()) / 60000;
    if (gap < store.settings.minGapMinutes) out.push({ a, b, gapMinutes: Math.round(gap) });
  }
  return out;
}

export function listRecipientsCount(store: Store, listId: string): number {
  return store.subscribers.filter((s) => s.listIds.includes(listId) && s.status === 'ENABLED')
    .length;
}

export function segmentOfList(store: Store, listId: string): Segment {
  return requireList(store, listId).segment;
}
