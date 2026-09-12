import type {
  Campaign,
  DeliveryEvent,
  MailingList,
  Settings,
  Store,
  Subscriber,
  SubscriberEvent,
} from './types';
import { SEED_TEMPLATES } from './email-templates';

// Početno seme (mock Listmonk motora). Datumi su fiksni da build i prvi prikaz budu
// deterministički; "sada" u aplikaciji je 12.9.2026.

export const LIST_B2B_OPS = 'lst-b2b-operativna';
export const LIST_B2B_PROMO = 'lst-b2b-promotivna';
export const LIST_B2C = 'lst-b2c-newsletter';

const lists: MailingList[] = [
  {
    id: LIST_B2B_OPS,
    name: 'B2B subagenti — operativna',
    segment: 'B2B_OPERATIVNI',
    sendingDomain: 'b2b.olympic.rs',
    configurationSet: 'ses-b2b-operativno',
    optinMode: 'AUTO_OBAVEZNO',
    unsubscribeAllowed: false,
    description:
      'Cenovnici, promene alotmana, rokovi uplate, hitna obaveštenja. Auto opt-in pri kreiranju portal naloga, bez odjave.',
  },
  {
    id: LIST_B2B_PROMO,
    name: 'B2B subagenti — promotivna',
    segment: 'B2B_PROMOTIVNI',
    sendingDomain: 'b2b.olympic.rs',
    configurationSet: 'ses-b2b-promotivno',
    optinMode: 'OPT_OUT',
    unsubscribeAllowed: true,
    description:
      'Nove destinacije, kampanje, ponude za prosleđivanje krajnjim klijentima. Opt-out po defaultu; odjava ne dira operativni tok.',
  },
  {
    id: LIST_B2C,
    name: 'Krajnji klijenti — newsletter',
    segment: 'B2C',
    sendingDomain: 'newsletter.olympic.rs',
    configurationSet: 'ses-b2c-newsletter',
    optinMode: 'DOUBLE_OPT_IN',
    unsubscribeAllowed: true,
    description:
      'Eksplicitan opt-in čekboksom pri bookingu + double opt-in potvrda. Consent timestamp, izvor prijave, pravo na brisanje.',
  },
];

const AGENCIES = [
  ['Putnik Tours', 'office@putniktours.rs', 'Milica Jovanović'],
  ['Sunčani Dani d.o.o.', 'rezervacije@suncanidani.rs', 'Dragan Petrović'],
  ['Balkan Voyage', 'b2b@balkanvoyage.com', 'Ana Kostić'],
  ['Travel House NS', 'info@travelhouse-ns.rs', 'Nemanja Ilić'],
  ['Vojvodina Tours', 'kontakt@vojvodinatours.rs', 'Jelena Marković'],
  ['Nis Travel Center', 'office@nistravel.rs', 'Marko Stojanović'],
  ['Kragujevac Putovanja', 'agencija@kgputovanja.rs', 'Ivana Đorđević'],
  ['Adriatic Line', 'sales@adriaticline.me', 'Luka Vuković'],
  ['Zlatibor Travel', 'office@zlatibortravel.rs', 'Tamara Nikolić'],
  ['Mediterran Plus', 'b2b@mediterranplus.rs', 'Stefan Pavlović'],
  ['Euroline Subotica', 'info@euroline-su.rs', 'Katarina Horvat'],
  ['Sirius Tours', 'rezervacije@siriustours.rs', 'Bojan Ristić'],
];

const TRAVELLERS = [
  ['jelena.p@gmail.com', 'Jelena Popović'],
  ['nikola.m88@gmail.com', 'Nikola Mitrović'],
  ['sanja.dj@yahoo.com', 'Sanja Đurić'],
  ['vladimir.s@outlook.com', 'Vladimir Savić'],
  ['maja.k@gmail.com', 'Maja Krstić'],
  ['ivan.todorovic@gmail.com', 'Ivan Todorović'],
  ['tijana.r@hotmail.com', 'Tijana Radović'],
  ['milos.jankovic@gmail.com', 'Miloš Janković'],
  ['aleksandra.v@gmail.com', 'Aleksandra Vasić'],
  ['petar.z@outlook.com', 'Petar Zdravković'],
  ['marina.l@gmail.com', 'Marina Lazić'],
  ['dusan.p@gmail.com', 'Dušan Pantić'],
  ['ana.stankovic@yahoo.com', 'Ana Stanković'],
  ['goran.m@gmail.com', 'Goran Milošević'],
  ['nevena.b@gmail.com', 'Nevena Bogdanović'],
  ['filip.r@outlook.com', 'Filip Radulović'],
  ['teodora.s@gmail.com', 'Teodora Simić'],
  ['lazar.n@gmail.com', 'Lazar Nedeljković'],
];

