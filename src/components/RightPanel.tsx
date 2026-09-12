'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import SubscriberEditor from './SubscriberEditor';
import { SegmentBadge, SubscriberStatusBadge } from './Badges';
import { Badge } from './ui/badge';
import { useInspector, type SubscriberInspect } from './InspectorContext';
import { fmtDate, fmtDateTime, fmtRelative } from '@/lib/datum';
import type { DeliveryEvent, Subscriber } from '@/lib/types';

interface HelpBlock {
  match: (p: string) => boolean;
  title: string;
  points: string[];
}

// Desni panel — kontekstualna pomoć po sekciji, iz spec-a (docs/M27_NEWSLETTER_MODULE.md).
const HELP: HelpBlock[] = [
  {
    match: (p) => p === '/',
    title: 'Pregled modula',
    points: [
      'Listmonk je motor u pozadini — ovaj panel je jedini interfejs za marketing tim.',
      'Dva SES domena: b2b.olympic.rs (subagenti) i newsletter.olympic.rs (B2C) — reputacija se ne meša.',
      'Ništa ne odlazi ka bazi bez ljudskog odobrenja (spec §5.2).',
    ],
  },
  {
    match: (p) => p.startsWith('/kampanje/nova'),
    title: 'Nova kampanja',
    points: [
      'Izaberi listu (tok) — segment određuje domen, configuration set i pravila odjave.',
      'Brif su ulazni podaci za Claude API: ponude, cene, rokovi. Bez izmišljanja podataka.',
      'Nacrt ide na test listu, pa na odobrenje — tek onda u Listmonk.',
    ],
  },
  {
    match: (p) => p.startsWith('/kampanje/'),
    title: 'Tok kampanje',
    points: [
      '1. Claude popuni šablon → 2. pregled i dorada → 3. test slanje internom timu',
      '4. Odobrenje sadržaja I termina zajedno (pošalji odmah / zakaži).',
      'Promena termina posle odobrenja ne traži ponovno odobrenje sadržaja (§6.3).',
      'Izmena sadržaja posle slanja na odobrenje vraća kampanju u nacrt.',
    ],
  },
  {
    match: (p) => p.startsWith('/kampanje'),
    title: 'Kampanje',
    points: [
      'Statusi: Nacrt → Čeka odobrenje → Zakazano / Šalje se → Poslato.',
      'Više paralelnih kampanja može biti zakazano istovremeno (§6.2).',
    ],
  },
  {
    match: (p) => p.startsWith('/kalendar'),
    title: 'Kalendar slanja',
    points: [
      'Prikazuje SVE zakazane kampanje sa terminom, segmentom i statusom.',
      'Upozorenje kad su dve kampanje bliže od podešenog razmaka (podrazumevano 60 min) — SES throughput.',
    ],
  },
  {
    match: (p) => p.startsWith('/liste'),
    title: 'Liste i tokovi',
    points: [
      'B2B operativni: auto opt-in, bez odjave — šalje se transakciono (/api/tx), ne kao kampanja (§3.1.1).',
      'B2B promotivni: opt-out po defaultu, odjava ne dira operativni tok.',
      'B2C: eksplicitan čekboks + double opt-in; consent timestamp i izvor prijave.',
    ],
  },
  {
    match: (p) => p.startsWith('/pretplatnici/sunset'),
    title: 'Sunset politika',
    points: [
      'Bez otvaranja 6 meseci → re-engagement kampanja → ako ni tada nema reakcije, pauza.',
      'Cilj: reputacija domena kod Gmail/Outlook filtera.',
    ],
  },
  {
    match: (p) => p.startsWith('/pretplatnici'),
    title: 'Pretplatnici',
    points: [
      'Prijave stižu automatski iz portala (B2B) i booking sistema (B2C).',
      'Ručni unos i CSV uvoz traže osnov pristanka, datum i referencu na dokaz.',
      'Klik na red otvara brze info o kontaktu u ovom panelu.',
      'Pravo na brisanje na zahtev: potpuno uklanjanje zapisa.',
    ],
  },
  {
    match: (p) => p.startsWith('/sabloni'),
    title: 'Šabloni',
    points: [
      'Kreiraju se retko (Claude Design → čist HTML/CSS), čuvaju sa {{placeholder}} poljima.',
      'Claude API popunjava SAMO vrednosti polja — izgled šablona se ne menja po kampanji.',
    ],
  },
  {
    match: (p) => p.startsWith('/analitika'),
    title: 'Analitika',
    points: [
      'Open/click/bounce po segmentu i toku — slivaju se u M-25 semantični sloj (Cube.dev).',
      'Bounce i complaint eventi stižu SES → SNS → Listmonk /webhooks/service/ses.',
    ],
  },
  {
    match: (p) => p.startsWith('/podesavanja'),
    title: 'SES i domeni',
    points: [
      'DMARC u fazama: p=none (par nedelja) → p=quarantine → p=reject. Nikad direktno na strogo.',
      'Warm-up: postepeno povećanje dnevnog volumena na novom domenu.',
      'Production access (izlazak iz SES sandboxa) po domenu.',
    ],
  },
  {
    match: (p) => p.startsWith('/integracije'),
    title: 'Integracije',
    points: [
      'Portal → POST /api/webhooks/portal (auto-subscribe na obe B2B liste).',
      'Booking → POST /api/webhooks/booking (samo uz consent=true; pokreće double opt-in).',
      'SES/SNS → POST /api/webhooks/ses (bounce/complaint/delivery).',
    ],
  },
];

