'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import Section from '@/components/Section';
import StatTile from '@/components/StatTile';
import { SegmentBadge, StatusBadge } from '@/components/Badges';
import { Button } from '@/components/ui/button';
import {
  approveAction,
  cancelAction,
  deleteCampaignAction,
  generateContentAction,
  rescheduleAction,
  sendTestAction,
  submitForApprovalAction,
  updateDraftAction,
  type ActionResult,
} from '@/app/actions';
import { fmtDateTime, fmtRelative, pct, toLocalInput } from '@/lib/datum';
import type { Campaign, Placeholder } from '@/lib/types';
import { useTabs } from '@/components/TabsContext';

interface Props {
  campaign: Campaign;
  placeholders: Placeholder[];
  templateName: string;
  list: {
    name: string;
    sendingDomain: string;
    configurationSet: string;
    unsubscribeAllowed: boolean;
    recipients: number;
  };
  defaultTestRecipients: string[];
  minGapMinutes: number;
  otherScheduled: { id: string; name: string; sendAt: string }[];
  claudeLive: boolean;
}

export default function CampaignWorkbench({
  campaign: c,
  placeholders,
  templateName,
  list,
  defaultTestRecipients,
  minGapMinutes,
  otherScheduled,
  claudeLive,
}: Props) {
  const router = useRouter();
  const { navigateInTab } = useTabs();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);

  const editable = c.status === 'DRAFT' || c.status === 'PENDING_APPROVAL';
  const [name, setName] = useState(c.name);
  const [subject, setSubject] = useState(c.subject);
  const [brief, setBrief] = useState(c.brief);
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of placeholders) init[p.key] = c.contentData[p.key] ?? '';
    return init;
  });
  const [dirty, setDirty] = useState(false);
  const [testTo, setTestTo] = useState((c.testRecipients.length ? c.testRecipients : defaultTestRecipients).join(', '));
  const [mode, setMode] = useState<'NOW' | 'SCHEDULE'>(c.sendAt ? 'SCHEDULE' : 'NOW');
  const [sendAt, setSendAt] = useState(toLocalInput(c.sendAt) || defaultSendAt());

  function run(label: string, fn: () => Promise<ActionResult>, after?: () => void) {
    setBusy(label);
    setMsg(null);
    startTransition(async () => {
      const r = await fn();
      setBusy(null);
      if (r.ok) {
        setMsg({ tone: 'ok', text: `${label}: uspešno.` });
        after?.();
        router.refresh();
      } else {
        setMsg({ tone: 'danger', text: r.error });
      }
    });
  }

  const missing = placeholders.filter((p) => !fields[p.key]?.trim()).map((p) => p.label);
  const chosenIso = mode === 'SCHEDULE' && sendAt ? new Date(sendAt).toISOString() : null;
  const conflicts = chosenIso
    ? otherScheduled
        .map((o) => ({ ...o, gap: Math.abs(new Date(o.sendAt).getTime() - new Date(chosenIso).getTime()) / 60000 }))
        .filter((o) => o.gap < minGapMinutes)
    : [];
  const previewSrc = `/api/campaigns/${c.id}/preview?v=${encodeURIComponent(c.updatedAt)}`;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">{c.name}</h1>
            <StatusBadge status={c.status} />
            <SegmentBadge segment={c.segment} />
          </div>
          <div className="mt-0.5 text-xs text-ink-faint">
            {list.name} · <span className="font-mono">{list.sendingDomain}</span> ·{' '}
            <span className="font-mono">{list.configurationSet}</span> · šablon: {templateName} ·{' '}
            {list.recipients} aktivnih primalaca
            {c.listmonkCampaignId ? ` · Listmonk #${c.listmonkCampaignId}` : ''}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === 'DRAFT' && (
            <Button
              size="sm"
              variant="brand"
              disabled={pending}
              onClick={() => run('Generisanje sadržaja', () => generateContentAction(c.id))}
            >
              <Icon name={busy === 'Generisanje sadržaja' ? 'loading' : 'sparkle'} className={`!text-[14px] ${busy === 'Generisanje sadržaja' ? 'animate-spin' : ''}`} />
              {c.generatedBy ? 'ponovo popuni (Claude)' : 'popuni šablon (Claude)'}
            </Button>
          )}
          {(c.status === 'DRAFT' || c.status === 'CANCELLED') && (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm('Obrisati kampanju?')) return;
                run('Brisanje', () => deleteCampaignAction(c.id), () => navigateInTab('/kampanje', 'Kampanje'));
              }}
            >
              <Icon name="trash" className="!text-[14px]" /> obriši
            </Button>
          )}
          {(c.status === 'PENDING_APPROVAL' || c.status === 'SCHEDULED' || c.status === 'APPROVED') && (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm('Otkazati kampanju? Zakazano slanje se povlači iz Listmonk-a.')) return;
                run('Otkazivanje', () => cancelAction(c.id));
              }}
            >
              <Icon name="circle-slash" className="!text-[14px]" /> otkaži
            </Button>
          )}
        </div>
      </div>

      {msg && <Notice tone={msg.tone} className="mb-3">{msg.text}</Notice>}
      {!claudeLive && c.status === 'DRAFT' && (
        <Notice tone="info" className="mb-3">
          Nema <code>ANTHROPIC_API_KEY</code> — „popuni šablon“ koristi lokalni popunjivač. Za pravi Claude API upiši
          ključ u <code>.env.local</code>.
        </Notice>
      )}

      {c.status === 'SENT' && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatTile label="Poslato" value={c.stats.sent} icon="mail" hint={fmtDateTime(c.sentAt)} />
          <StatTile label="Isporučeno" value={pct(c.stats.delivered, c.stats.sent)} icon="check" tone="ok" />
          <StatTile label="Otvoreno" value={pct(c.stats.opened, c.stats.sent)} icon="eye" tone="accent" hint={`${c.stats.opened} primalaca`} />
          <StatTile label="Klik" value={pct(c.stats.clicked, c.stats.sent)} icon="link" tone="accent" hint={`${c.stats.clicked} primalaca`} />
          <StatTile label="Bounce / prijave" value={`${c.stats.bounced} / ${c.stats.complaints}`} icon="warning" tone={c.stats.bounced + c.stats.complaints ? 'danger' : 'neutral'} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* LEVO — sadržaj */}
        <div className="flex flex-col gap-4">
          <Section
            title="Sadržaj"
            icon="edit"
            actions={
              editable ? (
                <Button
                  size="sm"
                  disabled={pending || !dirty}
                  onClick={() =>
                    run('Čuvanje', () => updateDraftAction(c.id, { name, subject, brief, contentData: fields }), () => setDirty(false))
                  }
                  className="normal-case"
                >
                  <Icon name="save" className="!text-[14px]" /> sačuvaj
                </Button>
              ) : undefined
            }
            bodyClassName="p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="label">Naziv (interni)</label>
                <input className="input" value={name} disabled={!editable} onChange={(e) => { setName(e.target.value); setDirty(true); }} />
              </div>
              <div>
                <label className="label">Subject mejla</label>
                <input className="input" value={subject} disabled={!editable} onChange={(e) => { setSubject(e.target.value); setDirty(true); }} placeholder="Popunjava Claude ili ručno" />
              </div>
            </div>
            <div className="mt-3">
              <label className="label">Brif (ulaz za Claude API)</label>
              <textarea className="input min-h-[90px] font-mono text-xs" value={brief} disabled={!editable} onChange={(e) => { setBrief(e.target.value); setDirty(true); }} />
            </div>
            <div className="mt-4 mb-2 flex items-center justify-between">
              <span className="label !mb-0">Polja šablona ({placeholders.length})</span>
              <span className="text-[11px] text-ink-faint">
                {c.generatedBy === 'CLAUDE' ? 'popunio Claude API' : c.generatedBy === 'LOKALNO' ? 'lokalni popunjivač' : c.generatedBy === 'RUCNO' ? 'ručno' : 'nepopunjeno'}
                {missing.length > 0 && editable ? ` · nedostaje ${missing.length}` : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {placeholders.map((p) => {
                const long = /opis|uvod|napomena/.test(p.key);
                const empty = !fields[p.key]?.trim();
                return (
                  <div key={p.key} className={long ? 'md:col-span-2' : ''}>
                    <label className="label flex items-center gap-1.5" htmlFor={`f-${p.key}`}>
                      {p.label}
                      {empty && editable && <span className="rounded-full bg-warn-bg px-1.5 text-[9px] text-warn">prazno</span>}
                    </label>
                    {long ? (
                      <textarea id={`f-${p.key}`} className="input min-h-[64px]" value={fields[p.key]} disabled={!editable} placeholder={p.hint} onChange={(e) => { setFields({ ...fields, [p.key]: e.target.value }); setDirty(true); }} />
                    ) : (
                      <input id={`f-${p.key}`} className="input" value={fields[p.key]} disabled={!editable} placeholder={p.hint} onChange={(e) => { setFields({ ...fields, [p.key]: e.target.value }); setDirty(true); }} />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Istorija" icon="history">
            <ul>
              {[...c.history].reverse().map((h, i) => (
                <li key={i} className="flex items-start gap-3 border-b border-border px-4 py-2 text-xs last:border-b-0">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-ink">{h.action}</span>
                    {h.note && <span className="text-ink-dim"> — {h.note}</span>}
                    <span className="block text-[11px] text-ink-faint">{h.actor} · {fmtDateTime(h.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* DESNO — tok i pregled */}
        <div className="flex flex-col gap-4">
          {(editable || c.status === 'SCHEDULED') && (
            <Section title="Test slanje (interna lista)" icon="beaker" bodyClassName="p-4">
              <label className="label">Primaoci (zarezom razdvojeni)</label>
              <div className="flex gap-2">
                <input className="input" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || dirty}
                  onClick={() => run('Test slanje', () => sendTestAction(c.id, testTo.split(',')))}
                  className="h-auto flex-shrink-0"
                >
                  <Icon name="send" className="!text-[14px]" /> pošalji test
                </Button>
              </div>
              <p className="mt-2 text-[11px] text-ink-faint">
                {c.testSentAt ? `Poslednji test: ${fmtDateTime(c.testSentAt)} → ${c.testRecipients.join(', ')}` : 'Test još nije poslat — obavezan pre odobrenja (provera u Gmail / Outlook / mobilnom).'}
                {dirty && ' · Prvo sačuvaj izmene.'}
              </p>
            </Section>
          )}

          {c.status === 'DRAFT' && (
            <Section title="Korak: slanje na odobrenje" icon="checklist" bodyClassName="p-4">
              {missing.length > 0 ? (
                <Notice tone="warn">Nepopunjena polja: {missing.join(', ')}. Popuni ih (Claude ili ručno) pa sačuvaj.</Notice>
              ) : (
                <p className="text-xs text-ink-dim">Sadržaj je kompletan. Slanjem na odobrenje sadržaj se zaključava — svaka dalja izmena vraća kampanju u nacrt.</p>
              )}
              <Button
                className="mt-3"
                disabled={pending || dirty || missing.length > 0 || !subject.trim()}
                onClick={() => run('Slanje na odobrenje', () => submitForApprovalAction(c.id))}
              >
                <Icon name="arrow-right" className="!text-[14px]" /> pošalji na odobrenje
              </Button>
            </Section>
          )}

          {c.status === 'PENDING_APPROVAL' && (
            <Section title="Odobrenje — sadržaj i termin (human-approval gate)" icon="verified" bodyClassName="p-4">
              {!c.testSentAt && <Notice tone="warn" className="mb-3">Pre odobrenja pošalji test na internu listu.</Notice>}
              <div className="mb-3 flex gap-2">
                {(['NOW', 'SCHEDULE'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 rounded-lg border p-3 text-left text-xs ${mode === m ? 'border-accent bg-accent-soft text-ink' : 'border-border bg-panel text-ink-dim hover:border-accent'}`}
                  >
                    <span className="block font-medium">{m === 'NOW' ? 'Pošalji odmah' : 'Zakaži za datum i vreme'}</span>
                    <span className="block text-[11px] text-ink-faint">
                      {m === 'NOW' ? `Listmonk kreće odmah ka ${list.recipients} primalaca` : 'Listmonk send_at, status „scheduled“, izmenljivo do slanja'}
                    </span>
                  </button>
                ))}
              </div>
              {mode === 'SCHEDULE' && (
                <div className="mb-3">
                  <label className="label">Termin (Europe/Belgrade)</label>
                  <input type="datetime-local" className="input" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
                  {conflicts.map((o) => (
                    <Notice key={o.id} tone="warn" className="mt-2">
                      „{o.name}“ je zakazana {fmtDateTime(o.sendAt)} — razmak {Math.round(o.gap)} min (preporuka ≥ {minGapMinutes}).
                    </Notice>
                  ))}
                </div>
              )}
              <Button
                disabled={pending || !c.testSentAt || (mode === 'SCHEDULE' && !sendAt)}
                onClick={() => {
                  const txt = mode === 'NOW' ? `Odobriti i POSLATI ODMAH na ${list.recipients} primalaca? Ovo je nepovratno.` : `Odobriti sadržaj i zakazati za ${fmtDateTime(chosenIso)}?`;
                  if (!confirm(txt)) return;
                  run('Odobrenje', () => approveAction(c.id, chosenIso));
                }}
              >
                <Icon name="check" className="!text-[14px]" /> {mode === 'NOW' ? 'odobri i pošalji' : 'odobri i zakaži'}
              </Button>
            </Section>
          )}

          {c.status === 'SCHEDULED' && (
            <Section title="Zakazano" icon="calendar" bodyClassName="p-4">
              <p className="mb-3 text-xs text-ink-dim">
                Slanje <strong className="text-ink">{fmtDateTime(c.sendAt)}</strong> ({fmtRelative(c.sendAt)}) ka {list.recipients} primalaca.
                Odobrio/la: {c.approvedBy} · {fmtDateTime(c.approvedAt)}. Promena termina ne traži ponovno odobrenje sadržaja.
              </p>
              <label className="label">Novi termin</label>
              <div className="flex gap-2">
                <input type="datetime-local" className="input" value={sendAt} onChange={(e) => setSendAt(e.target.value)} />
                <Button size="sm" variant="secondary" className="h-auto flex-shrink-0" disabled={pending || !sendAt} onClick={() => run('Promena termina', () => rescheduleAction(c.id, new Date(sendAt).toISOString()))}>
                  <Icon name="calendar" className="!text-[14px]" /> promeni termin
                </Button>
              </div>
              {conflicts.map((o) => (
                <Notice key={o.id} tone="warn" className="mt-2">
                  „{o.name}“ je zakazana {fmtDateTime(o.sendAt)} — razmak {Math.round(o.gap)} min (preporuka ≥ {minGapMinutes}).
                </Notice>
              ))}
            </Section>
          )}

          <Section
            title="Pregled mejla"
            icon="preview"
            actions={<a href={previewSrc} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline normal-case">otvori u novom tabu →</a>}
          >
            <iframe title="Pregled" src={previewSrc} className="h-[720px] w-full bg-white" sandbox="" />
          </Section>
        </div>
      </div>
    </div>
  );
}

function defaultSendAt(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}
