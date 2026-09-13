'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import Section from '@/components/Section';
import { SegmentBadge } from '@/components/Badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  resetDemoDataAction,
  setDmarcPhaseAction,
  syncListmonkAction,
  toggleProductionAccessAction,
  updateSettingsAction,
  type ActionResult,
} from '@/app/actions';
import { fmtDate, fmtDateTime, fmtRelative } from '@/lib/datum';
import type { DmarcPhase, MailingList, Settings } from '@/lib/types';
import type { AgentBudgetState, BudgetWindow } from '@/lib/agent-budget';

const DMARC: { phase: DmarcPhase; label: string; desc: string }[] = [
  { phase: 'NONE', label: 'p=none', desc: 'Monitoring — par nedelja, čitaju se izveštaji' },
  { phase: 'QUARANTINE', label: 'p=quarantine', desc: 'Neusklađeno ide u spam' },
  { phase: 'REJECT', label: 'p=reject', desc: 'Neusklađeno se odbija' },
];

/** Prazno polje znači „bez granice" — 0 bi se čitalo kao „budžet je 0 €", što je nešto drugo. */
function parseLimit(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  return raw.trim() === '' || !Number.isFinite(value) || value <= 0 ? null : value;
}

function BudgetRow({ w, naziv }: { w: BudgetWindow; naziv: string }) {
  const pct = w.limitEur ? Math.min(100, (w.spentEur / w.limitEur) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-ink-dim">
          {naziv} · {w.pozivi} {w.pozivi === 1 ? 'poziv' : 'poziva'}
        </span>
        <span className={w.exceeded ? 'font-semibold text-danger' : 'text-ink'}>
          {w.spentEur.toFixed(2).replace('.', ',')} €{' '}
          <span className="text-ink-faint">
            / {w.limitEur === null ? 'bez granice' : `${w.limitEur.toFixed(2).replace('.', ',')} €`}
          </span>
        </span>
      </div>
      {w.limitEur !== null && (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div
            style={{ width: `${pct}%` }}
            className={`h-full rounded-full ${w.exceeded ? 'bg-danger' : 'bg-accent'}`}
          />
        </div>
      )}
    </div>
  );
}

