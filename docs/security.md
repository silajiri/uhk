# Bezpečnostní pokyny pro Strážce světla

## Hlavní zásada
Úplná mapovací tabulka Skutečné jméno <-> Zvíře nesmí být nikdy stažena do zařízení žáka. Partnerova identita se odhalí pouze po aktivaci reflexní fáze.

## Firebase Security Rules
- Zákaz čtení uzlu `mappings` pro běžné hráče.
- Zákaz čtení uzlu `profiles` pro běžné hráče (obsahuje skutečná jména).
- Matchmaking se provádí přes Cloud Function `lookupMappingByEmail`.
- **Přístup k místnosti:** Povoleno čtení a zápis do `/rooms/{roomId}` pouze pokud `auth.uid` odpovídá `uid1` nebo `uid2` uloženému v dané místnosti.
- Odemknutí reflexe se řídí `teacherControl/reflectionUnlocked`.
- `/mappings`, `/profiles` a `/questions` mohou být zapisovány **POUZE** administrátorem přes Cloud Function `saveGameData`.

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
