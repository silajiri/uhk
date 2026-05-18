# Dokumentace herních modulů: Strážci světla – Echo v Mlžném lese  
## Revize: Verze 2.0 – Absolutní anonymita (Beztextová komunikace)

Tento dokument definuje detailní logiku herních modulů pro 3 úrovně asymetrické kooperace a závěrečnou reflexi. Oproti verzi 1.0 je **zcela eliminován volný textový chat**. Komunikace mezi Hráčem A (Sova) a Hráčem B (Rys) je omezena na kontextová tlačítka, vizuální signály a systémové herní akce, což garantuje 100% ochranu anonymity.

\---

## 4.1 Obrazovky 1 a 2: Login, Autentizace a Čekárna

Tento modul zajišťuje bezpečný vstup do hry, kontrolu identity a anonymní propojení hráčů bez rizika úniku dat na straně klienta.

### A. Uživatelská zkušenost (UI/UX)  
- **Přihlašovací obrazovka (`#screen-login`):** Obsahuje minimalistický centrovaný formulář. Přihlášení hráče je řešeno v rámci jeho školního google účtu v Google Workspace for education. Žák by měl být přihlášen ve svém Chrome prohlížeči. Klikne na tlačítko **Přihlásit se**, načež bude zobrazeno přihlašovací formulář, kde zvolí svůj účet. Po přihlášení se jeho údaje porovnají s listem hráčů, který je veden v administraci hry. Pokud jeho email není nalezen, je mu odepřen přístup.
- **Čekárna (`#screen-waiting`):** Po úspěšném ověření se plynule skryje login a aktivuje se čekárna. Dominuje jí velká, esteticky zpracovaná ikona přiděleného zvířete (SVG grafika) a text: **„V této hře jsi \[Zvíře\]. Tvůj parťák tě uvidí pod touto identitou.“** Pod ním svítí pulzující status bar: **„Hledání parťáka...“**.

### B. Algoritmická logika a Firebase Handshake  
1. **Odeslání e-mailu:** Klientský JavaScript vezme zadaný e-mail, převede jej na malá písmena a provede sanitizaci (nahrazení teček čárkami a zavináče podtržítkem pro kompatibilitu s klíči Firebase: `jmeno.prijmeni@skola.cz` \-\> `jmeno,prijmeni\_at\_skola\_cz`).  
2. **Volání Cloud Function:** Klient odešle požadavek na HTTPS Cloud Function `lookupMappingByEmail(sanitizedEmail)`.  
3. **Odezva serveru:** Cloud Function provede bezpečné čtení z chráněného uzlu `/mappings/{sanitizedEmail}`. Klientovi vrátí payload:  
   ```json  
   {  
     "pairId": "room\_4B\_01",  
     "animal": "Sova",  
     "role": "Hráč A"  
   }
   ```
4. **Zápis přítomnosti (Presence):** Klient se následně připojí k Realtime Database na cestu /rooms/room\_4B\_01/players/animal1 (pokud je Hráč A) a zapíše svůj stav: status: "online", lastSeen: Firebase.ServerValue.TIMESTAMP.

### **C. Podmínky synchronizace a přechodu**

* Klientská aplikace v čekárně spustí aktivní listener (onValue) na uzel /rooms/{pairId}/players.  
* **Podmínka spuštění:** Jakmile players/animal1/status \=== "online" **A ZÁROVEŇ** players/animal2/status \=== "online", klientský skript automaticky přepne stav celé místnosti /rooms/{pairId}/state na "playing" a lokálně spustí funkci switchScreen('screen-game').

### **D. Ošetření mezních stavů (Edge Cases)**

* **Odpojení v čekárně:** Pokud jeden z žáků zavře prohlížeč nebo ztratí signál ještě v čekárně, Firebase uzel přes mechanizmus .onDisconnect() automaticky přepne jeho status na "offline". Druhému hráči se status bar okamžitě změní na *„Parťák se odpojil, čekám na opětovné připojení...“* a hra se nespustí.

## **4.2 Úroveň 1: Spolehnutí ve tmě (Navigace pomocí signálního panelu)**

**Cíl:** Rozvoj spolehlivosti a přebírání zodpovědnosti za zranitelného parťáka.

**Komunikační náhrada chatu:** Sova nepíše text, ale mačká směrové a stavové příkazy, které se Rysovi zobrazují jako velké blikající ikony uprostřed obrazovky doprovázené zvukovým tónem.

### **A. Vizuální rozvržení (UI/UX)**

