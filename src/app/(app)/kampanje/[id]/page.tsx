import { notFound } from 'next/navigation';
import RegisterTab from '@/components/RegisterTab';
import CampaignWorkbench from './CampaignWorkbench';
import { getStore } from '@/lib/store';
import { listRecipientsCount, processDueCampaigns } from '@/lib/campaigns';
import { claudeConfigured } from '@/lib/claude';

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await processDueCampaigns();
  const store = getStore();
  const campaign = store.campaigns.find((c) => c.id === id);
  if (!campaign) notFound();
  const template = store.templates.find((t) => t.id === campaign.templateId)!;
  const list = store.lists.find((l) => l.id === campaign.listId)!;
  const otherScheduled = store.campaigns
    .filter((c) => c.status === 'SCHEDULED' && c.id !== campaign.id && c.sendAt)
    .map((c) => ({ id: c.id, name: c.name, sendAt: c.sendAt! }));

  return (
    <div className="p-6">
      <RegisterTab label={campaign.name} />
      <CampaignWorkbench
        campaign={campaign}
        placeholders={template.placeholders}
        templateName={template.name}
        list={{
          name: list.name,
          sendingDomain: list.sendingDomain,
          configurationSet: list.configurationSet,
          unsubscribeAllowed: list.unsubscribeAllowed,
          recipients: listRecipientsCount(store, list.id),
        }}
        defaultTestRecipients={store.settings.testRecipients}
        minGapMinutes={store.settings.minGapMinutes}
        otherScheduled={otherScheduled}
        claudeLive={claudeConfigured()}
      />
    </div>
  );
}
