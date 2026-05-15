# Bezpečnostní pokyny pro Strážce světla

## Hlavní zásada
Úplná mapovací tabulka Skutečné jméno <-> Zvíře nesmí být nikdy stažena do zařízení žáka. Partnerova identita se odhalí pouze po aktivaci reflexní fáze.

## Firebase Security Rules
- Zákaz čtení uzlu `mappings` pro běžné hráče.
- Povoleno čtení pouze pro kontext místnosti, kde je daný hráč součástí.
- Odemknutí reflexe se řídí `teacherControl/reflectionUnlocked`.

## UI zásada
- Implementovat jasný stavový indikátor, pokud partner odpojí nebo dojde k přerušení sítě.
- Zobrazit text: "Parťák se odpojil, čekejte na návrat".