function daysAgo(n: number, hour = 10): string {
  const d = new Date(Date.UTC(2026, 8, 12, hour, 0, 0));
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}
function daysAhead(n: number, hour = 9, minute = 0): string {
  const d = new Date(Date.UTC(2026, 8, 12, hour, minute, 0));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString();
}

/** Zasejani zapisi dobijaju jedan početni događaj — dnevnik ne sme da počne prazan. */
function signupHistory(at: string, actor: string, action: string): SubscriberEvent[] {
  return [{ at, actor, action }];
}

const subscribers: Subscriber[] = [
  ...AGENCIES.map(([company, email, name], i): Subscriber => {
    const optedOutPromo = i === 3 || i === 9;
    const stale = i === 7; // nije otvorio ništa 6+ meseci — kandidat za re-engagement (spec §8)
    return {
      id: `sub-b2b-${i + 1}`,
      email,
      name,
      company,
      listIds: optedOutPromo ? [LIST_B2B_OPS] : [LIST_B2B_OPS, LIST_B2B_PROMO],
      status: 'ENABLED',
      source: 'PORTAL',
      consentAt: daysAgo(200 - i * 9),
      sourceRef: `portal-acc-${1040 + i}`,
      lastOpenAt: stale ? daysAgo(214) : daysAgo(3 + (i % 11)),
      createdAt: daysAgo(200 - i * 9),
      unsubscribedFrom: optedOutPromo ? [LIST_B2B_PROMO] : [],
      history: [
        ...signupHistory(daysAgo(200 - i * 9), 'B2B portal', 'Prijava — kreiran portal nalog'),
        ...(optedOutPromo
          ? [
              {
                at: daysAgo(40 + i),
                actor: 'pretplatnik',
                action: 'Odjava sa liste',
                note: 'B2B subagenti — promotivna',
              },
            ]
          : []),
      ],
    };
  }),
  ...TRAVELLERS.map(([email, name], i): Subscriber => {
    const unconfirmed = i === 2 || i === 11;
    const stale = i === 5 || i === 14;
    const paused = i === 16;
    return {
      id: `sub-b2c-${i + 1}`,
      email,
      name,
      listIds: [LIST_B2C],
      status: paused ? 'PAUSED' : unconfirmed ? 'UNCONFIRMED' : 'ENABLED',
      source: 'BOOKING',
      consentAt: daysAgo(150 - i * 6),
      sourceRef: `BK-2026-${(3100 + i * 7).toString()}`,
      lastOpenAt: unconfirmed ? null : stale ? daysAgo(230) : daysAgo(2 + (i % 9)),
      createdAt: daysAgo(150 - i * 6),
      unsubscribedFrom: [],
      history: [
        ...signupHistory(daysAgo(150 - i * 6), 'booking sistem', 'Prijava uz označen pristanak'),
        ...(unconfirmed
          ? []
          : [
              {
                at: daysAgo(150 - i * 6),
                actor: 'pretplatnik',
                action: 'Pristanak potvrđen (double opt-in)',
                field: 'status',
                from: 'UNCONFIRMED',
                to: 'ENABLED',
              },
            ]),
        ...(paused
          ? [
              {
                at: daysAgo(20),
                actor: 'Milena Vasić',
                action: 'Slanje pauzirano (sunset)',
                field: 'status',
                from: 'ENABLED',
                to: 'PAUSED',
              },
            ]
          : []),
      ],
    };
  }),
  {
    id: 'sub-test-1',
    email: 'marketing@olympic.rs',
    name: 'Marketing tim (test)',
    listIds: [],
    status: 'ENABLED',
    source: 'INTERNI_TEST',
    consentAt: daysAgo(300),
    sourceRef: 'interno',
    lastOpenAt: daysAgo(1),
    createdAt: daysAgo(300),
    unsubscribedFrom: [],
    history: signupHistory(daysAgo(300), 'Milena Vasić', 'Interni test nalog'),
  },
];

