'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Icon from './Icon';
import { useTabs } from './TabsContext';
import { itemIcon, itemLabel, useAiContext } from './AiContextContext';
import { NAV_GROUPS, type NavGroup, type NavItem } from '@/lib/nav';
import type { AgentContextItem, ImageMediaType } from '@/lib/agent';

// Polje za razgovor sa NewsletterAgentom. Postoji TAČNO JEDNO u aplikaciji — `Shell.tsx` ga
// montira jednom i fizički premešta između desnog panela i donjeg doka (§ vidi komentar tamo),
// pa se istorija razgovora i nedovršen tekst ne gube pri premeštanju. Ova komponenta ne zna
// gde stoji; popunjava visinu koju joj roditelj da.
//
// Obrazac preuzet iz AiChatBox-a u Terminal Travel panelu: poruke rastu nagore, red za unos je
// na dnu, kontekst se prilaže čipovima, a odgovor nosi linkove ka ekranima gde čovek potvrđuje
// radnju. Agent ne izvršava radnje — to piše i u prozoru, ne samo u sistemskom promptu.

// Strelica „Pošalji" u boji loga — inline SVG sa gradijentom, NIJE codicon: codicon glifovi ne
// podržavaju pouzdano `background-clip: text` preko ::before pseudo-elementa. Logo ovog modula
// je jednotonski (dva prstena u `--brand`), pa gradijent ostaje unutar te narandžaste umesto da
// izmišlja drugu brend boju; fiksan je, ne prati temu — brend je isti u svetlom i tamnom.
function SendArrowIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ot-send-gradient" x1="0" y1="16" x2="16" y2="0">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="55%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fdba74" />
        </linearGradient>
      </defs>
      <path
        d="M14.5 1.5 1.5 7.1c-.6.26-.55 1.13.07 1.32l4.8 1.48 1.48 4.8c.19.62 1.06.67 1.32.07L14.5 1.5Z"
        fill="none"
        stroke="url(#ot-send-gradient)"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M6.5 9.5 14.5 1.5"
        stroke="url(#ot-send-gradient)"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Web Speech API nije deo standardnih DOM tipova (`webkitSpeechRecognition` je Chromium-ovo
// proširenje), pa se opisuje ovde — i to samo ono što se stvarno koristi, da `any` ne ugasi
// proveru imena svojstava.
interface PrepoznavanjeGovoraDogadjaj {
  results: { [index: number]: { [index: number]: { transcript?: string } } };
}
interface PrepoznavanjeGovora {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: PrepoznavanjeGovoraDogadjaj) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
declare global {
  interface Window {
    SpeechRecognition?: new () => PrepoznavanjeGovora;
    webkitSpeechRecognition?: new () => PrepoznavanjeGovora;
  }
}

interface Turn {
  question: string;
  contextLabels: string[];
  answer?: string;
  links: { label: string; href: string }[];
  loading: boolean;
  generatedBy?: 'CLAUDE' | 'LOKALNO';
}

const IMAGE_MEDIA_TYPES = new Set<string>(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DOCUMENT_FILE_ACCEPT = '.txt,.md,.csv,.json,.html,.htm,.pdf,.docx,.xlsx,.doc,.xls';
const PAGE_CONTENT_MAX_CHARS = 8000;
/** Id centralnog sadržaja (Shell.tsx) — odatle se čita vidljiv tekst otvorenog taba. */
const MAIN_CONTENT_ID = 'ot-main-content';

const PRIMERI = [
  'Koliko ih je na B2C listi i koliko čeka potvrdu?',
  'Ima li zakazanih kampanja preblizu jedna drugoj?',
  'Kakvo je stanje isporuke po domenima?',
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Otkrivanje već primljenog teksta reč po reč — vizuelna animacija, ne stvarni streaming. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function TypewriterText({ text }: { text: string }) {
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

export default function AiChatBox({
  fokus = false,
}: {
  /** Polje je SÂM sadržaj taba `/ai-agent`, ne dokovan deo panela. Tada nema šta da se
   * „priloži sa ekrana" — ekran je ovaj razgovor, pa bi automatsko čitanje `#ot-main-content`
   * značilo da agent uz svako pitanje dobija sopstvenu istoriju. */
  fokus?: boolean;
} = {}) {
  const { tabs, activeTabId, openTab } = useTabs();
  const {
    items: contextItems,
    addRecord,
    addFile,
    addImage,
    removeItem: removeContextItem,
    clear: clearContextItems,
    atCapacity,
  } = useAiContext();

  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [dismissedForPath, setDismissedForPath] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusPos, setPlusPos] = useState<{ bottom: number; left: number } | null>(null);
  const [screenPickerOpen, setScreenPickerOpen] = useState(false);
  const [screenPickerPos, setScreenPickerPos] = useState<{ bottom: number; left: number } | null>(
    null,
  );

  const plusRef = useRef<HTMLDivElement>(null);
  const screenBtnRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<PrepoznavanjeGovora | null>(null);

  // Provera podrške tek posle hidratacije: `typeof window` u telu komponente je na serveru uvek
  // `false`, a na klijentu odmah `true` — dugme bi se pojavilo pre nego što React uskladi stabla.
  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
  }, []);

  // Ista lista ekrana koju koriste levi meni i paleta komandi — učitana jednom, ne po otvaranju.
  useEffect(() => {
    fetch('/api/nav-items', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setNavItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setNavItems([]));
  }, []);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activePath = activeTab?.path ?? '/';
  // Prazna Početna nema šta da priloži — isto pravilo kao u Terminal Travel panelu.
  const isEmptyHome = !activeTab || activePath === '/';

  // Uklonjen čip konteksta važi za JEDAN tab; prelazak na drugi ga vraća. Podešavanje u renderu,
  // ne u efektu — inače se novi tab na trenutak iscrta sa nasleđenim „uklonjeno" stanjem.
  const [lastPath, setLastPath] = useState(activePath);
  if (lastPath !== activePath) {
    setLastPath(activePath);
    setDismissedForPath(null);
  }

  const autoContext =
    !fokus && !isEmptyHome && dismissedForPath !== activePath ? activeTab!.label : null;
  const manualRecordLabels = new Set(
    contextItems.filter((i) => i.type === 'RECORD').map((i) => (i as { refLabel: string }).refLabel),
  );
  const effectiveContextLabels = [
    ...(autoContext && !manualRecordLabels.has(autoContext) ? [autoContext] : []),
    ...contextItems.map(itemLabel),
  ];

  /** Vidljiv tekst centralnog taba. Isto pravilo uklanjanja kao naziv taba: X na čipu prekida i ovo. */
  function readPageContent(): string | undefined {
    if (fokus || dismissedForPath === activePath) return undefined;
    const text = document.getElementById(MAIN_CONTENT_ID)?.innerText?.trim();
    return text ? text.slice(0, PAGE_CONTENT_MAX_CHARS) : undefined;
  }

  async function addImageFile(file: File) {
    if (!IMAGE_MEDIA_TYPES.has(file.type)) {
      setFileError(`Tip slike „${file.type || 'nepoznat'}" nije podržan (jpg/png/gif/webp).`);
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFileError(`Slika je prevelika (najviše 5 MB): ${file.name}`);
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    addImage({
      label: file.name || 'slika',
      imageData: dataUrl.slice(dataUrl.indexOf(',') + 1),
      imageMediaType: file.type as ImageMediaType,
    });
  }

  async function addDocumentFile(file: File) {
    const formData = new FormData();
    formData.set('file', file);
    try {
      const res = await fetch('/api/ai-context/extract-file', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setFileError(data?.message ?? `Fajl „${file.name}" nije mogao da se pročita.`);
        return;
      }
      addFile({ label: data.label ?? file.name, content: data.content ?? '' });
    } catch {
      setFileError(`Fajl „${file.name}" nije mogao da se pošalje.`);
    }
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setFileError(null);
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) await addImageFile(file);
      else await addDocumentFile(file);
    }
  }

  /** Lepljenje slike (Ctrl+V) — isti mehanizam kao prilog preko „+", samo drugi okidač. */
  function handlePasteImage(e: React.ClipboardEvent<HTMLInputElement>) {
    const imageItem = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'));
    const file = imageItem?.getAsFile();
    if (!file) return;
    e.preventDefault();
    setFileError(null);
    void addImageFile(file);
  }

  async function send(overrideText?: string) {
    const question = (overrideText ?? input).trim();
    if (!question) return;
    const pageContent = readPageContent();
    const sentContextItems: AgentContextItem[] = [
      ...(autoContext && !manualRecordLabels.has(autoContext)
        ? [{ type: 'RECORD' as const, refLabel: autoContext }]
        : []),
      ...contextItems.map(({ id: _id, ...rest }) => rest as AgentContextItem),
    ];
    const history = turns
      .filter((t) => t.answer && !t.loading)
      .map((t) => ({ question: t.question, answer: t.answer! }));

    setInput('');
    clearContextItems();
    setTurns((t) => [
      ...t,
      { question, contextLabels: effectiveContextLabels, links: [], loading: true },
    ]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: question, pageContent, contextItems: sentContextItems, history }),
      });
      const data = await res.json();
      setTurns((t) => {
        const next = [...t];
        const last = next[next.length - 1];
        next[next.length - 1] = res.ok
          ? {
              ...last,
              loading: false,
              answer: data.answer,
              links: data.suggestions ?? [],
              generatedBy: data.generatedBy,
            }
          : { ...last, loading: false, answer: data?.error ?? 'Agent ne odgovara.' };
        return next;
      });
    } catch {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = {
          ...next[next.length - 1],
          loading: false,
          answer: 'Zahtev nije uspeo — pokušaj ponovo.',
        };
        return next;
      });
    }
  }

  /** Transkript ide kroz ISTI `send()` kao kucanje; zvuk se ne čuva niti napušta pregledač. */
  function toggleListening() {
    if (!speechSupported) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recognition = new Ctor();
    recognition.lang = 'sr-RS';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) void send(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function openMenuAbove(
    ref: React.RefObject<HTMLDivElement | null>,
    setPos: (p: { bottom: number; left: number }) => void,
  ) {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ bottom: window.innerHeight - rect.top + 4, left: rect.left });
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-xs">
      {/* Poruke idu odozdo nagore: najnovija tura je prvo dete, `flex-col-reverse` je crta na
          dnu (uz polje za unos), stariji razgovor raste nagore — skrol tako sam ostaje
          „prilepljen" za najnoviju poruku, bez ručnog scrollIntoView-a. Uvek montirano: ako se
          prazan uslov ukloni iz DOM-a, nema `flex-1` elementa i red za unos isplivava na vrh. */}
      <div className="flex min-h-0 flex-1 flex-col-reverse gap-3 overflow-y-auto px-2 py-2">
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
                  onClick={() => void send(p)}
                  className="rounded border border-border px-2 py-1 text-left text-ink-dim hover:bg-sunken hover:text-ink"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {[...turns].reverse().map((t, i) => (
          <div key={turns.length - 1 - i} className="flex flex-col gap-1.5">
            {t.contextLabels.length > 0 && (
              <div className="self-end text-[11px] italic text-ink-faint">
                kontekst: {t.contextLabels.join(' · ')}
              </div>
            )}
            <div className="self-end rounded-lg bg-accent-soft px-3 py-1.5 text-ink">{t.question}</div>
            {t.loading ? (
              <div className="flex items-center gap-2 text-ink-faint">
                <Icon name="loading" className="animate-spin" /> proveravam podatke…
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-panel px-3 py-2 text-ink-dim">
                {t.answer && <TypewriterText text={t.answer} />}
                {t.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="rounded-full border border-border bg-panel-2 px-2 py-0.5 text-[11px] text-accent-strong hover:border-accent"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                )}
                {t.generatedBy && (
                  <div className="mt-1.5 text-[11px] text-ink-faint">
                    {t.generatedBy === 'CLAUDE' ? 'Claude API' : 'lokalni odgovor (bez API ključa)'}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {effectiveContextLabels.length > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 px-2 pb-1">
          {autoContext && !manualRecordLabels.has(autoContext) && (
            <div className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink">
              <Icon name="link" />
              {autoContext}
              <button
                onClick={() => setDismissedForPath(activePath)}
                title="Ukloni kontekst ovog taba (i sadržaj ekrana)"
                className="ml-0.5 hover:text-danger"
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {contextItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1.5 rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] text-ink"
            >
              <Icon name={itemIcon(item)} />
              {itemLabel(item)}
              <button
                onClick={() => removeContextItem(item.id)}
                title="Ukloni iz konteksta"
                className="ml-0.5 hover:text-danger"
              >
                <Icon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}

      {fileError && (
        <div className="mx-2 mb-1 flex flex-shrink-0 items-center justify-between gap-2 rounded border border-danger bg-danger-bg px-2 py-1 text-[11px] text-danger">
          <span>{fileError}</span>
          <button onClick={() => setFileError(null)} title="Zatvori">
            <Icon name="close" />
          </button>
        </div>
      )}

      <div className="flex flex-shrink-0 items-center gap-2 px-2 py-2">
        <div ref={plusRef} className="relative">
          <button
            onClick={() => {
              if (!plusOpen) openMenuAbove(plusRef, setPlusPos);
              setPlusOpen((v) => !v);
            }}
            title="Priloži kontekst"
            className={`flex h-[31px] w-[31px] items-center justify-center rounded ${plusOpen ? 'bg-panel-2 text-accent-strong' : 'text-ink-faint hover:bg-panel-2 hover:text-ink'}`}
          >
            <Icon name="add" />
          </button>
          {/* Meni izlazi iz roditelja portalom: `overflow-hidden` na doku/panelu bi svaki
              apsolutno pozicioniran element isekao na ivici. Raste NAGORE, jer je red za unos
              na dnu. */}
          {plusOpen &&
            plusPos &&
            createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setPlusOpen(false)} />
                <div
                  style={{ bottom: plusPos.bottom, left: plusPos.left }}
                  className="fixed z-50 w-60 rounded-lg border border-border bg-panel py-1 text-xs shadow-lg"
                >
                  <button
                    disabled={isEmptyHome || atCapacity}
                    onClick={() => {
                      if (activeTab) addRecord(activeTab.label);
                      setPlusOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Icon name="file" /> Trenutno otvoren ekran
                    {!isEmptyHome ? ` — ${activeTab!.label}` : ''}
                  </button>
                  <button
                    disabled={atCapacity}
                    onClick={() => {
                      fileInputRef.current?.click();
                      setPlusOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    <Icon name="cloud-upload" /> Priloži fajl ili sliku
                  </button>
                </div>
              </>,
              document.body,
            )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={`${DOCUMENT_FILE_ACCEPT},image/*`}
            className="hidden"
            onChange={(e) => {
              void handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        <div ref={screenBtnRef} className="relative">
          <button
            onClick={() => {
              if (!screenPickerOpen) openMenuAbove(screenBtnRef, setScreenPickerPos);
              setScreenPickerOpen((v) => !v);
            }}
            title="Otvori ekran"
            className={`flex h-[31px] w-[31px] items-center justify-center rounded ${screenPickerOpen ? 'bg-panel-2 text-accent-strong' : 'text-ink-faint hover:bg-panel-2 hover:text-ink'}`}
          >
            <Icon name="list-tree" />
          </button>
          {screenPickerOpen &&
            screenPickerPos &&
            createPortal(
              <>
                <div className="fixed inset-0 z-40" onClick={() => setScreenPickerOpen(false)} />
                <div
                  style={{ bottom: screenPickerPos.bottom, left: screenPickerPos.left }}
                  className="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-panel py-1 text-xs shadow-lg"
                >
                  {navItems.length === 0 && <p className="px-3 py-2 text-ink-faint">Učitavanje…</p>}
                  {NAV_GROUPS.map((group: NavGroup) => {
                    const groupItems = navItems.filter((i) => group.itemIds.includes(i.id));
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group.id}>
                        {/* Naziv grupe je podebljan i bez linka — otvaraju se samo stavke. „#"
                            dodaje celu grupu u kontekst i ne zatvara meni. */}
                        <div className="flex items-center justify-between gap-2 py-1.5 pl-3 pr-1.5 font-semibold text-ink">
                          <span className="flex items-center gap-2">
                            <Icon name={group.icon} /> {group.label}
                          </span>
                          <button
                            onClick={() => addRecord(`Ekran: ${group.label}`)}
                            disabled={atCapacity}
                            title={
                              atCapacity
                                ? 'Najviše 8 stavki u kontekstu odjednom'
                                : `Dodaj „${group.label}" u kontekst`
                            }
                            className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded font-normal text-ink-faint hover:bg-panel-2 hover:text-accent-strong disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Icon name="symbol-number" />
                          </button>
                        </div>
                        {groupItems.map((item) => (
                          <div
                            key={item.id}
                            className="group flex w-full items-center justify-between gap-1 pl-7 pr-1.5 text-ink-dim hover:bg-panel-2 hover:text-ink"
                          >
                            <button
                              onClick={() => {
                                openTab(item.href, item.label);
                                setScreenPickerOpen(false);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
                            >
                              <Icon name={item.icon} />{' '}
                              <span className="truncate">{item.label}</span>
                            </button>
                            <button
                              onClick={() => addRecord(item.label)}
                              disabled={atCapacity}
                              title={
                                atCapacity
                                  ? 'Najviše 8 stavki u kontekstu odjednom'
                                  : `Dodaj „${item.label}" u kontekst`
                              }
                              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded text-ink-faint opacity-0 hover:bg-panel hover:text-accent-strong focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Icon name="symbol-number" />
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </>,
              document.body,
            )}
        </div>

        <Icon name="sparkle" className="text-accent-strong" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
          onPaste={handlePasteImage}
          placeholder={listening ? 'Slušam…' : 'Pitaj agenta…'}
          className="min-w-0 flex-1 border-b border-ink-faint bg-transparent px-1 pb-1 text-ink outline-none placeholder:text-ink-faint"
        />
        {speechSupported && (
          <button
            onClick={toggleListening}
            title={listening ? 'Zaustavi snimanje' : 'Pitaj glasom'}
            className={`flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded ${
              listening ? 'animate-pulse bg-danger-bg text-danger' : 'text-ink-faint hover:bg-panel-2 hover:text-ink'
            }`}
          >
            <Icon name="mic" />
          </button>
        )}
        <button
          onClick={() => void send()}
          title="Pošalji"
          className="flex h-[31px] w-[31px] flex-shrink-0 items-center justify-center rounded hover:bg-panel-2"
        >
          <SendArrowIcon />
        </button>
      </div>
    </div>
  );
}
