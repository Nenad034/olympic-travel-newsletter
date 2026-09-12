import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { Placeholder, Segment } from './types';
import { SEGMENT_LABEL } from './types';

// Spec §5.2 — content agent poziva Claude API sa podacima za tekuću kampanju; Claude
// popunjava placeholder-e postojećeg šablona. Ovde se NE generiše HTML (šablon je fiksan,
// spec §5.1), samo vrednosti polja — HTML se sklapa lokalno (`renderTemplate`), pa Claude
// ne može da promeni izgled/brend šablona niti da ubaci nedozvoljen markup.

export interface FillResult {
  subject: string;
  data: Record<string, string>;
  generatedBy: 'CLAUDE' | 'LOKALNO';
  model: string | null;
}

const MODEL = 'claude-opus-5';

const SYSTEM = `Ti si content/marketing agent turističke agencije Olympic Travel (Srbija).
Pišeš isključivo na srpskom jeziku, latinicom, u tonu koji odgovara publici:
- B2B (subagenti, ugovorni partneri): poslovno, precizno, bez marketinških preterivanja; cene su neto za partnere kad je tako navedeno.
- B2C (krajnji klijenti): toplo, konkretno, bez klišea i bez agresivne prodaje.
Nikad ne izmišljaj cene, hotele, datume ili uslove koji nisu u brifu — ako podatak nedostaje, napiši uopšteno ali istinito (npr. "cene na upit").
Vraćaš SAMO strukturu koju traži šema: naslov mejla (subject) i vrednosti svakog placeholder polja. Vrednosti su čist tekst, bez HTML-a i bez Markdown-a.`;

export function claudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function fillTemplate(input: {
  segment: Segment;
  campaignName: string;
  brief: string;
  placeholders: Placeholder[];
  existing: Record<string, string>;
}): Promise<FillResult> {
  if (!claudeConfigured()) return localFill(input);

  const client = new Anthropic();
  const properties: Record<string, { type: 'string'; description: string }> = {};
  for (const p of input.placeholders) {
    properties[p.key] = { type: 'string', description: `${p.label}. ${p.hint}`.trim() };
  }
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['subject', 'fields'],
    properties: {
      subject: { type: 'string', description: 'Naslov (subject) mejla, do 70 znakova' },
      fields: {
        type: 'object',
        additionalProperties: false,
        required: input.placeholders.map((p) => p.key),
        properties,
      },
    },
  };

  const userMessage = [
    `Segment: ${SEGMENT_LABEL[input.segment]}`,
    `Naziv kampanje: ${input.campaignName}`,
    `Brif (ulazni podaci za kampanju):`,
    input.brief,
    Object.keys(input.existing).length
      ? `\nVeć popunjena polja (zadrži ako su dobra, doradi ako brif traži drugačije):\n${JSON.stringify(input.existing, null, 2)}`
      : '',
    `\nPolja šablona koja treba popuniti:`,
    ...input.placeholders.map((p) => `- ${p.key}: ${p.label}${p.hint ? ` (${p.hint})` : ''}`),
  ].join('\n');

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userMessage }],
    output_config: { format: { type: 'json_schema', schema }, effort: 'medium' },
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('Claude je odbio zahtev (refusal) — proverite sadržaj brifa.');
  }
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const parsed = JSON.parse(text) as { subject: string; fields: Record<string, string> };
  return {
    subject: parsed.subject,
    data: parsed.fields,
    generatedBy: 'CLAUDE',
    model: message.model,
  };
}

/** Deterministički popunjivač bez API ključa — da tok radi i offline / u demo okruženju. */
function localFill(input: {
  segment: Segment;
  campaignName: string;
  brief: string;
  placeholders: Placeholder[];
  existing: Record<string, string>;
}): FillResult {
  const b2b = input.segment !== 'B2C';
  const lines = input.brief
    .split(/[\n.;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = lines[0] ?? input.campaignName;
  const data: Record<string, string> = { ...input.existing };
  const set = (k: string, v: string) => {
    if (!data[k]) data[k] = v;
  };
  set('naslov', input.campaignName);
  set(
    'uvod',
    b2b
      ? `Poštovani partneri, ${first.charAt(0).toLowerCase()}${first.slice(1)}. Detalji i uslovi su dostupni na B2B portalu.`
      : `${first}. Pogledajte izdvojene ponude ispod — broj mesta je ograničen.`,
  );
  const offers = lines.slice(1);
  for (let n = 1; n <= 3; n++) {
    const src = offers[n - 1];
    set(`ponuda_${n}_naziv`, src ? src.slice(0, 60) : `Ponuda ${n}`);
    set(`ponuda_${n}_opis`, src ? `Detalji: ${src}` : 'Detalji ponude na upit.');
    set(`ponuda_${n}_cena`, b2b ? 'cena na upit (neto)' : 'cena na upit');
  }
  set('napomena', 'Rokovi i uslovi prema važećem ugovoru; opcije se drže 48h.');
  set('cta_tekst', b2b ? 'Otvori B2B portal' : 'Pogledaj sve ponude');
  set('cta_link', b2b ? 'https://b2b.olympic.rs' : 'https://www.olympic.rs');
  for (const p of input.placeholders) set(p.key, '');
  return {
    subject: input.campaignName,
    data,
    generatedBy: 'LOKALNO',
    model: null,
  };
}
