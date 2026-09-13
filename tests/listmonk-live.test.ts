import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as listmonk from '@/lib/listmonk';
import { approve, createCampaign, refreshLiveStatuses, sendTestEmail, submitForApproval, updateDraft } from '@/lib/campaigns';
import { renderTemplate } from '@/lib/email-templates';
import { LIST_B2B_PROMO } from '@/lib/seed';
import { getStore, resetStore } from '@/lib/store';

// LIVE režim adaptera protiv lažnog Listmonk API-ja u memoriji. Simulira ono što je pravi motor
// (v6.2.0) stvarno tražio na prvom prolazu 13.9.2026 — spec §2.1: token auth, sopstveni ID-jevi
// lista, test samo postojeće kampanje i postojećih pretplatnika, `messenger`, asinhron status.

interface FakeState {
  lists: { id: number; name: string }[];
  templates: { id: number; name: string; type: string }[];
  subscribers: { id: number; email: string; lists: number[] }[];
  campaigns: { id: number; status: string; body: string; sent: number; to_send: number }[];
  calls: string[];
}

let fake: FakeState;

function ok(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), { status, headers: { 'Content-Type': 'application/json' } });
}
function fail(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });
}

function fakeListmonk(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const method = init?.method ?? 'GET';
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  const p = url.pathname.replace(/^\/api/, '');
  fake.calls.push(`${method} ${p}`);
  const auth = new Headers(init?.headers).get('Authorization') ?? '';
  if (!auth.startsWith('token ')) return Promise.resolve(fail(403, 'invalid API credentials'));

  let m: RegExpMatchArray | null;
  if (p === '/health') return Promise.resolve(ok(true));
  if (p === '/lists' && method === 'GET') return Promise.resolve(ok({ results: fake.lists }));
  if (p === '/lists' && method === 'POST') {
    const l = { id: fake.lists.length + 10, name: body.name as string };
    fake.lists.push(l);
    return Promise.resolve(ok(l));
  }
  if (p === '/templates' && method === 'GET') return Promise.resolve(ok(fake.templates));
  if (p === '/templates' && method === 'POST') {
    const t = { id: fake.templates.length + 20, name: body.name as string, type: body.type as string };
    fake.templates.push(t);
    return Promise.resolve(ok(t));
  }
  if (p === '/subscribers' && method === 'POST') {
    if (fake.subscribers.some((s) => s.email === body.email)) return Promise.resolve(fail(409, 'E-mail already exists.'));
    const s = { id: fake.subscribers.length + 1, email: body.email as string, lists: body.lists as number[] };
    fake.subscribers.push(s);
    return Promise.resolve(ok(s));
  }
  if (p === '/subscribers' && method === 'GET') {
    const q = url.searchParams.get('query') ?? '';
    const email = /'([^']+)'/.exec(q)?.[1];
    return Promise.resolve(ok({ results: fake.subscribers.filter((s) => s.email === email) }));
  }
  if ((m = /^\/subscribers\/(\d+)$/.exec(p)) && method === 'PUT') {
    const s = fake.subscribers.find((x) => x.id === Number(m![1]))!;
    s.lists = body.lists as number[];
    return Promise.resolve(ok(s));
  }
  if (p === '/campaigns' && method === 'POST') {
    for (const id of body.lists as number[]) {
      if (!fake.lists.some((l) => l.id === id)) return Promise.resolve(fail(400, `Unknown list ID ${id}`));
    }
    const c = { id: fake.campaigns.length + 1, status: 'draft', body: body.body as string, sent: 0, to_send: 0 };
    fake.campaigns.push(c);
    return Promise.resolve(ok(c));
  }
  if ((m = /^\/campaigns\/(\d+)$/.exec(p)) && method === 'PUT') {
    const c = fake.campaigns.find((x) => x.id === Number(m![1]))!;
    if (c.status !== 'draft') return Promise.resolve(fail(400, 'Cannot update a running or scheduled campaign'));
    c.body = body.body as string;
    return Promise.resolve(ok(c));
  }
  if ((m = /^\/campaigns\/(\d+)$/.exec(p)) && method === 'GET') {
    const c = fake.campaigns.find((x) => x.id === Number(m![1]))!;
    return Promise.resolve(ok({ ...c, views: 3, clicks: 1, bounces: 1 }));
  }
  if ((m = /^\/campaigns\/(\d+)\/status$/.exec(p)) && method === 'PUT') {
    const c = fake.campaigns.find((x) => x.id === Number(m![1]))!;
    c.status = body.status as string;
    if (c.status === 'running') c.to_send = 10;
    return Promise.resolve(ok(c));
  }
  if ((m = /^\/campaigns\/(\d+)\/test$/.exec(p)) && method === 'POST') {
    if (body.messenger !== 'email') return Promise.resolve(fail(400, 'Unknown messenger .'));
    const emails = body.subscribers as string[];
    if (!emails.every((e) => fake.subscribers.some((s) => s.email === e))) {
      return Promise.resolve(fail(400, 'No known subscribers to test.'));
    }
    return Promise.resolve(ok(true));
  }
  if (p === '/tx' && method === 'POST') return Promise.resolve(ok(true));
  return Promise.resolve(fail(404, `nepoznata ruta ${method} ${p}`));
}

