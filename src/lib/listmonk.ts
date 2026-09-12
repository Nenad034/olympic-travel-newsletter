import 'server-only';

// Listmonk REST adapter (spec §2). Listmonk je "motor" u pozadini — ovaj modul je jedino
// mesto koje zna njegov API. Kad LISTMONK_URL nije podešen, sve operacije rade nad lokalnim
// mock stanjem (store.json) i vraćaju simulirane ID-jeve, tako da UI tok (kreiraj → test →
// odobri → zakaži) radi identično i bez motora.

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
}

export interface ListmonkResult {
  mode: 'LIVE' | 'MOCK';
  campaignId: number;
}

function config() {
  const url = process.env.LISTMONK_URL?.replace(/\/$/, '');
  const user = process.env.LISTMONK_USER;
  const password = process.env.LISTMONK_PASSWORD;
  if (!url || !user || !password) return null;
  return { url, auth: 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64') };
}

export function listmonkMode(): 'LIVE' | 'MOCK' {
  return config() ? 'LIVE' : 'MOCK';
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
  if (!res.ok) throw new Error(`Listmonk ${method} ${pathname} → ${res.status}`);
  const json = (await res.json()) as { data: T };
  return json.data;
}

let mockCounter = 100;

/** Kreira kampanju u Listmonk-u (status draft ili scheduled ako je `send_at` zadat). */
export async function createCampaign(payload: ListmonkCampaignPayload): Promise<ListmonkResult> {
  if (!config()) return { mode: 'MOCK', campaignId: ++mockCounter };
  const data = await call<{ id: number }>('POST', '/campaigns', payload);
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
  status: 'scheduled' | 'running' | 'cancelled' | 'paused',
): Promise<void> {
  if (!config()) return;
  await call('PUT', `/campaigns/${id}/status`, { status });
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
 * operativna poruka ode kroz pogrešan tip kampanje. Zahteva Listmonk tx šablon koji renderuje
 * `{{ .Tx.Data.body }}` (LISTMONK_TX_TEMPLATE_ID, podrazumevano 1).
 */
export async function sendTransactional(input: {
  emails: string[];
  subject: string;
  html: string;
  fromEmail: string;
  headers: Record<string, string>[];
}): Promise<ListmonkResult> {
  if (!config()) return { mode: 'MOCK', campaignId: ++mockCounter };
  const templateId = Number(process.env.LISTMONK_TX_TEMPLATE_ID ?? '1');
  await call('POST', '/tx', {
    subscriber_emails: input.emails,
    template_id: templateId,
    data: { subject: input.subject, body: input.html },
    headers: input.headers,
    from_email: input.fromEmail,
    content_type: 'html',
  });
  return { mode: 'LIVE', campaignId: ++mockCounter };
}

/** Auto-subscribe (spec §7) — `POST /subscribers` sa `preconfirm_subscriptions` po toku. */
export async function upsertSubscriber(input: {
  email: string;
  name: string;
  lists: number[];
  preconfirm: boolean;
  attribs: Record<string, unknown>;
}): Promise<void> {
  if (!config()) return;
  await call('POST', '/subscribers', {
    email: input.email,
    name: input.name,
    status: 'enabled',
    lists: input.lists,
    preconfirm_subscriptions: input.preconfirm,
    attribs: input.attribs,
  });
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
