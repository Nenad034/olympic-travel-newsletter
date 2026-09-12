import { NextResponse } from 'next/server';
import { askAgent, type AgentContextItem } from '@/lib/agent';

export const dynamic = 'force-dynamic';

// Jedina ulazna tačka ka agentu. Jedan poziv po pitanju — server nema trajnu memoriju
// razgovora, panel šalje prethodne ture uz svaki upit (isti obrazac kao POST /omnisearch
// u Terminal Travel panelu).
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    query?: string;
    pageContent?: string;
    contextItems?: AgentContextItem[];
    history?: { question: string; answer: string }[];
  } | null;

  if (!body?.query?.trim()) {
    return NextResponse.json({ error: 'Obavezno polje: query' }, { status: 400 });
  }

  try {
    const res = await askAgent({
      query: body.query,
      pageContent: body.pageContent,
      contextItems: body.contextItems,
      history: body.history,
    });
    return NextResponse.json(res);
  } catch (e) {
    // Ispad modela ne sme da sruši panel — korisnik dobija poruku, ne prazan ekran.
    const message = e instanceof Error ? e.message : 'Nepoznata greška';
    console.error('[agent] greška pri odgovoru:', message);
    return NextResponse.json({ error: `Agent trenutno ne odgovara: ${message}` }, { status: 502 });
  }
}
