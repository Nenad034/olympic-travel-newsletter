'use client';

import { useMemo, useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import Section from '@/components/Section';
import { SegmentBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import { createCampaignAction } from '@/app/actions';
import type { Segment } from '@/lib/types';

interface ListOpt {
  id: string;
  name: string;
  segment: Segment;
  sendingDomain: string;
  configurationSet: string;
  unsubscribeAllowed: boolean;
  description: string;
  recipients: number;
}
interface TplOpt {
  id: string;
  name: string;
  audience: 'B2B' | 'B2C';
  description: string;
  placeholders: number;
}

const BRIEF_EXAMPLE = `Early booking leto 2027 — Grčka i Turska. Popust do 30% za rezervacije do 31.10.
Halkidiki, Kasandra, hotel 4*, 10 noćenja polupansion, sopstveni prevoz, od 549 € po osobi.
Rodos, Faliraki, all inclusive, 7 noćenja avionom iz Beograda, od 799 € po osobi.
Antalija, Lara, ultra all inclusive 5*, 7 noćenja avionom, transfer uključen, od 899 € po osobi.
CTA: https://www.olympic.rs/leto-2027`;

export default function NewCampaignForm({ lists, templates }: { lists: ListOpt[]; templates: TplOpt[] }) {
  const [listId, setListId] = useState(lists[0]?.id ?? '');
  const list = lists.find((l) => l.id === listId);
  const audience = list?.segment === 'B2C' ? 'B2C' : 'B2B';
  const eligible = useMemo(() => templates.filter((t) => t.audience === audience), [templates, audience]);
  const [templateId, setTemplateId] = useState(eligible[0]?.id ?? '');
  const effectiveTemplate = eligible.find((t) => t.id === templateId) ? templateId : (eligible[0]?.id ?? '');
  const [name, setName] = useState('');
  const [brief, setBrief] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createCampaignAction({ name, listId, templateId: effectiveTemplate, brief });
      if (r && !r.ok) setError(r.error);
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Section title="1 · Segment (lista / tok)" icon="list-tree" bodyClassName="p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {lists.map((l) => (
              <label
                key={l.id}
                className={`flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 ${
                  listId === l.id ? 'border-accent bg-accent-soft' : 'border-border bg-panel hover:border-accent'
                }`}
              >
                <input type="radio" name="list" className="hidden" checked={listId === l.id} onChange={() => setListId(l.id)} />
                <div className="flex items-center justify-between gap-2">
                  <SegmentBadge segment={l.segment} />
                  <span className="font-mono text-xs text-ink-dim">{l.recipients} prim.</span>
                </div>
                <span className="text-xs font-medium text-ink">{l.name}</span>
                <span className="text-[11px] leading-snug text-ink-faint">{l.description}</span>
                <span className="mt-1 text-[10px] font-mono text-ink-faint">
                  {l.sendingDomain} · {l.configurationSet} · {l.unsubscribeAllowed ? 'odjava: da' : 'bez odjave'}
                </span>
              </label>
            ))}
          </div>
        </Section>

        <Section title="2 · Šablon" icon="layout" bodyClassName="p-4">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {eligible.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 ${
                  effectiveTemplate === t.id ? 'border-accent bg-accent-soft' : 'border-border bg-panel hover:border-accent'
                }`}
              >
                <input type="radio" name="tpl" className="hidden" checked={effectiveTemplate === t.id} onChange={() => setTemplateId(t.id)} />
                <span className="text-xs font-medium text-ink">{t.name}</span>
                <span className="text-[11px] leading-snug text-ink-faint">{t.description}</span>
                <span className="text-[10px] font-mono text-ink-faint">{t.placeholders} polja</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-faint">
            Prikazani su samo šabloni za izabranu publiku ({audience}). Novi šabloni se prave retko, u Claude Design-u, i
            dodaju u sekciji „Šabloni“.
          </p>
        </Section>

        <Section title="3 · Naziv i brif (ulazni podaci za Claude API)" icon="sparkle" bodyClassName="p-4">
          <label className="label" htmlFor="name">Naziv kampanje (interni)</label>
          <input id="name" className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="npr. B2C — Rana rezervacija leto 2027" required />
          <div className="mb-1 flex items-center justify-between">
            <label className="label !mb-0" htmlFor="brief">Brif — ponude, cene, rokovi, CTA link</label>
            <button type="button" onClick={() => setBrief(BRIEF_EXAMPLE)} className="text-[11px] text-accent hover:underline">
              ubaci primer
            </button>
          </div>
          <textarea id="brief" className="input min-h-[180px] font-mono text-xs" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Jedna ponuda po redu: destinacija, hotel, usluga, termin, cena…" required />
          <p className="mt-2 text-[11px] text-ink-faint">
            Claude popunjava SAMO placeholder polja šablona iz ovog brifa — ne izmišlja cene ni uslove. Ako nema API ključa,
            radi lokalni popunjivač (vidljivo u statusnoj traci).
          </p>
        </Section>

        {error && <Notice tone="danger">{error}</Notice>}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            <Icon name={pending ? 'loading' : 'arrow-right'} className={`!text-[14px] ${pending ? 'animate-spin' : ''}`} />
            {pending ? 'Kreiram nacrt…' : 'Kreiraj nacrt'}
          </Button>
          <span className="text-[11px] text-ink-faint">Nacrt ne šalje ništa — sledeći korak je generisanje sadržaja i test.</span>
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <Section title="Šta se dešava dalje" icon="info" bodyClassName="p-4 text-xs text-ink-dim">
          <ol className="flex list-decimal flex-col gap-2 pl-4">
            <li>Claude API popunjava polja šablona iz brifa (ili ih uneseš ručno).</li>
            <li>Pregled HTML-a, dorada polja.</li>
            <li>Test slanje internom timu (Gmail / Outlook / mobilni).</li>
            <li><strong className="text-ink">Odobrenje</strong> sadržaja i termina — tek tada kampanja odlazi u Listmonk.</li>
            <li>Pošalji odmah ili zakaži; zakazane se vide u kalendaru i mogu se menjati do slanja.</li>
          </ol>
        </Section>
        {list && (
          <Section title="Pravila izabranog toka" icon="shield" bodyClassName="p-4 text-xs text-ink-dim">
            <ul className="flex flex-col gap-1.5">
              <li><span className="text-ink-faint">Domen:</span> <span className="font-mono">{list.sendingDomain}</span></li>
              <li><span className="text-ink-faint">Configuration set:</span> <span className="font-mono">{list.configurationSet}</span></li>
              <li><span className="text-ink-faint">Odjava:</span> {list.unsubscribeAllowed ? 'standardan unsubscribe link' : 'nema — deo poslovnog odnosa'}</li>
              <li><span className="text-ink-faint">Primalaca sada:</span> <span className="font-mono">{list.recipients}</span></li>
            </ul>
          </Section>
        )}
      </aside>
    </form>
  );
}
