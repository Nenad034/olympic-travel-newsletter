import { getStore } from '@/lib/store';
import { processDueCampaigns } from '@/lib/campaigns';

// Sažetak u dnu leve trake — brojači po statusu (server komponenta, prosleđena kroz Shell).
export default function SidebarSummary() {
  processDueCampaigns();
  const store = getStore();
  const count = (s: string) => store.campaigns.filter((c) => c.status === s).length;
  const rows = [
    { l: 'Nacrti', v: count('DRAFT') },
    { l: 'Čeka odobrenje', v: count('PENDING_APPROVAL') },
    { l: 'Zakazano', v: count('SCHEDULED') },
    { l: 'Poslato', v: count('SENT') },
  ];
  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="section-head">Stanje kampanja</div>
      <ul className="p-2">
        {rows.map((r) => (
          <li key={r.l} className="flex items-center justify-between px-1 py-1 text-xs">
            <span className="text-ink-dim">{r.l}</span>
            <span className="font-mono font-semibold text-ink">{r.v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
