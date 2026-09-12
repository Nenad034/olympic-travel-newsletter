import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import StatTile from '@/components/StatTile';
import Notice from '@/components/Notice';
import TabLink from '@/components/TabLink';
import { SegmentBadge } from '@/components/Badges';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStore } from '@/lib/store';
import { fmtDate, pct } from '@/lib/datum';
import { SEGMENT_LABEL, type Segment } from '@/lib/types';

function Meter({ value, total, tone = 'bg-accent' }: { value: number; total: number; tone?: string }) {
  const w = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-panel2">
        <div className={`h-full ${tone}`} style={{ width: `${w}%` }} />
      </div>
      <span className="font-mono text-[11px] text-ink-dim">{pct(value, total)}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const store = getStore();
  const sent = store.campaigns.filter((c) => c.status === 'SENT').sort((a, b) => (a.sentAt! < b.sentAt! ? 1 : -1));
  const segments: Segment[] = ['B2B_OPERATIVNI', 'B2B_PROMOTIVNI', 'B2C'];
  const bySeg = segments.map((s) => {
    const rows = sent.filter((c) => c.segment === s);
    const t = rows.reduce(
      (a, c) => ({ sent: a.sent + c.stats.sent, delivered: a.delivered + c.stats.delivered, opened: a.opened + c.stats.opened, clicked: a.clicked + c.stats.clicked, bounced: a.bounced + c.stats.bounced, complaints: a.complaints + c.stats.complaints }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
    );
    return { segment: s, campaigns: rows.length, ...t };
  });
  const all = bySeg.reduce((a, r) => ({ sent: a.sent + r.sent, opened: a.opened + r.opened, clicked: a.clicked + r.clicked, bounced: a.bounced + r.bounced, complaints: a.complaints + r.complaints }), { sent: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 });

  return (
    <div className="p-6">
      <RegisterTab label="Analitika" />
      <PageHeader title="Analitika kampanja" subtitle="Open / click / bounce po segmentu i toku. Isti podaci se sinhronizuju u M-25 semantični sloj (Cube.dev)." />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Poslato ukupno" value={all.sent} icon="mail" />
        <StatTile label="Open rate" value={pct(all.opened, all.sent)} icon="eye" tone="accent" />
        <StatTile label="Click rate" value={pct(all.clicked, all.sent)} icon="link" tone="accent" />
        <StatTile label="Bounce rate" value={pct(all.bounced, all.sent)} icon="warning" tone={all.bounced ? 'warn' : 'ok'} />
        <StatTile label="Spam prijave" value={all.complaints} icon="report" tone={all.complaints ? 'danger' : 'ok'} hint="cilj < 0,1%" />
      </div>

      <Section title="Po segmentu i toku" icon="graph" className="mb-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-panel-2">
              <TableHead>Tok</TableHead>
              <TableHead className="text-right">Kampanja</TableHead>
              <TableHead className="text-right">Poslato</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Click</TableHead>
              <TableHead>Bounce</TableHead>
              <TableHead className="text-right">Prijave</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bySeg.map((r) => (
              <TableRow key={r.segment}>
                <TableCell><div className="flex items-center gap-2"><SegmentBadge segment={r.segment} /><span className="text-ink-dim">{SEGMENT_LABEL[r.segment]}</span></div></TableCell>
                <TableCell className="text-right font-mono">{r.campaigns}</TableCell>
                <TableCell className="text-right font-mono">{r.sent}</TableCell>
                <TableCell><Meter value={r.opened} total={r.sent} /></TableCell>
                <TableCell><Meter value={r.clicked} total={r.sent} tone="bg-accent2" /></TableCell>
                <TableCell><Meter value={r.bounced} total={r.sent} tone="bg-danger" /></TableCell>
                <TableCell className="text-right font-mono">{r.complaints}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Po kampanji" icon="list-flat" className="mb-4">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-panel-2">
              <TableHead>Kampanja</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Poslato</TableHead>
              <TableHead className="text-right">Primaoci</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Click</TableHead>
              <TableHead className="text-right">Bounce</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sent.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-ink-faint">Još nema poslatih kampanja.</TableCell></TableRow>}
            {sent.map((c) => (
              <TableRow key={c.id}>
                <TableCell><TabLink href={`/kampanje/${c.id}`} label={c.name} className="font-medium text-ink hover:text-accent">{c.name}</TabLink></TableCell>
                <TableCell><SegmentBadge segment={c.segment} /></TableCell>
                <TableCell className="text-ink-dim">{fmtDate(c.sentAt)}</TableCell>
                <TableCell className="text-right font-mono">{c.stats.sent}</TableCell>
                <TableCell><Meter value={c.stats.opened} total={c.stats.sent} /></TableCell>
                <TableCell><Meter value={c.stats.clicked} total={c.stats.sent} tone="bg-accent2" /></TableCell>
                <TableCell className="text-right font-mono">{c.stats.bounced}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Notice tone="info">
        <strong>M-25 sync {store.settings.cubeSyncEnabled ? 'uključen' : 'isključen'}:</strong> metrike po kampanji/segmentu/toku odlaze u Cube.dev, ne ostaju
        zaključane u Listmonk UI-ju. Dugoročni cilj: agent koji na osnovu istorije predlaže koji tip ponude bolje prolazi kod kog segmenta.
        Izvor podataka za eksterne alate: <code className="font-mono">GET /api/campaigns</code>.
      </Notice>
    </div>
  );
}
