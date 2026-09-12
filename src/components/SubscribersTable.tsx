'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Notice from './Notice';
import { SubscriberStatusBadge } from './Badges';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  confirmOptinAction,
  deleteSubscriberAction,
  pauseSubscriberAction,
  unsubscribeAction,
  type ActionResult,
} from '@/app/actions';
import { useInspector } from './InspectorContext';
import { useAiContext } from './AiContextContext';
import { fmtDate, fmtRelative } from '@/lib/datum';
import type { DeliveryEvent, MailingList, Subscriber } from '@/lib/types';

const SOURCE_LABEL: Record<Subscriber['source'], string> = {
  PORTAL: 'B2B portal',
  BOOKING: 'booking',
  INTERNI_TEST: 'interno',
  RUCNI_UNOS: 'ručni unos',
  IMPORT_CSV: 'CSV uvoz',
};

export default function SubscribersTable({
  subscribers,
  lists,
  events = [],
  showLists = true,
  emptyText = 'Nema pretplatnika.',
}: {
  subscribers: Subscriber[];
  lists: MailingList[];
  /** Isporuka (bounce/complaint/delivery) — prosleđuje se u desni panel uz selektovani red. */
  events?: DeliveryEvent[];
  showLists?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const { target, inspect } = useInspector();
  const { addRecord, atCapacity } = useAiContext();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [q, setQ] = useState('');

  // Posle akcije server vraća nove zapise — selekcija mora da prati sveže podatke,
  // inače desni panel prikazuje stanje od pre odjave/pauze.
  useEffect(() => {
    if (!target) return;
    const fresh = subscribers.find((x) => x.id === target.subscriber.id);
    if (!fresh) {
      inspect(null);
      return;
    }
    if (fresh !== target.subscriber) {
      inspect({
        kind: 'subscriber',
        subscriber: fresh,
        lists,
        events: events.filter((e) => e.email === fresh.email),
      });
    }
  }, [subscribers, lists, events, target, inspect]);

  function run(fn: () => Promise<ActionResult>, okText: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setMsg(r.ok ? { tone: 'ok', text: okText } : { tone: 'danger', text: r.error });
      router.refresh();
    });
  }

  const needle = q.trim().toLowerCase();
  const rows = needle
    ? subscribers.filter((s) => [s.email, s.name, s.company ?? '', s.sourceRef].some((v) => v.toLowerCase().includes(needle)))
    : subscribers;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Icon name="search" className="absolute left-2 top-1/2 -translate-y-1/2 !text-[14px] text-ink-faint" />
          <input className="input !pl-7" placeholder="Pretraga: email, ime, firma, referenca…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="text-[11px] text-ink-faint">{rows.length} od {subscribers.length}</span>
        <span className="text-[11px] text-ink-faint">· klik na red = brze info desno</span>
      </div>
      {msg && <Notice tone={msg.tone} className="mb-3">{msg.text}</Notice>}
      <div className="overflow-hidden rounded-lg border border-border bg-panel">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-panel-2">
              <TableHead>Pretplatnik</TableHead>
              <TableHead>Status</TableHead>
              {showLists && <TableHead>Liste</TableHead>}
              <TableHead>Izvor / pristanak</TableHead>
              <TableHead>Poslednje otvaranje</TableHead>
              <TableHead className="text-right">Akcije</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-ink-faint">{emptyText}</TableCell></TableRow>
            )}
            {rows.map((s) => {
              const promoLists = lists.filter((l) => s.listIds.includes(l.id) && l.unsubscribeAllowed);
              const selected = target?.subscriber.id === s.id;
              return (
                <TableRow
                  key={s.id}
                  onClick={() =>
                    inspect(
                      selected
                        ? null
                        : {
                            kind: 'subscriber',
                            subscriber: s,
                            lists,
                            events: events.filter((e) => e.email === s.email),
                          },
                    )
                  }
                  className={`cursor-pointer ${selected ? 'bg-accent-soft' : ''}`}
                >
                  <TableCell>
                    <div className="font-medium text-ink">{s.name}{s.company ? <span className="text-ink-faint"> · {s.company}</span> : null}</div>
                    <div className="font-mono text-[11px] text-ink-faint">{s.email}</div>
                  </TableCell>
                  <TableCell><SubscriberStatusBadge status={s.status} /></TableCell>
                  {showLists && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.listIds.map((id) => {
                          const l = lists.find((x) => x.id === id);
                          return <Badge key={id} variant={l?.segment === 'B2C' ? 'accent2' : l?.unsubscribeAllowed ? 'accent' : 'outline'}>{l?.segment === 'B2C' ? 'B2C' : l?.unsubscribeAllowed ? 'B2B promo' : 'B2B oper.'}</Badge>;
                        })}
                        {s.unsubscribedFrom.map((id) => (
                          <Badge key={`u-${id}`} variant="secondary" className="line-through opacity-70">{lists.find((x) => x.id === id)?.segment === 'B2C' ? 'B2C' : 'B2B promo'}</Badge>
                        ))}
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-ink-dim">
                    <div>{SOURCE_LABEL[s.source]} · <span className="font-mono text-[11px]">{s.sourceRef}</span></div>
                    <div className="text-[11px] text-ink-faint">pristanak {fmtDate(s.consentAt)}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-ink-dim">{s.lastOpenAt ? fmtRelative(s.lastOpenAt) : '—'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" disabled={atCapacity} title={atCapacity ? 'Kontekst agenta je pun' : 'Dodaj u AI kontekst'} onClick={() => addRecord('PRETPLATNIK', `${s.name} <${s.email}>`)}>
                        <Icon name="sparkle" className="!text-[12px]" />
                      </Button>
                      {s.status === 'UNCONFIRMED' && (
                        <Button size="sm" variant="secondary" disabled={pending} title="Simuliraj klik na double opt-in link" onClick={() => run(() => confirmOptinAction(s.id), 'Prijava potvrđena.')}>
                          <Icon name="check" className="!text-[12px]" /> potvrdi
                        </Button>
                      )}
                      {promoLists.map((l) => (
                        <Button key={l.id} size="sm" variant="outline" disabled={pending} title={`Odjava sa: ${l.name}`} onClick={() => run(() => unsubscribeAction(s.id, l.id), `Odjavljen sa „${l.name}“.`)}>
                          <Icon name="bell-slash" className="!text-[12px]" /> odjavi{l.segment === 'B2C' ? '' : ' promo'}
                        </Button>
                      ))}
                      {(s.status === 'ENABLED' || s.status === 'PAUSED') && (
                        <Button size="sm" variant="ghost" disabled={pending} title={s.status === 'PAUSED' ? 'Nastavi slanje' : 'Pauziraj slanje (sunset)'} onClick={() => run(() => pauseSubscriberAction(s.id, s.status !== 'PAUSED'), s.status === 'PAUSED' ? 'Slanje nastavljeno.' : 'Slanje pauzirano.')}>
                          <Icon name={s.status === 'PAUSED' ? 'debug-start' : 'debug-pause'} className="!text-[12px]" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-danger" disabled={pending} title="Obriši na zahtev (pravo na brisanje)" onClick={() => { if (confirm(`Trajno obrisati ${s.email}?\n\nZapis i njegov dnevnik nestaju. Ostaje samo hash adrese na listi obrisanih, da ručni unos i CSV uvoz ne vrate adresu nazad.`)) run(() => deleteSubscriberAction(s.id, 'zahtev kontakta'), 'Zapis obrisan, adresa upisana na listu obrisanih.'); }}>
                        <Icon name="trash" className="!text-[12px]" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
