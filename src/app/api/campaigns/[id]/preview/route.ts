import { getStore } from '@/lib/store';
import { renderCampaignHtml } from '@/lib/campaigns';

export const dynamic = 'force-dynamic';

/** Renderovan HTML kampanje za <iframe> pregled. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const c = store.campaigns.find((x) => x.id === id);
  if (!c) return new Response('Kampanja ne postoji', { status: 404 });
  const html = c.bodyHtml ?? renderCampaignHtml(store, c);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
