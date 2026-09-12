import { NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** Lista kampanja za komandnu paletu i eksterne alate (M-25 sync). */
export async function GET() {
  const store = getStore();
  return NextResponse.json(
    store.campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      segment: c.segment,
      sendAt: c.sendAt,
      sentAt: c.sentAt,
      stats: c.stats,
    })),
  );
}
