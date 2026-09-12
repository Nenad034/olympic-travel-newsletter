'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTabs } from './TabsContext';
import Icon from './Icon';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, openTab, closeTab, closeAllTabs, togglePin, reorderTabs } =
    useTabs();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-1.5">
      <div className="flex h-full min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <Link
              key={tab.id}
              href={tab.path}
              onClick={(e) => {
                if (draggedId) {
                  e.preventDefault();
                  return;
                }
                setActiveTab(tab.id);
              }}
              title={tab.label}
              draggable
              onDragStart={(e) => {
                setDraggedId(tab.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDragOverId(null);
              }}
              onDragOver={(e) => {
                if (!draggedId || draggedId === tab.id) return;
                e.preventDefault();
                setDragOverId(tab.id);
              }}
              onDragLeave={() => setDragOverId((cur) => (cur === tab.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && draggedId !== tab.id) reorderTabs(draggedId, tab.id);
                setDraggedId(null);
                setDragOverId(null);
              }}
              className={`group flex h-[29px] w-[20ch] flex-shrink-0 cursor-grab items-center gap-1.5 rounded border px-2 text-[11px] transition-colors active:cursor-grabbing ${
                active
                  ? 'border-tabline-strong bg-accent-soft text-ink'
                  : 'border-tabline text-ink-faint hover:border-tabline-strong hover:text-ink'
              } ${draggedId === tab.id ? 'opacity-40' : ''} ${dragOverId === tab.id ? 'border-2 border-tabline-strong' : ''}`}
            >
              <span className="min-w-0 flex-1 truncate font-semibold">{tab.label}</span>
              {tab.pinned ? (
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePin(tab.id);
                  }}
                  title="Otkači tab"
                  className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded text-accent hover:bg-panel2"
                >
                  <Icon name="pinned" className="!text-[12px]" />
                </span>
              ) : (
                <>
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      togglePin(tab.id);
                    }}
                    title="Zakači tab"
                    className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 hover:!opacity-100 hover:bg-panel2 group-hover:opacity-70"
                  >
                    <Icon name="pin" className="!text-[12px]" />
                  </span>
                  {tabs.length > 1 && (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      className="flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded opacity-0 hover:!opacity-100 hover:bg-danger-bg hover:text-danger group-hover:opacity-70"
                    >
                      <Icon name="close" className="!text-[12px]" />
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => openTab('/blank', 'Novi tab', { forceNew: true })}
          title="Nov, prazan tab"
          className="flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel hover:text-ink"
        >
          <Icon name="add" className="!text-[14px]" />
        </button>
      </div>
      {tabs.length > 3 && (
        <button
          onClick={closeAllTabs}
          title="Zatvori sve tabove"
          className="flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center rounded text-ink-faint hover:bg-danger-bg hover:text-danger"
        >
          <Icon name="close-all" className="!text-[14px]" />
        </button>
      )}
    </div>
  );
}
