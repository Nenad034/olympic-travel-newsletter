# M-27: Newsletter / Mailing Modul

**Status:** Draft spec — v0.1
**Vlasnik:** Terminal Travel Agency (TTA)
**Povezani moduli:** Content/Marketing domain agent, M-25 Semantični sloj (Cube.dev), B2B portal (subagent nalozi), Booking sistem

---

## 1. Svrha

Modul za slanje newsletter/mailing komunikacije prema dva jasno odvojena segmenta:

1. **B2B subagenti** — mreža ugovornih partnera sa nalozima na TTA portalu
2. **Krajnji klijenti (B2C)** — putnici koji su izvršili booking preko agencije

Modul mora da podrži i operativnu komunikaciju (cenovnici, alotmani, rokovi) i promotivnu/marketing komunikaciju, sa različitim pravilima pristanka i različitim tretmanom reputacije domena za svaki tok.

---

## 2. Arhitektura — komponente

| Komponenta | Uloga |
|---|---|
| **Listmonk** (self-hosted, PostgreSQL) | Motor: liste, pretplatnici, kampanje, bounce/complaint obrada |
| **Amazon SES** | Transport sloj za slanje |
| **Amazon SNS** | Prenosi bounce/complaint/delivery evente ka Listmonk-u |
| **Claude Design (MCP)** | Kreiranje i redizajn HTML template-a newsletter-a (retko, po potrebi) |
| **Claude API** (messages endpoint) | Automatsko punjenje template-a sadržajem po kampanji |
| **Custom UI sloj** | Interfejs preko kog marketing tim pokreće/odobrava kampanje, poziva Listmonk API u pozadini |
| **B2B portal** | Izvor auto-subscribe evenata za subagente |
| **Booking sistem** | Izvor auto-subscribe evenata za krajnje klijente |
| **M-25 Semantični sloj (Cube.dev)** | Prijem podataka o performansama kampanja radi analitike |

Listmonk se ne izlaže krajnjim korisnicima direktno — čitav frontend za kreiranje i pregled kampanja je custom, u TTA dizajn sistemu (navy/gold/sand), a Listmonk ostaje "motor" u pozadini dostupan preko svog REST API-ja.

---

## 3. Segmentacija liste i tokova

### 3.1 B2B (subagenti)

Jedan red = jedan subagent = jedan email (nema nested kontakata unutar firme za sada).

Dva odvojena toka, iste baze:

- **Operativni tok** — cenovnici, promena alotmana, rokovi uplate, hitna obaveštenja.
  - Auto opt-in pri kreiranju portal naloga.
  - Nema unsubscribe opcije (deo poslovnog odnosa, ne marketing).
  - Zaseban SES configuration set, da se statistika ne meša sa promotivnim slanjem.

- **Promotivni tok** — nove destinacije, kampanje, ponude za prosleđivanje krajnjim klijentima.
  - Opt-out po defaultu (poslovni kontekst, ne zahteva eksplicitan opt-in kao kod fizičkih lica).
  - Standardan unsubscribe link.
  - Odjava sa ovog toka ne sme da utiče na operativni tok.

#### 3.1.1 Unsubscribe mehanizam po toku

Listmonk automatski generiše unsubscribe link u footeru svake kampanje, vezan za konkretnu listu (ne za celu bazu). Ovo se uklapa direktno u podelu tokova:

- **B2C** — standardan unsubscribe, obavezan po zakonu.
- **B2B promotivni tok** — standardan unsubscribe; subagent se odjavljuje samo sa promocija, operativni tok ostaje netaknut (odvojene liste).
- **B2B operativni tok** — **bez** unsubscribe opcije, jer nije marketing nego deo poslovnog odnosa.

Preporuka: operativni tok se ne šalje kao Listmonk "kampanja" (koja po defaultu dobija unsubscribe link), nego kao **transakcioni mejl** preko Listmonk-ovog transactional API-ja — taj mehanizam po prirodi nema unsubscribe link jer nije marketing komunikacija, čime se izbegava ručno podešavanje/uklanjanje linka po template-u i rizik da neko greškom pošalje operativnu poruku kroz pogrešan tip kampanje.

