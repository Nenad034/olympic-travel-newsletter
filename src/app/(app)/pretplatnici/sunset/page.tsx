import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import StatTile from '@/components/StatTile';
import SubscribersTable from '@/components/SubscribersTable';
import { getStore } from '@/lib/store';
import { sunsetCandidates } from '@/lib/subscribers';

export default function SunsetPage() {
  const store = getStore();
  const candidates = sunsetCandidates(store);
  const paused = store.subscribers.filter((s) => s.status === 'PAUSED');
  return (
    <div className="p-6">
      <RegisterTab label="Sunset / re-engagement" />
      <PageHeader
        title="Sunset / re-engagement politika"
        subtitle={`Bez otvaranja ${store.settings.sunsetMonths} meseci → re-engagement kampanja → bez reakcije → pauza. Zaštita reputacije domena kod Gmail/Outlook filtera.`}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Kandidati za re-engagement" value={candidates.length} icon="history" tone={candidates.length ? 'warn' : 'ok'} hint="B2C ili B2B promotivni tok" />
        <StatTile label="Pauzirano" value={paused.length} icon="debug-pause" hint="bez reakcije ni na re-engagement" />
        <StatTile label="Automatika" value={store.settings.reengagementEnabled ? 'UKLJ.' : 'ISKLJ.'} icon="run" tone={store.settings.reengagementEnabled ? 'ok' : 'warn'} hint="podešavanja → sunset" />
      </div>
      <Notice tone="info" className="mb-4">
        Operativni B2B tok je izuzet — partner mora primati cenovnike i rokove bez obzira na otvaranja. Re-engagement
        kampanja se pravi kao i svaka druga (segment: promo/B2C) i prolazi kroz isti human-approval gate.
      </Notice>
      <SubscribersTable subscribers={[...candidates, ...paused]} lists={store.lists} events={store.events} emptyText="Nema neaktivnih pretplatnika — baza je zdrava." />
    </div>
  );
}
