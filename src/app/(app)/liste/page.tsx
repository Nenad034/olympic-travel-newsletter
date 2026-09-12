import RegisterTab from '@/components/RegisterTab';
import PageHeader from '@/components/PageHeader';
import TabLink from '@/components/TabLink';
import Icon from '@/components/Icon';
import { SegmentBadge } from '@/components/Badges';
import { Badge } from '@/components/ui/badge';
import { getStore } from '@/lib/store';
import type { OptinMode } from '@/lib/types';

const OPTIN: Record<OptinMode, { label: string; desc: string; variant: 'outline' | 'accent' | 'accent2' }> = {
  AUTO_OBAVEZNO: { label: 'auto opt-in · bez odjave', desc: 'Pri kreiranju portal naloga; deo poslovnog odnosa.', variant: 'outline' },
  OPT_OUT: { label: 'opt-out', desc: 'Poslovni kontekst; standardan unsubscribe link.', variant: 'accent' },
  DOUBLE_OPT_IN: { label: 'double opt-in', desc: 'Čekboks pri bookingu + potvrda mejlom; ZZPL.', variant: 'accent2' },
};

export default function ListsPage() {
  const store = getStore();
  return (
    <div className="p-6">
      <RegisterTab label="Liste i tokovi" />
      <PageHeader
        title="Liste i tokovi"
        subtitle="Dva odvojena B2B toka nad istom bazom subagenata + zasebna B2C lista. Različita pravila pristanka, različit SES domen."
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {store.lists.map((l) => {
          const members = store.subscribers.filter((s) => s.listIds.includes(l.id));
          const active = members.filter((s) => s.status === 'ENABLED').length;
          const unconfirmed = members.filter((s) => s.status === 'UNCONFIRMED').length;
          const optedOut = store.subscribers.filter((s) => s.unsubscribedFrom.includes(l.id)).length;
          const domain = store.settings.domains.find((d) => d.domain === l.sendingDomain);
          const o = OPTIN[l.optinMode];
          return (
            <TabLink key={l.id} href={`/liste/${l.id}`} label={l.name} className="flex flex-col rounded-lg border border-border bg-panel hover:border-accent">
              <div className="section-head justify-between rounded-t-lg">
                <SegmentBadge segment={l.segment} />
                <span className="font-mono text-[10px] normal-case tracking-normal">{l.sendingDomain}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div>
                  <div className="text-sm font-semibold text-ink">{l.name}</div>
                  <p className="mt-1 text-xs leading-snug text-ink-dim">{l.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-panel2 p-2"><div className="font-mono text-lg font-semibold text-ink">{active}</div><div className="text-[10px] text-ink-faint">aktivnih</div></div>
                  <div className="rounded-md bg-panel2 p-2"><div className="font-mono text-lg font-semibold text-warn">{unconfirmed}</div><div className="text-[10px] text-ink-faint">čeka potvrdu</div></div>
                  <div className="rounded-md bg-panel2 p-2"><div className="font-mono text-lg font-semibold text-ink-dim">{optedOut}</div><div className="text-[10px] text-ink-faint">odjavljeno</div></div>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px] text-ink-dim">
                  <div className="flex items-center gap-2"><Badge variant={o.variant}>{o.label}</Badge></div>
                  <div className="text-ink-faint">{o.desc}</div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]"><Icon name="settings" className="!text-[12px]" /> {l.configurationSet}</div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <Icon name="shield" className="!text-[12px]" /> DMARC p={domain?.dmarcPhase.toLowerCase()} · SPF {domain?.spf ? '✓' : '✗'} · DKIM {domain?.dkim ? '✓' : '✗'}
                  </div>
                </div>
              </div>
            </TabLink>
          );
        })}
      </div>
      <div className="mt-4 rounded-lg border border-border bg-panel p-4 text-xs text-ink-dim">
        <strong className="text-ink">Zašto dva domena:</strong> loša reputacija na jednoj strani (npr. spam prijave krajnjih klijenata) ne sme da ugrozi
        isporuku kritične B2B komunikacije. <strong className="text-ink">Zašto dva B2B toka:</strong> odjava sa promotivnog toka ne sme da utiče na
        operativna obaveštenja (cenovnici, alotmani, rokovi) — zato odvojene liste i odvojeni configuration set-ovi, ista baza.
      </div>
    </div>
  );
}
