# Dokumentace herních modulů: Strážci světla – Echo v Mlžném lese  
## Revize: Verze 4.0 – Aktuální stav projektu

Tento dokument definuje detailní logiku herních modulů pro 4 úrovně asymetrické kooperace a závěrečnou reflexi. 
Během samotných herních úrovní (Level 1 až 4) je **zcela eliminován volný textový chat** pro zaručení 100% anonymity. Komunikace je omezena na kontextová tlačítka, vizuální signály a systémové herní akce. 
Po dokončení her a odhalení identit v závěrečné fázi reflexe je však **volný real-time chat povolen**, aby se žáci mohli o své zkušenosti podělit a společně ji zhodnotit.

Všechny úrovně také obsahují **instrukční modály s tlačítkem potvrzení přečtení („Přečetl jsem a rozumím“)** na svém začátku, což pomáhá pomalu čtoucím žákům (např. ve 4. třídě) porozumět úkolu před zahájením hry.

---

## 4.1 Obrazovky 1 a 2: Login, Autentizace a Čekárna

Tento modul zajišťuje bezpečný vstup do hry, kontrolu identity a anonymní propojení hráčů bez rizika úniku dat na straně klienta.

### A. Uživatelská zkušenost (UI/UX)  
- **Přihlašovací obrazovka (`index.html`):** Obsahuje minimalistický formulář. Přihlášení hráče je řešeno v rámci jeho školního Google účtu (Google Workspace for Education) přes Firebase Auth. Po přihlášení se jeho údaje porovnají s listem hráčů, který je veden v administraci hry. Pokud jeho email není nalezen, je mu odepřen přístup.
- **Čekárna (`game.html` před spuštěním):** Po úspěšném ověření se spustí Router. Na začátku se zobrazí čekací obrazovka s velkou ikonou přiděleného zvířete a textem: **„V této hře jsi [Zvíře]. Tvůj parťák tě uvidí pod touto identitou.“**. Pod ním svítí pulzující status bar: **„Hledání parťáka...“**.
- **Odebrání odhlášení:** Pro zabránění předčasného a neúmyslného odpojení hráčů v průběhu hry bylo z klientského herního rozhraní (`game.html`) zcela odstraněno tlačítko pro odhlášení.

### B. Algoritmická logika a Firebase Handshake  
1. **Odeslání e-mailu:** Klientský JavaScript vezme zadaný e-mail z Google Auth, převede jej na malá písmena a provede sanitizaci (nahrazení teček čárkami a zavináče podtržítkem pro kompatibilitu s klíči Firebase: `jmeno.prijmeni@skola.cz` -> `jmeno,prijmeni_at_skola_cz`).  
2. **Volání Cloud Function:** Klient odešle autorizovaný HTTP POST požadavek na Cloud Function `lookupMappingByEmail`.  
3. **Odezva serveru:** Cloud Function provede bezpečné čtení z chráněných uzlů `/profiles` a `/mappings` v RTDB. Klientovi vrátí payload:  
   ```json  
   {  
     "status": "success",  
     "role": "player1" | "player2",  
     "animal": "Sova" | "Rys" | "...",  
     "pairId": "pair_1716260000_1",  
     "avatar": "lion.svg" | "...",  
     "realName": "Jan Novák",  
     "email": "jan.novak@skola.cz"  
   }
   ```
4. **Zápis přítomnosti (Presence):** Klient se následně připojí k Realtime Database na cestu `/rooms/{pairId}/players/animal1` (pokud je `player1` / Sova) nebo `animal2` (pokud je `player2` / Rys) a zapíše svůj stav: status: "online", lastSeen: serverTimestamp(), UID a email.

### C. Podmínky synchronizace a přechodu
* Klientská aplikace v čekárně spustí active listener (`onValue`) na uzel `/rooms/{pairId}/state`.
* **Podmínka spuštění:** Jakmile oba hráči zapíšou přítomnost a stav v místnosti se přepne do herního stavu, `initGameRouter` automaticky spustí příslušný level (defaultně `level1`).

---

## 4.2 Úroveň 1: Spolehnutí ve tmě (Navigace v lese)

