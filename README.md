# PRD: Strážci světla – Kooperativní hra pro rozvoj třídního kolektivu

Krátké představení a cíle projektu — technické detaily najdete v `docs/architecture.md`.

## 1. Cíle projektu
*   **Hlavní cíl:** Vytvořit webovou hru pro žáky 5. třídy ZŠ (hranou na tabletech/noteboocích), která pomocí řízené anonymity a interaktivní reflexe pomůže narušit sociální předsudky ve třídě.
*   **Herní cíl:** Hráči působí jako anonymní Strážci světla ve dvojicích a zakouší důsledky důvěry, podpory a upřímnosti v prostředí, kde o sobě nevědí nic jiného než vzájemné chování.
*   **Pedagogický cíl (Integrovaná reflexe):** Hra má dvě hlavní fáze – Akci (anonymní spolupráce) a Zpětný pohled (interaktivní odhalení). Cílem je nejprve vytvořit anonymní zkušenost a poté vést žáky k tomu, aby na ni aplikovali svůj vlastní úsudek a očekávání.

## 2. Fáze vývoje (Milníky pro AI asistenta)
*   **Krok 1: UI základ & Datový model** (Příprava HTML pro přihlášení a návrh JSON struktury pro Firebase mapovací tabulku a chování).
*   **Krok 2: Cílený Matchmaking** (Napojení na Firebase – přečtení přezdívky, automatické spárování do anonymních dvojic a přesměrování do správné `room`).
*   **Krok 3: Herní mechaniky & Logování** (Vytvoření herního rozhraní pro moduly Tajemství, Zastání se, Výsměch vs. Podpora a ukládání dat do databáze).
*   **Krok 4: Modul "Post-Game Reflection"** (Interaktivní rekapitulace, odkrytí identity, zrcadlení vlastních rozhodnutí a zobrazení anonymních vzkazů).

Pro podrobné technické specifikace (DB schéma, životní cyklus místnosti, Firebase rules, admin control a další) otevřete [docs/architecture.md](docs/architecture.md).

*   **Sokratovské dotazování (povinné pravidlo pro AI asistenta):** AI nesmí domýšlet řešení na základě vlastních předpokladů. Musí se zastavit a položit kontrolní otázku vždy, když nastane jedna z níže definovaných situací:
	1. **Neznalost implementace:** AI nemá dostatek technických údajů nebo konkrétních parametrů k tomu, aby spolehlivě implementovala požadavek (např. chybějící formát dat, nejasné API, neznámé knihovny). V takovém případě se AI zastaví a konkrétně se dotáže na chybějící technické informace.
	2. **Vícero výkladů zadání:** Zadání připouští více platných interpretací (např. nejednoznačné UX chování, nerozhodnuté okrajové případy nebo volby mezi různými algoritmy). AI se musí zastavit a nabídnout uživateli krátký výčet možných interpretací a zeptat se, kterou variantu preferuje.
	3. **Interní rozpor v zadání:** Zadání obsahuje vzájemně si odporující požadavky nebo cíle (např. současné požadavky na anonymitu i export identit). AI musí upozornit na rozpor, popsat jej a požádat o jeho vyjasnění.
	Zakázáno: doplňovat chybějící informace nebo dělat rozhodnutí místo uživatele na základě domněnek. Po zastavení položte jasnou, cílenou otázku, ne více hypotéz najednou.

## 3. Repo struktura
Krátký přehled klíčových adresářů a souborů:
- `public/` – statické HTML pro hru a administraci (`index.html`, `admin.html`).
- `src/` – klientský kód a styly (`app.js`, `src/game/`, `src/admin/`, `src/styles/`).
- `firebase/rules/` – Firebase security rules (`database.rules.json`).
- `docs/` – dokumentace projektu; důležité soubory:
	- `docs/architecture.md` (technické specifikace)
	- `docs/gotchas.md` (metodické poznámky a pravidla — např. "žádné žebříčky", postup pro lichý počet žáků, psychologické bezpečí)
- `tests/` – unit a e2e testy.