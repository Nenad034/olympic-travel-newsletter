import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import SettingsPanels from './SettingsPanels';
import { getStore } from '@/lib/store';
import { listmonkMode } from '@/lib/listmonk';
import { claudeConfigured } from '@/lib/claude';
import { budgetState } from '@/lib/agent-budget';

export default function SettingsPage() {
  const store = getStore();
  return (
    <div className="p-6">
      <RegisterTab label="SES i domeni" />
      <PageHeader
        title="SES, domeni i pravila slanja"
        subtitle="Dva verifikovana SES identiteta na odvojenim poddomenima · DMARC u fazama · configuration set po toku · warm-up."
      />
      <SettingsPanels
        settings={store.settings}
        lists={store.lists}
        listmonkMode={listmonkMode()}
        listmonkUrl={process.env.LISTMONK_URL ?? null}
        claudeLive={claudeConfigured()}
        budget={budgetState(store)}
      />
    </div>
  );
}