beforeEach(() => {
  fake = { lists: [{ id: 1, name: 'Default list' }], templates: [{ id: 1, name: 'Default campaign template', type: 'campaign' }], subscribers: [], campaigns: [], calls: [] };
  process.env.LISTMONK_URL = 'http://listmonk.test:9000';
  process.env.LISTMONK_API_USER = 'ot-newsletter';
  process.env.LISTMONK_API_TOKEN = 'tajna';
  vi.stubGlobal('fetch', vi.fn(fakeListmonk));
  resetStore();
});

afterEach(() => {
  delete process.env.LISTMONK_URL;
  delete process.env.LISTMONK_API_USER;
  delete process.env.LISTMONK_API_TOKEN;
  vi.unstubAllGlobals();
});

async function draftReadyForTest() {
  const c = await createCampaign({ name: 'Promo', listId: LIST_B2B_PROMO, templateId: getStore().templates[0].id, brief: 'Ponuda' });
  const data: Record<string, string> = {};
  for (const p of getStore().templates[0].placeholders) data[p.key] = `vrednost ${p.key}`;
  updateDraft(c.id, { subject: 'Naslov', contentData: data });
  return c.id;
}

describe('Listmonk LIVE — ID-jevi lista i šablona', () => {
  it('bez povezivanja LIVE slanje odbija da krene sa jasnom porukom', async () => {
    const id = await draftReadyForTest();
    await expect(sendTestEmail(id, ['marketing@olympic.rs'])).rejects.toThrow(/nije povezana sa Listmonk-om/);
    expect(fake.campaigns).toHaveLength(0);
  });

  it('syncSetup pravi liste i šablone po imenu, prenosi pretplatnike i pamti ID-jeve; ponovni poziv ne duplira', async () => {
    const first = await listmonk.syncSetup();
    expect(first.lists.every((l) => l.created)).toBe(true);
    expect(first.createdTemplates).toHaveLength(2);
    expect(first.subscribers.synced).toBe(getStore().subscribers.length);
    expect(first.subscribers.failed).toEqual([]);
    const store = getStore();
    expect(store.lists.every((l) => typeof l.listmonkListId === 'number')).toBe(true);
    expect(store.settings.listmonkTxTemplateId).toBe(first.txTemplateId);
    expect(store.settings.listmonkCampaignTemplateId).toBe(first.campaignTemplateId);

    const second = await listmonk.syncSetup();
    expect(second.lists.every((l) => !l.created)).toBe(true);
    expect(second.createdTemplates).toEqual([]);
    expect(fake.lists).toHaveLength(1 + store.lists.length);
    // postojeći pretplatnici idu na PUT (409 → pronađi → ažuriraj), ne prave duplikate
    expect(fake.subscribers).toHaveLength(store.subscribers.length);
  });
});

