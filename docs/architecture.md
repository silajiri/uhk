# Architektura a technické specifikace

Tento dokument obsahuje technické detaily, které jsou specifické pro implementaci hry Strážci světla:

- Správa stavů místnosti a synchronizace
- Detailní JSON schéma databáze pro `rooms/{roomId}` a další uzly
- Firebase Security Rules a zabezpečení
- Administrátorské (teacher) rozhraní a řízení průběhu
- Matchmaking a přihlašovací flow

---

## A. State Management a synchronizace

Firebase Realtime Database je jediným zdrojem pravdy pro aktuální stav místnosti a herní pozice.

Stavy místnosti (`state`):
- `level1` – asymetrická navigace v temném lese (Sova naviguje, Rys se slepě pohybuje)
- `level2` – sdílení krystalu tepla po dobu 120s
- `level3` – zadání 5místné brány pravdy ze sdílených úlomků
- `reflection` – závěrečná reflexe a real-time chat po odmaskování

Klientská logika:
- **Matchmaking:** Probíhá přes Google Workspace přihlášení. Klientský kód zavolá HTTPS Cloud Function `lookupMappingByEmail` na `https://europe-west1-uhk-game.cloudfunctions.net/lookupMappingByEmail`. Funkce bezpečně dohledá e-mail ve `/profiles` a `/mappings` a vrátí payload s `pairId`, zvířetem (`animal`), rolí (`player1`/`player2`), avatarem a skutečným jménem.
- **Připojení (Presence):** Klient se zapíše na `/rooms/{pairId}/players/animal1` (Sova) nebo `animal2` (Rys) jako `status: "online"` a `lastSeen: serverTimestamp()`.
- **Zpracování odpojení:** Při zavření prohlížeče se přes `.onDisconnect()` automaticky změní status na `offline`. Druhý hráč na to může reagovat upozorněním na obrazovce.
- **Navbar a role:** Navbar v klientském rozhraní se dynamicky aktualizuje podle role (Sova / Rys) s barevně odlišeným svítícím ohraničením avataru podle role.

---

## B. Detailní schéma databáze

Skutečné rozvržení Realtime Database:

```json
{
  "mappings": {
    "jan,novak_at_skola,cz": {
      "email": "jan.novak@skola.cz",
      "animal": "Sova",
      "pairId": "pair_1716260000_1",
      "role": "player1"
    },
    "petr,svoboda_at_skola,cz": {
      "email": "petr.svoboda@skola.cz",
      "animal": "Rys",
      "pairId": "pair_1716260000_1",
      "role": "player2"
    }
  },
  "profiles": {
    "jan,novak_at_skola,cz": {
      "name": "Jan Novák",
      "avatar": "lion.svg",
      "animal": "Sova"
    },
    "petr,svoboda_at_skola,cz": {
      "name": "Petr Svoboda",
      "avatar": "elephant.svg",
      "animal": "Rys"
    }
  },
  "questions": [],
  "rooms": {
    "pair_1716260000_1": {
      "state": "level1" | "level2" | "level3" | "reflection",
      "playerPosition": {
        "x": 0,
        "y": 0
      },
      "players": {
        "animal1": {
          "animal": "Sova",
          "status": "online" | "offline",
          "lastSeen": 1716260005000,
          "uid": "UID-SOVA",
          "email": "jan.novak@skola.cz"
        },
        "animal2": {
          "animal": "Rys",
          "status": "online" | "offline",
          "lastSeen": 1716260006000,
          "uid": "UID-RYS",
          "email": "petr.svoboda@skola.cz"
        }
      },
      "identities": {
        "animal1": {
          "name": "Jan Novák",
          "avatar": "lion.svg"
        },
        "animal2": {
          "name": "Petr Svoboda",
          "avatar": "elephant.svg"
        }
      },
      "actions": {
        "level1_darkness": {
          "map": [
            [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 2, 0, 1, 0, 0, 0, 0]
          ],
          "startPos": { "x": 0, "y": 0 },
          "goalPos": { "x": 9, "y": 9 },
          "lastSignal": {
            "type": "UP" | "DOWN" | "LEFT" | "RIGHT" | "STOP" | "TRAP",
            "count": 1,
            "timestamp": 1716260010000
          },
          "collision": {
            "message": "⚠️ Pád do pasti!...",
            "timestamp": 1716260012000
          },
          "resetCount": 0
        },
        "level2_warmth": {
          "crystalHolder": "player1" | "player2",
          "temperatures": {
            "player1": 100,
            "player2": 100
          },
          "startTime": 1716260050000,
          "resetCount": 0,
          "signal": "FREEZING" | null
        },
        "level3_truth": {
          "fullCode": "A7X9K",
          "sovaFragment": "A7---",
          "rysFragment": "--X9K",
          "sovaShared": true,
          "rysShared": true,
          "attempts": 0
        }
      },
      "teacherControl": {
        "reflectionUnlocked": false
      },
      "reflectionChat": {
        "-O123456789abcdef": {
          "sender": "player1" | "player2",
          "text": "Ahoj, skvělá spolupráce!",
          "timestamp": 1716260100000
        }
      }
    }
  }
}
```

