import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import Notice from '@/components/Notice';
import { Badge } from '@/components/ui/badge';
import IntegrationSimulators from './IntegrationSimulators';
import { getStore } from '@/lib/store';
import { listmonkMode } from '@/lib/listmonk';

const CONTRACTS = [
  {
    id: 'portal',
    title: 'B2B portal → auto-subscribe',
    method: 'POST',
    path: '/api/webhooks/portal',
    when: 'Pri kreiranju naloga subagenta na portalu.',
    effect: 'Dodaje na B2B operativnu (obavezno) i B2B promotivnu (opt-out dostupan odmah) listu. preconfirm=true.',
    body: `{
  "email": "office@agencija.rs",
  "name": "Ime Prezime",
  "company": "Agencija d.o.o.",
  "portalAccountId": "portal-acc-1234"
}`,
    response: `{ "ok": true, "subscriberId": "sub-…", "lists": ["lst-b2b-operativna", "lst-b2b-promotivna"] }`,
  },
  {
    id: 'booking',
    title: 'Booking sistem → auto-subscribe (B2C)',
    method: 'POST',
    path: '/api/webhooks/booking',
    when: 'Pri potvrdi bookinga; consent je vrednost čekboksa koji je putnik označio.',
    effect: 'Samo uz consent=true: dodaje na B2C listu i pokreće Listmonk double opt-in. consent=false → nema prijave (200, subscribed:false).',
    body: `{
  "email": "putnik@gmail.com",
  "name": "Ime Prezime",
  "bookingRef": "BK-2026-3107",
  "consent": true
}`,
    response: `{ "ok": true, "subscribed": true, "subscriberId": "sub-…", "status": "UNCONFIRMED" }`,
  },
  {
    id: 'ses',
    title: 'Amazon SNS → SES eventi',
    method: 'POST',
    path: '/api/webhooks/ses',
    when: 'SNS topic po domenu; u produkciji ide i direktno na Listmonk /webhooks/service/ses.',
    effect: 'Beleži bounce/complaint/delivery; hard bounce ili complaint → adresa blokirana.',
    body: `{
  "Type": "Notification",
  "Message": "{\\"eventType\\":\\"Bounce\\",\\"bounce\\":{\\"bounceType\\":\\"Permanent\\"},\\"mail\\":{\\"source\\":\\"newsletter@b2b.olympic.rs\\",\\"destination\\":[\\"office@putniktours.rs\\"]}}"
}`,
    response: `{ "ok": true, "type": "BOUNCE" }`,
  },
  {
    id: 'campaigns',
    title: 'M-25 semantični sloj (Cube.dev) ← metrike',
    method: 'GET',
    path: '/api/campaigns',
    when: 'Periodično (Cube refresh) ili posle svakog slanja.',
    effect: 'Vraća id, naziv, status, segment, termine i stats (sent/delivered/opened/clicked/bounced/complaints) po kampanji.',
    body: '',
    response: `[{ "id": "cmp-001", "name": "…", "status": "SENT", "segment": "B2B_OPERATIVNI", "stats": { "sent": 12, "opened": 11, … } }]`,
  },
];

export default function IntegrationsPage() {
  const store = getStore();
  return (
    <div className="p-6">
      <RegisterTab label="Integracije" />
      <PageHeader title="Integracije" subtitle="API kontrakti prema portalu, booking sistemu, SES/SNS i M-25 — plus simulacija poziva za lokalnu proveru." />
      <Notice tone="info" className="mb-4">
        Webhook rute proveravaju zaglavlje <code className="font-mono">x-webhook-secret</code> ako je podešen{' '}
        <code className="font-mono">WEBHOOK_SECRET</code>. Listmonk motor: <Badge variant={listmonkMode() === 'LIVE' ? 'ok' : 'warn'}>{listmonkMode()}</Badge>{' '}
        — u mock režimu se pozivi ka Listmonk API-ju preskaču, a lokalna baza se ažurira identično.
      </Notice>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          {CONTRACTS.map((c) => (
            <Section key={c.id} title={c.title} icon="plug" actions={<span className="font-mono normal-case tracking-normal"><Badge variant="outline">{c.method}</Badge> {c.path}</span>}>
              <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                <div className="text-xs text-ink-dim">
                  <div className="mb-1"><span className="text-ink-faint">Kada:</span> {c.when}</div>
                  <div><span className="text-ink-faint">Efekat:</span> {c.effect}</div>
                </div>
                <div>
                  {c.body && (
                    <>
                      <div className="label">Telo zahteva</div>
                      <pre className="mb-2 overflow-x-auto rounded-md bg-sunken p-2 font-mono text-[11px] text-ink">{c.body}</pre>
                    </>
                  )}
                  <div className="label">Odgovor</div>
                  <pre className="overflow-x-auto rounded-md bg-sunken p-2 font-mono text-[11px] text-ink">{c.response}</pre>
                </div>
              </div>
            </Section>
          ))}
          <Section title="Listmonk API (motor u pozadini)" icon="server" bodyClassName="p-4 text-xs text-ink-dim">
            <ul className="flex flex-col gap-1">
              <li><code className="font-mono">POST /api/campaigns</code> — kreiranje kampanje sa <code className="font-mono">send_at</code> (zakazano) i <code className="font-mono">X-SES-CONFIGURATION-SET</code> zaglavljem</li>
              <li><code className="font-mono">PUT /api/campaigns/:id/status</code> — scheduled / running / cancelled</li>
              <li><code className="font-mono">POST /api/campaigns/:id/test</code> — test slanje na internu listu</li>
              <li><code className="font-mono">POST /api/subscribers</code> — auto-subscribe sa <code className="font-mono">preconfirm_subscriptions</code> (B2B: true, B2C: false → double opt-in)</li>
              <li><code className="font-mono">/webhooks/service/ses</code> — nativna SES/SNS podrška (bounce, complaint, delivery)</li>
            </ul>
            <p className="mt-2 text-[11px] text-ink-faint">Podesi u <code className="font-mono">.env.local</code>: LISTMONK_URL, LISTMONK_USER, LISTMONK_PASSWORD. Adapter: <code className="font-mono">src/lib/listmonk.ts</code>.</p>
          </Section>
        </div>
        <IntegrationSimulators subscriberCount={store.subscribers.length} />
      </div>
    </div>
  );
}