const SOURCE_LABEL: Record<Subscriber['source'], string> = {
  PORTAL: 'B2B portal',
  BOOKING: 'booking sistem',
  INTERNI_TEST: 'interni test',
  RUCNI_UNOS: 'ručni unos',
  IMPORT_CSV: 'CSV uvoz',
};

const EVENT_LABEL: Record<DeliveryEvent['type'], string> = {
  BOUNCE: 'bounce',
  COMPLAINT: 'prijava kao spam',
  DELIVERY: 'isporučeno',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1">
      <span className="w-[84px] flex-shrink-0 text-ink-faint">{label}</span>
      <span className="min-w-0 flex-1 break-words text-ink-dim">{children}</span>
    </div>
  );
}

/** Brze info o selektovanom pretplatniku — sve što tabela ne staje da prikaže. */
function SubscriberQuickInfo({ target }: { target: SubscriberInspect }) {
  const { subscriber: s, lists, events } = target;
  const [editing, setEditing] = useState(false);
  const member = lists.filter((l) => s.listIds.includes(l.id));
  const left = lists.filter((l) => s.unsubscribedFrom.includes(l.id));
  const manual = s.source === 'RUCNI_UNOS' || s.source === 'IMPORT_CSV';
  const problems = events.filter((e) => e.type !== 'DELIVERY');

  if (editing) {
    return <SubscriberEditor subscriber={s} lists={lists} onDone={() => setEditing(false)} />;
  }

  return (
    <>
      <div className="mx-2 rounded-lg border border-border bg-panel">
        <div className="section-head rounded-t-lg">
          <Icon name="account" /> <span className="flex-1">Pretplatnik</span>
          <button
            onClick={() => setEditing(true)}
            title="Izmeni podatke kontakta"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint hover:bg-sunken hover:text-ink"
          >
            <Icon name="edit" className="!text-[14px]" /> izmeni
          </button>
        </div>
        <div className="p-3">
          <div className="text-[13px] font-semibold text-ink">{s.name}</div>
          {s.company && <div className="text-ink-dim">{s.company}</div>}
          <div className="mt-0.5 break-all font-mono text-[11px] text-ink-faint">{s.email}</div>
          <div className="mt-2">
            <SubscriberStatusBadge status={s.status} />
          </div>
        </div>
      </div>

      <div className="mx-2 mt-2 rounded-lg border border-border bg-panel">
        <div className="section-head rounded-t-lg">
          <Icon name="law" /> Pristanak
        </div>
        <div className="px-3 py-2">
          <Row label="Izvor">{SOURCE_LABEL[s.source]}</Row>
          <Row label="Datum">{fmtDateTime(s.consentAt)}</Row>
          <Row label="Referenca">
            <span className="font-mono text-[11px]">{s.sourceRef}</span>
          </Row>
          {s.consentNote && <Row label="Osnov">{s.consentNote}</Row>}
          {s.addedBy && <Row label="Uneo">{s.addedBy}</Row>}
          {manual && (
            <p className="mt-2 text-[11px] text-ink-faint">
              Zapis nije stigao iz izvornog sistema — dokaz pristanka mora postojati van aplikacije.
            </p>
          )}
        </div>
      </div>

      <div className="mx-2 mt-2 rounded-lg border border-border bg-panel">
        <div className="section-head rounded-t-lg">
          <Icon name="list-tree" /> Liste
        </div>
        <div className="flex flex-col gap-2 p-3">
          {member.map((l) => (
            <div key={l.id} className="flex items-start gap-2">
              <SegmentBadge segment={l.segment} />
              <span className="min-w-0 flex-1 text-ink-dim">{l.name}</span>
            </div>
          ))}
          {member.length === 0 && <span className="text-ink-faint">Nije ni na jednoj listi.</span>}
          {left.map((l) => (
            <div key={l.id} className="flex items-start gap-2 opacity-70">
              <Badge variant="secondary">odjavljen</Badge>
              <span className="min-w-0 flex-1 text-ink-faint line-through">{l.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-2 mt-2 rounded-lg border border-border bg-panel">
        <div className="section-head rounded-t-lg">
          <Icon name="pulse" /> Aktivnost
        </div>
        <div className="px-3 py-2">
          <Row label="U bazi od">{fmtDate(s.createdAt)}</Row>
          <Row label="Otvaranje">
            {s.lastOpenAt ? `${fmtRelative(s.lastOpenAt)} · ${fmtDate(s.lastOpenAt)}` : 'nijednom'}
          </Row>
          <Row label="Događaji">{events.length ? `${events.length} zapisa` : 'nema'}</Row>
        </div>
      </div>

      {problems.length > 0 && (
        <div className="mx-2 mt-2 rounded-lg border border-border bg-panel">
          <div className="section-head rounded-t-lg">
            <Icon name="warning" /> Isporuka
          </div>
          <ul className="flex flex-col gap-2 p-3">
            {problems.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-col">
                <span className="text-ink-dim">
                  <span className={e.type === 'BOUNCE' ? 'text-danger' : 'text-warn'}>
                    {EVENT_LABEL[e.type]}
                  </span>{' '}
                  · {fmtDate(e.at)}
                </span>
                <span className="text-[11px] text-ink-faint">{e.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function RightPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const { target, inspect } = useInspector();
  const block = HELP.find((h) => h.match(pathname)) ?? HELP[0];

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-panel-2 pb-3 text-xs">
      <div className="flex h-[29px] flex-shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          {target ? 'Brze info' : 'Povezano'}
        </span>
        <div className="flex items-center">
          {target && (
            <button
              onClick={() => inspect(null)}
              title="Poništi selekciju — nazad na pomoć za sekciju"
              className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
            >
              <Icon name="clear-all" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Zatvori desni panel"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>

      {target ? (
        <SubscriberQuickInfo key={target.subscriber.id} target={target} />
      ) : (
        <>
          <div className="mx-2 rounded-lg border border-border bg-panel">
            <div className="section-head rounded-t-lg">
              <Icon name="info" /> {block.title}
            </div>
            <ul className="flex flex-col gap-2 p-3 text-ink-dim">
              {block.points.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-2 mt-2 rounded-lg border border-border bg-panel">
            <div className="section-head rounded-t-lg">
              <Icon name="book" /> Princip
            </div>
            <p className="p-3 text-ink-dim">
              <strong className="text-ink">Agent priprema, čovek odobrava.</strong> Masovno slanje je
              nepovratno — nijedna kampanja ne odlazi u Listmonk bez potvrde osobe iz marketing tima.
            </p>
          </div>
        </>
      )}
    </aside>
  );
}