**Cíl:** Rozvoj spolehlivosti a přebírání zodpovědnosti za zranitelného parťáka.

**Komunikační náhrada chatu:** Sova nepíše text, ale mačká směrové a stavové příkazy. Rys nevidí mapu a pohybuje se na základě těchto blikajících signálů.

### A. Vizuální rozvržení (UI/UX)
- **Zobrazení u Hráče A (Sova - Navigátor):** Vidí celou mřížku 10x10. Vidí pozici zdí (tmavé), pastí (červené), cíl (zelený) a bod parťáka (modrý). Pravý/spodní panel obsahuje **Navigační pult** se 6 velkými tlačítkami (↑, ↓, ←, →, STOP, PAST) uspořádanými podle fyzické klávesnice.
- **Zobrazení u Hráče B (Rys - Slepý poutník):** Vidí pouze černou mřížku a svůj svítící bod. Nevidí zdi, pasti ani cíl. Pohybuje se pomocí hardwarových šipek klávesnice.
- **Vstupní modal:** Před startem musí oba potvrdit přečtení instrukcí tlačítkem *„👍 Přečetl jsem a rozumím“*.

### B. Procedurální generování mapy
Aby byla hra pokaždé jiná, mapa se generuje dynamicky při startu (generuje ji Sova):
1. **Pozice startu a cíle:** Náhodně se vygenerují na mřížce 10x10 tak, aby jejich Manhattan vzdálenost byla alespoň 6.
2. **Překážky a pasti:** Rozmístí se 24 náhodných zdí a 6 náhodných pastí.
3. **BFS Validace:** Algoritmus ověří, že z vygenerovaného startu do cíle existuje průchodná cesta. Pokud ne, mapa se regeneruje znovu, dokud není nalezena platná konfigurace. Data se uloží do DB pod `/rooms/{pairId}/actions/level1_darkness`.

### C. Mechanika přenosu signálu
Když Sova klikne na navigační tlačítko, zapíše se akce do `actions/level1_darkness/lastSignal`.
Rysův klient na to okamžitě reaguje:
1. Uprostřed Rysovy obrazovky se přes celou plochu na 1.5 sekundy vykreslí velká poloprůhledná svítící šipka nebo symbol (🛑 / ⚠️).
2. Přehraje se krátký zvukový tón.

### D. Logika kolize a chybový stav
Pokud Rys stoupne na past (hodnota 2):
1. Pozice hráče se resetuje na startovní pozici.
2. Hodnota `resetCount` v DB se inkrementuje o 1.
3. Sově se na 3 sekundy zablokuje navigační pult.
4. Rysovi se zobrazí modal s chybou *„⚠️ Pád do pasti! Rys narazil na neviditelnou překážku a vrací se na začátek lesa.“*, který must potvrdit kliknutím na *„🏃 Rozumím, zkusit znovu“*.

---

## 4.3 Úroveň 2: Sdílené teplo (Střídání krystalu)

**Cíl:** Rozvoj ohleduplnosti a překonávání sobectví.

### A. Vizuální rozvržení (UI/UX)
- Obrazovka zobrazuje mrazivou krajinu a dva velké svislé ukazatele teploty: Teplo Sovy a Teplo Ryse (0-100 %).
- Každý hráč má u svého teploměru svítící štítek **„TY“** (modrý/oranžový) pro rychlou orientaci.
- Pokud hráč **nemá** krystal, má tlačítko **„Mrznu! Potřebuji teplo!“**.
- Pokud hráč **má** krystal, vidí pulzující tlačítko **„Předat krystal parťákovi“**.
- **Stav počasí (`#weather-status`):** Pod časomírou je zobrazen skleněný (glassmorphic) štítek indikující aktuální fázi klimatu a rychlost chladnutí. Mění se dynamicky s časem a barevně reaguje (modrá, žlutá, červená).
- **Pulzující neonová časomíra:** Od 80. sekundy (fáze Blizzard) se časomíra zvětší, zčervená a začne pulzovat.
- **Vstupní modal:** Před startem je nutné potvrdit instrukce kliknutím na *„👍 Přečetl jsem a rozumím“*.