export default function SettingsPanels({ settings, lists, listmonkMode, listmonkUrl, claudeLive, budget }: { settings: Settings; lists: MailingList[]; listmonkMode: 'LIVE' | 'MOCK'; listmonkUrl: string | null; claudeLive: boolean; budget: AgentBudgetState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [testRecipients, setTestRecipients] = useState(settings.testRecipients.join(', '));
  const [sunsetMonths, setSunsetMonths] = useState(settings.sunsetMonths);
  const [reengagement, setReengagement] = useState(settings.reengagementEnabled);
  const [minGap, setMinGap] = useState(settings.minGapMinutes);
  const [threshold, setThreshold] = useState(settings.bigCampaignThreshold);
  const [dailyBudget, setDailyBudget] = useState(settings.agentDailyBudgetEur?.toString() ?? '');
  const [monthlyBudget, setMonthlyBudget] = useState(settings.agentMonthlyBudgetEur?.toString() ?? '');

  function run(fn: () => Promise<ActionResult>, ok: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      // Akcija koja vrati tekst (npr. izveštaj sinhronizacije) ima prednost nad opštom porukom.
      setMsg(r.ok ? { tone: 'ok', text: r.id ? `${ok} ${r.id}` : ok } : { tone: 'danger', text: r.error });
      router.refresh();
    });
  }

  const live = listmonkMode === 'LIVE';
  const unlinked = lists.filter((l) => l.listmonkListId == null).length;

  return (
    <div className="flex flex-col gap-4">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-panel2 text-ink-dim"><Icon name="server" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-ink">Listmonk motor</div>
            <div className="truncate font-mono text-[11px] text-ink-faint">{live ? listmonkUrl : 'mock (data/store.json)'}</div>
          </div>
          <Badge variant={listmonkMode === 'LIVE' ? 'ok' : 'warn'}>{listmonkMode}</Badge>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-panel2 text-ink-dim"><Icon name="sparkle" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-ink">Claude API</div>
            <div className="truncate font-mono text-[11px] text-ink-faint">{claudeLive ? 'claude-opus-5 · punjenje šablona' : 'ANTHROPIC_API_KEY nije podešen'}</div>
          </div>
          <Badge variant={claudeLive ? 'ok' : 'warn'}>{claudeLive ? 'AKTIVAN' : 'LOKALNO'}</Badge>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-panel p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-panel2 text-ink-dim"><Icon name="graph" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-ink">M-25 Cube.dev sync</div>
            <div className="truncate font-mono text-[11px] text-ink-faint">metrike kampanja → semantični sloj</div>
          </div>
          <Badge variant={settings.cubeSyncEnabled ? 'ok' : 'secondary'}>{settings.cubeSyncEnabled ? 'UKLJ.' : 'ISKLJ.'}</Badge>
        </div>
      </div>

      <Section title="SES identiteti (poddomeni)" icon="globe">
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-2">
          {settings.domains.map((d, i) => (
            <div key={d.domain} className={`p-4 ${i === 0 ? 'border-b border-border lg:border-b-0 lg:border-r' : ''}`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold text-ink">{d.domain}</div>
                  <div className="text-[11px] text-ink-faint">{d.purpose}</div>
                </div>
                <div className="flex gap-1">{d.segments.map((s) => <SegmentBadge key={s} segment={s} />)}</div>
              </div>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge variant={d.sesVerified ? 'ok' : 'danger'}>SES {d.sesVerified ? 'verifikovan' : 'nije verifikovan'}</Badge>
                <Badge variant={d.spf ? 'ok' : 'danger'}>SPF</Badge>
                <Badge variant={d.dkim ? 'ok' : 'danger'}>DKIM</Badge>
                <Badge variant={d.productionAccess ? 'ok' : 'warn'}>{d.productionAccess ? 'production access' : 'SES sandbox'}</Badge>
              </div>
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">DMARC faza — od {fmtDate(d.dmarcSince)} ({fmtRelative(d.dmarcSince)})</div>
              <div className="mb-3 flex gap-1.5">
                {DMARC.map((p, idx) => {
                  const cur = DMARC.findIndex((x) => x.phase === d.dmarcPhase);
                  const active = p.phase === d.dmarcPhase;
                  const jump = idx > cur + 1;
                  return (
                    <button
                      key={p.phase}
                      type="button"
                      disabled={pending || active || jump}
                      title={jump ? 'Ne preskakati faze — greška u SPF/DKIM bi nečujno blokirala slanja' : p.desc}
                      onClick={() => { if (confirm(`Preći na DMARC ${p.label} za ${d.domain}?`)) run(() => setDmarcPhaseAction(d.domain, p.phase), `DMARC ${p.label} postavljen za ${d.domain}.`); }}
                      className={`flex-1 rounded-lg border p-2 text-left ${active ? 'border-accent bg-accent-soft' : 'border-border bg-panel hover:border-accent disabled:opacity-40'}`}
                    >
                      <span className="block font-mono text-xs font-semibold text-ink">{p.label}</span>
                      <span className="block text-[10px] leading-snug text-ink-faint">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-dim">
                <span>Config sets: <span className="font-mono">{d.configurationSets.join(', ')}</span></span>
                <span>warm-up dan {d.warmupDay} · limit {d.warmupDailyLimit}/dan</span>
              </div>
              <div className="mt-2 text-[11px] text-ink-faint">SNS: <span className="font-mono">{d.snsTopic}</span></div>
              <Button size="sm" variant="outline" className="mt-3" disabled={pending} onClick={() => run(() => toggleProductionAccessAction(d.domain), 'Status production access-a izmenjen.')}>
                <Icon name={d.productionAccess ? 'lock' : 'unlock'} className="!text-[12px]" /> {d.productionAccess ? 'označi kao sandbox' : 'označi production access odobren'}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Povezivanje sa Listmonk-om" icon="server" bodyClassName="p-4">
        <p className="text-xs text-ink-dim">
          Modul u motoru pravi svoje liste (po imenu) i dva šablona — transakcioni omotač za operativni tok i „čist“ kampanjski
          omotač — i pamti njihove ID-jeve. Bez povezivanja LIVE slanje odbija da krene. Ponovno pokretanje ne pravi duplikate.
        </p>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {lists.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="py-1.5 pr-3"><SegmentBadge segment={l.segment} /></td>
                <td className="py-1.5 pr-3 text-ink">{l.name}</td>
                <td className="py-1.5 text-right font-mono text-[11px] text-ink-faint">
                  {l.listmonkListId == null ? <Badge variant={live ? 'warn' : 'secondary'}>nije povezana</Badge> : `Listmonk lista #${l.listmonkListId}`}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border">
              <td className="py-1.5 pr-3 text-ink-faint" colSpan={2}>Transakcioni šablon (operativni tok, /api/tx)</td>
              <td className="py-1.5 text-right font-mono text-[11px] text-ink-faint">{settings.listmonkTxTemplateId == null ? '—' : `#${settings.listmonkTxTemplateId}`}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-1.5 pr-3 text-ink-faint" colSpan={2}>Čist kampanjski omotač (promo / B2C)</td>
              <td className="py-1.5 text-right font-mono text-[11px] text-ink-faint">{settings.listmonkCampaignTemplateId == null ? '—' : `#${settings.listmonkCampaignTemplateId}`}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={pending || !live} onClick={() => run(() => syncListmonkAction(), 'Povezano:')}>
            <Icon name="sync" className="!text-[12px]" /> poveži sa Listmonk-om
          </Button>
          <span className="text-[11px] text-ink-faint">
            {!live
              ? 'Dostupno samo u LIVE režimu (LISTMONK_URL, LISTMONK_API_USER, LISTMONK_API_TOKEN).'
              : settings.listmonkSyncedAt
                ? `Poslednje povezivanje ${fmtDateTime(settings.listmonkSyncedAt)}${unlinked ? ` · ${unlinked} nepovezanih` : ''}`
                : 'Još nije povezivano.'}
          </span>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Interna test lista" icon="beaker" bodyClassName="p-4">
          <label className="label">Primaoci test slanja (zarezom)</label>
          <input className="input" value={testRecipients} onChange={(e) => setTestRecipients(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-faint">Provera renderovanja u Gmail / Outlook / mobilnim klijentima pre slanja na punu bazu.</p>
          <Button size="sm" className="mt-3" disabled={pending} onClick={() => run(() => updateSettingsAction({ testRecipients: testRecipients.split(',').map((s) => s.trim()).filter(Boolean) }), 'Test lista sačuvana.')}>
            <Icon name="save" className="!text-[12px]" /> sačuvaj
          </Button>
        </Section>

        <Section title="Sunset / re-engagement" icon="history" bodyClassName="p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Neaktivnost (meseci)</label>
              <input type="number" min={1} max={24} className="input" value={sunsetMonths} onChange={(e) => setSunsetMonths(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Automatska re-engagement kampanja</label>
              <label className="flex h-[38px] items-center gap-2 text-xs text-ink">
                <input type="checkbox" checked={reengagement} onChange={(e) => setReengagement(e.target.checked)} /> uključena
              </label>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">Bez otvaranja → re-engagement → bez reakcije → pauza. Operativni B2B tok je izuzet.</p>
          <Button size="sm" className="mt-3" disabled={pending} onClick={() => run(() => updateSettingsAction({ sunsetMonths, reengagementEnabled: reengagement }), 'Sunset politika sačuvana.')}>
            <Icon name="save" className="!text-[12px]" /> sačuvaj
          </Button>
        </Section>

        <Section title="Razmak između kampanja (SES throughput)" icon="calendar" bodyClassName="p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Minimalni razmak (min)</label>
              <input type="number" min={0} max={240} className="input" value={minGap} onChange={(e) => setMinGap(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">„Velika“ kampanja od (primalaca)</label>
              <input type="number" min={0} className="input" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">Kalendar i odobrenje upozoravaju kad su dve kampanje zakazane bliže od ovog razmaka (preporuka 30–60 min).</p>
          <Button size="sm" className="mt-3" disabled={pending} onClick={() => run(() => updateSettingsAction({ minGapMinutes: minGap, bigCampaignThreshold: threshold }), 'Razmak sačuvan.')}>
            <Icon name="save" className="!text-[12px]" /> sačuvaj
          </Button>
        </Section>

        <Section title="Budžet AI agenta" icon="sparkle" bodyClassName="p-4">
          <div className="flex flex-col gap-2">
            <BudgetRow w={budget.daily} naziv="Danas" />
            <BudgetRow w={budget.monthly} naziv="Ovaj mesec" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dnevna granica (EUR)</label>
              <input className="input" placeholder="bez granice" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
            </div>
            <div>
              <label className="label">Mesečna granica (EUR)</label>
              <input className="input" placeholder="bez granice" value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-ink-faint">
            Potrošnja se sabira iz dnevnika poziva agenta, po procenjenom cenovniku modela — orijentir za praćenje, ne faktura.
            Kad je granica dostignuta, agent ne prestaje da radi: odgovara lokalno, iz istih podataka i bez troška, dok ne počne nov period ili dok se granica ne podigne.
          </p>
          <Button size="sm" className="mt-3" disabled={pending} onClick={() => run(() => updateSettingsAction({ agentDailyBudgetEur: parseLimit(dailyBudget), agentMonthlyBudgetEur: parseLimit(monthlyBudget) }), 'Budžet agenta sačuvan.')}>
            <Icon name="save" className="!text-[12px]" /> sačuvaj
          </Button>
        </Section>

        <Section title="Demo podaci" icon="debug-restart" bodyClassName="p-4">
          <p className="text-xs text-ink-dim">Vraća lokalno skladište (data/store.json) na početno seme: 3 liste, 31 pretplatnik, 6 kampanja u različitim statusima.</p>
          <Button size="sm" variant="destructive" className="mt-3" disabled={pending} onClick={() => { if (confirm('Vratiti sve demo podatke na početno stanje?')) run(() => resetDemoDataAction(), 'Demo podaci vraćeni.'); }}>
            <Icon name="debug-restart" className="!text-[12px]" /> resetuj demo podatke
          </Button>
        </Section>
      </div>
    </div>
  );
}