const b2bStats = { sent: 10, delivered: 10, opened: 8, clicked: 5, bounced: 0, complaints: 0 };

const campaigns: Campaign[] = [
  {
    id: 'cmp-001',
    name: 'Cenovnik zimske sezone 2026/27',
    subject: 'Novi cenovnik — zima 2026/27 (skijanje, Nova godina)',
    listId: LIST_B2B_OPS,
    segment: 'B2B_OPERATIVNI',
    templateId: 'tpl-b2b-standard',
    status: 'SENT',
    brief: 'Objava zimskog cenovnika: Bansko, Kopaonik, Jahorina. Rok za early booking 30.9.',
    contentData: {
      naslov: 'Zimski cenovnik 2026/27 je objavljen',
      uvod: 'Poštovani partneri, na portalu je od danas dostupan kompletan cenovnik zimske sezone. Early booking uslovi važe do 30. septembra.',
      ponuda_1_naziv: 'Bansko, hotel Lion 4* — polupansion',
      ponuda_1_opis: '7 noćenja, sopstveni prevoz, ski-pass po specijalnoj ceni za partnere.',
      ponuda_1_cena: 'od 419 € po osobi (neto)',
      ponuda_2_naziv: 'Kopaonik, Grand Hotel & Spa 4* — Nova godina',
      ponuda_2_opis: '4 noćenja, doček uključen, spa centar.',
      ponuda_2_cena: 'od 389 € po osobi (neto)',
      napomena: 'Alotmani za Novu godinu su ograničeni — opcije se drže 48h. Rok uplate avansa: 7 dana od potvrde.',
      cta_tekst: 'Otvori cenovnik na portalu',
      cta_link: 'https://b2b.olympic.rs/cenovnici/zima-2026',
    },
    bodyHtml: null,
    generatedBy: 'CLAUDE',
    testSentAt: daysAgo(9, 12),
    testRecipients: ['marketing@olympic.rs', 'prodaja@olympic.rs'],
    approvedBy: 'Milena Vasić',
    approvedAt: daysAgo(9, 14),
    sendAt: null,
    sentAt: daysAgo(8, 9),
    listmonkCampaignId: 41,
    deliveryMode: 'TRANSAKCIONO',
    stats: { sent: 12, delivered: 12, opened: 11, clicked: 9, bounced: 0, complaints: 0 },
    history: [
      { at: daysAgo(10, 11), actor: 'Content agent', action: 'Nacrt kreiran' },
      { at: daysAgo(10, 11), actor: 'Claude API', action: 'Šablon popunjen sadržajem' },
      { at: daysAgo(9, 12), actor: 'Milena Vasić', action: 'Test slanje', note: '2 primaoca' },
      { at: daysAgo(9, 14), actor: 'Milena Vasić', action: 'Odobreno — pošalji odmah' },
      { at: daysAgo(8, 9), actor: 'Listmonk', action: 'Poslato', note: 'kampanja #41' },
    ],
    createdBy: 'Content agent',
    createdAt: daysAgo(10, 11),
    updatedAt: daysAgo(8, 9),
  },
  {
    id: 'cmp-002',
    name: 'Jesenji city break — B2B promo',
    subject: 'City break jesen: Prag, Beč, Budimpešta — ponude za vaše klijente',
    listId: LIST_B2B_PROMO,
    segment: 'B2B_PROMOTIVNI',
    templateId: 'tpl-b2b-standard',
    status: 'SENT',
    brief: 'Jesenje city break ture autobusom, za prosleđivanje krajnjim klijentima.',
    contentData: {
      naslov: 'Jesenji city break — ponude spremne za vaše klijente',
      uvod: 'Pripremili smo tri gradske ture za oktobar i novembar, sa gotovim materijalom za vaše kanale.',
      ponuda_1_naziv: 'Prag, 4 dana autobusom',
      ponuda_1_opis: '2 noćenja sa doručkom, hotel 3*, vođene ture uključene.',
      ponuda_1_cena: 'od 149 € po osobi',
      ponuda_2_naziv: 'Beč — adventski vikend',
      ponuda_2_opis: '1 noćenje, hotel 4*, poseta božićnim pijacama.',
      ponuda_2_cena: 'od 99 € po osobi',
      napomena: 'Provizija po standardnom ugovoru; marketing materijal (slike, tekst) je na portalu.',
      cta_tekst: 'Preuzmi materijal',
      cta_link: 'https://b2b.olympic.rs/promo/jesen-2026',
    },
    bodyHtml: null,
    generatedBy: 'CLAUDE',
    testSentAt: daysAgo(5, 10),
    testRecipients: ['marketing@olympic.rs'],
    approvedBy: 'Milena Vasić',
    approvedAt: daysAgo(5, 11),
    sendAt: null,
    sentAt: daysAgo(4, 9),
    listmonkCampaignId: 42,
    deliveryMode: 'KAMPANJA',
    stats: b2bStats,
    history: [
      { at: daysAgo(6, 9), actor: 'Content agent', action: 'Nacrt kreiran' },
      { at: daysAgo(5, 10), actor: 'Milena Vasić', action: 'Test slanje' },
      { at: daysAgo(5, 11), actor: 'Milena Vasić', action: 'Odobreno — pošalji odmah' },
      { at: daysAgo(4, 9), actor: 'Listmonk', action: 'Poslato', note: 'kampanja #42' },
    ],
    createdBy: 'Content agent',
    createdAt: daysAgo(6, 9),
    updatedAt: daysAgo(4, 9),
  },
  {
    id: 'cmp-003',
    name: 'B2C — Rana rezervacija leto 2027',
    subject: 'Leto 2027: rezervišite ranije i uštedite do 30%',
    listId: LIST_B2C,
    segment: 'B2C',
    templateId: 'tpl-b2c-ponude',
    status: 'SCHEDULED',
    brief: 'Early booking leto 2027: Grčka (Halkidiki, Rodos), Turska (Antalija). Popust do 30% do 31.10.',
    contentData: {
      naslov: 'Leto 2027 već čeka — uštedite do 30%',
      uvod: 'Najbolje cene sezone su tu pre svih. Rezervišite do 31. oktobra uz minimalan avans i besplatnu promenu termina.',
      ponuda_1_naziv: 'Halkidiki, Kasandra — hotel 4*',
      ponuda_1_opis: '10 noćenja, polupansion, sopstveni prevoz.',
      ponuda_1_cena: 'od 549 € po osobi',
      ponuda_2_naziv: 'Rodos, Faliraki — all inclusive',
      ponuda_2_opis: '7 noćenja, avionom iz Beograda.',
      ponuda_2_cena: 'od 799 € po osobi',
      ponuda_3_naziv: 'Antalija, Lara — ultra all inclusive 5*',
      ponuda_3_opis: '7 noćenja, avionom, transfer uključen.',
      ponuda_3_cena: 'od 899 € po osobi',
      cta_tekst: 'Pogledaj sve ponude',
      cta_link: 'https://www.olympic.rs/leto-2027',
    },
    bodyHtml: null,
    generatedBy: 'CLAUDE',
    testSentAt: daysAgo(1, 13),
    testRecipients: ['marketing@olympic.rs', 'prodaja@olympic.rs'],
    approvedBy: 'Milena Vasić',
    approvedAt: daysAgo(1, 15),
    sendAt: daysAhead(3, 8, 0),
    sentAt: null,
    listmonkCampaignId: 43,
    deliveryMode: 'KAMPANJA',
    stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
    history: [
      { at: daysAgo(2, 9), actor: 'Content agent', action: 'Nacrt kreiran' },
      { at: daysAgo(2, 9), actor: 'Claude API', action: 'Šablon popunjen sadržajem' },
      { at: daysAgo(1, 13), actor: 'Milena Vasić', action: 'Test slanje' },
      { at: daysAgo(1, 15), actor: 'Milena Vasić', action: 'Odobreno i zakazano', note: '15.9. 10:00' },
    ],
    createdBy: 'Content agent',
    createdAt: daysAgo(2, 9),
    updatedAt: daysAgo(1, 15),
  },
  {
    id: 'cmp-004',
    name: 'B2B promo — Egipat zima',
    subject: 'Hurgada i Šarm el Šeik: zimske ponude za vaše klijente',
    listId: LIST_B2B_PROMO,
    segment: 'B2B_PROMOTIVNI',
    templateId: 'tpl-b2b-standard',
    status: 'SCHEDULED',
    brief: 'Zimske ponude Egipat: čarter iz Beograda, all inclusive, novembar–mart.',
    contentData: {
      naslov: 'Egipat ove zime — čarter iz Beograda',
      uvod: 'Otvorili smo prodaju zimskih čarter letova za Hurgadu i Šarm el Šeik. Ponude su spremne za vaše klijente.',
      ponuda_1_naziv: 'Hurgada, Albatros Palace 5* — all inclusive',
      ponuda_1_opis: '7 noćenja, direktan let, transfer.',
      ponuda_1_cena: 'od 690 € po osobi (neto)',
      ponuda_2_naziv: 'Šarm el Šeik, Rixos Premium 5* — ultra AI',
      ponuda_2_opis: '7 noćenja, direktan let, transfer.',
      ponuda_2_cena: 'od 890 € po osobi (neto)',
      napomena: 'Grupni popusti od 10 putnika. Alotman avio-sedišta ograničen po polasku.',
      cta_tekst: 'Otvori B2B portal',
      cta_link: 'https://b2b.olympic.rs/ponude/egipat-zima',
    },
    bodyHtml: null,
    generatedBy: 'CLAUDE',
    testSentAt: daysAgo(0, 8),
    testRecipients: ['marketing@olympic.rs'],
    approvedBy: 'Milena Vasić',
    approvedAt: daysAgo(0, 9),
    sendAt: daysAhead(3, 8, 20),
    sentAt: null,
    listmonkCampaignId: 44,
    deliveryMode: 'KAMPANJA',
    stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
    history: [
      { at: daysAgo(1, 9), actor: 'Content agent', action: 'Nacrt kreiran' },
      { at: daysAgo(0, 8), actor: 'Milena Vasić', action: 'Test slanje' },
      { at: daysAgo(0, 9), actor: 'Milena Vasić', action: 'Odobreno i zakazano', note: '15.9. 10:20' },
    ],
    createdBy: 'Content agent',
    createdAt: daysAgo(1, 9),
    updatedAt: daysAgo(0, 9),
  },
  {
    id: 'cmp-005',
    name: 'Promena alotmana — Rodos oktobar',
    subject: 'HITNO: promena alotmana Rodos, polasci 3. i 10. oktobra',
    listId: LIST_B2B_OPS,
    segment: 'B2B_OPERATIVNI',
    templateId: 'tpl-b2b-standard',
    status: 'PENDING_APPROVAL',
    brief: 'Avio-kompanija smanjila alotman za polaske 3.10. i 10.10. Partneri moraju potvrditi opcije do 14.9. u 12h.',
    contentData: {
      naslov: 'Promena alotmana — Rodos, 3. i 10. oktobar',
      uvod: 'Obaveštavamo vas da je avio-prevoznik smanjio alotman sedišta na polascima 3. i 10. oktobra. Molimo da sve otvorene opcije potvrdite do nedelje, 14. septembra, do 12:00.',
      ponuda_1_naziv: 'Polazak 3.10. — preostalo 18 sedišta',
      ponuda_1_opis: 'Opcije bez potvrde do roka se automatski oslobađaju.',
      ponuda_1_cena: 'cene nepromenjene',
      ponuda_2_naziv: 'Polazak 10.10. — preostalo 12 sedišta',
      ponuda_2_opis: 'Opcije bez potvrde do roka se automatski oslobađaju.',
      ponuda_2_cena: 'cene nepromenjene',
      napomena: 'Rok za potvrdu: 14.9.2026. u 12:00. Posle roka nema garancije za sedišta.',
      cta_tekst: 'Potvrdi opcije na portalu',
      cta_link: 'https://b2b.olympic.rs/rezervacije/opcije',
    },
    bodyHtml: null,
    generatedBy: 'CLAUDE',
    testSentAt: null,
    testRecipients: [],
    approvedBy: null,
    approvedAt: null,
    sendAt: null,
    sentAt: null,
    listmonkCampaignId: null,
    deliveryMode: 'TRANSAKCIONO',
    stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
    history: [
      { at: daysAgo(0, 7), actor: 'Content agent', action: 'Nacrt kreiran' },
      { at: daysAgo(0, 7), actor: 'Claude API', action: 'Šablon popunjen sadržajem' },
      { at: daysAgo(0, 7), actor: 'Content agent', action: 'Poslato na odobrenje' },
    ],
    createdBy: 'Content agent',
    createdAt: daysAgo(0, 7),
    updatedAt: daysAgo(0, 7),
  },
  {
    id: 'cmp-006',
    name: 'B2C — Novogodišnja putovanja',
    subject: '',
    listId: LIST_B2C,
    segment: 'B2C',
    templateId: 'tpl-b2c-ponude',
    status: 'DRAFT',
    brief: 'Doček Nove godine: Beč, Prag, Budimpešta autobusom; Istanbul avionom. Rani popust do 15.10.',
    contentData: {},
    bodyHtml: null,
    generatedBy: null,
    testSentAt: null,
    testRecipients: [],
    approvedBy: null,
    approvedAt: null,
    sendAt: null,
    sentAt: null,
    listmonkCampaignId: null,
    deliveryMode: 'KAMPANJA',
    stats: { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complaints: 0 },
    history: [{ at: daysAgo(0, 6), actor: 'Content agent', action: 'Nacrt kreiran' }],
    createdBy: 'Content agent',
    createdAt: daysAgo(0, 6),
    updatedAt: daysAgo(0, 6),
  },
];

