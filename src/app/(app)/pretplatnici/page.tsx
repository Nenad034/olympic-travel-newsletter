import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import SubscriberIntake from '@/components/SubscriberIntake';
import SubscribersTable from '@/components/SubscribersTable';
import { getStore } from '@/lib/store';

export default function SubscribersPage() {
  const store = getStore();
  const subs = [...store.subscribers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const listOpts = store.lists.map((l) => ({
    id: l.id,
    name: l.name,
    segment: l.segment,
    optinMode: l.optinMode,
  }));
  return (
    <div className="p-6">
      <RegisterTab label="Pretplatnici" />
      <PageHeader title="Pretplatnici" subtitle={`${subs.length} zapisa · consent timestamp, izvor prijave i referenca na izvorni sistem za svaki`} />
      <Notice tone="info" className="mb-4">
        Prijave stižu automatski iz B2B portala (kreiranje naloga) i booking sistema (potvrda sa
        pristankom), preko webhook ruta — simulacija poziva je u sekciji „Integracije“. Ručni unos i
        CSV uvoz ispod služe za kontakte čiji pristanak postoji van tih sistema i traže osnov,
        datum i referencu na dokaz. Klik na red otvara brze info u desnom panelu.
      </Notice>
      <SubscriberIntake lists={listOpts} />
      <SubscribersTable subscribers={subs} lists={store.lists} events={store.events} />
    </div>
  );
}
