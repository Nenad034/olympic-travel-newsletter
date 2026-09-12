import 'server-only';
import path from 'node:path';

// Izvlačenje teksta iz priloženog dokumenta — po uzoru na `extract-file.service.ts` u Terminal
// Travel API-ju (M15 §6.5.4.3). TRANZIENTNO: bafer se čita u memoriji i odbacuje, fajl se nikad
// ne piše na disk. Tekst odavde ulazi u prompt kao PODATAK — sistemski prompt agenta izričito
// kaže da priložen sadržaj nikad nije instrukcija.

const PLAIN_TEXT_EXTENSIONS = new Set(['.txt', '.md', '.csv', '.json']);

/** Gornja granica izvučenog teksta — isti token/cena razlog kao za sadržaj ekrana. */
export const FILE_CONTENT_MAX_CHARS = 12000;

export class UnsupportedFileError extends Error {}

export async function extractText(buffer: Buffer, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (PLAIN_TEXT_EXTENSIONS.has(ext)) return buffer.toString('utf-8');
  if (ext === '.html' || ext === '.htm') return stripHtml(buffer.toString('utf-8'));
  if (ext === '.pdf') return extractPdf(buffer);
  if (ext === '.docx') return extractDocx(buffer);
  if (ext === '.xlsx') return extractXlsx(buffer);
  if (ext === '.doc' || ext === '.xls') {
    throw new UnsupportedFileError(
      `Stari format „${ext}" nije podržan — sačuvaj fajl kao ${ext === '.doc' ? '.docx' : '.xlsx'} pa pokušaj ponovo.`,
    );
  }
  throw new UnsupportedFileError(
    `Tip fajla „${ext || '(bez ekstenzije)'}" nije podržan za prilog u razgovor sa agentom.`,
  );
}

/** Skidanje tagova bez nove zavisnosti; script/style se brišu celi da kod ne uđe u tekst. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Prevod jedne Excel ćelije u tekst. `String(v)` ovde ne valja: ExcelJS za veći deo ćelija ne
 * vraća primitivnu vrednost nego objekat, pa bi u tekst ušlo doslovno `[object Object]` —
 * i to baš na mestima koja nose značenje (`richText` naziv, `formula` sa izračunatim
 * `result`, hiperlink). Isti nalaz kao u Terminal Travel servisu, nad stvarnim cenovnicima.
 */
function cellToText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as Record<string, unknown>;
  if (Array.isArray(o.richText))
    return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('');
  if ('result' in o) return cellToText(o.result);
  if ('text' in o) return cellToText(o.text);
  if ('hyperlink' in o) return String(o.hyperlink);
  return '';
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const out: string[] = [];
  wb.eachSheet((sheet) => {
    out.push(`# ${sheet.name}`);
    sheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: false }, (cell) => cells.push(cellToText(cell.value)));
      const line = cells.filter(Boolean).join(' | ');
      if (line) out.push(line);
    });
  });
  return out.join('\n');
}
