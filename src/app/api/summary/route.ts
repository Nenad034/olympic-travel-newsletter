import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';
import { health } from '@/lib/listmonk';
import { claudeConfigured } from '@/lib/claude';
import { processDueCampaigns } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

export async function GET() {
  processDueCampaigns();
  const store = getStore();
  return NextResponse.json({
    listmonk: await health(),
    claude: claudeConfigured(),
    pendingApproval: store.campaigns.filter((c) => c.status === 'PENDING_APPROVAL').length,
    scheduled: store.campaigns.filter((c) => c.status === 'SCHEDULED').length,
  });
}