### B. Teplotní mechanika a gradient (Zrychlující se úbytek tepla)
Pro zamezení matematické nemožnosti lineárního úbytku a vytvoření herního tlaku je klima rozděleno do tří fází:
1. **0. až 40. sekunda: ❄️ Mírný chlad**
   - Hráč bez krystalu mrzne rychlostí **-2 % za sekundu**.
   - Hráč s krystalem se zahřívá rychlostí **+4 % za sekundu** (netto zisk týmu +2 %/s).
   - *Cíl:* Stabilizace a naplnění ukazatelů teploty na maximum.
2. **40. až 80. sekunda: 💨 Silný mráz**
   - Hráč bez krystalu mrzne rychlostí **-4 % za sekundu**.
   - Hráč s krystalem se zahřívá rychlostí **+4 % za sekundu** (netto změna 0 %/s).
   - *Cíl:* Udržení rovnováhy teplot střídáním krystalu.
3. **80. až 120. sekunda: 🚨 BLIZZARD!**
   - Hráč bez krystalu mrzne rychlostí **-7 % za sekundu**.
   - Hráč s krystalem se zahřívá rychlostí **+5 % za sekundu** (netto úbytek týmu -2 %/s).
   - *Cíl:* Extrémně rychlé střídání, hráč bez krystalu zmrzne za cca 14 sekund.
- **Barevná animace:** Barva teploměru se dynamicky mění (interpoluje) od **červené** (100 %) přes **zelenou** (50 %) k **ledově modré** (0 %).
- Pokud teplota hráče klesne pod 30 %, celá obrazovka se zbarví do mrazivého nádechu.

### C. Signalizace a blikání
Pokud mrznoucí hráč klikne na *„Mrznu!“*, zapíše se signál do DB. Na obrazovce držitele krystalu:
1. Celé pozadí hry začne divoce blikat ledově modrou barvou.
2. Z vrchu obrazovky se plynule sesune červený varovný banner: **„🥶 PARŤÁK MRZNE! Rychle mu předej krystal!“**. Banner po 3.5 sekundách sám zmizí.

### D. Podmínky selhání a úspěchu
- **Úspěch:** Přežít synchronizované střídání krystalu po dobu **120 sekund**. Poté hra automaticky přepne stav na `level3`.
- **Selhání:** Pokud teplota kteréhokoliv z hráčů klesne na 0 %:
  1. Hra se zablokuje a na obrazovce obou hráčů se zobrazí velký modal **„Jeden z vás zmrzl!“**.
  2. Modal jasně vysvětluje, že došlo k restartu času na výchozích **120 sekund**.
  3. Hráči se vrátí do hry až po odsouhlasení tlačítkem *„👍 Rozumím, zkusit znovu“*.
  4. Hodnota `resetCount` v DB se zvýší a časovač se resetuje na startovní čas.

---

## 4.4 Úroveň 3: Skleněný most (Paměťová cesta)

**Cíl:** Rozpoznání chování a reakcí pod tlakem, vyzkoušení si role podporovatele vs. narušitele / škůdce.

### A. Vizuální rozvržení (UI/UX)
- **Hrací plocha:** Čtvercová šachovnice o velikosti **N x N** dlaždic (nastavitelná v administraci, např. 5x5).
- **Zadání (Náhled):** Na začátku levelu se na **T sekund** (např. 5s) oběma hráčům zobrazí hrací pole se zvýrazněním **K pochozích dlaždic** (např. 7). Pozice pochozích dlaždic jsou generovány náhodně. Po vypršení času T se zvýraznění skryje a dlaždice vypadají identicky.
- **Aktivní Hráč A:** Kliká na dlaždice a snaží se odhalit pochozí cestu. Správné dlaždice se zbarví zeleně, špatné dlaždice bliknou červeně a zresetují celý aktuální pokus. Má 3 pokusy.
- **Sledující Hráč B:** Sleduje pokrok parťáka v reálném čase. Má k dispozici ovládací pult s tlačítky pro odeslání reakcí:
  - **Průběžná podpora 👏:** Spustí na obrazovce aktivního hráče povzbuzující animaci (hvězdičky/srdíčka) a text (např. "Super! Jen tak dál!").
  - **Průběžný hate 😜:** Spustí rušivou animaci (chvění obrazovky, červenou mlhu) a text (např. "To nedáš!").
