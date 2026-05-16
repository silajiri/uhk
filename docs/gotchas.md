# Gotchas — metodické poznámky a pravidla

Tento soubor obsahuje věci, které nejsou přímo v kódu, ale musí být dodržovány vývojovým týmem, učiteli a při nasazení. Umístěte sem pravidla, která by AI mohla jinak opomenout.

## 1. Žádné žebříčky
- Projekt nesmí zobrazovat globální žebříčky nebo "nejlepší" hráče. Jediné metriky jsou interní indexy v rámci anonymní dvojice (např. "Index společné důvěry").
- V UI, reportech a dashboardu nikdy neumožňujte porovnávání mezi studenty (žádné sorted leaderboards, no top-N exports).

## 2. Postup pro lichý počet žáků
- Hra nepřebírá zodpovědnost za dynamické přerozdělení v případě lichého počtu žáků.
- Řešení: asistentský režim (bot/učitelská dodávka) doplní chybějícího partnera. To musí být v admin postupu zdokumentováno a učitel o tom musí být informován.

## 3. Psychologické bezpečí
- Veškeré texty z reflexe musí být konstruovány tak, aby podporovaly pozitivní interakce.
- Nezobrazovat citlivé komentáře veřejně; anonymní vzkazy zůstávají anonymní a učitel by měl mít možnost je filtrovat.
- Vždy poskytnout konstruktivní vodítka pro reflexi, ne hodnocení.

## 4. Ochrana identity a přístup k údajům
- Mapovací tabulka (Skutečné jméno <-> Zvíře) nesmí být stáhnuta na klienta.
- Identita parťáka se odhaluje pouze po aktivaci reflexní fáze učitelem (`teacherControl/reflectionUnlocked`).
- **Avataři:** Každý žák má přiřazené ID avataru (např. `lion.svg`), který se načítá z lokálního adresáře `assets/avatars/`. Toto mapování je uloženo v `/profiles`.
- Matchmaking používá Google Workspace přihlášení a server-side Cloud Function `lookupMappingByEmail`.
- Klient nesmí číst `/mappings` přímo; místo toho se spouští volání na `https://us-central1-uhk-game.cloudfunctions.net/lookupMappingByEmail`.

## 5. Admin workflow (krátké instrukce)
- **Import profilů:** Učitel nahraje seznam třídy (formát: `email;jméno;avatar;zvíře`).
- **Tvorba párů:** Učitel definuje dvojice jednoduše pomocí jmen (formát: `Jméno1;Jméno2`).
- Při problému s konektivitou: učitel může v dashboardu přepnout místnost do režimu "paused" nebo restartovat místnost.
- Před odhalením identity musí učitel explicitně stisknout tlačítko "Spustit reflexi".

## 6. Bezpečnost a nasazení
- Žádné API klíče nebo `.env` soubory v repozitáři – použít systém tajemství CI/CD.
- Firebase Security Rules musí zakázat klientům čtení citlivých uzlů (`/mappings`).

---

Tento soubor by měl být snadno dostupný učitelům i vývojovému týmu. Pokud se pravidla změní, aktualizujte zde a informujte tým (commit + krátký changelog).