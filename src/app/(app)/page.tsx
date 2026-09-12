import Link from 'next/link';
import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import StatTile from '@/components/StatTile';
import Notice from '@/components/Notice';
import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { SegmentBadge, StatusBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { getStore } from '@/lib/store';
import { listRecipientsCount, processDueCampaigns, scheduleConflicts } from '@/lib/campaigns';
import { sunsetCandidates } from '@/lib/subscribers';
import { fmtDateTime, fmtRelative, pct } from '@/lib/datum';
import { LIST_B2B_OPS, LIST_B2B_PROMO, LIST_B2C } from '@/lib/seed';

export default async function HomePage() {
  await processDueCampaigns();
  const store = getStore();
  const pending = store.campaigns.filter((c) => c.status === 'PENDING_APPROVAL');
  const scheduled = store.campaigns
    .filter((c) => c.status === 'SCHEDULED')
    .sort((a, b) => (a.sendAt! < b.sendAt! ? -1 : 1));
  const sent = store.campaigns.filter((c) => c.status === 'SENT');
  const conflicts = scheduleConflicts(store);
  const sunset = sunsetCandidates(store);
  const totals = sent.reduce(
    (acc, c) => ({ sent: acc.sent + c.stats.sent, opened: acc.opened + c.stats.opened, clicked: acc.clicked + c.stats.clicked }),
    { sent: 0, opened: 0, clicked: 0 },
  );
  const b2cDomain = store.settings.domains.find((d) => d.domain === 'newsletter.olympic.rs');
  const recent = [...store.campaigns]
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    .slice(0, 6);

  return (
    <div className="p-6">
      <RegisterTab label="Početna" />
      <PageHeader
        title="Newsletter / Mailing — pregled"
        subtitle="M-27 · Listmonk motor · Amazon SES · Claude API popunjava šablone · čovek odobrava slanje"
        actions={
          <Button asChild variant="brand" size="sm">
            <Link href="/kampanje/nova" className="flex items-center gap-1.5">
              <Icon name="add" className="!text-[14px]" /> nova kampanja
            </Link>
          </Button>
        }
      />

      {(pending.length > 0 || conflicts.length > 0 || (b2cDomain && !b2cDomain.productionAccess)) && (
        <div className="mb-4 flex flex-col gap-2">
          {pending.length > 0 && (
            <Notice tone="warn">
              <strong>{pending.length}</strong> {pending.length === 1 ? 'kampanja čeka' : 'kampanje čekaju'} odobrenje —{' '}
              <TabLink href="/kampanje?status=PENDING_APPROVAL" label="Čeka odobrenje" className="underline">
                otvori red za odobravanje
              </TabLink>
              .
            </Notice>
          )}
          {conflicts.map((c) => (
            <Notice key={c.a.id + c.b.id} tone="warn">
              Dve kampanje zakazane preblizu (<strong>{c.gapMinutes} min</strong> razmaka, preporuka ≥{' '}
              {store.settings.minGapMinutes}): „{c.a.name}“ i „{c.b.name}“ — razmaknuti zbog SES throughput-a.
            </Notice>
          ))}
          {b2cDomain && !b2cDomain.productionAccess && (
            <Notice tone="info">
              Domen <strong>newsletter.olympic.rs</strong> je još u SES sandbox-u (production access nije odobren) —
              B2C kampanje idu samo na verifikovane adrese.
            </Notice>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Čeka odobrenje" value={pending.length} icon="checklist" tone={pending.length ? 'warn' : 'neutral'} hint="human-approval gate" />
        <StatTile label="Zakazano" value={scheduled.length} icon="calendar" tone="accent" hint={scheduled[0] ? `sledeće ${fmtRelative(scheduled[0].sendAt)}` : 'ništa u redu'} />
        <StatTile label="Open rate (poslato)" value={pct(totals.opened, totals.sent)} icon="eye" tone="ok" hint={`${totals.opened} / ${totals.sent} otvoreno`} />
        <StatTile label="Sunset kandidati" value={sunset.length} icon="history" tone={sunset.length ? 'warn' : 'neutral'} hint={`bez otvaranja ${store.settings.sunsetMonths}+ meseci`} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {[
          { id: LIST_B2B_OPS, icon: 'briefcase' },
          { id: LIST_B2B_PROMO, icon: 'megaphone' },
          { id: LIST_B2C, icon: 'person' },
        ].map(({ id, icon }) => {
          const list = store.lists.find((l) => l.id === id)!;
          return (
            <TabLink
              key={id}
              href={`/liste/${id}`}
              label={list.name}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3 hover:border-accent"
            >
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
                <Icon name={icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{list.name}</span>
                <span className="block text-[11px] text-ink-faint">
                  {list.sendingDomain} · {list.configurationSet}
                </span>
              </span>
              <span className="font-mono text-lg font-semibold text-ink">{listRecipientsCount(store, id)}</span>
            </TabLink>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="Sledeća slanja" icon="calendar" actions={<TabLink href="/kalendar" label="Kalendar slanja" className="text-accent hover:underline normal-case">kalendar →</TabLink>}>
          {scheduled.length === 0 && <p className="p-4 text-center text-xs text-ink-faint">Nema zakazanih kampanja.</p>}
          {scheduled.map((c) => (
            <TabLink key={c.id} href={`/kampanje/${c.id}`} label={c.name} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-panel2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-ink">{c.name}</div>
                <div className="text-[11px] text-ink-faint">
                  {fmtDateTime(c.sendAt)} · {fmtRelative(c.sendAt)} · {listRecipientsCount(store, c.listId)} primalaca
                </div>
              </div>
              <SegmentBadge segment={c.segment} />
            </TabLink>
          ))}
        </Section>

        <Section title="Poslednje aktivnosti" icon="history" actions={<TabLink href="/kampanje" label="Kampanje" className="text-accent hover:underline normal-case">sve kampanje →</TabLink>}>
          {recent.map((c) => (
            <TabLink key={c.id} href={`/kampanje/${c.id}`} label={c.name} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-panel2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-ink">{c.name}</div>
                <div className="truncate text-[11px] text-ink-faint">
                  {c.history[c.history.length - 1]?.action} · {fmtRelative(c.updatedAt)}
                </div>
              </div>
              <StatusBadge status={c.status} />
            </TabLink>
          ))}
        </Section>
      </div>
    </div>
  );
}
