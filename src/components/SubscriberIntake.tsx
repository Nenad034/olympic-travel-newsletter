'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Notice from './Notice';
import Section from './Section';
import { SegmentBadge } from './Badges';
import { Button } from './ui/button';
import { createSubscriberAction, importSubscribersAction } from '@/app/actions';
import type { OptinMode, Segment } from '@/lib/types';

// Unos kontakata van automatskih tokova (portal / booking). Svaki zapis nosi osnov pristanka,
// datum i referencu na dokaz — polja su obavezna i na formi i u CSV-u, jer se bez njih zapis
// ne može odbraniti pred inspekcijom. B2C i dalje ide na double opt-in.

interface ListOpt {
  id: string;
  name: string;
  segment: Segment;
  optinMode: OptinMode;
}

interface ImportReport {
  total: number;
  created: number;
  updated: number;
  errors: { line: number; email: string; message: string }[];
}

const CSV_PRIMER = `email,ime,firma,liste,pristanak,osnov,referenca
office@putniktours.rs,Milica Jovanović,Putnik Tours,b2b-operativna;b2b-promotivna,2026-02-14,potpisan ugovor o saradnji,UG-2026-114
ana.petrovic@gmail.com,Ana Petrović,,b2c,2026-05-03,čekboks na prijavnom formularu na sajmu,SAJAM-2026-088`;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SubscriberIntake({ lists }: { lists: ListOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'RUCNO' | 'CSV'>('RUCNO');

  return (
    <Section
      title="Dodavanje kontakata"
      icon="person-add"
      className="mb-4"
      actions={
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint hover:bg-panel hover:text-ink"
        >
          <Icon name={open ? 'chevron-up' : 'chevron-down'} className="!text-[14px]" />
          {open ? 'sakrij' : 'otvori'}
        </button>
      }
      bodyClassName={open ? 'p-4' : 'hidden'}
    >
      <div className="mb-4 flex gap-1">
        <Button size="sm" variant={mode === 'RUCNO' ? 'default' : 'outline'} onClick={() => setMode('RUCNO')}>
          <Icon name="edit" className="!text-[12px]" /> Ručni unos
        </Button>
        <Button size="sm" variant={mode === 'CSV' ? 'default' : 'outline'} onClick={() => setMode('CSV')}>
          <Icon name="cloud-upload" className="!text-[12px]" /> CSV uvoz
        </Button>
      </div>
      {mode === 'RUCNO' ? (
        <ManualForm lists={lists} onDone={() => router.refresh()} />
      ) : (
        <CsvForm lists={lists} onDone={() => router.refresh()} />
      )}
    </Section>
  );
}

function ListChecklist({
  lists,
  selected,
  onToggle,
}: {
  lists: ListOpt[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {lists.map((l) => (
        <label key={l.id} className="flex cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={selected.includes(l.id)} onChange={() => onToggle(l.id)} />
          <SegmentBadge segment={l.segment} />
          <span className="text-ink-dim">{l.name}</span>
          {l.optinMode === 'DOUBLE_OPT_IN' && (
            <span className="text-[11px] text-ink-faint">· ide na double opt-in</span>
          )}
        </label>
      ))}
    </div>
  );
}

function ManualForm({ lists, onDone }: { lists: ListOpt[]; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [listIds, setListIds] = useState<string[]>([]);
  const [consentAt, setConsentAt] = useState(today());
  const [consentNote, setConsentNote] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setListIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const r = await createSubscriberAction({
        email,
        name,
        company,
        listIds,
        consentAt,
        consentNote,
        sourceRef,
      });
      if (!r.ok) {
        setMsg({ tone: 'danger', text: r.error });
        return;
      }
      setMsg({ tone: 'ok', text: `${email} je dodat.` });
      setEmail('');
      setName('');
      setCompany('');
      setSourceRef('');
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="office@agencija.rs" />
        </div>
        <div>
          <label className="label">Ime i prezime</label>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Milica Jovanović" />
        </div>
        <div>
          <label className="label">Firma (opciono)</label>
          <input className="input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Putnik Tours" />
        </div>
        <div>
          <label className="label">Liste</label>
          <ListChecklist lists={lists} selected={listIds} onToggle={toggle} />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="label">Datum pristanka</label>
          <input className="input" type="date" required max={today()} value={consentAt} onChange={(e) => setConsentAt(e.target.value)} />
        </div>
        <div>
          <label className="label">Osnov pristanka</label>
          <input className="input" required value={consentNote} onChange={(e) => setConsentNote(e.target.value)} placeholder="potpisan ugovor o saradnji" />
        </div>
        <div>
          <label className="label">Referenca na dokaz</label>
          <input className="input" required value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="UG-2026-114" />
        </div>
        <Notice tone="warn">
          Unos van portala i bookinga znači da dokaz pristanka postoji negde drugde. Referenca mora da
          vodi do tog dokumenta — to je jedino što stoji iza zapisa ako kontakt uloži prigovor.
        </Notice>
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <div>
          <Button type="submit" disabled={pending}>
            <Icon name="check" className="!text-[12px]" /> {pending ? 'Dodajem…' : 'Dodaj kontakt'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function CsvForm({ lists, onDone }: { lists: ListOpt[]; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [listIds, setListIds] = useState<string[]>([]);
  const [consentNote, setConsentNote] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setListIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    startTransition(async () => {
      const r = await importSubscribersAction(csv, {
        defaultListIds: listIds,
        defaultConsentNote: consentNote,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setReport(r.report);
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-3">
        <div>
          <label className="label">CSV sadržaj</label>
          <textarea
            className="input font-mono !text-[11px]"
            rows={10}
            required
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={CSV_PRIMER}
          />
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={pickFile} />
          <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Icon name="folder-opened" className="!text-[12px]" /> Učitaj .csv fajl
          </Button>
          {fileName && <span className="text-[11px] text-ink-faint">{fileName}</span>}
          <Button type="button" size="sm" variant="ghost" onClick={() => setCsv(CSV_PRIMER)}>
            popuni primerom
          </Button>
        </div>
        {error && <Notice tone="danger">{error}</Notice>}
        {report && (
          <Notice tone={report.errors.length ? 'warn' : 'ok'}>
            <div>
              Obrađeno {report.total} redova: {report.created} novih, {report.updated} postojećih
              dopunjeno, {report.errors.length} odbijeno.
            </div>
            {report.errors.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
                {report.errors.slice(0, 12).map((x) => (
                  <li key={`${x.line}-${x.email}`}>
                    red {x.line} · {x.email || '(bez adrese)'} — {x.message}
                  </li>
                ))}
                {report.errors.length > 12 && <li>…i još {report.errors.length - 12}</li>}
              </ul>
            )}
          </Notice>
        )}
        <div>
          <Button type="submit" disabled={pending || !csv.trim()}>
            <Icon name="cloud-upload" className="!text-[12px]" /> {pending ? 'Uvozim…' : 'Uvezi'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-border bg-sunken p-3 text-xs text-ink-dim">
          <div className="mb-1 font-semibold text-ink">Kolone</div>
          <code className="break-all font-mono text-[11px]">
            email,ime,firma,liste,pristanak,osnov,referenca
          </code>
          <p className="mt-2 text-ink-faint">
            Obavezan je samo <code className="font-mono">email</code>; ostalo se dopunjava vrednostima
            ispod. Više lista u istom polju razdvaja se sa <code className="font-mono">;</code> —
            oznake: <code className="font-mono">b2b-operativna</code>,{' '}
            <code className="font-mono">b2b-promotivna</code>, <code className="font-mono">b2c</code>.
            Separator kolona može biti zarez ili tačka-zarez.
          </p>
        </div>
        <div>
          <label className="label">Liste za redove bez kolone „liste“</label>
          <ListChecklist lists={lists} selected={listIds} onToggle={toggle} />
        </div>
        <div>
          <label className="label">Osnov pristanka za redove bez kolone „osnov“</label>
          <input className="input" value={consentNote} onChange={(e) => setConsentNote(e.target.value)} placeholder="migracija baze subagenata iz starog sistema" />
        </div>
        <Notice tone="info">
          Redovi bez osnova pristanka i bez datuma se odbijaju, ostatak fajla prolazi. Već odjavljeni
          kontakti se ne vraćaju na listu.
        </Notice>
      </div>
    </form>
  );
}
