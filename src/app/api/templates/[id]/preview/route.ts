import { getStore } from '@/lib/store';
import { renderTemplate } from '@/lib/email-templates';

export const dynamic = 'force-dynamic';

/** Pregled šablona sa primerom sadržaja (placeholder-i ostaju označeni). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const t = store.templates.find((x) => x.id === id);
  if (!t) return new Response('Šablon ne postoji', { status: 404 });
  const sample: Record<string, string> = {};
  for (const p of t.placeholders) sample[p.key] = `{{${p.key}}}`;
  const html = renderTemplate(t.html, sample, { unsubscribeAllowed: true });
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
