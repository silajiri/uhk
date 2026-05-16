# PRD: Strážci světla – Kooperativní hra pro rozvoj třídního kolektivu

## 1. Cíle projektu
*   **Hlavní cíl:** Vytvořit webovou hru pro žáky 5. třídy ZŠ (hranou na tabletech/noteboocích), která pomocí řízené anonymity a interaktivní reflexe pomůže narušit sociální předsudky ve třídě.
*   **Herní cíl:** Hráči působí jako anonymní Strážci světla ve dvojicích a zakouší důsledky důvěry, podpory a upřímnosti v prostředí, kde o sobě nevědí nic jiného než vzájemné chování.
*   **Pedagogický cíl (Integrovaná reflexe):** Hra má dvě hlavní fáze – Akci (anonymní spolupráce) a Zpětný pohled (interaktivní odhalení). Cílem je nejprve vytvořit anonymní zkušenost a poté vést žáky k tomu, aby na ni aplikovali svůj vlastní úsudek a očekávání.

## 2. Architektura a Technologie
*   **Frontend:** Čisté HTML, CSS, Vanilla JavaScript. Prostředí musí být intuitivní a přizpůsobené pro dotykové ovládání na tabletech.
*   **Hosting:** GitHub Pages (statický web).
*   **Backend / Databáze:** Firebase Realtime Database (pro synchronizaci stavu hry v reálném čase, striktně modulární Web SDK verze 9/10).
*   **Systém identit (Zvířecí klíč):**
    * Žáci se nepřihlašují jmény, ale unikátními názvy zvířat (např. Vlk, Orel).
*   **Administrátorské rozhraní:** Webová stránka pro učitele, která je chráněná přístupem a umožňuje upravovat mapovací i párovací tabulku.
*   **Anonymní dvojice:** Žáci jsou automaticky párováni do anonymních dvojic. Systém propojuje zvířata do dvojic podle pevného klíče zadaného učitelem v admin panelu. Párování není náhodné, ale pevně definované. Na obrazovce vidí svůj stav jako "Hráč A" a "Hráč B" a skóre vzájemné důvěry, ale ne skutečné identity.

## 3. Datová struktura a Backend logika
Hra vyžaduje specifickou přípravu databáze před samotným spuštěním:
*   **Mapovací tabulka:** Databáze propojuje Skutečné jméno <-> Zvířecí přezdívka a přidružený avatar (např. Jan Novák = "Odvážný Sokol" + obrázek orla). Avatar pro přezdívku může být ikonický obrázek zvířete, který přispívá k anonymnímu hernímu zážitku. Skutečné jméno se převezme z přihlašovacího dialogu poskytnutého Google Workspace účtem.
*   **Párovací tabulka (Matchmaking):** Předem fixně definované dvojice (na základě sociometrie), které jsou přiřazeny do konkrétních herních místností (např. "Odvážný Sokol" a "Bystrá Liška" hrají vždy spolu v `room_01`).
*   **Action Log (Záznam historie):** Firebase musí v průběhu hry ukládat u každého hráče specifická rozhodnutí a indexy chování pro jednotlivé moduly: důvěra, podpora, sdílení informace, reakce na chybu a upřímnost.
*   **Závěrečné hodnocení:** Mapovací i párovací tabulky budou využity při generování závěrečného hodnocení a reflexe hry, protože spojují anonymní přezdívky se skutečnými rolemi a herními skupinami.
*   **Anonymní zpětné vazby:** Hráči mohou psát vzkazy svému parťákovi, které se později zobrazí jako anonymní "Třídní mapa upřímnosti".

## 4. Průběh aplikace (User Flow)
Hra je rozdělena do dvou fází, které spolu vytvářejí systém "Ozvěny rozhodnutí":
1.  **Fáze 1: Anonymní spolupráce (Akce)**
    *   Hráči plní úkoly ve dvojicích, neznají své skutečné identity a vidí pouze důvěru a herní symboly.
    *   Rozhodnutí se průběžně logují jako chování, které se později zhodnotí v reflexi.
    *   Modul "Tajemství": Hráč musí poslat kód a před odesláním odpoví na otázku "Věříš mu, že tě nepodrazí? (Ano/Ne)". Toto soukromé rozhodnutí se zobrazí až ve zpětném pohledu.
    *   Modul "Zastání se": Když parťák uvízne, hra nabídne možnost zachránit ho za cenu vlastní rychlosti. Rozhodnutí "Ano/Ne" se zaznamená.
    *   Modul "Výsměch vs. Podpora": Pokud parťák zkazí minihru, druhému hráči se objeví dvě ikony: 👏 (Podpora) a 😂 (Výsměch). Musí jednu vybrat, aby hra pokračovala.
