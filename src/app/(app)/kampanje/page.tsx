import Link from 'next/link';
import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { SegmentBadge, StatusBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStore } from '@/lib/store';
import { listRecipientsCount, processDueCampaigns } from '@/lib/campaigns';
import { fmtDateTime, fmtRelative, pct } from '@/lib/datum';
import { CAMPAIGN_STATUS_LABEL, type CampaignStatus } from '@/lib/types';

const FILTERS: { key: string; label: string; statuses: CampaignStatus[] | null }[] = [
  { key: 'SVE', label: 'Sve', statuses: null },
  { key: 'DRAFT', label: 'Nacrti', statuses: ['DRAFT'] },
  { key: 'PENDING_APPROVAL', label: 'Čeka odobrenje', statuses: ['PENDING_APPROVAL'] },
  { key: 'SCHEDULED', label: 'Zakazano', statuses: ['SCHEDULED', 'APPROVED', 'RUNNING'] },
  { key: 'SENT', label: 'Poslato', statuses: ['SENT'] },
  { key: 'CANCELLED', label: 'Otkazano', statuses: ['CANCELLED'] },
];

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; segment?: string }>;
}) {
  const { status = 'SVE', segment } = await searchParams;
  await processDueCampaigns();
  const store = getStore();
  const filter = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const rows = store.campaigns
    .filter((c) => !filter.statuses || filter.statuses.includes(c.status))
    .filter((c) => !segment || c.segment === segment)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const title = filter.key === 'PENDING_APPROVAL' ? 'Čeka odobrenje' : 'Kampanje';

  return (
    <div className="p-6">
      <RegisterTab label={title} />
      <PageHeader
        title={title}
        subtitle={`${rows.length} ${rows.length === 1 ? 'kampanja' : 'kampanja'} · nacrt → odobrenje → zakazano/šalje se → poslato`}
        actions={
          <Button asChild variant="brand" size="sm">
            <Link href="/kampanje/nova" className="flex items-center gap-1.5">
              <Icon name="add" className="!text-[14px]" /> nova kampanja
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const n = store.campaigns.filter((c) => !f.statuses || f.statuses.includes(c.status)).length;
          const active = f.key === filter.key;
          return (
            <Link
              key={f.key}
              href={f.key === 'SVE' ? '/kampanje' : `/kampanje?status=${f.key}`}
              className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium ${
                active ? 'border-accent bg-accent-soft text-ink' : 'border-border bg-panel text-ink-dim hover:border-accent'
              }`}
            >
              {f.label}
              <span className="rounded-full bg-panel2 px-1.5 font-mono text-[10px] text-ink-faint">{n}</span>
            </Link>
          );
        })}
        <span className="mx-1 h-4 w-px bg-border" />
        {(['B2B_OPERATIVNI', 'B2B_PROMOTIVNI', 'B2C'] as const).map((s) => (
          <Link
            key={s}
            href={`/kampanje?status=${filter.key}&segment=${segment === s ? '' : s}`}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium ${
              segment === s ? 'border-accent bg-accent-soft text-ink' : 'border-border bg-panel text-ink-dim hover:border-accent'
            }`}
          >
            {s === 'B2C' ? 'B2C' : s === 'B2B_OPERATIVNI' ? 'B2B operativno' : 'B2B promotivno'}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-panel">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-panel-2">
              <TableHead>Kampanja</TableHead>
              <TableHead>Segment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Termin / poslato</TableHead>
              <TableHead className="text-right">Primaoci</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead className="text-right">Click</TableHead>
              <TableHead>Izmenjeno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-ink-faint">
                  Nema kampanja za izabrani filter.
                </TableCell>
              </TableRow>
            )}
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <TabLink href={`/kampanje/${c.id}`} label={c.name} className="block">
                    <span className="block font-medium text-ink hover:text-accent">{c.name}</span>
                    <span className="block truncate text-[11px] text-ink-faint">{c.subject || '— bez naslova —'}</span>
                  </TabLink>
                </TableCell>
                <TableCell><SegmentBadge segment={c.segment} /></TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-ink-dim">
                  {c.status === 'SENT' ? fmtDateTime(c.sentAt) : c.status === 'SCHEDULED' ? fmtDateTime(c.sendAt) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {c.status === 'SENT' ? c.stats.sent : listRecipientsCount(store, c.listId)}
                </TableCell>
                <TableCell className="text-right font-mono">{pct(c.stats.opened, c.stats.sent)}</TableCell>
                <TableCell className="text-right font-mono">{pct(c.stats.clicked, c.stats.sent)}</TableCell>
                <TableCell className="whitespace-nowrap text-ink-faint">{fmtRelative(c.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-[11px] text-ink-faint">
        Statusi: {Object.values(CAMPAIGN_STATUS_LABEL).join(' · ')}
      </p>
    </div>
  );
}
