import type { Placeholder, Template } from './types';

// Šabloni newsletter-a (spec §5.1) — čist HTML/CSS sa {{placeholder}} poljima, u navy/gold/sand
// paleti agencije. Inline stilovi namerno: mail klijenti (Gmail/Outlook) ne podržavaju <style>
// pouzdano. Placeholder-i se popunjavaju iz `contentData` kampanje (`renderTemplate`).

const NAVY = '#12213f';
const GOLD = '#c9a24a';
const SAND = '#f4efe6';

export const B2B_PLACEHOLDERS: Placeholder[] = [
  { key: 'naslov', label: 'Naslov', hint: 'Glavni naslov u zaglavlju mejla' },
  { key: 'uvod', label: 'Uvodni pasus', hint: '2–3 rečenice obraćanja partnerima' },
  { key: 'ponuda_1_naziv', label: 'Ponuda 1 — naziv', hint: 'npr. Rodos, hotel Blue Sea 4*' },
  { key: 'ponuda_1_opis', label: 'Ponuda 1 — opis', hint: 'Termin, usluga, šta je uključeno' },
  { key: 'ponuda_1_cena', label: 'Ponuda 1 — cena', hint: 'npr. od 489 € po osobi' },
  { key: 'ponuda_2_naziv', label: 'Ponuda 2 — naziv', hint: '' },
  { key: 'ponuda_2_opis', label: 'Ponuda 2 — opis', hint: '' },
  { key: 'ponuda_2_cena', label: 'Ponuda 2 — cena', hint: '' },
  { key: 'napomena', label: 'Operativna napomena', hint: 'Rok uplate, alotman, promene' },
  { key: 'cta_tekst', label: 'CTA dugme — tekst', hint: 'npr. Otvori B2B portal' },
  { key: 'cta_link', label: 'CTA dugme — link', hint: 'https://…' },
];

export const B2C_PLACEHOLDERS: Placeholder[] = [
  { key: 'naslov', label: 'Naslov', hint: 'Glavni naslov (emotivan, kratak)' },
  { key: 'uvod', label: 'Uvodni pasus', hint: 'Obraćanje putniku' },
  { key: 'ponuda_1_naziv', label: 'Ponuda 1 — naziv', hint: '' },
  { key: 'ponuda_1_opis', label: 'Ponuda 1 — opis', hint: '' },
  { key: 'ponuda_1_cena', label: 'Ponuda 1 — cena', hint: '' },
  { key: 'ponuda_2_naziv', label: 'Ponuda 2 — naziv', hint: '' },
  { key: 'ponuda_2_opis', label: 'Ponuda 2 — opis', hint: '' },
  { key: 'ponuda_2_cena', label: 'Ponuda 2 — cena', hint: '' },
  { key: 'ponuda_3_naziv', label: 'Ponuda 3 — naziv', hint: '' },
  { key: 'ponuda_3_opis', label: 'Ponuda 3 — opis', hint: '' },
  { key: 'ponuda_3_cena', label: 'Ponuda 3 — cena', hint: '' },
  { key: 'cta_tekst', label: 'CTA dugme — tekst', hint: 'npr. Pogledaj sve ponude' },
  { key: 'cta_link', label: 'CTA dugme — link', hint: 'https://…' },
];

function offerBlock(n: number): string {
  return `
        <tr>
          <td style="padding:0 0 14px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3dccb;border-radius:8px;background:#ffffff;">
              <tr>
                <td style="padding:16px 18px;">
                  <div style="font-family:Georgia,serif;font-size:17px;color:${NAVY};font-weight:bold;">{{ponuda_${n}_naziv}}</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#3a3f4b;margin-top:6px;">{{ponuda_${n}_opis}}</div>
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${GOLD};margin-top:10px;">{{ponuda_${n}_cena}}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function shell(opts: { preheader: string; body: string; footer: string; brandTag: string }): string {
  return `<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{naslov}}</title>