- **Finální reakce (👏 vs. 😂):** Na konci pokusů aktivního hráče (ať už úspěchu po označení všech K dlaždic, nebo neúspěchu po vyčerpání 3 pokusů) se hra pozastaví. Pasivnímu hráči se zobrazí povinný modal se dvěma velkými tlačítky: **👏 (Podpora)** a **😂 (Výsměch)**. Hra nepokračuje, dokud jednu možnost nezvolí. Tato volba se zaloguje a zobrazí aktivnímu hráči.

### B. Algoritmická logika a střídání rolí
1. Generuje se náhodně K dlaždic na poli N x N.
2. Aktivní hráč hledá dlaždice. Pokud uspěje, po finální reakci partnera hra přechází do Levelu 4.
3. Pokud aktivní hráč po 3 pokusech neuspěje, po finální reakci se role **obracejí**:
   - Generuje se **nové náhodné rozložení** K pochozích dlaždic na poli N x N.
   - Zobrazí se náhled na T sekund.
   - Hráč B se stává aktivním hledačem (má 3 pokusy).
   - Hráč A se stává sledujícím a může odesílat reakce.
   - Na konci pokusů Hráče B se aktivnímu Hráči A zobrazí povinná finální reakce, po jejímž odeslání hra pokračuje do Levelu 4.
4. Všechny kliky, průběžné interakce (podpory/haty), finální nucené reakce a úspěšnost (`success: true|false`) se ukládají a sčítají v databázi pod `actions/level3_bridge` pro vyhodnocení.

---

## 4.5 Úroveň 4: Kód pravdy (Dilema vězně a Brána pravdy)

**Cíl:** Rozvoj pravdomluvnosti, etického rozhodování, rozpoznání následků zrady vs. spolupráce a asymetrické spolupráce.

### A. Vizuální rozvržení (UI/UX)
- Zobrazuje se uzamčená kamenná brána s 5 prázdnými sloty pro výsledný kód (runové sloty, které po vyplnění svítí zlatě) a digitální klávesnicí na displeji.
- Každý hráč vidí v boxu **„Tvůj úlomek“** část kódu, zbytek je nahrazen pomlčkami.
- Pod ním jsou dvě tlačítka pro volbu sdílení:
  - `🟢 Odeslat pravdu` – Odešle partnerovi skutečný úlomek.
  - `🔴 Poslat lež` – Vygeneruje zfalšovaný kód (písmena se náhodně zamění, ale formát pomlček zůstane zachován) a odešle jej.
- V pravém boxu **„Úlomek parťáka“** svítí otazníky `???`, dokud parťák neprovede sdílení.