2.  **Fáze 2: Integrovaná reflexe (Aha-moment)**
    *   Po dokončení hry se spustí interaktivní rekapitulace pro oba hráče.
    *   Krok A – "Co jsi o něm nevěděl": Hra ukáže konkrétní souhrn chování parťáka (např. kolikrát pomohl, kdy podržel a jak reagoval na chyby) a pak odhalí jeho skutečné jméno.
    *   Krok B – "Zrcadlo tvých pocitů": Hráči uvidí svá vlastní předchozí rozhodnutí (např. nedůvěru při sdílení kódu, volbu podpory) a musí reflektovat, co to znamená pro jejich očekávání a vztah.

## 5. Herní moduly a témata
Navržené moduly nahrazují klasické úrovně a podporují práci s otázkami důvěry, podpory a upřímnosti:
*   **Sdílení klíče** (Téma: Sdílení tajemství)
    *   Hráč A získá tajnou informaci (kód), kterou musí poslat Hráči B. B ji může použít pro společný postup, nebo ji zneužít pro vlastní zisk.
    *   Reflexe se ptá: "Jaké to bylo svěřit svůj kód někomu, koho nevidíš? Bál ses, že tě zneužije?"
*   **Obranný štít** (Téma: Zastání se druhého)
    *   Hráč A je zablokovaný nepřítelem a Hráč B se rozhoduje, zda ho osvobodí za cenu vlastní energie.
    *   Reflexe se ptá: "Zastane se mě parťák, i když ho to něco stojí?"
*   **Aréna chyb** (Téma: Pomoc při neúspěchu)
    * **Mechanika:** Modul probíhá striktně v rámci anonymní dvojice (peer-to-peer). 
    * **Průběh:** Hráč A plní náročnou minihru (postřeh/logika). Hráč B vidí pokrok parťáka v reálném čase. Pokud Hráč A udělá chybu, Hráči B se zobrazí volba: poslat anonymní **podporu** (přidá parťákovi čas/pokus) nebo **výsměch** (vizuální šum na obrazovce parťáka).
    * **Cíl:** Zjistit, zda mě parťák podrží, i když chybuji a on mě nevidí.
*   **Detektor lži** (Téma: Upřímnost)
    *   Na konci dvojice nahlásí, kolik pokladů našli. Pokud souhlasí, dostanou bonus; pokud jeden lže, oba jej ztratí.
    *   Reflexe se ptá: "Vyplatilo se nám být k sobě upřímní?"
* **Odmaskování** The Reveal (Aha-moment)modul*
    * **Individuální reflexe:** Hráč vidí rekapitulaci: "Tvůj parťák [Zvíře] ti 3x pomohl, sdílel s tebou kód a podržel tě v Aréně chyb."
    * **Odhalení:** Po kliknutí na tlačítko "Kdo byl můj strážce?" se ikona zvířete animací (např. otočením karty) změní na reálné jméno spolužáka z administrátorské tabulky.
    * **Personalizace:** Zobrazení textu: "Tento hráč ti věřil, i když tě neviděl. Byl to **[Jméno]**."

## 6. Fáze vývoje (Milníky pro AI asistenta)
*   **Krok 1: UI základ & Datový model** (Příprava HTML pro přihlášení a návrh JSON struktury pro Firebase mapovací tabulku a chování).
*   **Krok 2: Cílený Matchmaking** (Napojení na Firebase – přečtení přezdívky, automatické spárování do anonymních dvojic a přesměrování do správné `room`).
*   **Krok 3: Herní mechaniky & Logování** (Vytvoření herního rozhraní pro moduly Tajemství, Zastání se, Výsměch vs. Podpora a ukládání dat do databáze).
*   **Krok 4: Modul "Post-Game Reflection"** (Interaktivní rekapitulace, odkrytí identity, zrcadlení vlastních rozhodnutí a zobrazení anonymních vzkazů).


## 7. Metodické poznámky pro vývoj
* **Cílené párování:** Hra musí umožnit učiteli v admin panelu manuálně definovat dvojice (např. "Vlk" s "Orlem"), aby bylo možné propojit lídry s izolovanými žáky.
* **Absence žebříčků:** Systém nesmí zobrazovat globální pořadí "nejlepších" hráčů. Jediným měřítkem úspěchu je "Index společné důvěry" v rámci dvojice.
* **Psychologické bezpečí:** Veškerá textová zpětná vazba v rámci reflexe musí být konstruktivní a směřovat k budování vztahu po odhalení identity.