'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import Section from '@/components/Section';
import { Button } from '@/components/ui/button';
import { simulateBookingSignupAction, simulatePortalSignupAction, type ActionResult } from '@/app/actions';

export default function IntegrationSimulators({ subscriberCount }: { subscriberCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [p, setP] = useState({ email: '', name: '', company: '' });
  const [b, setB] = useState({ email: '', name: '', consent: true });
  const [sesOut, setSesOut] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? { tone: 'ok', text: ok } : { tone: 'danger', text: r.error });
      router.refresh();
    });
  }

  async function sendSes(type: 'Bounce' | 'Complaint' | 'Delivery') {
    setSesOut(null);
    const res = await fetch('/api/webhooks/ses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Type: 'Notification',
        Message: JSON.stringify({
          eventType: type,
          bounce: type === 'Bounce' ? { bounceType: 'Permanent' } : undefined,
          complaint: type === 'Complaint' ? { complaintFeedbackType: 'abuse' } : undefined,
          mail: { source: 'newsletter@b2b.olympic.rs', destination: [p.email || 'office@putniktours.rs'] },
        }),
      }),
    });
    setSesOut(`${res.status} ${JSON.stringify(await res.json())}`);
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-4">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Section title="Simulacija: portal nalog" icon="briefcase" bodyClassName="p-4">
        <label className="label">Email</label>
        <input className="input mb-2" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} placeholder="office@nova-agencija.rs" />
        <label className="label">Kontakt</label>
        <input className="input mb-2" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="Ime Prezime" />
        <label className="label">Firma</label>
        <input className="input mb-3" value={p.company} onChange={(e) => setP({ ...p, company: e.target.value })} placeholder="Nova Agencija d.o.o." />
        <Button size="sm" disabled={pending || !p.email || !p.name || !p.company} onClick={() => run(() => simulatePortalSignupAction(p), 'Subagent dodat na operativnu i promotivnu listu.')}>
          <Icon name="add" className="!text-[12px]" /> kreiraj portal nalog
        </Button>
      </Section>

      <Section title="Simulacija: booking sa pristankom" icon="person" bodyClassName="p-4">
        <label className="label">Email</label>
        <input className="input mb-2" value={b.email} onChange={(e) => setB({ ...b, email: e.target.value })} placeholder="putnik@gmail.com" />
        <label className="label">Ime</label>
        <input className="input mb-2" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Ime Prezime" />
        <label className="mb-3 flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={b.consent} onChange={(e) => setB({ ...b, consent: e.target.checked })} />
          Želim da primam newsletter (eksplicitan opt-in)
        </label>
        <Button size="sm" disabled={pending || !b.email || !b.name} onClick={() => run(() => simulateBookingSignupAction(b), 'Putnik dodat na B2C listu — čeka double opt-in potvrdu.')}>
          <Icon name="check" className="!text-[12px]" /> potvrdi booking
        </Button>
      </Section>

      <Section title="Simulacija: SES event" icon="shield" bodyClassName="p-4">
        <p className="mb-2 text-[11px] text-ink-faint">Šalje SNS-oblik poruke na /api/webhooks/ses za adresu iz polja „portal email“ (ili office@putniktours.rs).</p>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => sendSes('Delivery')}>delivery</Button>
          <Button size="sm" variant="outline" onClick={() => sendSes('Bounce')}>hard bounce</Button>
          <Button size="sm" variant="destructive" onClick={() => sendSes('Complaint')}>complaint</Button>
        </div>
        {sesOut && <pre className="mt-2 overflow-x-auto rounded-md bg-sunken p-2 font-mono text-[11px] text-ink">{sesOut}</pre>}
      </Section>
      <p className="text-[11px] text-ink-faint">Trenutno u bazi: {subscriberCount} pretplatnika.</p>
    </aside>
  );
}
