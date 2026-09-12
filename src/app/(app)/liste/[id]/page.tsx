import { notFound } from 'next/navigation';
import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import StatTile from '@/components/StatTile';
import SubscribersTable from '@/components/SubscribersTable';
import { SegmentBadge } from '@/components/Badges';
import { getStore } from '@/lib/store';

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const list = store.lists.find((l) => l.id === id);
  if (!list) notFound();
  const members = store.subscribers.filter((s) => s.listIds.includes(list.id));
  const active = members.filter((s) => s.status === 'ENABLED').length;
  const sentHere = store.campaigns.filter((c) => c.listId === list.id && c.status === 'SENT');
  const totals = sentHere.reduce((a, c) => ({ sent: a.sent + c.stats.sent, opened: a.opened + c.stats.opened }), { sent: 0, opened: 0 });

  return (
    <div className="p-6">
      <RegisterTab label={list.name} />
      <PageHeader
        title={list.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SegmentBadge segment={list.segment} />
            <span className="font-mono">{list.sendingDomain}</span> · <span className="font-mono">{list.configurationSet}</span> ·{' '}
            {list.unsubscribeAllowed ? 'odjava dozvoljena' : 'bez odjave (operativni tok)'}
          </span>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Aktivnih" value={active} icon="person" tone="ok" />
        <StatTile label="Čeka potvrdu" value={members.filter((s) => s.status === 'UNCONFIRMED').length} icon="mail" tone="warn" hint={list.optinMode === 'DOUBLE_OPT_IN' ? 'double opt-in' : 'n/a'} />
        <StatTile label="Odjavljeno" value={store.subscribers.filter((s) => s.unsubscribedFrom.includes(list.id)).length} icon="bell-slash" />
        <StatTile label="Kampanja poslato" value={sentHere.length} icon="send" hint={totals.sent ? `open ${Math.round((totals.opened / totals.sent) * 100)}%` : undefined} />
      </div>
      <SubscribersTable subscribers={members} lists={store.lists} events={store.events} showLists={false} />
    </div>
  );
}