* **Zobrazení u Hráče A (Sova \- Navigátor):** Vidí celou mřížku 10x10. Vidí pozici zdí, pastí, cíl \[9,9\] a zelený bod (Rys). Pravý panel obsahuje **Navigační pult** se 6 velkými tlačítky: \[↑ Vpřed\], \[↓ Vzad\], \[← Doleva\], \[→ Doprava\], \[STOP\!\], \[⚠️ Pozor, past\!\].  
* **Zobrazení u Hráče B (Rys \- Slepý poutník):** Vidí pouze černou mřížku a svůj svítící bílý bod. Nevidí zdi ani pasti. Nemá žádná navigační tlačítka. Pohybuje se pomocí hardwarových šipek klávesnice nebo dotykových gest na displeji. Pravý panel je prázdný (zobrazuje pouze velkou černou plochu „Mlžného lesa“).

### **B. Mechanika přenosu signálu**

Když Sova klikne na tlačítko na svém Navigačním pultu (např. \[→ Doprava\]), JavaScript provede bleskový zápis do Firebase:

```JavaScript
set(ref(db, `rooms/${pairId}/actions/level1\_darkness/lastSignal`), {  
    type: "RIGHT",  
    timestamp: Firebase.ServerValue.TIMESTAMP  
});
```

Rysův klient naslouchá uzlu lastSignal. Při detekci nové hodnoty:

1. Uprostřed Rysone obrazovky se přes celou plochu na 1.5 sekundy vykreslí velká poloprůhledná svítící šipka směřující doprava ➔.  
2. Přehraje se krátký, specifický zvukový tón (chime).  
3. Rys na základě tohoto vizuálního a zvukového pokynu stiskne šipku doprava na své klávesnici.

### **C. Logika pohybu a kolize**

* Rysův pohyb zapíše nové souřadnice do playerPosition v DB.  
* Pokud Rys stoupne na index mřížky, kde je definována past (2), spustí se **kolizní řetězec**:  
  * Hodnota resetCount v DB se zvýší o 1\.  
  * Oběma hráčům obrazovka zčervená.  
  * Sově se na 3 sekundy zablokuje Navigační pult.  
  * Rysovi se zobrazí ikona zlomeného srdce a velký nápis: *„Nezdařilo se. Sova tě vrací na začátek lesa. Zkuste to znovu a opatrněji.“*  
  * Pozice se v DB resetuje na \[0,0\].

## **4.3 Úroveň 2: Sdílené teplo (Koordinace nouzovými makry)**

**Cíl:** Rozvoj ohleduplnosti a potlačení bezohlednosti.

**Komunikační náhrada chatu:** Hráči komunikují výhradně prostřednictvím stavu svých „Teplotních barů“ (které vidí oba na obou obrazovkách) a dvou rychlých emotikonových tlačítek pro vyjádření tísně.

### **A. Vizuální rozvržení (UI/UX)**

* Mřížka mizí, obrazovka zobrazuje mrazivou krajinu.  
* Oba hráči vidí dva velké svislé ukazatele: Teplo Sovy a Teplo Ryse (0-100 %).  
* Pod ukazateli jsou pro hráče, který **nemá** krystal, dostupná dvě tlačítka rychlé emoce: \[🥶 Mrznu\!\] a \[🙏 Prosím teplo\].  
* Hráč, který krystal **má**, vidí pouze dominantní pulzující tlačítko \[💎 Předat krystal tepla parťákovi\].

### **B. Logika mrazu a interakce**

* Lokální časovač na obou zařízeních každých 1000 ms snižuje teplotu toho, kdo krystal nemá, o **\-4 %**. Držiteli teplo stoupá o **\+2 %**.  
* Pokud hráč bez krystalu klikne na \[🥶 Mrznu\!\], do uzlu rooms/{pairId}/actions/level2\_warmth/signal se zapíše hodnota "FREEZING".  
* Na obrazovce držitele krystalu začne celý okraj displeje divoce blikat ledově modrou barvou a tlačítko Předat krystal se zvětší o 20 % (vizuální urgence).  
* Žák držící krystal musí aktivně potlačit touhu si krystal nechat (sobectví) a kliknutím na tlačítko změnit hodnotu crystalHolder v DB.

### **C. Podmínka selhání a úspěchu**

* Pád kteréhokoliv baru na 0 % vyvolá 5sekundové zamrznutí obou obrazovek s hláškou: *„Chlad vás přemohl. Sledujte ukazatel tepla svého parťáka\!“*. Úroveň se resetuje.  
* Pokud dvojice přežije 60 sekund synchronizovaného střídání krystalu, přechází se do Levelu 3\.

## **4.4 Úroveň 3: Kód pravdy (Mechanické spojení úlomků)**

**Cíl:** Rozvoj pravdomluvnosti a eliminace dezinformací/lží.

**Komunikační náhrada chatu:** Úplný zákaz textového předávání fragmentů. Kód nelze nikam napsat. Hráči musí použít herní mechaniku „Odeslání energetického úlomku“.

### **A. Vizuální rozvržení (UI/UX)**

