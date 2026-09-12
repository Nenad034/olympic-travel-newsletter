import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import StatTile from '@/components/StatTile';
import Notice from '@/components/Notice';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStore } from '@/lib/store';
import { fmtDateTime } from '@/lib/datum';

export default function DeliveryPage() {
  const store = getStore();
  const events = [...store.events].sort((a, b) => (a.at < b.at ? 1 : -1));
  const bounces = events.filter((e) => e.type === 'BOUNCE').length;
  const complaints = events.filter((e) => e.type === 'COMPLAINT').length;
  const blocked = store.subscribers.filter((s) => s.status === 'BLOCKLISTED').length;

  return (
    <div className="p-6">
      <RegisterTab label="Isporuka i reputacija" />
      <PageHeader title="Isporuka i reputacija domena" subtitle="SES → SNS → Listmonk /webhooks/service/ses — bounce, complaint i delivery eventi po domenu." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bounce (30 dana)" value={bounces} icon="warning" tone={bounces ? 'warn' : 'ok'} />
        <StatTile label="Spam prijave" value={complaints} icon="report" tone={complaints ? 'danger' : 'ok'} hint="prag SES: 0,1%" />
        <StatTile label="Blokirane adrese" value={blocked} icon="circle-slash" hint="hard bounce / complaint" />
        <StatTile label="Domena" value={store.settings.domains.length} icon="globe" hint={store.settings.domains.map((d) => `p=${d.dmarcPhase.toLowerCase()}`).join(' · ')} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {store.settings.domains.map((d) => {
          const domEvents = events.filter((e) => e.domain === d.domain);
          const domBounce = domEvents.filter((e) => e.type === 'BOUNCE').length;
          const domComplaint = domEvents.filter((e) => e.type === 'COMPLAINT').length;
          const healthy = domComplaint === 0 && domBounce < 3;
          return (
            <div key={d.domain} className="rounded-lg border border-border bg-panel">
              <div className="section-head justify-between">
                <span className="font-mono normal-case tracking-normal">{d.domain}</span>
                <Badge variant={healthy ? 'ok' : 'warn'}>{healthy ? 'reputacija: dobra' : 'reputacija: pratiti'}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 p-4 text-center">
                <div><div className="font-mono text-lg font-semibold text-ink">{domEvents.filter((e) => e.type === 'DELIVERY').length}</div><div className="text-[10px] text-ink-faint">isporuka</div></div>
                <div><div className="font-mono text-lg font-semibold text-warn">{domBounce}</div><div className="text-[10px] text-ink-faint">bounce</div></div>
                <div><div className="font-mono text-lg font-semibold text-danger">{domComplaint}</div><div className="text-[10px] text-ink-faint">prijave</div></div>
              </div>
              <div className="border-t border-border px-4 py-2 text-[11px] text-ink-faint">
                {d.purpose} · warm-up dan {d.warmupDay} (limit {d.warmupDailyLimit}/dan) · SNS: <span className="font-mono">{d.snsTopic.split(':').pop()}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Section title="Dnevnik evenata" icon="list-unordered">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-panel-2">
              <TableHead>Vreme</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Adresa</TableHead>
              <TableHead>Domen</TableHead>
              <TableHead>Detalj</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-ink-faint">Nema evenata.</TableCell></TableRow>}
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-ink-dim">{fmtDateTime(e.at)}</TableCell>
                <TableCell><Badge variant={e.type === 'DELIVERY' ? 'ok' : e.type === 'BOUNCE' ? 'warn' : 'danger'}>{e.type}</Badge></TableCell>
                <TableCell className="font-mono text-[11px]">{e.email}</TableCell>
                <TableCell className="font-mono text-[11px] text-ink-dim">{e.domain}</TableCell>
                <TableCell className="text-ink-dim">{e.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
      <Notice tone="info" className="mt-4">
        Listmonk automatski obrađuje bounce/complaint (blokira adresu posle hard bounce-a ili spam prijave). Ova stranica je
        ogledalo tih evenata; test poziv: <code className="font-mono">POST /api/webhooks/ses</code> (vidi Integracije).
      </Notice>
    </div>
  );
}