### 3.2 B2C (krajnji klijenti)

- Jedna lista, eksplicitan opt-in u trenutku bookinga (čekboks, ne prećutna saglasnost).
- Standardan double opt-in flow kroz Listmonk.
- Puna primena Zakona o zaštiti podataka o ličnosti: consent timestamp, izvor prijave, pravo na brisanje na zahtev.

### 3.3 Izolacija domena

Dva verifikovana SES identiteta na odvojenim poddomenima:

- `b2b.olympic.rs` (ili ekvivalent) — subagenti, oba toka
- `newsletter.olympic.rs` (ili ekvivalent) — krajnji klijenti

Razlog: loša reputacija na jednoj strani (npr. veći broj spam prijava od krajnjih klijenata) ne sme da ugrozi isporuku kritične B2B komunikacije.

---

## 4. SES konfiguracija

- SPF, DKIM, DMARC na oba poddomena.
- **DMARC rollout u fazama:** `p=none` (monitoring, par nedelja) → `p=quarantine` → `p=reject`. Ne ići direktno na strogo — greška u SPF/DKIM konfiguraciji bi inače nečujno blokirala legitimna slanja.
- Production access zahtev ka AWS-u (izlazak iz sandboxa) sa opisom use-case-a i očekivanog volumena.
- Configuration sets: minimum dva (B2B operativno / B2B promotivno), plus poseban za B2C.
- SNS topic po domenu, subscribe na Listmonk-ov `/webhooks/service/ses` endpoint (native podrška, potvrđeno u zvaničnoj Listmonk dokumentaciji) — pokriva bounce, complaint i delivery evente.
- Postepeno "zagrevanje" (warm-up) pri prelasku na nov domen/IP — ne krenuti sa punim volumenom prvog dana.

---

## 5. Tok kreiranja i slanja kampanje

### 5.1 Kreiranje/redizajn template-a (retko, epizodno)

1. Marketing tim (ili agent preko MCP-a) koristi **Claude Design** da kreira ili redizajna vizuelni template newsletter-a, sa primenjenim TTA dizajn sistemom.
2. Export kao čist HTML/CSS.
3. Template se čuva u TTA sistemu sa definisanim placeholder poljima (naslov ponude, opis, cena, slika, CTA link, itd.), odvojeno za B2B i B2C stil ako je potrebno.

### 5.2 Popunjavanje sadržaja i slanje (svaka kampanja)

1. Agent (content/marketing domain agent) poziva **Claude API** sa podacima za tekuću kampanju (aktuelne ponude, cene, segment kome je namenjeno).
2. Claude API popunjava placeholdere u postojećem template-u i vraća finalni HTML.
3. **Human-approval gate:** generisani draft ide na odobrenje pre slanja — u skladu sa postojećim TTA principom "agent priprema, čovek odobrava" za sve nepovratne akcije. Masovno slanje je nepovratno, pa se ne šalje automatski bez potvrde osobe iz marketing tima.
4. Nakon odobrenja, finalni HTML se prosleđuje **Listmonk API**-ju koji kreira kampanju na odgovarajućoj listi/configuration setu.
5. Pre slanja na punu bazu, kampanja se šalje na internu test listu (par TTA zaposlenih) radi provere renderovanja u različitim mail klijentima (Gmail, Outlook, mobilni).
6. Listmonk šalje kampanju preko SES-a.

---

## 6. Zakazivanje slanja i paralelno upravljanje sa više kampanja

Listmonk nativno podržava zakazivanje kampanje na tačan datum i vreme (`send_at` polje na campaign objektu, status `scheduled` dok se ne izvrši). Ovo se koristi kao osnova, bez potrebe za dodatnom infrastrukturom za red čekanja.

### 6.1 Zakazivanje pojedinačne kampanje

- Pri kreiranju kampanje (nakon human-approval koraka iz sekcije 5.2), osoba koja odobrava bira: **pošalji odmah** ili **zakaži za datum i vreme**.
- Zakazana kampanja ide u Listmonk sa statusom `scheduled` i tačnim `send_at` vremenom; ostaje vidljiva i izmenljiva do trenutka slanja.
- Custom UI sloj mora da omogući izmenu ili otkazivanje već zakazane kampanje pre nego što krene slanje.

