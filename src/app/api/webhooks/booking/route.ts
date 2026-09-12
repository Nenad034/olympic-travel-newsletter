import { NextResponse } from 'next/server';
import { subscribeFromBooking } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

// Spec §7 — booking sistem → potvrda bookinga sa označenim pristankom → B2C lista →
// double opt-in. `consent: false` je validan poziv koji NE pravi prijavu.
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    bookingRef?: string;
    consent?: boolean;
  } | null;
  if (!body?.email || !body.name || !body.bookingRef || typeof body.consent !== 'boolean') {
    return NextResponse.json(
      { error: 'Obavezna polja: email, name, bookingRef, consent (boolean)' },
      { status: 400 },
    );
  }
  const sub = await subscribeFromBooking({
    email: body.email,
    name: body.name,
    bookingRef: body.bookingRef,
    consent: body.consent,
  });
  if (!sub) return NextResponse.json({ ok: true, subscribed: false, reason: 'no-consent' });
  return NextResponse.json({ ok: true, subscribed: true, subscriberId: sub.id, status: sub.status });
}
