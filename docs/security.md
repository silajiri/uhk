# Bezpečnostní pokyny pro Strážce světla

## Hlavní zásada
Úplná mapovací tabulka Skutečné jméno <-> Zvíře nesmí být nikdy stažena do zařízení žáka. Partnerova identita se odhalí pouze po aktivaci reflexní fáze.

## Firebase Security Rules
- Zákaz čtení uzlu `mappings` pro běžné hráče.
- Matchmaking se provádí přes volatelnou Cloud Function `lookupMappingByEmail`; klient nikdy nečte uzel `/mappings` přímo.
- Povoleno čtení pouze pro kontext místnosti, kde je daný hráč součástí.
- Odemknutí reflexe se řídí `teacherControl/reflectionUnlocked`.
- `/mappings` a `/questions` mohou být zapisovány **POUZE** přes Cloud Function `saveGameData` (klienti: `.write: false`).

## Origin-based Access Control
Aby byly data chráněna před neoprávněným přístupem:
- Cloud Function `saveGameData` kontroluje `Origin` a `Referer` HTTP headers.
- Zápis do databáze je povolen POUZE z:
  - `https://silajiri.github.io` (produkce)
  - `http://localhost:*` (lokální vývoj)
- Pokusy ze všech ostatních domén jsou `403 Forbidden`.
- Admin emails v `functions/index.js` určují, kdo má právo admin operace provádět.

## UI zásada
- Implementovat jasný stavový indikátor, pokud partner odpojí nebo dojde k přerušení sítě.
- Zobrazit text: "Parťák se odpojil, čekejte na návrat".
