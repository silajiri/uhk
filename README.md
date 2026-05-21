# PRD: Strážci světla – Kooperativní hra pro rozvoj třídního kolektivu

Krátké představení a cíle projektu — technické detaily najdete v `docs/architecture.md`.

https://silajiri.github.io/uhk/

## 1. Cíle projektu
*   **Hlavní cíl:** Vytvořit webovou hru pro žáky 4. a 5. třídy ZŠ (hranou na tabletech/noteboocích), která pomocí řízené anonymity a interaktivní reflexe pomůže narušit sociální předsudky ve třídě.
*   **Herní cíl:** Hráči působí jako anonymní Strážci světla (Sova a Rys) a zakouší důsledky důvěry, podpory a upřímnosti v asymetrickém prostředí, kde o sobě nevědí nic jiného než vzájemné chování.
*   **Pedagogický cíl (Integrovaná reflexe):** Hra má dvě hlavní fáze – Akci (anonymní spolupráce ve 3 úrovních) a Zpětný pohled (interaktivní odmaskování a společný real-time chat). Cílem je nejprve vytvořit anonymní zkušenost a poté vést žáky k tomu, aby na ni aplikovali svůj vlastní úsudek a očekávání.

## 2. Herní úrovně a struktura
Hra se skládá ze tří hlavních asymetrických úrovní a závěrečné reflexní fáze:
1.  **Level 1: Spolehnutí ve tmě** (Asymetrická navigace v náhodně generovaném bludišti se zdmi a pastmi – Sova naviguje, Rys slepě chodí podle zaslaných signálů).
2.  **Level 2: Sdílené teplo** (Společné střídání hřejivého krystalu po dobu 120 sekund; teplota nesmí klesnout na 0 %, jinak se čas resetuje a ukáže se varování).
3.  **Level 3: Kód pravdy** (Skládání 5místného kódu ze dvou oddělených úlomků, které si hráči musí zaslat. Při 3 chybách se kód změní).
4.  **Závěrečná reflexe** (Po schválení učitelem se zobrazí statistiky, otočením karty odhalí skutečné jméno parťáka a odemkne se volný real-time chat).

Podrobné chování a technické detaily jednotlivých úrovní najdete v [docs/GAME_MODULES_DEEP_DIVE.md](docs/GAME_MODULES_DEEP_DIVE.md).

## 3. Repo struktura
Krátký přehled klíčových adresářů a souborů:
- `index.html` – statické přihlášení přes Google Workspace.
- `game.html` – hlavní herní klient s navbar badge (role) a herní plochou.
- `admin.html` – učitelský dashboard pro matchmaking a monitoring.
- `database.rules.json` – Firebase security rules.
- `functions/` – Firebase Cloud Functions (Matchmaking `lookupMappingByEmail` a zápis dat `saveGameData` běžící v regionu `europe-west1`).
- `src/` – klientský JavaScript:
    - `src/app.js` – inicializace a update navbaru.
    - `src/auth.js` – přihlašovací proces a handshake s Cloud Function.
    - `src/game/` – logika hry (level1, level2, level3, router, reflexe a chat).
    - `src/admin/` – monitorování a nahrávání dat učitelem.
- `docs/` – dokumentace projektu:
    - [docs/architecture.md](docs/architecture.md) (technické specifikace a JSON schéma)
    - [docs/GAME_MODULES_DEEP_DIVE.md](docs/GAME_MODULES_DEEP_DIVE.md) (detailní průvodce herními levely a reflexí)
    - [docs/gotchas.md](docs/gotchas.md) (metodické pokyny – zákaz žebříčků, psychologické bezpečí, lichý počet žáků)
    - [docs/security.md](docs/security.md) (bezpečnostní zásady, přímé restrikce na RTDB)
