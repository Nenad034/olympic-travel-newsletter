import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { instanceId, tryAcquire } from '@/lib/scheduler-lock';
import { dataDir } from '@/lib/store';

// Brava postoji zbog rada u VIŠE instanci (spec §10.2): bez nje bi dve instance našle istu
// dospelu kampanju i obe je poslale. Testovi zato oponašaju DVA nezavisna držaoca, ne dva
// poziva iz istog procesa.

const LOCK = () => path.join(dataDir(), 'scheduler.lock');

function cleanup() {
  try {
    fs.unlinkSync(LOCK());
  } catch {
    /* brave nema — u redu */
  }
}

describe('brava schedulera', () => {
  it('drugu instancu ne pušta dok prva drži zakup', () => {
    cleanup();
    const prva = tryAcquire(instanceId(), 60_000);
    const druga = tryAcquire(instanceId(), 60_000);

    expect(prva).not.toBeNull();
    expect(druga).toBeNull();

    prva!.release();
  });

  it('posle otpuštanja brava je slobodna', () => {
    cleanup();
    const prva = tryAcquire(instanceId(), 60_000);
    prva!.release();

    const druga = tryAcquire(instanceId(), 60_000);
    expect(druga).not.toBeNull();
    druga!.release();
  });

  it('istekao zakup preuzima druga instanca — pala instanca ne zaključava slanje zauvek', () => {
    cleanup();
    // Zakup koji ističe istog trenutka je isto što i instanca koja je pala odmah po uzimanju
    // brave. Nula, ne „par milisekundi": provera isteka je `<= Date.now()`, pa bi svaka
    // pozitivna vrednost zavisila od toga koliko je sledeći red koda bio brz.
    const pala = tryAcquire(instanceId(), 0);
    expect(pala).not.toBeNull();

    const nova = tryAcquire(instanceId(), 60_000);
    expect(nova).not.toBeNull();

    // Pala instanca više ne sme ni da produži ni da obriše tuđu bravu.
    expect(pala!.renew()).toBe(false);
    pala!.release();
    expect(fs.existsSync(LOCK())).toBe(true);

    nova!.release();
  });

  it('držalac produžava sopstveni zakup dok posao traje', () => {
    cleanup();
    const holder = instanceId();
    const drzi = tryAcquire(holder, 60_000);
    expect(drzi!.renew()).toBe(true);

    // Posle produženja zakup i dalje važi, pa druga instanca ne prolazi.
    expect(tryAcquire(instanceId(), 60_000)).toBeNull();
    drzi!.release();
  });

  it('oštećen zapis brave ne blokira obradu zauvek', () => {
    cleanup();
    fs.writeFileSync(LOCK(), 'ovo nije JSON', 'utf8');

    const nova = tryAcquire(instanceId(), 60_000);
    expect(nova).not.toBeNull();
    nova!.release();
  });
});
