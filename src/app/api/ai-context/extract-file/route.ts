import { NextResponse } from 'next/server';
import { extractText, FILE_CONTENT_MAX_CHARS, UnsupportedFileError } from '@/lib/extract-file';

export const dynamic = 'force-dynamic';

// Prilog dokumenta u razgovor sa agentom — most do `extract-file.ts`. Fajl prolazi kroz
// memoriju i odbacuje se: ne piše se na disk niti se čuva u store-u. Slike NE idu ovuda —
// one se pretvaraju u base64 u pregledaču i idu direktno uz pitanje (Claude Vision).
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'Obavezno polje: file' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { message: `Fajl je prevelik (najviše ${MAX_FILE_BYTES / 1024 / 1024} MB).` },
      { status: 413 },
    );
  }
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = (await extractText(buffer, file.name)).trim();
    if (!text) {
      return NextResponse.json(
        { message: `Iz fajla „${file.name}" nije izvučen nikakav tekst.` },
        { status: 422 },
      );
    }
    return NextResponse.json({
      label: file.name,
      content: text.slice(0, FILE_CONTENT_MAX_CHARS),
      truncated: text.length > FILE_CONTENT_MAX_CHARS,
    });
  } catch (e) {
    if (e instanceof UnsupportedFileError) {
      return NextResponse.json({ message: e.message }, { status: 415 });
    }
    const message = e instanceof Error ? e.message : 'Nepoznata greška';
    console.error('[extract-file] greška:', message);
    return NextResponse.json(
      { message: `Fajl „${file.name}" nije mogao da se pročita: ${message}` },
      { status: 500 },
    );
  }
}