### 6.2 Više paralelnih newsletter-a sa različitim terminima

- Ne postoji ograničenje na jednu aktivnu zakazanu kampanju — više odvojenih newsletter-a (npr. jedan za B2B promotivni tok, jedan za B2C, jedan sezonski) mogu istovremeno postojati u statusu `scheduled`, svaki sa sopstvenim datumom/vremenom i sopstvenom listom/segmentom.
- Custom UI treba da prikaže **kalendarski/listovni pregled** svih zakazanih kampanja (naziv, segment, datum/vreme, status), da marketing tim ima uvid u sve što je u redu za slanje, ne samo poslednju kreiranu.
- Operativna napomena: ako se dve veće kampanje zakažu u kratkom vremenskom razmaku (npr. obe u istom satu), vredi u UI-ju upozoriti korisnika — veliki uzastopni sendovi mogu opteretiti SES throughput i tempo slanja, bolje ih razmaknuti makar 30–60 minuta.

### 6.3 Odnos prema odobravanju sadržaja

Zakazivanje ne zaobilazi human-approval gate iz sekcije 5.2 — odobrava se i sadržaj i termin slanja zajedno, pre nego što kampanja pređe u status `scheduled`. Izmena termina posle odobrenja sadržaja ne zahteva ponovno odobravanje sadržaja, samo potvrdu novog datuma/vremena.

---

## 7. Auto-subscribe integracija

- **B2B:** kreiranje naloga na portalu → API poziv ka Listmonk-u → subagent se automatski dodaje na operativnu listu (obavezno) i promotivnu listu (opt-out dostupan odmah).
- **B2C:** potvrda bookinga sa označenim pristankom → API poziv ka Listmonk-u → dodavanje na B2C listu → pokreće se double opt-in flow.

Automatski tok je pravilo: subscribe se okida iz izvornog sistema (portal ili booking), čime se izbegava dupliranje baze i neusklađenost podataka o pristanku.

### 7.1 Ručni unos i CSV uvoz (izuzetak)

Dve situacije automatski tok ne pokriva: prenos postojeće baze subagenata iz starog sistema i kontakt čiji pristanak je pribavljen van portala/bookinga (potpisan ugovor, prijavni formular na sajmu). Za njih stranica „Pretplatnici“ ima ručni unos i CSV uvoz, uz sledeća ograničenja:

- Svaki takav zapis nosi **osnov pristanka**, **datum pristanka** i **referencu na dokaz**; bez ijednog od ta tri polja zapis se ne kreira. Izvor se beleži kao `RUCNI_UNOS` ili `IMPORT_CSV`, uz ime osobe koja je unela zapis.
- Dokumentovan pristanak ne zamenjuje potvrdu adrese — unos na B2C listu i dalje ulazi kao `unconfirmed` i prolazi kroz double opt-in.
- Ranija odjava preživljava uvoz: kontakt koji se odjavio sa neke liste se uvozom ne vraća na nju.
- CSV kolone: `email,ime,firma,liste,pristanak,osnov,referenca` (separator zarez ili tačka-zarez, više lista razdvojeno sa `;` ili `|`). Obavezan je samo `email`; ostalo se dopunjava vrednostima zadatim u formi. Neispravni redovi se odbijaju pojedinačno, ostatak fajla prolazi, a izveštaj navodi broj reda i razlog.

---

## 8. Sunset / re-engagement politika

- Ako pretplatnik (B2C ili B2B-promotivni tok) ne otvori nijedan mejl u periodu od 6 meseci → automatska re-engagement kampanja.
- Ako ni tada nema reakcije → pauziranje daljeg slanja na tu adresu.
- Cilj: zaštita reputacije domena kod Gmail/Outlook filtera; lakše ugraditi ovo pravilo od početka nego naknadno čistiti bazu.

---

## 9. Analitika

- Metrike kampanja (open rate, click rate, bounce rate) po segmentu i tipu toka slivaju se u **M-25 semantični sloj** (Cube.dev), ne ostaju zaključane u Listmonk-ovom internom UI-ju.
- Cilj na duži rok: agent koji na osnovu istorijskih podataka predlaže koji tip ponude bolje prolazi kod kog segmenta.