* Na obrazovce je uzamčená brána a na ní pět volných slotů pro výsledný kód.  
* **Sova** vidí na své kamenné desce: Tvůj úlomek: A7---. Pod ním je jediné tlačítko: \[⚡ Odeslat úlomek parťákovi\].  
* **Rys** vidí na své kamenné desce: Tvůj úlomek: \--X9K. Pod ním je jediné tlačítko: \[⚡ Odeslat úlomek parťákovi\].  
* Pod touto sekcí mají oba hráči shodné rozhraní: 5 prázdných políček a digitální klávesnici (A-Z, 0-9) pro zadání finálního kódu.

### **B. Algoritmus bezpečného sdílení kódu**

Aby žáci nemohli kód nijak zkreslit, mechanika funguje jako přímý datový přenos, který však vyžaduje **aktivní rozhodnutí (důvěru) úlomek sdílet**:

1. Sova klikne na \[⚡ Odeslat úlomek parťákovi\].  
2. V DB se v uzlu level3\_truth/sovaShared změní hodnota na true.  
3. Rysovi se na obrazovce animací (přílet světelného bodu) odemkne vizuální pole, kde se zobrazí: *„Úlomek od Sovy: A7“*.  
4. Rys udělá totéž $\\rightarrow$ Sově se zobrazí: *„Úlomek od Ryse: X9K“*.  
5. V tuto chvíli mají oba hráči na svých obrazovkách kompletní pravdivé informace: Sova ví, že její část je A7 a parťákova X9K. Rys ví totéž.  
6. Oba musí na své digitální klávesnici manuálně naťukat spojený kód A7X9K.

### **C. Ošetření chyb a validace**

Pokud žák zadá kód špatně (např. splete pořadí znaků):

* V DB se inkrementuje attempts.  
* Celá brána se otřese a pole zčervená.  
* Zobrazí se systémová zpráva: *„Kód je neplatný. Spojte úlomky přesně tak, jak vám byly doručeny. Pravda je jediný klíč.“*  
* Při úspěšném zadání oběma hráči se místnost přepne do stavu phase: "waiting\_for\_teacher\_reflection".

## **4.5 Modul Post-Game Reflection a Velké odhalení**

Tento modul zůstává technicky nejcitlivější částí aplikace. Striktně blokuje načtení reálných jmen až do okamžiku schválení učitelem.

### **A. Fáze 1: Anonymní hodnocení parťáka**

Po úspěšném otevření brány se okamžitě aktivuje #screen-reflection. Vzhledem k zákazu chatu je i zpětná vazba strukturovaná pomocí hodnotících prvků, které znemožňují napsat identifikační údaje:

1. **Posuvník 1 (Důvěra):** *„Jak moc ses mohl/a na parťáka spolehnout při navigaci a předávání tepla?“* (Škála 1-10).  
2. **Posuvník 2 (Bezpečí):** *„Cítil/a ses bezpečně, i když jsi v lese nic neviděl/a?“* (Škála 1-10).  
3. **Výběr komplimentu (Makra):** Žák nemůže psát volný text. Vybírá ze seznamu 3 předdefinované oceňující vzkazy (může zaškrtnout i všechny):  
   * \[ \] Můj parťák byl neuvěřitelně trpělivý a nenechal mě padnout.  
   * \[ \] Myslel na moje bezpečí a spolehlivě mi předával teplo.  
   * \[ \] Jednal naprosto férově a poslal mi správný kód.

### **B. Fáze 2: Blokování a Učitelský impuls**

* Po kliknutí na „Odeslat reflexi“ se data uloží do uzlu /reflection/{animal}.  
* Klient přejde do stavu rigidního čekání. Na obrazovce svítí: *„Tvoje hodnocení bylo odesláno. Odlož tablet a vyčkej v kruhu na pokyn učitele.“*  
* Klient má spuštěný přísný listener na uzel teacherControl/reflectionUnlocked.

### **C. Fáze 3: Aha moment (Otočení karty)**

1. Učitel na svém centrálním panelu vidí, že 4.B dokončila reflexe. Spustí diskuzi v kruhu o zvířatech.  
2. Učitel stiskne tlačítko na svém PC $\\rightarrow$ v DB se přepne teacherControl/reflectionUnlocked na true.  
3. Klientský JavaScript zachytí tento impuls. **Teprve v této vteřině** provede jednorázové bezpečné stažení jména partnera z uzlu /profiles/{partnerEmail}/name.  
4. Na obrazovce žáka začne pulzovat karta s ikonou zvířete. Žák na ni klikne.  
5. Spustí se hardwarově akcelerovaná CSS 3D animace:  
   CSS  
   .reveal-card-lock.unlocked .card-flip-inner { transform: rotateY(180deg); }

6. Karta se otočí a odhalí reálné jméno. Žák prožije klíčový pedagogický moment: zjišťuje, že ten 100% spolehlivý, trpělivý a ohleduplný zachránce je spolužák, kterého v lavici považoval za nespolehlivého lháře.