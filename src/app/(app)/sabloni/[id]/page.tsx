import { notFound } from 'next/navigation';
import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import Section from '@/components/Section';
import { Badge } from '@/components/ui/badge';
import { getStore } from '@/lib/store';

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = getStore();
  const t = store.templates.find((x) => x.id === id);
  if (!t) notFound();
  return (
    <div className="p-6">
      <RegisterTab label={t.name} />
      <PageHeader
        title={t.name}
        subtitle={<span className="flex items-center gap-2"><Badge variant={t.audience === 'B2C' ? 'accent2' : 'accent'}>{t.audience}</Badge>{t.description}</span>}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Section title={`Placeholder polja (${t.placeholders.length})`} icon="symbol-field">
            <ul>
              {t.placeholders.map((p) => (
                <li key={p.key} className="border-b border-border px-4 py-2 text-xs last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-ink">{p.label}</span>
                    <code className="rounded bg-panel2 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim">{'{{' + p.key + '}}'}</code>
                  </div>
                  {p.hint && <div className="text-[11px] text-ink-faint">{p.hint}</div>}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Sistemska polja (Listmonk)" icon="link" bodyClassName="p-4 text-xs text-ink-dim">
            <p><code className="font-mono">{'{UnsubscribeURL}'}</code> — link za odjavu (samo tokovi sa odjavom)</p>
            <p className="mt-1"><code className="font-mono">{'{MessageURL}'}</code> — „pogledaj u pregledaču“</p>
            <p className="mt-1"><code className="font-mono">{'{{unsubscribe_blok}}'}</code> — B2B: tekst zavisi od toka (operativni tok: nema odjave)</p>
          </Section>
        </div>
        <Section title="Pregled šablona (polja označena)" icon="preview">
          <iframe title="Pregled" src={`/api/templates/${t.id}/preview`} className="h-[820px] w-full bg-white" sandbox="" />
        </Section>
      </div>
    </div>
  );
}