const settings: Settings = {
  domains: [
    {
      domain: 'b2b.olympic.rs',
      purpose: 'Subagenti — oba B2B toka',
      segments: ['B2B_OPERATIVNI', 'B2B_PROMOTIVNI'],
      spf: true,
      dkim: true,
      dmarcPhase: 'QUARANTINE',
      dmarcSince: daysAgo(21),
      sesVerified: true,
      productionAccess: true,
      configurationSets: ['ses-b2b-operativno', 'ses-b2b-promotivno'],
      snsTopic: 'arn:aws:sns:eu-central-1:000000000000:ses-b2b-events',
      warmupDay: 24,
      warmupDailyLimit: 2000,
    },
    {
      domain: 'newsletter.olympic.rs',
      purpose: 'Krajnji klijenti (B2C)',
      segments: ['B2C'],
      spf: true,
      dkim: true,
      dmarcPhase: 'NONE',
      dmarcSince: daysAgo(6),
      sesVerified: true,
      productionAccess: false,
      configurationSets: ['ses-b2c-newsletter'],
      snsTopic: 'arn:aws:sns:eu-central-1:000000000000:ses-b2c-events',
      warmupDay: 6,
      warmupDailyLimit: 200,
    },
  ],
  testRecipients: ['marketing@olympic.rs', 'prodaja@olympic.rs'],
  sunsetMonths: 6,
  reengagementEnabled: true,
  minGapMinutes: 60,
  bigCampaignThreshold: 500,
  listmonkUrl: 'http://listmonk.internal:9000',
  cubeSyncEnabled: true,
};

const events: DeliveryEvent[] = [
  {
    id: 'ev-1',
    at: daysAgo(4, 9),
    type: 'DELIVERY',
    email: 'office@putniktours.rs',
    campaignId: 'cmp-002',
    domain: 'b2b.olympic.rs',
    detail: 'Isporučeno (SES → SNS → Listmonk /webhooks/service/ses)',
  },
  {
    id: 'ev-2',
    at: daysAgo(4, 9),
    type: 'BOUNCE',
    email: 'stara.adresa@nepostojeci-domen.rs',
    campaignId: 'cmp-002',
    domain: 'b2b.olympic.rs',
    detail: 'Hard bounce — domen ne postoji. Listmonk automatski blokirao adresu.',
  },
  {
    id: 'ev-3',
    at: daysAgo(8, 9),
    type: 'DELIVERY',
    email: 'rezervacije@suncanidani.rs',
    campaignId: 'cmp-001',
    domain: 'b2b.olympic.rs',
    detail: 'Isporučeno',
  },
];

export function buildSeed(): Store {
  return {
    lists,
    subscribers,
    subscriberAudit: [],
    suppressions: [],
    agentInvocations: [],
    templates: SEED_TEMPLATES,
    campaigns,
    settings,
    events,
  };
}
