import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Notice from '@/components/Notice';
import TabLink from '@/components/TabLink';
import { Badge } from '@/components/ui/badge';
import { getStore } from '@/lib/store';
import { fmtDate } from '@/lib/datum';

export default function TemplatesPage() {
  const store = getStore();
  return (
    <div className="p-6">
      <RegisterTab label="Šabloni" />
      <PageHeader title="Šabloni newsletter-a" subtitle="Čist HTML/CSS sa {{placeholder}} poljima — izgled je fiksan, Claude API popunjava samo vrednosti polja." />
      <Notice tone="info" className="mb-4">
        Novi šablon ili redizajn (retko): marketing tim ili agent preko <strong>Claude Design</strong> (MCP) napravi
        vizuelni template u navy/gold/sand paleti, eksportuje kao čist HTML i doda ovde sa definisanim poljima.
      </Notice>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {store.templates.map((t) => {
          const used = store.campaigns.filter((c) => c.templateId === t.id).length;
          return (
            <TabLink key={t.id} href={`/sabloni/${t.id}`} label={t.name} className="flex overflow-hidden rounded-lg border border-border bg-panel hover:border-accent">
              <iframe title={t.name} src={`/api/templates/${t.id}/preview`} className="pointer-events-none h-[260px] w-[220px] flex-shrink-0 origin-top-left scale-100 bg-white" sandbox="" />
              <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{t.name}</span>
                  <Badge variant={t.audience === 'B2C' ? 'accent2' : 'accent'}>{t.audience}</Badge>
                </div>
                <p className="text-xs leading-snug text-ink-dim">{t.description}</p>
                <div className="mt-auto text-[11px] text-ink-faint">
                  {t.placeholders.length} polja · korišćen u {used} kampanja · izmenjen {fmtDate(t.updatedAt)}
                </div>
              </div>
            </TabLink>
          );
        })}
      </div>
    </div>
  );
}
