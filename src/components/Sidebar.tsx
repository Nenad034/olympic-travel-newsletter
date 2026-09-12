'use client';

import Icon, { IconDuo } from './Icon';
import { useTabs } from './TabsContext';
import { NAV_ITEMS, type NavGroup } from '@/lib/nav';

// Leva traka: spisak sekcija AKTIVNE grupe kao kartice (isti jezik kao Terminal Travel panel).
export default function Sidebar({
  activeGroup,
  onCollapse,
  collapsed,
  summary,
}: {
  activeGroup: NavGroup | null;
  onCollapse: () => void;
  collapsed?: boolean;
  /** Opcioni sažetak ispod stavki (npr. brojači kampanja) — prosleđuje Shell. */
  summary?: React.ReactNode;
}) {
  const { openTab } = useTabs();
  if (collapsed || !activeGroup) return null;

  const sectionItems = activeGroup.itemIds
    .map((id) => NAV_ITEMS.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => Boolean(i));

  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto bg-panel-2 py-3">
      <div className="mx-2 mb-1 flex h-[29px] flex-shrink-0 items-center justify-between">
        <span />
        <button
          onClick={onCollapse}
          title="Skupi levu traku"
          className="flex h-[29px] w-[29px] items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <IconDuo name="chevron-left" />
        </button>
      </div>
      <div>
        <div className="mx-2 mb-2 flex items-center gap-2 px-2 text-[14.52px] font-bold uppercase text-ink-faint">
          <span className="truncate">{activeGroup.label}</span>
        </div>
        <div className="mx-2 flex flex-col gap-1">
          {sectionItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openTab(item.href, item.label)}
              title={item.description}
              className="flex items-center gap-2 rounded-lg border border-border bg-panel p-2 text-left hover:border-accent"
            >
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-panel2 text-ink-dim">
                <Icon name={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-ink">{item.label}</span>
                <span className="block truncate text-[10px] text-ink-faint">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      {summary && <div className="mx-2 mt-4">{summary}</div>}
    </nav>
  );
}