### B. Algoritmus sdílení a přímé zobrazení
1. Kód se generuje náhodně z povolených znaků `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
2. Sova vidí fragment složený z prvních dvou znaků (např. `AB---`), Rys vidí fragment s posledními třemi znaky (např. `--CDE`).
3. Po stisknutí jednoho z tlačítek se zapíše stav sdílení (`sovaShared` / `rysShared` = `true`), hodnota úlomku (skutečná/falešná) a status pravosti (`sovaShardStatus` / `rysShardStatus` = `'true'` / `'fake'`) do databáze pod `actions/level4_truth`.
4. Jakmile partner sdílí svůj úlomek, zobrazí se okamžitě a bez jakéhokoliv ověřování v boxu „Úlomek parťáka“.
5. Hráči nemají k dispozici žádný detektor lži ani dešifrování. Zda byl kód správný, zjistí až při pokusu o aktivaci brány. Pokud partner odeslal lež (podvrh), brána se neotevře, pokus se započítá jako neúspěšný a hráči musí komunikovat a vyjednávat.

### C. Ošetření chyb a limit pokusů
- Pokud hráč zadá nesprávný kód a odešle jej:
  - Vstupní pole zabliká červeně a celá sekce se otřese (`shake` animace).
  - V DB se inkrementuje hodnota `attempts` (pokusy).
- **Změna kódu:** Limit pokusů je **3**. Pokud je kód zadán 3krát chybně:
  - Kód se v databázi kompletně resetuje (vygenerují se nové úlomky).
  - Oběma hráčům se zobrazí modal **„Kód se změnil!“** vysvětlující situaci. Hráči musí znovu odeslat úlomky a provést testování.

### D. Vyhodnocení brány (Útěk a Uvěznění)
Při odeslání správného kódu brána vyhodnotí status hráče:
- Pokud hráč **sám poslal pravdu**, brána ho propustí a úspěšně uniká z lesa (`escaped`). Zobrazí se celoobrazovková karta úspěchu se zeleným zářícím tónem a symbolem `✨`.
- Pokud hráč **poslal lež (podvrh)**, brána jeho zradu odhalí, zablokuje se a uvězní ho v lese (`trapped`). Zobrazí se celoobrazovková karta s mříží, červeným tónem a symbolem `🔒`.

---

## 4.6 Modul Post-Game Reflection a Velké odhalení

Po dokončení brány oběma hráči se stav místnosti přepne do reflexe.

### A. Učitelská kontrola (Čekání)
Hráči po vstupu do reflexe vidí čekací obrazovku: **„Čekání na učitele, až odemkne fázi reflexe…“**. 
Teprve když učitel v administraci klikne na tlačítko *„Odemknout reflexi“*, klientské aplikace se přepnou do fáze odmaskování.

### B. Krok 1: Statistika a spuštění odmaskování
1. Zobrazí se statistická karta s informacemi o spolupráci (pády v L1, statistiky mostu v L3 – počet podpor/hatů a finální reakce, a pokusy v L4).
2. Hráč vidí, se kterým anonymním zvířetem hrál.
3. Kliknutím na tlačítko **„🔍 Odhalit skutečné jméno partnera“** se provede 3D otočení karty spolužáka a zasypání obrazovky konfetami.

### C. Krok 2: Vzkaz o bezpečí a Ocenění podpory
* **Ujištění o bezpečí:** V reflexní obrazovce se zobrazí výrazný rámeček s textem:
  > *„Ať už se během hry v Mlžném lese stalo cokoliv – ať už vám parťák poslal podporu, nebo se vám vysmál – pamatujte, že toto byla jen hra. Nyní jste zpátky v bezpečí své třídy, kde jste parťáci a můžete si o všem otevřeně popovídat.“*
* **Ocenění podpory:** Pokud si hráči navzájem poslali více podpor než hatů, zobrazí se speciální svítící status: **„Ocenění: Strážci souznění 🌟 – Dokázali jste se podpořit i v těžkých chvílích na mostě!“**

### D. Krok 3: Morální vyhodnocení na základě výsledků brány
Na základě kombinace stavů `escapedPlayers` se zobrazí barevný morální banner a na míru šitý citát:
1. **Společné vítězství (oba `escaped`):** Zelený banner `🟢 Společné vítězství!`. Hráči si věřili a oba unikli.
2. **Unikl jsi sám / Byl jsi uvězněn (jeden `escaped`, jeden `trapped`):** 
   - Pro uprchlíka: Modrý banner `⚡ Unikl jsi sám!`. Partner se pokusil o zradu, ale byl bránou polapen.
   - Pro zrádce: Oranžový banner `⚠️ Byl jsi uvězněn bránou!`. Pokusil se oklamat partnera a byl potrestán.
3. **Vzájemná zrada potrestána (oba `trapped`):** Tmavě červený banner `🚨 Vzájemná zrada potrestána!`. Oba se pokusili oklamat druhého, oba zůstali uvězněni.

### E. Krok 4: Závěrečný real-time chat
Po odmaskování a zobrazení morálních karet se odemkne chatovací místnost.
- Zprávy se synchronizují v reálném čase.
- Partnerovy zprávy jsou jasně nadepsány jeho **skutečným jménem**.
- Slouží k diskuzi o průběhu hry, sdílení pocitů a vysvětlení motivů chování na mostě a u brány.