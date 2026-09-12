import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import NewCampaignForm from './NewCampaignForm';
import { getStore } from '@/lib/store';
import { listRecipientsCount } from '@/lib/campaigns';

export default function NewCampaignPage() {
  const store = getStore();
  const lists = store.lists.map((l) => ({
    id: l.id,
    name: l.name,
    segment: l.segment,
    sendingDomain: l.sendingDomain,
    configurationSet: l.configurationSet,
    unsubscribeAllowed: l.unsubscribeAllowed,
    description: l.description,
    recipients: listRecipientsCount(store, l.id),
  }));
  const templates = store.templates.map((t) => ({
    id: t.id,
    name: t.name,
    audience: t.audience,
    description: t.description,
    placeholders: t.placeholders.length,
  }));
  return (
    <div className="p-6">
      <RegisterTab label="Nova kampanja" />
      <PageHeader
        title="Nova kampanja"
        subtitle="1. segment i šablon → 2. brif za Claude API → nacrt → test → odobrenje → slanje / zakazivanje"
      />
      <NewCampaignForm lists={lists} templates={templates} />
    </div>
  );
}
