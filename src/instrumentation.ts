// Poziva se jednom po instanci Next servera (docs: file-conventions/instrumentation).
// Jedina svrha ovde je da se podigne scheduler za dospele zakazane kampanje, da slanje ne
// zavisi od toga da li je neko otvorio stranicu.
export async function register() {
  // Edge runtime nema tajmere koji preživljavaju zahtev niti pristup file-backed store-u.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { startScheduler } = await import('@/lib/scheduler');
  startScheduler();
}