</head>
<body style="margin:0;padding:0;background:${SAND};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:${SAND};">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAND};">
  <tr>
    <td align="center" style="padding:28px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:${NAVY};border-radius:10px 10px 0 0;padding:22px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-family:Georgia,serif;font-size:20px;color:#ffffff;letter-spacing:1px;">
                  <span style="color:${GOLD};">●</span>&nbsp;Olympic Travel
                </td>
                <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${GOLD};text-transform:uppercase;letter-spacing:2px;">${opts.brandTag}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:30px 28px 10px 28px;">
            <h1 style="margin:0 0 12px 0;font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${NAVY};">{{naslov}}</h1>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#3a3f4b;">{{uvod}}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#ffffff;padding:0 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.body}
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="background:#ffffff;padding:8px 28px 30px 28px;">
            <a href="{{cta_link}}" style="display:inline-block;background:${GOLD};color:${NAVY};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:12px 28px;border-radius:6px;">{{cta_tekst}}</a>
          </td>
        </tr>
        <tr>
          <td style="background:${NAVY};border-radius:0 0 10px 10px;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#b9c0d0;">
            ${opts.footer}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export const B2B_TEMPLATE_HTML = shell({
  preheader: '{{naslov}}',
  brandTag: 'B2B partner',
  body:
    offerBlock(1) +
    offerBlock(2) +
    `
        <tr>
          <td style="padding:4px 0 18px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SAND};border-left:4px solid ${GOLD};border-radius:4px;">
              <tr>
                <td style="padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${NAVY};">
                  <strong>Napomena za partnere:</strong> {{napomena}}
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
  footer: `Olympic Travel d.o.o. · B2B odeljenje · Ovaj mejl je deo poslovne komunikacije sa ugovornim partnerima.<br>
            {{unsubscribe_blok}}`,
});

export const B2C_TEMPLATE_HTML = shell({
  preheader: '{{naslov}}',
  brandTag: 'Newsletter',
  body: offerBlock(1) + offerBlock(2) + offerBlock(3),
  footer: `Olympic Travel d.o.o. · Primate ovaj newsletter jer ste dali saglasnost pri rezervaciji.<br>
            <a href="{{ UnsubscribeURL }}" style="color:${GOLD};">Odjava</a> · <a href="{{ MessageURL }}" style="color:${GOLD};">Pogledaj u pregledaču</a>`,
});

export const SEED_TEMPLATES: Template[] = [
  {
    id: 'tpl-b2b-standard',
    name: 'B2B — standardni bilten',
    audience: 'B2B',
    description:
      'Zaglavlje sa B2B oznakom, dve ponude, blok "napomena za partnere" (rok uplate, alotman), CTA ka portalu. Koristi se za oba B2B toka — unsubscribe blok se ubacuje samo na promotivnom toku.',
    html: B2B_TEMPLATE_HTML,
    placeholders: B2B_PLACEHOLDERS,
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'tpl-b2c-ponude',
    name: 'B2C — sezonske ponude',
    audience: 'B2C',
    description:
      'Tri ponude sa cenama, emotivan naslov, CTA ka sajtu. Obavezan Listmonk {{ UnsubscribeURL }} u podnožju (double opt-in lista).',
    html: B2C_TEMPLATE_HTML,
    placeholders: B2C_PLACEHOLDERS,
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
];

/** Popunjava {{placeholder}} polja; nepopunjena polja ostaju vidljivo označena da ne prođu u slanje. */
export function renderTemplate(
  html: string,
  data: Record<string, string>,
  opts: { unsubscribeAllowed: boolean },
): string {
  const unsubscribe = opts.unsubscribeAllowed
    ? `<a href="{{ UnsubscribeURL }}" style="color:${GOLD};">Odjava sa promotivnih obaveštenja</a> — odjava ne utiče na operativna obaveštenja (cenovnici, rokovi).`
    : 'Operativna obaveštenja se šalju svim aktivnim partnerima i ne podležu odjavi.';
  return html.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (key === 'unsubscribe_blok') return unsubscribe;
    const v = data[key];
    if (v === undefined || v.trim() === '') {
      return `<span style="background:#fde68a;color:#7c2d12;padding:0 4px;">[${key}]</span>`;
    }
    return escapeHtml(v);
  });
}

export function missingPlaceholders(placeholders: Placeholder[], data: Record<string, string>) {
  return placeholders.filter((p) => !data[p.key] || data[p.key].trim() === '').map((p) => p.key);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
