import { NextResponse } from 'next/server';
import { subscribeFromPortal } from '@/lib/subscribers';

export const dynamic = 'force-dynamic';

// Spec §7 — B2B portal → kreiranje naloga → auto-subscribe na operativnu (obavezno) i
// promotivnu (opt-out dostupan odmah) listu. Autentikacija: zajednička tajna u zaglavlju.
export async function POST(req: Request) {
  const secret = process.env.WEBHOOK_SECRET;
  if (secret && req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as {
    email?: string;
    name?: string;
    company?: string;
    portalAccountId?: string;
  } | null;
  if (!body?.email || !body.name || !body.company || !body.portalAccountId) {
    return NextResponse.json(
      { error: 'Obavezna polja: email, name, company, portalAccountId' },
      { status: 400 },
    );
  }
  const sub = await subscribeFromPortal({
    email: body.email,
    name: body.name,
    company: body.company,
    portalAccountId: body.portalAccountId,
  });
  return NextResponse.json({ ok: true, subscriberId: sub.id, lists: sub.listIds });
}
