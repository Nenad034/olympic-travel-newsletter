import 'server-only';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dataDir } from './store';

// Brava za obradu dospelih kampanja kad aplikacija radi u VIŠE instanci (spec §10.2, odluka
// 13.9.2026). Tajmer iz `scheduler.ts` je po instanci: dve instance iza istog balansera bi u
// istoj sekundi našle istu dospelu kampanju i obe je poslale. Zaštita od preklapanja koja je
// do sada postojala je bila u memoriji jednog procesa i drugom procesu ne znači ništa.
//
// Brava je FAJL pored store-a, ne zapis u samom store-u: store se čita i piše kao celina, pa bi
// dve instance koje uzimaju bravu upisom u njega prepisale jedna drugu (isto stanje trke koje
// brava treba da spreči). Fajl se pravi sa `wx` zastavicom — na svim podržanim sistemima to je
// atomično „napravi ako ne postoji", pa tačno jedan pisac uspeva.
//
// Zakup (lease), ne trajna brava: instanca koja padne usred obrade ne sme da zauvek zaključa
// slanje. Držalac zakup produžava dok radi; kad istekne, druga instanca ga preuzima.

const LOCK_FILE = 'scheduler.lock';

interface Lease {
  holder: string;
  acquiredAt: string;
  expiresAt: string;
}

function lockPath(): string {
  return path.join(dataDir(), LOCK_FILE);
}

/** Identitet instance — host i PID su dovoljni da se dve instance razlikuju, a slučajan rep
 * pokriva i ponovo iskorišćen PID posle brzog restarta. */
export function instanceId(): string {
  return `${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;
}

function readLease(): Lease | null {
  try {
    const raw = JSON.parse(fs.readFileSync(lockPath(), 'utf8')) as Lease;
    return raw && typeof raw.holder === 'string' && typeof raw.expiresAt === 'string' ? raw : null;
  } catch {
    // Nema fajla ili je oštećen. Oštećen zapis se tretira kao istekao — vidi `tryAcquire`.
    return null;
  }
}

function writeExclusive(lease: Lease): boolean {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(lockPath(), JSON.stringify(lease), { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

export interface Held {
  /** Produžava zakup dok posao traje. Vraća `false` ako bravu više ne drži ova instanca. */
  renew: () => boolean;
  release: () => void;
}

/**
 * Pokušaj preuzimanja brave. Vraća `null` kad je drži druga instanca sa važećim zakupom —
 * pozivalac tada jednostavno preskače tik, isto kao kad je sopstveni prethodni tik još u toku.
 */
export function tryAcquire(holder: string, leaseMs: number): Held | null {
  const lease = (): Lease => ({
    holder,
    acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + leaseMs).toISOString(),
  });

  if (!writeExclusive(lease())) {
    const existing = readLease();
    const expired = !existing || new Date(existing.expiresAt).getTime() <= Date.now();
    if (!expired) return null;
    // Istekao (ili oštećen) zapis se uklanja, pa se brava uzima ponovo preko istog atomičnog
    // `wx` upisa. Ako dve instance istovremeno pokušaju preuzimanje, obe mogu da obrišu fajl,
    // ali samo jedna može da ga NAPRAVI — pa i dalje postoji tačno jedan držalac.
    try {
      fs.unlinkSync(lockPath());
    } catch {
      // Druga instanca je bila brža — svejedno probamo upis ispod; ako je ona već uzela bravu,
      // naš `wx` upis neće uspeti i ovaj tik se preskače.
    }
    if (!writeExclusive(lease())) return null;
  }

  let held = true;
  return {
    renew() {
      if (!held) return false;
      const current = readLease();
      // Tuđa brava se NIKAD ne produžava: ako je naš zakup u međuvremenu istekao i neko drugi
      // ga preuzeo, mi smo izgubili pravo na posao i to moramo da saznamo, ne da prepišemo.
      if (!current || current.holder !== holder) {
        held = false;
        return false;
      }
      try {
        fs.writeFileSync(
          lockPath(),
          JSON.stringify({ ...current, expiresAt: new Date(Date.now() + leaseMs).toISOString() }),
          'utf8',
        );
        return true;
      } catch {
        return false;
      }
    },
    release() {
      if (!held) return;
      held = false;
      const current = readLease();
      if (!current || current.holder !== holder) return; // tuđu bravu ne diramo
      try {
        fs.unlinkSync(lockPath());
      } catch {
        // Fajl je već nestao — brava je svejedno slobodna.
      }
    },
  };
}
