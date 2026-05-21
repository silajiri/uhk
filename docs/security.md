# Bezpečnostní pokyny pro Strážce světla

## Hlavní zásada
Úplná mapovací tabulka Skutečné jméno <-> Zvíře nesmí být nikdy stažena do zařízení žáka. Partnerova identita se odhalí pouze po aktivaci reflexní fáze.

## Firebase Security Rules
- Zákaz čtení uzlu `mappings` pro běžné hráče.
- Zákaz čtení uzlu `profiles` pro běžné hráče (obsahuje skutečná jména a avatary).
- Matchmaking se provádí přes Cloud Function `lookupMappingByEmail`.
- **Bezpečné předání identit pro odmaskování:** Vzhledem k tomu, že hráči nemohou napřímo číst z uzlu `/profiles`, na začátku fáze reflexe (`reflection.js`) zapíše každý klient své skutečné jméno a avatar do místnosti na cestu `/rooms/{roomId}/identities/{animal1|animal2}`. Partner si tyto informace může přečíst až poté, co učitel povolí reflexi a klient schválí odmaskování.
- **Přístup k místnosti:** Povoleno čtení a zápis do `/rooms/{roomId}` pouze pokud je uživatel autorizován a jeho UID je zapsáno v místnosti pod jedním ze zvířat (`players/animal1/uid` nebo `players/animal2/uid`).
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
