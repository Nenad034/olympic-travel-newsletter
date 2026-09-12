'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import Notice from './Notice';
import { Button } from './ui/button';
import { useAiContext } from './AiContextContext';

// Prozor razgovora sa NewsletterAgentom — obrazac preuzet iz AiChatBox-a u Terminal Travel
// panelu: jedan poziv po pitanju, istorija se šalje sa klijenta (server je bez memorije),
// odgovor se otkriva reč-po-reč, a ispod odgovora stoje linkovi ka ekranima gde se radnja
// potvrđuje. Agent ne izvršava radnje — to piše i u samom prozoru, ne samo u promptu.

interface Suggestion {
  label: string;
  href: string;
}

interface Turn {
  question: string;
  answer: string;
  suggestions: Suggestion[];
  generatedBy: 'CLAUDE' | 'LOKALNO';
}

const PAGE_CONTENT_MAX_CHARS = 8000;

const PRIMERI = [
  'Koliko nas ima na B2C listi i koliko čeka potvrdu?',
  'Ima li zakazanih kampanja preblizu jedna drugoj?',
  'Šta znaš o adresi rezervacije@siriustours.rs?',
];

/** Otkrivanje već primljenog teksta reč po reč — vizuelna animacija, ne stvarni streaming. */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function TypewriterText({ text }: { text: string }) {
  // Tekst tura se ne menja posle prvog prikaza (svaka tura je svoj element), pa početno
  // stanje nosi ceo odgovor kad je animacija isključena i prazno kad nije — bez setState
  // u telu efekta i bez trenutka u kom odgovor nije nigde.
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? text : ''));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const words = text.split(' ');
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setShown(words.slice(0, i).join(' '));
      if (i >= words.length) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [text]);
  return <p className="whitespace-pre-wrap">{shown}</p>;
}

export default function AiAgentBox({ onClose }: { onClose: () => void }) {
  const { items, removeItem, clear } = useAiContext();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, pending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setError(null);
    setPending(true);
    setQ('');
    try {
      // Vidljiv tekst otvorene stranice ide uz pitanje — isto što korisnik gleda, ništa više.
      const pageContent = document.querySelector('main')?.innerText?.slice(0, PAGE_CONTENT_MAX_CHARS);
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          pageContent,
          contextItems: items.map(({ type, refLabel }) => ({ type, refLabel })),
          history: turns.slice(-6).map((t) => ({ question: t.question, answer: t.answer })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? 'Agent ne odgovara.');
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          question: text,
          answer: body.answer as string,
          suggestions: (body.suggestions ?? []) as Suggestion[],
          generatedBy: body.generatedBy as Turn['generatedBy'],
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Greška u komunikaciji sa agentom.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-panel-2">
      <div className="flex h-[29px] flex-shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
          Agent
        </span>
        <div className="flex items-center">
          {turns.length > 0 && (
            <button
              onClick={() => setTurns([])}
              title="Obriši razgovor"
              className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
            >
              <Icon name="clear-all" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Zatvori agenta"
            className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
          >
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 text-xs">
        {turns.length === 0 && (
          <div className="rounded-lg border border-border bg-panel p-3">
            <p className="text-ink-dim">
              Pitaj o stanju baze, kampanjama i isporuci. Agent <strong className="text-ink">čita</strong>{' '}
              podatke i predlaže — nijednu radnju ne izvršava sam.
            </p>
            <div className="mt-2 flex flex-col gap-1">
              {PRIMERI.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded border border-border px-2 py-1 text-left text-ink-dim hover:bg-sunken hover:text-ink"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className="mb-2 flex flex-col gap-1.5">
            <div className="self-end rounded-lg bg-accent-soft px-2.5 py-1.5 text-ink">{t.question}</div>
            <div className="rounded-lg border border-border bg-panel px-2.5 py-2 text-ink-dim">
              <TypewriterText text={t.answer} />
              {t.suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.suggestions.map((s) => (
                    <Link
                      key={s.href}
                      href={s.href}
                      className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-ink-dim hover:bg-sunken hover:text-ink"
                    >
                      <Icon name="link" className="!text-[12px]" /> {s.label}
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-1.5 text-[11px] text-ink-faint">
                {t.generatedBy === 'CLAUDE' ? 'Claude API' : 'lokalni odgovor (bez API ključa)'}
              </div>
            </div>
          </div>
        ))}

        {pending && (
          <div className="rounded-lg border border-border bg-panel px-2.5 py-2 text-ink-faint">
            Proveravam podatke…
          </div>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>

      {items.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1 border-t border-border px-2 py-1.5">
          {items.map((i) => (
            <span
              key={i.id}
              className="flex items-center gap-1 rounded border border-border bg-panel px-1.5 py-0.5 text-[11px] text-ink-dim"
            >
              {i.refLabel}
              <button onClick={() => removeItem(i.id)} title="Ukloni iz konteksta">
                <Icon name="close" className="!text-[11px] hover:text-danger" />
              </button>
            </span>
          ))}
          <button
            onClick={clear}
            className="text-[11px] text-ink-faint underline-offset-2 hover:text-ink hover:underline"
          >
            ukloni sve
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(q);
        }}
        className="flex flex-shrink-0 items-center gap-1 border-t border-border p-2"
      >
        <input
          ref={inputRef}
          className="input !py-1.5"
          placeholder="Pitaj agenta…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !q.trim()} title="Pošalji">
          <Icon name="send" className="!text-[14px]" />
        </Button>
      </form>
    </div>
  );
}
