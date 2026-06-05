# PRD: Strážci světla – Kooperativní hra pro rozvoj třídního kolektivu

## 1. Cíle projektu
*   **Hlavní cíl:** Vytvořit webovou hru pro žáky 4. a 5. třídy ZŠ (hranou na tabletech/noteboocích), která pomocí řízené anonymity a interaktivní reflexe pomůže narušit sociální předsudky ve třídě.
*   **Herní cíl:** Hráči působí jako anonymní Strážci světla (ve dvojicích Sova a Rys) a zakouší důsledky důvěry, podpory a upřímnosti v asymetrických úlohách, kde o sobě nevědí nic jiného než vzájemné chování.
*   **Pedagogický cíl (Integrovaná reflexe):** Hra má dvě hlavní fáze – Akci (anonymní spolupráce ve 4 úrovních) a Zpětný pohled (interaktivní odhalení a real-time chat). Cílem je nejprve vytvořit anonymní zkušenost a poté vést žáky k tomu, aby na ni aplikovali svůj vlastní úsudek a očekávání.
*   **Bezpečí a podpora:** V závěrečné reflexi je kladen silný důraz na psychologické bezpečí třídy a ocenění vzájemné podpory žáků.

## 2. Architektura a Technologie
*   **Frontend:** Čisté HTML, CSS, Vanilla JavaScript. Upraveno pro tablety a pomalu čtoucí žáky (velké texty, vyžadováno explicitní potvrzení instrukcí a chybových stavů).
*   **Hosting:** GitHub Pages (statický web).
*   **Backend / Databáze:** Firebase Realtime Database (pro synchronizaci stavu hry a pozic v reálném čase, Web SDK verze 11).
*   **Systém identit (Zvířecí přezdívky):**
    * Žáci se nepřihlašují jmény, ale vystupují pod zvířecími rolemi (Sova jako player1, Rys jako player2).
*   **Zobrazení rolí:** Role jsou jasně zobrazeny v horním topbaru (`Role: SOVA` / `Role: RYS`) včetně svítícího lemu avataru (modrý lem pro Sovu, oranžový pro Rysa) a na teploměrech.
*   **Anonymní dvojice:** Žáci jsou automaticky párováni do anonymních dvojic podle pevného klíče zadaného učitelem v admin panelu.

## 3. Datová struktura a Matchmaking
*   **Mapovací a Profilová tabulka:** V databázi je uloženo propojení: e-mail -> přezdívka/role a e-mail -> skutečné jméno/avatar. Skutečné jméno je převzato z Google Workspace účtu.
*   **Matchmaking (Cloud Function):** Klient nečte tabulky napřímo z důvodu bezpečnosti. Volá HTTPS Cloud Function `lookupMappingByEmail` nasazenou v regionu `europe-west1`. Ta ověří e-mail a vrátí pairId, zvíře, roli, skutečné jméno a avatar.
*   **Bezpečnostní pravidla (Security Rules):** Přísně omezují čtení profilů a mapování. Klientský zápis je povolen pouze do vlastní místnosti `/rooms/{roomId}`.

## 4. Uživatelský průchod (User Flow)
Hra je rozdělena do dvou fází:
1.  **Fáze 1: Anonymní spolupráce (Akce)**
    *   Hráči plní 4 asymetrické úrovně, neznají své skutečné identity a vidí se pouze jako „Sova“ a „Rys“.
    *   Všechny herní akce (pohyby, signály, střídání krystalů, kliky na dlaždice, podpora/hate) se synchronizují v reálném čase a logují.
    *   **Zákaz odhlášení:** Pro zajištění plynulosti a zamezení rozpadu dvojic během hry bylo odstraněno tlačítko pro odhlášení z klientského rozhraní.
