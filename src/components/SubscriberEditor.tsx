'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Notice from './Notice';
import { SegmentBadge } from './Badges';
import { Button } from './ui/button';
import { updateSubscriberAction } from '@/app/actions';
import type { MailingList, Subscriber } from '@/lib/types';

// Ispravka zapisa iz desnog panela. Trag pristanka je izmenjiv samo za ručni unos i CSV uvoz —
// za portal i booking ta polja tvrdi izvorni sistem, pa ih ovde ne diramo.

function dateInput(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export default function SubscriberEditor({
  subscriber,
  lists,
  onDone,
}: {
  subscriber: Subscriber;
  lists: MailingList[];
  onDone: () => void;
}) {
  const router = useRouter();
  const manual = subscriber.source === 'RUCNI_UNOS' || subscriber.source === 'IMPORT_CSV';
  const [email, setEmail] = useState(subscriber.email);
  const [name, setName] = useState(subscriber.name);
  const [company, setCompany] = useState(subscriber.company ?? '');
  const [listIds, setListIds] = useState<string[]>(subscriber.listIds);
  const [consentAt, setConsentAt] = useState(dateInput(subscriber.consentAt));
  const [consentNote, setConsentNote] = useState(subscriber.consentNote ?? '');
  const [sourceRef, setSourceRef] = useState(subscriber.sourceRef);
  const [allowResubscribe, setAllowResubscribe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const backOn = listIds.filter((id) => subscriber.unsubscribedFrom.includes(id));
  const addedDoubleOptin = listIds.some(
    (id) =>
      !subscriber.listIds.includes(id) &&
      lists.find((l) => l.id === id)?.optinMode === 'DOUBLE_OPT_IN',
  );

  function toggle(id: string) {
    setListIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await updateSubscriberAction(subscriber.id, {
        email,
        name,
        company,
        listIds,
        allowResubscribe,
        ...(manual ? { consentAt, consentNote, sourceRef } : {}),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="mx-2 rounded-lg border border-border bg-panel">
      <div className="section-head rounded-t-lg">
        <Icon name="edit" /> Izmena zapisa
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Ime i prezime</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Firma</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="—" />
        </div>
        <div>
          <label className="label">Liste</label>
          <div className="flex flex-col gap-1.5">
            {lists.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={listIds.includes(l.id)} onChange={() => toggle(l.id)} />
                <SegmentBadge segment={l.segment} />
                {subscriber.unsubscribedFrom.includes(l.id) && (
                  <span className="text-[11px] text-warn">odjavljen</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {manual ? (
          <>
            <div>
              <label className="label">Datum pristanka</label>
              <input className="input" type="date" required max={new Date().toISOString().slice(0, 10)} value={consentAt} onChange={(e) => setConsentAt(e.target.value)} />
            </div>
            <div>
              <label className="label">Osnov pristanka</label>
              <input className="input" required value={consentNote} onChange={(e) => setConsentNote(e.target.value)} />
            </div>
            <div>
              <label className="label">Referenca na dokaz</label>
              <input className="input" required value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
            </div>
          </>
        ) : (
          <p className="text-[11px] text-ink-faint">
            Datum pristanka, osnov i referenca stižu iz izvornog sistema i ne menjaju se ovde —
            ispravka ide u portalu odnosno booking sistemu.
          </p>
        )}

        {backOn.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded border border-warn bg-warn-bg p-2 text-warn">
            <input type="checkbox" className="mt-0.5" checked={allowResubscribe} onChange={(e) => setAllowResubscribe(e.target.checked)} />
            <span>
              Vraćam kontakt na listu sa koje se odjavio. Radim to jer postoji nova saglasnost, ne
              zato što je odjava greška.
            </span>
          </label>
        )}
        {addedDoubleOptin && subscriber.status === 'ENABLED' && (
          <Notice tone="warn">
            Nova lista traži double opt-in — zapis prelazi u „Čeka potvrdu“ dok kontakt ne potvrdi.
          </Notice>
        )}
        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={pending}>
            <Icon name="save" className="!text-[12px]" /> {pending ? 'Čuvam…' : 'Sačuvaj'}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onDone}>
            Odustani
          </Button>
        </div>
      </div>
    </form>
  );
}
