import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// Paleta preuzeta iz Terminal Travel internog panela (apps/panel/tailwind.config.ts) —
// tokeni su CSS promenljive definisane u src/app/globals.css (svetli / dim / tamni mod).
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        panel: 'var(--panel)',
        panel2: 'var(--panel-2)',
        'panel-2': 'var(--panel-2)',
        bar: 'var(--bar)',
        sunken: 'var(--sunken)',
        border: 'var(--border)',
        ink: {
          DEFAULT: 'var(--text)',
          dim: 'var(--text-dim)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          strong: 'var(--accent-strong)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
        },
        accent2: {
          DEFAULT: 'var(--accent2)',
          soft: 'var(--accent2-soft)',
        },
        tabline: {
          DEFAULT: 'var(--tab-line)',
          strong: 'var(--tab-line-strong)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          ink: 'var(--brand-ink)',
        },
        ok: { DEFAULT: 'var(--ok)', bg: 'var(--ok-bg)' },
        warn: { DEFAULT: 'var(--warn)', bg: 'var(--warn-bg)' },
        danger: { DEFAULT: 'var(--danger)', bg: 'var(--danger-bg)' },

        // shadcn/ui semantički alias-i
        background: 'var(--bg)',
        foreground: 'var(--text)',
        card: { DEFAULT: 'var(--panel)', foreground: 'var(--text)' },
        popover: { DEFAULT: 'var(--panel)', foreground: 'var(--text)' },
        primary: { DEFAULT: 'var(--accent)', foreground: 'var(--accent-ink)' },
        secondary: { DEFAULT: 'var(--panel-2)', foreground: 'var(--text)' },
        muted: { DEFAULT: 'var(--panel-2)', foreground: 'var(--text-faint)' },
        destructive: 'var(--danger)',
        input: 'var(--border)',
        ring: 'var(--accent-strong)',
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'ui-monospace',
          '"Cascadia Code"',
          '"Cascadia Mono"',
          '"SFMono-Regular"',
          'Menlo',
          'Consolas',
          'monospace',
        ],
        brand: ['"Chakra Petch"', 'ui-monospace', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 120ms ease-out',
        'scale-in': 'scale-in 120ms ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
