'use client';

import { usePathname } from 'next/navigation';
import Icon from './Icon';

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
      'B2B operativni: auto opt-in, bez odjave — deo poslovnog odnosa.',
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
      'Nema ručnog unosa — prijave stižu iz portala (B2B) i booking sistema (B2C).',
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

export default function RightPanel({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();
  const block = HELP.find((h) => h.match(pathname)) ?? HELP[0];
  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto bg-panel-2 text-xs">
      <div className="flex h-[29px] flex-shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Povezano</span>
        <button
          onClick={onClose}
          title="Zatvori desni panel"
          className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <Icon name="close" />
        </button>
      </div>
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
          <strong className="text-ink">Agent priprema, čovek odobrava.</strong> Masovno slanje je nepovratno —
          nijedna kampanja ne odlazi u Listmonk bez potvrde osobe iz marketing tima.
        </p>
      </div>
    </aside>
  );
}
