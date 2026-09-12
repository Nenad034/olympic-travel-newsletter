'use client';

import { useTabs } from './TabsContext';

/** Drill-down u zapis (red liste → detalj) ostaje u ISTOM tabu — zamena za next/link na tim mestima. */
export default function TabLink({
  href,
  label,
  className,
  children,
  title,
}: {
  href: string;
  label: string;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const { navigateInTab } = useTabs();
  return (
    <a
      href={href}
      className={className}
      title={title}
      onClick={(e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
          return;
        e.preventDefault();
        navigateInTab(href, label);
      }}
    >
      {children}
    </a>
  );
}