describe('Listmonk LIVE — tok kampanje', () => {
  it('prvi test pravi nacrt u motoru, upisuje test primaoce i šalje test sa messenger=email', async () => {
    await listmonk.syncSetup();
    const id = await draftReadyForTest();
    await sendTestEmail(id, ['novi-tester@olympic.rs']);
    const c = getStore().campaigns.find((x) => x.id === id)!;
    expect(c.listmonkCampaignId).toBe(1);
    expect(fake.campaigns[0].status).toBe('draft');
    expect(fake.subscribers.some((s) => s.email === 'novi-tester@olympic.rs' && s.lists.length === 0)).toBe(true);
    expect(fake.calls).toContain('POST /campaigns/1/test');
  });

  it('odobrenje ažurira postojeći nacrt (ne pravi novi) i pušta ga; status i brojke stižu iz motora', async () => {
    await listmonk.syncSetup();
    const id = await draftReadyForTest();
    await sendTestEmail(id, ['marketing@olympic.rs']);
    submitForApproval(id);
    await approve(id, null);
    expect(fake.campaigns).toHaveLength(1);
    expect(fake.campaigns[0].status).toBe('running');
    expect(getStore().campaigns.find((x) => x.id === id)!.status).toBe('RUNNING');

    // motor još šalje — kod nas ostaje „Šalje se"
    expect(await refreshLiveStatuses()).toBe(0);
    expect(getStore().campaigns.find((x) => x.id === id)!.status).toBe('RUNNING');

    fake.campaigns[0].status = 'finished';
    fake.campaigns[0].sent = 10;
    expect(await refreshLiveStatuses()).toBe(1);
    const done = getStore().campaigns.find((x) => x.id === id)!;
    expect(done.status).toBe('SENT');
    expect(done.stats).toMatchObject({ sent: 10, delivered: 9, opened: 3, clicked: 1, bounced: 1 });
  });

  it('kampanja ide na Listmonk čist omotač, a telo nosi Go-template oznaku za odjavu', async () => {
    await listmonk.syncSetup();
    const id = await draftReadyForTest();
    await sendTestEmail(id, ['marketing@olympic.rs']);
    const sent = fake.campaigns[0].body;
    expect(sent).toContain('{{ UnsubscribeURL }}');
    expect(sent).not.toMatch(/[^{]\{UnsubscribeURL\}/);
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => String(c[0]).endsWith('/api/campaigns') && c[1]?.method === 'POST')!;
    expect(JSON.parse(String(call[1].body)).template_id).toBe(getStore().settings.listmonkCampaignTemplateId);
  });

  it('transakciono odobrenje ne upisuje lažni ID kampanje', async () => {
    await listmonk.syncSetup();
    const ops = getStore().lists.find((l) => l.optinMode === 'AUTO_OBAVEZNO')!;
    const c = await createCampaign({ name: 'Ops', listId: ops.id, templateId: getStore().templates[0].id, brief: 'Rok' });
    const data: Record<string, string> = {};
    for (const p of getStore().templates[0].placeholders) data[p.key] = 'x';
    updateDraft(c.id, { subject: 'Rok', contentData: data });
    await sendTestEmail(c.id, ['marketing@olympic.rs']);
    submitForApproval(c.id);
    await approve(c.id, null);
    const done = getStore().campaigns.find((x) => x.id === c.id)!;
    expect(done.status).toBe('SENT');
    expect(done.listmonkCampaignId).toBeNull();
    expect(fake.calls.filter((x) => x === 'POST /tx')).toHaveLength(2); // test + pravo slanje
  });
});

describe('šablonske oznake', () => {
  it('popunjivač ne dira Listmonk oznake sa razmakom', () => {
    const html = renderTemplate('<a href="{{ UnsubscribeURL }}">{{naslov}}</a>', { naslov: 'Leto' }, { unsubscribeAllowed: true });
    expect(html).toBe('<a href="{{ UnsubscribeURL }}">Leto</a>');
  });
});