---

## 9a. NewsletterAgent (razgovor sa modulom)

Agent u panelu odgovara na pitanja o stanju baze, kampanja i isporuke. Obrazac je preuzet iz OmnisearchAgent-a u Terminal Travel panelu (`apps/api/src/modules/m15-ai-orkestracija/omnisearch`), jer rešava isti problem pod istim ograničenjem — čovek odobrava, agent ne izvršava.

- **Alati su isključivo za čitanje** (`stanje_baze`, `nadji_pretplatnika`, `stanje_kampanja`, `sadrzaj_kampanje`, `stanje_isporuke`). Agent nema nijednu funkciju koja menja stanje; kad upit liči na zahtev za radnju, odgovor objašnjava radnju i vodi na ekran gde je čovek potvrđuje (§5.2).
- **Sadržaj kampanja je vidljiv agentu** (`sadrzaj_kampanje`, odluka 13.9.2026): naslov mejla, brif, popunjena polja šablona i tekst tela poruke (HTML se pretvara u tekst, bez markup-a). Do odobrenja se telo menja svakom izmenom sadržaja, pa alat odvojeno vraća `telo_je_nacrt` — agent mora da kaže da je to ono što bi otišlo, a ne poruka koja je otišla. Uvid ne pomera granicu modula: nijedan alat i dalje ne menja stanje.
- **Linkovi se izvode iz alata koji su stvarno pozvani**, ne iz modela — agent ne može da uputi na rutu koja ne postoji.
- **Prompt injection**: rezultati alata nose slobodan tekst koji su upisali ljudi izvan marketing tima (ime i firma iz portala, osnov pristanka iz uvoza, brif kampanje). Sistemski prompt taj tekst tretira kao podatak koji se citira ili sažima, nikad kao instrukciju.
- **Kontekst**: uz pitanje se šalje vidljiv tekst otvorene stranice i zapisi koje je korisnik svesno priložio („Dodaj u AI kontekst" na redu). Priložen zapis je referenca, ne sirov podatak — agent ga razrešava svojim alatom.
- **Bez trajne memorije**: prethodne ture razgovora šalje panel uz svaki poziv (poslednjih 6), server ne čuva poruke.
- **Dnevnik poziva** (`Store.agentInvocations`): vreme, model, tokeni, procenjen trošak, trajanje, iteracije i pozvani alati — **bez teksta upita**; dnevnik služi za uvid u potrošnju, ne za čitanje razgovora.
- **Budžet potrošnje** (`src/lib/agent-budget.ts`, odluka 13.9.2026): dnevna i mesečna granica u EUR (`Settings.agentDailyBudgetEur`, `agentMonthlyBudgetEur`; `null` = bez granice), potrošnja se **sabira iz dnevnika poziva**, ne iz posebnog brojača koji bi mogao da se sa njim raziđe. Dostignuta granica ne gasi agenta nego ga vraća na lokalan odgovor — isti alati i isti podaci, bez troška — i to kaže u odgovoru. Cenovnik je aproksimacija za praćenje, ne faktura (isti pristup kao M18 `agent-invocations/pricing.ts` u Terminal Travel).
- **Bez API ključa** modul radi u mock režimu, pa agent sklapa odgovor lokalno iz istih alata i to jasno kaže — ne pretvara se da je model.

### 9a.1 Polje za razgovor

**Gde agent stoji** (obrazac iz Terminal Travel panela, dizajn dok. §6c.0 — `RightPanel.tsx`, `/ai-asistent`):

- U **desnom panelu** agent je TRAJAN deo panela, naslagan **ispod brzih info** — nisu tabovi, oba dela su vidljiva odjednom. Otvaranje samog panela time kontroliše i pristup agentu; posebnog „upali/ugasi agenta" prekidača nema, jer bi mogao da ostane u stanju koje korisnik ne vidi. Linija između dva dela se prevlači (visina se pamti kao **procenat panela**, ne u pikselima — panel se ručno sužava i širi), a svaki deo se može sklopiti: sklopljene brze info puštaju agenta na ceo panel i obrnuto. Sklapanje je samo vizuelno — polje ostaje u DOM-u, pa se istorija razgovora ne gubi.
- **Ikonica u desnoj traci** (dno, `RightRail.tsx`) i ikonica „proširi" u zaglavlju agenta otvaraju **poseban tab samo za agenta** (`/ai-agent`). To je ista komponenta, sa `fokus` režimom koji isključuje automatsko čitanje `#ot-main-content` — tamo je agent SAM taj sadržaj, pa bi inače uz svako pitanje dobijao sopstvenu istoriju. Tab ima **sopstveni razgovor**, namerno: montira se i odmontira zajedno sa tabom.
- Agent se **ne prikazuje u centralnom panelu** ni na koji drugi način (odluka 13.9.2026; ranija treća pozicija „dno centralnog panela" je uklonjena) — centralni panel je radni prostor za sadržaj, agent je ili uz njega (desno) ili umesto njega (tab).

Dokovano polje postoji **tačno jedno**. `Shell.tsx` ga montira jednom i fizički premešta njegov čvor u slot desnog panela kad se panel otvori, umesto da ga renderuje unutar panela — to bi značilo odmontiranje pri svakom zatvaranju panela i gubitak istorije razgovora i nedovršenog teksta.

- **Glas**: `Web Speech API` u pregledaču — transkript prolazi kroz isti `send()` tok kao kucanje, zvuk se ne šalje na server niti čuva. Dugme se ne prikazuje u pregledačima bez podrške (nema polovičnog stanja).
- **Prilog preko „+"**: slike (jpg/png/gif/webp do 5 MB) idu u base64 direktno u pregledaču i ulaze u poziv kao Claude Vision blokovi; dokumenti (txt/md/csv/json, html, pdf, docx, xlsx) idu na `POST /api/ai-context/extract-file`, koji izvlači tekst u memoriji i odbacuje fajl — ništa se ne piše na disk ni u store. Slika se može i nalepiti (Ctrl+V).
- **Automatski kontekst**: naziv otvorenog taba i vidljiv tekst centralnog panela (`#ot-main-content`) prilažu se uz svako pitanje; „X" na čipu ukida oboje za taj tab.
- **Linkovi u odgovoru** dolaze iz `/api/nav-items` registra — istog koji pune levi meni i paleta komandi.

---

## 10. Otvorena pitanja za sledeću iteraciju

### 10.1 Rešeno implementacijom

- **Operativni B2B tok: transakciono, ne kampanja bez unsubscribe linka** (§3.1.1). Odlučeno u korist transakcionog slanja (Listmonk `/api/tx`): taj kanal po prirodi nema unsubscribe link, pa nema ni ručnog podešavanja po šablonu ni rizika da neko operativnu poruku pošalje kao kampanju. Cena odluke je što `/api/tx` nema `send_at`, pa zakazano operativno slanje mora da izvrši aplikacija — otud scheduler iz §10.2. U kodu: `Campaign.deliveryMode`, `campaigns.sendTransactionalNow`.
- **Prag razmaka između dve kampanje** (§6.2). Potreban je automatski, ali kao upozorenje, ne kao zabrana — marketing tim ima kontekst koji aplikacija nema. Prag je podesiv (`Settings.minGapMinutes`, podrazumevano 60 min, uz `bigCampaignThreshold` za „veliku" kampanju) i prikazuje se na kalendaru i pri odobravanju. U kodu: `campaigns.scheduleConflicts`.
- **API kontrakti portal/booking → Listmonk** (REST payload šema). Kontrakt ne ide direktno ka Listmonk-u nego ka ovom modulu, koji je jedino mesto koje zna Listmonk API (`src/lib/listmonk.ts`) — time izvorni sistemi ne moraju da znaju ništa o motoru, pravilima pristanka ni double opt-in-u. Rute i šeme: `POST /api/webhooks/portal` (`email`, `name`, `company`, `portalAccountId`), `POST /api/webhooks/booking` (`email`, `name`, `bookingRef`, `consent`; bez `consent: true` nema prijave), `POST /api/webhooks/ses` (bounce/complaint/delivery). Autentikacija je zajednička tajna u zaglavlju `x-webhook-secret` (`WEBHOOK_SECRET`).
- **Ručni unos podataka** (§7.1). Prvobitna zabrana svakog unosa van portala/bookinga pokazala se kao rupa za prenos postojeće baze; dozvoljeni su ručni unos i CSV uvoz uz obavezan osnov pristanka, datum i referencu na dokaz.

### 10.2 Odlučeno u toku rada, van prvobitnog spiska

- **Zakazano slanje ne sme da zavisi od otvaranja stranice.** Obrada dospelih kampanja ide iz `src/instrumentation.ts` na interval (60 s, `SCHEDULER_INTERVAL_MS`), sa zaštitom od preklapanja tikova. Bez toga operativni tok — koji nema Listmonk `send_at` — ne bi otišao dok neko ne otvori panel.
- **Dnevnik izmena pretplatnika.** Ko, kad, koje polje i stara → nova vrednost, po uzoru na istoriju kampanja; obavezno za pristanak, odjavu, vraćanje na listu, pauziranje i brisanje.
- **Brisanje ostavlja suppression zapis.** Hash adrese, datum i razlog — bez toga bi obrisana adresa vratila se prvim uvozom stare baze. Ručni unos i CSV uvoz je odbijaju; povratak ide samo kroz portal ili booking, uz novu saglasnost.
- **Scheduler u više instanci** (13.9.2026). Tajmer je po instanci, pa bi dve instance iza istog balansera obradile istu dospelu kampanju i poslale je dvaput; dotadašnja zaštita od preklapanja bila je zastavica u memoriji jednog procesa i drugom procesu nije značila ništa. Rešeno **zakupom na nivou skladišta** (`src/lib/scheduler-lock.ts`): fajl `data/scheduler.lock`, pravljen atomičnim `wx` upisom, sa rokom koji držalac produžava dok posao traje. Namerno NIJE izabrana „jedna određena instanca šalje" — njen pad bi zaustavio slanje dok je neko ručno ne zameni; ovako istekao zakup preuzima bilo koja živa instanca. Uz bravu ide i odbacivanje keša store-a na početku tika (`store.reloadStore`): bez toga bi brava sprečila istovremeno slanje, ali ne i ponovljeno slanje iz zastarele kopije. *Ostaje ograničenje:* ostale izmene (iz panela) i dalje pišu ceo JSON kao celinu — puna sigurnost u više instanci dolazi tek sa pravom bazom iza Listmonk-a, brava pokriva slanje, koje je nepovratno.
- **Budžet potrošnje agenta** (13.9.2026). Dnevna i mesečna granica u EUR, podesive na ekranu SES i domeni; potrošnja se sabira iz dnevnika poziva (jedan izvor istine umesto brojača koji bi se s njim razišao). Prekoračenje **ne gasi agenta** nego ga vraća na lokalan odgovor bez troška — modul ostaje upotrebljiv, a korisnik u odgovoru vidi zašto je drugačiji. Detalji u §9a.
- **Agent vidi sadržaj kampanja** (13.9.2026, vlasnikova odluka). Do sada je video samo brojno stanje, pa na pitanje „šta piše u ovoj kampanji" nije mogao ništa osim da uputi na ekran. Alat `sadrzaj_kampanje` vraća naslov, brif, popunjena polja i tekst tela; granica modula se ne pomera, jer je i dalje isključivo čitanje. Detalji u §9a.

### 10.3 I dalje otvoreno

- Tačan naziv/struktura poddomena za SES identitete.
- Da li B2B promotivni opt-out ide odmah pri kreiranju naloga ili nakon prvog slanja (pravna provera preporučena, van obima ovog dokumenta).
- Da li custom UI sloj ide kao zaseban modul ili deo postojećeg content/marketing agent interfejsa.
- Retencija test/staging liste i ko su interni test primaoci.
- Rok čuvanja suppression zapisa — hash nije ličan podatak u istom smislu, ali lista ne treba da raste zauvek.
- Tačan iznos budžeta agenta u EUR (mehanizam i podrazumevane vrednosti postoje, §10.2 — iznos je vlasnikova odluka). Granica **po korisniku** ostaje otvorena dok modul ima jedan nalog.
