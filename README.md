# Olympic Travel — Newsletter / Mailing modul (M-27)

Interni panel marketing tima za slanje newsletter-a prema **B2B subagentima** (operativni i promotivni tok) i **B2C klijentima**, po specifikaciji [docs/M27_NEWSLETTER_MODULE.md](docs/M27_NEWSLETTER_MODULE.md).

Vizuelna struktura je preuzeta iz Terminal Travel internog panela (VS Code obrazac): gornja traka sa tabovima, leva Activity Bar + bočna traka, desna traka, statusna traka, svetli / dim / tamni mod, Codicons ikonice, „Azur + Svetionik“ paleta.

## Arhitektura

| Komponenta | Gde je u kodu |
|---|---|
| **Listmonk** (motor: liste, pretplatnici, kampanje, bounce obrada) | `src/lib/listmonk.ts` — REST adapter; bez `LISTMONK_URL` radi **mock** nad `data/store.json` |
| **Claude API** (punjenje šablona sadržajem, spec §5.2) | `src/lib/claude.ts` — `claude-opus-5`, structured output (JSON schema); bez `ANTHROPIC_API_KEY` radi lokalni popunjivač |
| **Šabloni** (Claude Design → čist HTML sa `{{placeholder}}` poljima) | `src/lib/email-templates.ts` |
| **Tok kampanje / human-approval gate / zakazivanje** | `src/lib/campaigns.ts` |
| **Auto-subscribe (portal, booking), sunset politika** | `src/lib/subscribers.ts`, `src/app/api/webhooks/*` |
| **SES/SNS eventi** | `src/app/api/webhooks/ses/route.ts` |
| **Metrike za M-25 (Cube.dev)** | `GET /api/campaigns` |

## Tok kampanje

```
Nacrt ──(Claude popuni šablon)──▶ Nacrt ──▶ Čeka odobrenje ──▶ [odobri: odmah | zakaži] ──▶ Šalje se / Zakazano ──▶ Poslato
                                                    │
                                          test slanje internoj listi (obavezno pre odobrenja)
```

- Odobrava se **sadržaj i termin zajedno**; promena termina posle odobrenja ne traži ponovno odobrenje sadržaja.
- Izmena sadržaja posle slanja na odobrenje vraća kampanju u nacrt.
- Više kampanja može biti zakazano paralelno; kalendar upozorava kad su dve bliže od podešenog razmaka (SES throughput).

## Pokretanje

```bash
npm install
cp .env.example .env.local   # opciono: ANTHROPIC_API_KEY, LISTMONK_*
npm run dev                  # http://localhost:3200
```

Demo podaci (3 liste, 31 pretplatnik, 6 kampanja) se kreiraju automatski u `data/store.json`; reset je u „SES i domeni → Demo podaci“.

## Sekcije

- **Početna** — upozorenja (odobrenja, sudari termina, SES sandbox), brojači, sledeća slanja
- **Kampanje** — lista po statusu/segmentu, nova kampanja, radni sto kampanje (sadržaj, test, odobrenje, pregled, istorija)
- **Kalendar slanja** — mesečni prikaz + red za slanje
- **Liste i tokovi / Pretplatnici / Sunset** — pristanci, odjave, pravo na brisanje, re-engagement kandidati
- **Šabloni** — pregled polja i renderovanog HTML-a
- **Analitika / Isporuka** — open/click/bounce po toku, reputacija domena, dnevnik SES evenata
- **SES i domeni** — SPF/DKIM, DMARC faze (none → quarantine → reject), production access, warm-up, test lista, sunset, razmak kampanja
- **Integracije** — API kontrakti + simulatori webhook poziva

## Skripte

`npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm run typecheck`
