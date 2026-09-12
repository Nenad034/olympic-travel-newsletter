'use client';

import Link from 'next/link';
import Icon, { IconDuo } from './Icon';
import { NAV_ITEMS, type NavGroup, type NavItem } from '@/lib/nav';
import { useTabs } from './TabsContext';

// Leva vertikalna traka (VS Code Activity Bar): jedna ikonica po grupi; kad je leva traka
// skupljena, prelazak mišem otvara plutajući podmeni sa stavkama grupe.
function GroupFlyout({ group, groupItems }: { group: NavGroup; groupItems: NavItem[] }) {
  const { openTab } = useTabs();
  return (
    <div className="pointer-events-none absolute left-full top-0 z-50 hidden pl-1.5 group-hover:block group-focus-within:block">
      <div className="pointer-events-auto min-w-[190px] rounded-lg border border-border bg-panel py-1 text-xs shadow-lg">
        {groupItems.length > 1 && (
          <div className="px-3 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-ink-faint">
            {group.label}
          </div>
        )}
        {groupItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openTab(item.href, item.label)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink-dim hover:bg-panel-2 hover:text-ink"
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ActivityBar({
  groups,
  activeGroupId,
  onSelectGroup,
  collapsed,
  onToggleCollapse,
}: {
  groups: NavGroup[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { openTab } = useTabs();
  return (
    <nav className="flex w-[43px] flex-shrink-0 flex-col items-center gap-1 bg-panel-2 py-1">
      {collapsed && (
        <button
          type="button"
          title="Proširi levu traku"
          aria-label="Proširi levu traku"
          onClick={onToggleCollapse}
          className="mb-1 flex h-[29px] w-[29px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <IconDuo name="chevron-right" />
        </button>
      )}
      {groups.map((group, idx) => {
        const single =
          group.itemIds.length === 1 ? NAV_ITEMS.find((i) => i.id === group.itemIds[0]) : null;
        const active = group.id === activeGroupId;
        const isLast = idx === groups.length - 1 && groups.length > 1;
        const groupItems = group.itemIds
          .map((id) => NAV_ITEMS.find((i) => i.id === id))
          .filter((i): i is NavItem => i !== undefined);
        const flyout = collapsed && groupItems.length > 0;
        const className = `flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md ${
          active
            ? 'bg-accent-soft text-accent-strong'
            : 'bg-panel text-ink-faint hover:bg-panel2 hover:text-ink'
        }`;
        const wrapperClassName = `group relative flex-shrink-0 ${isLast ? 'mt-auto' : ''}`;
        const title = flyout ? undefined : group.label;
        if (single) {
          return (
            <div key={group.id} className={wrapperClassName}>
              <Link
                href={single.href}
                title={title}
                className={className}
                onClick={(e) => {
                  e.preventDefault();
                  openTab(single.href, single.label);
                  if (collapsed) onToggleCollapse();
                }}
              >
                <Icon name={group.icon} />
              </Link>
              {flyout && <GroupFlyout group={group} groupItems={groupItems} />}
            </div>
          );
        }
        return (
          <div key={group.id} className={wrapperClassName}>
            <button title={title} onClick={() => onSelectGroup(group.id)} className={className}>
              <Icon name={group.icon} />
            </button>
            {flyout && <GroupFlyout group={group} groupItems={groupItems} />}
          </div>
        );
      })}
    </nav>
  );
}
