'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

type Theme = 'light' | 'dim' | 'dark';

const CYCLE: Theme[] = ['light', 'dim', 'dark'];
const LABELS: Record<Theme, string> = {
  light: 'Prebaci na dim mod',
  dim: 'Prebaci na tamni mod',
  dark: 'Prebaci na svetli mod',
};
const ICONS: Record<Theme, string> = {
  light: 'circle-filled',
  dim: 'circle-large-outline',
  dark: 'color-mode',
};

export const THEME_COOKIE = 'ot-newsletter-theme';
const ONE_YEAR = 60 * 60 * 24 * 365;

function writeThemeCookie(theme: Theme) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; SameSite=Lax${secure}`;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme') as Theme | null;
    setTheme(
      current ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    );
  }, []);

  function toggle() {
    const next = CYCLE[(CYCLE.indexOf(theme ?? 'light') + 1) % CYCLE.length];
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    writeThemeCookie(next);
  }

  return (
    <button
      onClick={toggle}
      title={LABELS[theme ?? 'light']}
      className="flex h-[36px] w-[36px] flex-shrink-0 items-center justify-center rounded-md bg-panel text-ink-faint hover:bg-panel2 hover:text-ink"
    >
      <Icon name={ICONS[theme ?? 'light']} />
    </button>
  );
}
