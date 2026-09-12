import { NextResponse } from 'next/server';
import { mutate, newId, now } from '@/lib/store';

export const dynamic = 'force-dynamic';

// Spec §4 — SNS → SES eventi. U produkciji SNS ide direktno na Listmonk
// `/webhooks/service/ses`; ova ruta je ogledalo koje beleži event u lokalni dnevnik isporuke
// (analitika/isporuka) i primenjuje pravila: hard bounce / complaint → pretplatnik blokiran.
interface SnsMessage {
  Type?: string;
  SubscribeURL?: string;
  Message?: string;
}

export async function POST(req: Request) {
  const raw = (await req.json().catch(() => null)) as SnsMessage | null;
  if (!raw) return NextResponse.json({ error: 'bad json' }, { status: 400 });
  if (raw.Type === 'SubscriptionConfirmation' && raw.SubscribeURL) {
    // Potvrda SNS pretplate — u produkciji se otvara SubscribeURL.
    return NextResponse.json({ ok: true, action: 'confirm', url: raw.SubscribeURL });
  }
  const msg = (typeof raw.Message === 'string' ? JSON.parse(raw.Message) : raw) as {
    notificationType?: string;
    eventType?: string;
    mail?: { destination?: string[]; source?: string };
    bounce?: { bounceType?: string };
    complaint?: { complaintFeedbackType?: string };
  };
  const type = (msg.eventType ?? msg.notificationType ?? '').toUpperCase();
  const email = msg.mail?.destination?.[0] ?? 'nepoznato';
  const domain = msg.mail?.source?.split('@')[1]?.replace('>', '') ?? 'nepoznato';
  const mapped = type === 'BOUNCE' ? 'BOUNCE' : type === 'COMPLAINT' ? 'COMPLAINT' : 'DELIVERY';
  mutate((store) => {
    store.events.unshift({
      id: newId('ev'),
      at: now(),
      type: mapped,
      email,
      campaignId: null,
      domain,
      detail:
        mapped === 'BOUNCE'
          ? `Bounce (${msg.bounce?.bounceType ?? '?'})`
          : mapped === 'COMPLAINT'
            ? `Spam prijava (${msg.complaint?.complaintFeedbackType ?? '?'})`
            : 'Isporučeno',
    });
    if (mapped === 'COMPLAINT' || (mapped === 'BOUNCE' && msg.bounce?.bounceType === 'Permanent')) {
      const s = store.subscribers.find((x) => x.email === email.toLowerCase());
      if (s) s.status = 'BLOCKLISTED';
    }
  });
  return NextResponse.json({ ok: true, type: mapped });
}
