import Link from 'next/link';
import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import Notice from '@/components/Notice';
import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { SegmentBadge, StatusBadge } from '@/components/Badges';
import { getStore } from '@/lib/store';
import { listRecipientsCount, processDueCampaigns, scheduleConflicts } from '@/lib/campaigns';
import { fmtDateTime, fmtRelative, fmtTime } from '@/lib/datum';
import type { Campaign } from '@/lib/types';

const TZ = 'Europe/Belgrade';
const DAYS = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];
const MONTHS = ['januar', 'februar', 'mart', 'april', 'maj', 'jun', 'jul', 'avgust', 'septembar', 'oktobar', 'novembar', 'decembar'];

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ }); // YYYY-MM-DD
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  processDueCampaigns();
  const store = getStore();
  const today = new Date();
  const [y0, m0] = (m ?? today.toLocaleDateString('sv-SE', { timeZone: TZ }).slice(0, 7)).split('-').map(Number);
  const year = y0 || today.getFullYear();
  const month = (m0 || today.getMonth() + 1) - 1;

  const visible = store.campaigns.filter(
    (c) => (c.status === 'SCHEDULED' && c.sendAt) || (c.status === 'SENT' && c.sentAt) || c.status === 'RUNNING',
  );
  const byDay = new Map<string, Campaign[]>();
  for (const c of visible) {
    const key = dayKey(c.sendAt ?? c.sentAt ?? c.updatedAt);
    byDay.set(key, [...(byDay.get(key) ?? []), c]);
  }

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // ponedeljak = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const todayKey = today.toLocaleDateString('sv-SE', { timeZone: TZ });
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const fmtM = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

  const upcoming = store.campaigns
    .filter((c) => c.status === 'SCHEDULED' && c.sendAt)
    .sort((a, b) => (a.sendAt! < b.sendAt! ? -1 : 1));
  const conflicts = scheduleConflicts(store);

  return (
    <div className="p-6">
      <RegisterTab label="Kalendar slanja" />
      <PageHeader
        title="Kalendar slanja"
        subtitle="Sve zakazane i poslate kampanje po danima — više paralelnih newsletter-a može biti u redu istovremeno."
        actions={
          <div className="flex items-center gap-1">
            <Link href={`/kalendar?m=${fmtM(prev)}`} className="flex h-7 w-7 items-center justify-center rounded border border-border bg-panel hover:border-accent"><Icon name="chevron-left" className="!text-[14px]" /></Link>
            <span className="min-w-[150px] text-center text-xs font-semibold text-ink">{MONTHS[month]} {year}.</span>
            <Link href={`/kalendar?m=${fmtM(next)}`} className="flex h-7 w-7 items-center justify-center rounded border border-border bg-panel hover:border-accent"><Icon name="chevron-right" className="!text-[14px]" /></Link>
          </div>
        }
      />

      {conflicts.map((c) => (
        <Notice key={c.a.id + c.b.id} tone="warn" className="mb-3">
          <strong>Preblizu:</strong> „{c.a.name}“ ({fmtDateTime(c.a.sendAt)}) i „{c.b.name}“ ({fmtDateTime(c.b.sendAt)}) — razmak {c.gapMinutes} min,
          preporuka ≥ {store.settings.minGapMinutes} min zbog SES throughput-a.
        </Notice>
      ))}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-lg border border-border bg-panel">
          <div className="grid grid-cols-7 bg-panel-2">
            {DAYS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const key = day ? `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}` : '';
              const items = day ? (byDay.get(key) ?? []) : [];
              const isToday = key === todayKey;
              return (
                <div key={i} className={`min-h-[96px] border-b border-r border-border p-1.5 ${day ? '' : 'bg-sunken'} ${isToday ? 'bg-accent-soft' : ''}`}>
                  {day && (
                    <div className={`mb-1 text-[11px] font-mono ${isToday ? 'font-bold text-accent-strong' : 'text-ink-faint'}`}>{day}</div>
                  )}
                  <div className="flex flex-col gap-1">
                    {items.map((c) => (
                      <TabLink
                        key={c.id}
                        href={`/kampanje/${c.id}`}
                        label={c.name}
                        title={`${c.name} · ${fmtDateTime(c.sendAt ?? c.sentAt)}`}
                        className={`block truncate rounded border-l-2 px-1.5 py-0.5 text-[10px] leading-tight ${
                          c.status === 'SENT' ? 'border-ok bg-ok-bg text-ok' : c.segment === 'B2C' ? 'border-accent2 bg-accent2-soft text-ink' : 'border-accent bg-accent-soft text-ink'
                        }`}
                      >
                        <span className="font-mono">{fmtTime(c.sendAt ?? c.sentAt)}</span> {c.name}
                      </TabLink>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 px-3 py-2 text-[10px] text-ink-faint">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent" /> B2B zakazano</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent2" /> B2C zakazano</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-ok" /> poslato</span>
          </div>
        </div>

        <Section title={`U redu za slanje (${upcoming.length})`} icon="list-ordered">
          {upcoming.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema zakazanih kampanja.</p>}
          {upcoming.map((c) => (
            <TabLink key={c.id} href={`/kampanje/${c.id}`} label={c.name} className="block border-b border-border px-4 py-3 last:border-b-0 hover:bg-panel2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-ink">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-faint">
                <span>{fmtDateTime(c.sendAt)} · {fmtRelative(c.sendAt)} · {listRecipientsCount(store, c.listId)} prim.</span>
                <SegmentBadge segment={c.segment} />
              </div>
            </TabLink>
          ))}
        </Section>
      </div>
    </div>
  );
}