2.  **Fáze 2: Integrovaná reflexe (Aha-moment)**
    *   Po úspěšném splnění všech úrovní čekají žáci na uvolnění reflexe učitelem.
    *   Zobrazí se přehled statistik (počet pádů v Levelu 1, pokusů v Levelu 3 a 4).
    *   Ujištění o bezpečí třídy a případné ocenění za podporu na mostě.
    *   Kliknutím na tlačítko se animací 3D otočení karty odhalí skutečné jméno spolužáka a jeho avatar s textem *„Tento hráč ti věřil, i když tě neviděl.“*
    *   Otevře se **volný real-time chat**, kde si žáci mohou vyměnit pocity a poděkovat si.

## 5. Herní úrovně

*   **Level 1: Spolehnutí ve tmě** (Téma: Důvěra a přebírání odpovědnosti)
    *   Mřížka 10x10 se generuje procedurálně (náhodný start, cíl s Manhattan vzdáleností >= 6, 24 zdí a 6 pastí s BFS validací cesty).
    *   Sova (Navigátor) vidí celou mapu lesa a navigační tlačítka v rozvržení šipek klávesnice. Rys (Slepý poutník) vidí jen tmu a svůj bod, pohybuje se šipkami na klávesnici na základě velkých blikajících signálů.
    *   Kolize s pastí vrátí Rysa na start, zablokuje Sovu a vyvolá na obrazovce Rysa modal o srážce vyžadující potvrzení.
*   **Level 2: Sdílené teplo** (Téma: Ohleduplnost a střídání zdrojů)
    *   Ukazatele tepla Sovy a Ryse klesají tomu, kdo nemá krystal (-4 %/s v druhé fázi), a rostou držiteli (+2 %/s). Barva se mění od červené přes zelenou po ledově modrou.
    *   Hráči si musí krystal střídat a přežít **120 sekund**.
    *   Mrznoucí hráč posílá signál „Mrznu!“, který držiteli krystalu zobrazí blikající varovný slide-down banner.
    *   Pokud teplota klesne na 0 %, level se resetuje a oběma se zobrazí velký modal o zmrznutí a resetu času zpět na 120s.
*   **Level 3: Skleněný most** (Téma: Podpora vs. Hate a chování pod tlakem)
    *   Čtvercová šachovnice N x N (výchozí 5x5, nastavitelná v administraci). Oběma se na T sekund ukáže náhodná cesta z K pochozích dlaždic.
    *   Aktivní hráč kliká a hledá pochozí dlaždice. Sledující hráč může posílat průběžnou podporu 👏 nebo hate 😜.
    *   Při chybě se pokus resetuje. Hráč má 3 pokusy. Na konci pokusů (ať už úspěchu, či neúspěchu) musí parťák povinně zvolit finální reakci (👏 nebo 😂), aby hra pokračovala.
    *   Pokud aktivní hráč po 3 pokusech neuspěje, role se prohodí na nově vygenerovaném mostě.
*   **Level 4: Kód pravdy** (Téma: Upřímnost a preciznost)
    *   Brána je uzamčena 5místným kódem. Sova vidí začátek (např. `AB---`), Rys konec (např. `--CDE`).
    *   Hráči si musí úlomky nasdílet tlačítkem přímého přenosu (lze poslat pravdu či lež), složit kód dohromady a zadat ho.
    *   Při 3 chybách se kód změní, úlomky se regenerují a zobrazí se modal o resetu. Propuštění/uvěznění závisí na poctivosti odeslaného úlomku.

## 6. Metodické poznámky pro vývoj
* **Cílené párování:** Učitel v admin panelu manuálně nahrává profilovou a párovací tabulku pro spojení lídrů s izolovaným žáky.
* **Absence žebříčků:** Hra nezobrazuje globální žebříčky ani neporovnává žáky mezi sebou. Jediným měřítkem je úspěšné zdolání překážek ve dvojici.
* **Potvrzování informací:** Kvůli pomalejšímu tempu čtení u mladších žáků (např. 4. třída) je důležité, aby se všechna klíčová hlášení (instrukce na začátku levelu, pád do pasti, zmrznutí, změna kódu) zobrazovala jako modální okna vyžadující aktivní potvrzení (např. tlačítkem „Přečetl jsem a rozumím“).