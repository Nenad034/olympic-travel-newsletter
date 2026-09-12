import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Olympic Travel — Newsletter',
  description: 'M-27 Newsletter / Mailing modul — interni panel marketing tima.',
};

const THEME_COOKIE = 'ot-newsletter-theme';
const THEMES = ['light', 'dim', 'dark'] as const;

// Tema se čuva u kolačiću da server već u prvom HTML-u postavi data-theme (bez treptaja).
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stored = (await cookies()).get(THEME_COOKIE)?.value;
  const theme = THEMES.find((t) => t === stored);
  return (
    <html lang="sr" data-theme={theme}>
      <body className="font-sans text-sm antialiased">{children}</body>
    </html>
  );
}
