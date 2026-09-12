import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

// Svaki test proces dobija svoj direktorijum za store.json — testovi nikad ne diraju
// razvojni data/store.json. Postavlja se pre nego što src/lib/store.ts pročita promenljivu.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-newsletter-test-'));
process.env.NEWSLETTER_DATA_DIR = dir;

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});
