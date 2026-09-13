#!/usr/bin/env node
// Jednokratno podešavanje LOKALNOG Listmonk-a (docker/listmonk) za razvoj:
//   1. prijava admin nalogom (sesija) — Listmonk v4+ ne prima Basic auth na API-ju,
//   2. API korisnik `ot-newsletter` sa tokenom (token se vidi SAMO pri kreiranju, pa se
//      postojeći korisnik briše i pravi iznova — za razvoj je to u redu, za produkciju nije),
//   3. SMTP → Mailpit sa host mašine (host.docker.internal:1025, bez auth/TLS) da nijedan mejl ne
//      izađe napolje; čitaju se na http://localhost:8025.
// Na kraju ispisuje redove za .env.local. Liste i tx šablon NE pravi ovde — to radi sam modul
// (`listmonk.syncSetup`), jer je potrebno i u produkciji, ne samo u razvoju.
//
//   node scripts/listmonk-dev-setup.mjs [--url http://localhost:9000] [--admin admin] [--password ...]

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]] : [])).filter((p) => p.length),
);
const URL_ = (args.url ?? 'http://localhost:9000').replace(/\/$/, '');
const ADMIN = args.admin ?? process.env.LISTMONK_ADMIN_USER ?? 'admin';
const PASSWORD = args.password ?? process.env.LISTMONK_ADMIN_PASSWORD ?? 'listmonk-dev-1234';
const API_USER = 'ot-newsletter';

const login = await fetch(`${URL_}/admin/login`, {
  method: 'POST',
  redirect: 'manual',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ username: ADMIN, password: PASSWORD, next: '/admin' }),
});
const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');
if (login.status !== 302 || !cookie) {
  console.error(`Prijava nije uspela (${login.status}) — proveri admin lozinku.`);
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${URL_}/api${path}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json.message ?? ''}`);
  return json.data;
}

// 2. API korisnik
const users = await api('GET', '/users');
const existing = users.find((u) => u.username === API_USER);
if (existing) await api('DELETE', `/users/${existing.id}`);
const created = await api('POST', '/users', {
  username: API_USER,
  name: 'Olympic Travel newsletter modul',
  type: 'api',
  user_role_id: 1, // Super Admin — za razvoj; u produkciji uloga sa campaigns/lists/subscribers/tx
  status: 'enabled',
});

// 3. SMTP → Mailpit
const settings = await api('GET', '/settings');
settings.smtp = [
  {
    ...settings.smtp[0],
    name: 'mailpit',
    enabled: true,
    host: 'host.docker.internal',
    port: 1025,
    auth_protocol: 'none',
    username: '',
    password: '',
    tls_type: 'none',
    tls_skip_verify: true,
    max_conns: 5,
  },
];
settings['app.from_email'] = 'Olympic Travel <newsletter@olympic.rs>';
// Lozinke drugih sekcija dolaze maskirane („••••") i PUT ih tako i vraća — Listmonk ih tumači kao
// „nepromenjeno", pa je bezbedno poslati ceo objekat nazad.
await api('PUT', '/settings', settings);

console.log('Listmonk podešen. Motor se sam restartuje posle promene podešavanja (par sekundi).\n');
console.log('Dodaj u .env.local:');
console.log(`LISTMONK_URL=${URL_}`);
console.log(`LISTMONK_API_USER=${created.username}`);
console.log(`LISTMONK_API_TOKEN=${created.password}`);