---

## C. Firebase Security Rules – Bezpečnostní nastavení

Zajišťují, že běžní žáci nemohou zjistit identitu svého partnera předčasně ani číst profily ostatních žáků:
1. Uzly `/mappings` a `/profiles` jsou čitelné a zapisovatelné výhradně administrativními účty přes Cloud Function.
2. Uzel `/questions` je čitelný pro všechny přihlášené uživatele.
3. Uzel `/rooms` je globálně čitelný a zapisovatelný pouze specifikovaným administrátorským e-mailům (např. `sila.jiri@gmail.com`, `tereza.silova@zsjrk.cz`).
4. Uzel `/rooms/$roomId` je čitelný a zapisovatelný pouze přihlášeným uživatelům, jejichž UID souhlasí s `players/animal1/uid` nebo `players/animal2/uid` v této místnosti (nebo pokud místnost ještě neexistuje).

---

## D. Průběh hry a Levely

### Level 1: Spolehnutí ve tmě
- **Téma:** Důvěra a navigace.
- **Asymetrie:** Sova vidí mapu s překážkami (1) a pastmi (2) a posílá navigační signály. Rys se pohybuje v černé mřížce poslepu na základě velkých overlay šipek na displeji.
- **Reset:** Vstup na past Rysa přemístí zpět na start, inkrementuje `resetCount` a na chvíli zablokuje pult Sovy.

### Level 2: Sdílené teplo
- **Téma:** Ohleduplnost a střídání zdrojů.
- **Asymetrie:** Pouze držitel krystalu se zahřívá (+2%/s), druhý mrzne (-4%/s). Musí si krystal střídat.
- **Nouzový signál:** Ne-držitel může vyslat signál "Mrznu!", který vyvolá červený slide-down banner na obrazovce držitele.
- **Upozornění na selhání:** Pád teploty jednoho z nich na 0 % vyvolá celoobrazovkový modal "Jeden z vás zmrzl!" oznamující restart přežití zpět na začátek (120 sekund).

### Level 3: Kód pravdy
- **Téma:** Pravdomluvnost a sdílení informací.
- **Asymetrie:** Sova vidí první 2 znaky 5místného kódu, Rys poslední 3 znaky. Každý musí odeslat svůj úlomek druhému.
- **Zámek:** Po 3 neúspěšných pokusech o složení kódu se kód a úlomky v RTDB změní a hráčům se zobrazí modal "Kód se změnil!".

### Fáze reflexe (Post-Game)
- **Čekání:** Hráči čekají, dokud učitel na monitoringu neklikne na "Odemknout reflexi" (nastaví `teacherControl/reflectionUnlocked: true`).
- **Odmaskování:** Statistický přehled o spáchaných chybách (resetLevel1, attemptsLevel3), stisknutí tlačítka pro odhalení parťáka a CSS 3D otočení karty odkrývající partnerovo skutečné jméno a avatar.
- **Závěrečný chat:** Odemčení real-time chatovací bubliny (`reflectionChat`), kde si spolužáci mohou vyměnit zprávy, s viditelnými skutečnými jmény nad zprávami.

---

## E. Administrátorské rozhraní (Teacher Dashboard)

Učitelské UI (`admin.html`) slouží pro přípravu a živý monitoring:
1. **Import dat:** Umožňuje importovat profily studentů a definovat pevné dvojice studentů. Ukládá data do `/profiles` a `/mappings` přes zabezpečené Cloud Function endpointy.
2. **Live Monitoring:** Zobrazuje v reálném čase tabulku všech vytvořených místností, jejich stav online/offline (podle presence zvířat) a aktuální herní fázi (Level 1, 2, 3, a Reflexe).
3. **Globální řízení:** Tlačítko pro odemčení reflexe, které uvolní skutečná jména pro všechny místnosti naráz.
4. **Manuální restart:** Možnost restartovat konkrétní místnost v případě chyb nebo odpojení žáků.