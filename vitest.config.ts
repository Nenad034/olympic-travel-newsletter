import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Domenski sloj (src/lib) je čist TypeScript nad file-backed store-om, pa se testira u Node
// okruženju bez Next runtime-a. Dve stvari to traže:
//  - `server-only` baca izuzetak van React server konteksta → zamenjuje se praznim modulom;
//  - store piše na disk → svaki test proces dobija svoj NEWSLETTER_DATA_DIR (tests/setup.ts).
export default defineConfig({
  resolve: {
    alias: {
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
  },
});
