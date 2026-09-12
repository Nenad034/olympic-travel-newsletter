// M-27 Newsletter modul — domenski model (docs/M27_NEWSLETTER_MODULE.md).

/** Tri toka slanja (spec §3): dva B2B toka dele istu bazu subagenata, B2C je zasebna lista. */
export type Segment = 'B2B_OPERATIVNI' | 'B2B_PROMOTIVNI' | 'B2C';

export const SEGMENT_LABEL: Record<Segment, string> = {
  B2B_OPERATIVNI: 'B2B — operativni tok',
  B2B_PROMOTIVNI: 'B2B — promotivni tok',
  B2C: 'B2C — krajnji klijenti',
};

export const SEGMENT_SHORT: Record<Segment, string> = {
  B2B_OPERATIVNI: 'B2B operativno',
  B2B_PROMOTIVNI: 'B2B promotivno',
  B2C: 'B2C',
};

/** Pravila pristanka po toku (spec §3.1/§3.2). */
export type OptinMode = 'AUTO_OBAVEZNO' | 'OPT_OUT' | 'DOUBLE_OPT_IN';

export interface MailingList {
  id: string;
  name: string;
  segment: Segment;
  /** SES identitet sa kog se šalje (spec §3.3) — b2b.olympic.rs ili newsletter.olympic.rs. */
  sendingDomain: string;
  /** SES configuration set (spec §4) — odvojen po toku da se statistika ne meša. */
  configurationSet: string;
  optinMode: OptinMode;
  /** Operativni B2B tok nema odjavu — deo poslovnog odnosa, ne marketing. */
  unsubscribeAllowed: boolean;
  description: string;
}

export type SubscriberStatus = 'ENABLED' | 'UNCONFIRMED' | 'PAUSED' | 'BLOCKLISTED';

export interface Subscriber {
  id: string;
  email: string;
  name: string;
  listIds: string[];
  status: SubscriberStatus;
  /** Izvor prijave (spec §7). Automatski tokovi su PORTAL i BOOKING; RUCNI_UNOS i IMPORT_CSV
   * su unos od strane marketing tima i traže dokumentovan osnov pristanka (`consentNote`). */
  source: 'PORTAL' | 'BOOKING' | 'INTERNI_TEST' | 'RUCNI_UNOS' | 'IMPORT_CSV';
  consentAt: string;
  /** Referenca na izvorni zapis (portal nalog / booking / dokaz pristanka za ručni unos) —
   * za pravo na brisanje i reviziju. */
  sourceRef: string;
  /** Kako je pristanak pribavljen — obavezno kod ručnog unosa i CSV uvoza (ZZPL trag). */
  consentNote?: string;
  /** Ko je zapis uneo ili uvezao (prazno za automatske tokove). */
  addedBy?: string;
  company?: string;
  lastOpenAt: string | null;
  createdAt: string;
  /** Datum odjave sa promotivnog toka (B2B) — ne utiče na operativni tok. */
  unsubscribedFrom: string[];
}

export interface Placeholder {
  key: string;
  label: string;
  hint: string;
}

export interface Template {
  id: string;
  name: string;
  audience: 'B2B' | 'B2C';
  description: string;
  /** Čist HTML sa {{placeholder}} poljima (spec §5.1). */
  html: string;
  placeholders: Placeholder[];
  updatedAt: string;
}

export type CampaignStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'SENT'
  | 'CANCELLED';

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: 'Nacrt',
  PENDING_APPROVAL: 'Čeka odobrenje',
  APPROVED: 'Odobreno',
  SCHEDULED: 'Zakazano',
  RUNNING: 'Šalje se',
  SENT: 'Poslato',
  CANCELLED: 'Otkazano',
};

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complaints: number;
}

export interface CampaignEvent {
  at: string;
  actor: string;
  action: string;
  note?: string;
}

export interface Campaign {
  id: string;
  name: string;
  subject: string;
  listId: string;
  segment: Segment;
  templateId: string;
  status: CampaignStatus;
  /** Ulazni podaci za kampanju (ponude, cene, rok) — ono što ide ka Claude API-ju (spec §5.2). */
  brief: string;
  /** Vrednosti placeholder-a — popunjene od strane Claude API-ja ili ručno. */
  contentData: Record<string, string>;
  /** Finalni HTML (šablon + sadržaj). */
  bodyHtml: string | null;
  generatedBy: 'CLAUDE' | 'LOKALNO' | 'RUCNO' | null;
  testSentAt: string | null;
  testRecipients: string[];
  approvedBy: string | null;
  approvedAt: string | null;
  /** Listmonk `send_at` — postavljen samo dok je status SCHEDULED. */
  sendAt: string | null;
  sentAt: string | null;
  /** ID kampanje u Listmonk-u posle sinhronizacije (null dok se ne pošalje ka motoru). */
  listmonkCampaignId: number | null;
  /** Spec §3.1.1 — operativni B2B tok ide kao transakcioni mejl (Listmonk /api/tx, bez
   * unsubscribe linka); promotivni i B2C tok kao regularna Listmonk kampanja. */
  deliveryMode: 'KAMPANJA' | 'TRANSAKCIONO';
  stats: CampaignStats;
  history: CampaignEvent[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type DmarcPhase = 'NONE' | 'QUARANTINE' | 'REJECT';

export interface SendingDomain {
  domain: string;
  purpose: string;
  segments: Segment[];
  spf: boolean;
  dkim: boolean;
  dmarcPhase: DmarcPhase;
  dmarcSince: string;
  sesVerified: boolean;
  productionAccess: boolean;
  configurationSets: string[];
  snsTopic: string;
  /** Dan zagrevanja (spec §4) — dnevna kvota raste postepeno. */
  warmupDay: number;
  warmupDailyLimit: number;
}

export interface Settings {
  domains: SendingDomain[];
  /** Interna test lista (spec §5.2 korak 5). */
  testRecipients: string[];
  /** Sunset politika (spec §8). */
  sunsetMonths: number;
  reengagementEnabled: boolean;
  /** Minimalni razmak između dve velike kampanje (spec §6.2). */
  minGapMinutes: number;
  bigCampaignThreshold: number;
  listmonkUrl: string;
  cubeSyncEnabled: boolean;
}

export interface DeliveryEvent {
  id: string;
  at: string;
  type: 'BOUNCE' | 'COMPLAINT' | 'DELIVERY';
  email: string;
  campaignId: string | null;
  domain: string;
  detail: string;
}

export interface Store {
  lists: MailingList[];
  subscribers: Subscriber[];
  templates: Template[];
  campaigns: Campaign[];
  settings: Settings;
  events: DeliveryEvent[];
}
