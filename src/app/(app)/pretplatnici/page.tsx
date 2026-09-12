import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import SubscribersTable from '@/components/SubscribersTable';
import { getStore } from '@/lib/store';

export default function SubscribersPage() {
  const store = getStore();
  const subs = [...store.subscribers].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return (
    <div className="p-6">
      <RegisterTab label="Pretplatnici" />
      <PageHeader title="Pretplatnici" subtitle={`${subs.length} zapisa · consent timestamp, izvor prijave i referenca na izvorni sistem za svaki`} />
      <Notice tone="info" className="mb-4">
        Nema ručnog unosa — prijave stižu isključivo iz B2B portala (kreiranje naloga) i booking sistema (potvrda sa
        pristankom), preko webhook ruta. Simulacija poziva je u sekciji „Integracije“.
      </Notice>
      <SubscribersTable subscribers={subs} lists={store.lists} />
    </div>
  );
}
