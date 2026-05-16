# Architektura a technické specifikace

Tento dokument obsahuje technické detaily, které jsou příliš rozsáhlé pro hlavní `README.md`:

- Správa stavů místnosti a synchronizace (heartbeat, reconnect)
- Detailní JSON schéma databáze pro `rooms/{roomId}`
- Požadavky na Firebase Security Rules
- Administrátorské (teacher) rozhraní a řízení průběhu

Poznámka: Pro přehlednější PRD zůstává v `README.md` pouze stručné představení a milníky vývoje. Kompletní technické požadavky jsou zde.

## A. State Management a synchronizace

Zásada: Firebase Realtime Database je jediným zdrojem pravdy pro aktuální stav místnosti.

Stavy místnosti (příklad):
- `waiting` – čekání na oba hráče
- `playing` – oba hráči jsou připojeni a hra probíhá
- `reflection_started` – reflexní fáze odemčena učitelem
- `finished` – hra dokončena

Klientská logika:
- **Matchmaking:** Probíhá na základě e-mailu žáka. Po přihlášení volá klient Cloud Function `lookupMappingByEmail`, která vrátí `pairId` a přiřazené zvíře (`animal`).
- **Připojení:** Hráč se připojuje do Realtime Database na cestu `/rooms/{pairId}`. První připojený nastavuje `player1` a `uid1`, druhý `player2` a `uid2`.
- **Heartbeat:** Klient periodicky (každých 5 s) aktualizuje svůj stav v místnosti pro detekci odpojení partnera.
- Při reconnectu klient načte aktuální stav z `/rooms/{roomId}` a obnoví UI do odpovídající fáze.
- UI musí podporovat zobrazení stavu partnera (online/offline/disconnected) a jasnou hlášku: "Parťák se odpojil, čekejte na návrat".

## B. Detailní schéma databáze

Navržená struktura (příklad):
```
/rooms/{roomId}/
	state: "waiting" | "module_secret_active" | "module_help_active" | "module_support_active" | "reflection_started" | "finished"
	currentModule: "secret" | "help" | "support" | "lie_detector"
	phase: "action" | "reflection"
	players:
		animal1:
			uid: "user-123"
			status: "online" | "offline" | "disconnected"
			lastSeen: 1680000000000
			currentRole: "Hráč A"
		animal2:
			uid: "user-456"
			status: "online" | "offline" | "disconnected"
			lastSeen: 1680000005000
			currentRole: "Hráč B"
	actions:
		secret:
			animal1:
				trust: true
				timestamp: 1680000100000
			animal2:
				trust: false
				timestamp: 1680000105000
		help:
			animal1:
				supported: false
				timestamp: 1680000200000
		support:
			animal2:
				reaction: "encourage"  # nebo "mock"
				timestamp: 1680000300000
		lie_detector:
			animal1:
				declaredTreasure: 4
			animal2:
				declaredTreasure: 4
			matched: true
	presence:
		animal1: true
		animal2: false
	teacherControl:
		reflectionUnlocked: false
		lastPhaseAdvance: 1680000000000
```

Poznámky ke schématu:
- `actions` ukládejte atomicky pod module-uzly, aby byly snadno dotazovatelné při generování reflexe.
- `presence` a `players/*/status` slouží k rychlému zobrazení online stavů v dashboardu.

## D. Průběh aplikace a herní moduly

### Průběh aplikace (User Flow)

Hra je rozdělena do dvou fází, které společně vytvářejí systém "Ozvěny rozhodnutí":

- **Fáze 1: Anonymní spolupráce (Akce)**
  - Hráči plní úkoly ve dvojicích, neznají své skutečné identity a vidí pouze důvěru a herní symboly.
  - Rozhodnutí se průběžně logují jako chování, které se později zhodnotí v reflexi.
  - Modul "Tajemství": hráč musí poslat kód a před odesláním odpovědět na otázku "Věříš mu, že tě nepodrazí? (Ano/Ne)". Toto rozhodnutí se zobrazí až ve zpětném pohledu.
  - Modul "Zastání se": když parťák uvízne, hra nabídne možnost ho zachránit za cenu vlastní rychlosti. Volba Ano/Ne se zaznamená.
  - Modul "Výsměch vs. Podpora": pokud parťák zkazí minihru, druhému hráči se objeví ikony 👏 (Podpora) a 😂 (Výsměch). Musí jednu vybrat, aby hra pokračovala.

- **Fáze 2: Integrovaná reflexe (Aha-moment)**
  - Po dokončení hry se spustí interaktivní rekapitulace pro oba hráče.
  - Krok A – "Co jsi o něm nevěděl": zobrazí se souhrn chování parťáka (např. kolikrát pomohl, kdy podržel a jak reagoval na chyby) a následně jeho skutečné jméno.
  - Krok B – "Zrcadlo tvých pocitů": hráči uvidí svá vlastní předchozí rozhodnutí a musí reflektovat, co to znamená pro jejich očekávání a vztah.

### Herní moduly a témata

Navržené moduly nahrazují klasické úrovně a podporují práci s otázkami důvěry, podpory a upřímnosti:

- **Sdílení klíče** (Téma: Sdílení tajemství)
  - Hráč A získá tajnou informaci (kód), kterou musí poslat Hráči B. B ji může použít pro společný postup, nebo ji zneužít pro vlastní zisk.
  - Reflexe se ptá: "Jaké to bylo svěřit svůj kód někomu, koho nevidíš? Bál ses, že tě zneužije?"

- **Obranný štít** (Téma: Zastání se druhého)
  - Hráč A je zablokovaný nepřítelem a Hráč B se rozhoduje, zda ho osvobodí za cenu vlastní energie.
  - Reflexe se ptá: "Zastane se mě parťák, i když ho to něco stojí?"

- **Aréna chyb** (Téma: Pomoc při neúspěchu)
  - Modul probíhá v anonymní dvojici. Hráč A plní náročnou minihru; Hráč B vidí pokrok parťáka a volí anonymní podporu nebo výsměch.
  - Cíl: zjistit, zda parťák podrží druhého i v případě chyby.

- **Detektor lži** (Téma: Upřímnost)
  - Na konci dvojice hráči nahlásí, kolik pokladů našli. Pokud souhlasí, dostanou bonus; pokud jeden lže, oba jej ztratí.
  - Reflexe se ptá: "Vyplatilo se nám být k sobě upřímní?"

- **Odmaskování (The Reveal)**
  - Individuální reflexe: hráč vidí, jak se jeho parťák choval během hry, a poté klikne na tlačítko, aby odhalil jeho skutečné jméno.
  - V textu je důraz na pozitivní závěrečné sdělení: "Tento hráč ti věřil, i když tě neviděl." 

## C. Firebase Security Rules – doporučení

Hlavní pravidla:
- Mapovací tabulka (`/mappings`) nesmí být čitelná běžným hráčům (`.read: false`).
- Matchmaking se provádí přes volatelnou Cloud Function `lookupMappingByEmail`; klient nikdy nečte uzel `/mappings` přímo.
- Klient smí číst pouze uzel `/rooms/{roomId}` když je uživatel součástí této místnosti.
- Odemknutí reflexe (přístup ke skutečným identitám) se řídí hodnotou `teacherControl/reflectionUnlocked` a čtení identity je povoleno až po jejím nastavení učitelem.

Příklad výňatku pravidel (koncept):
```
{"rules": {
	"rooms": {
		"$roomId": {
			".read": "auth != null && data.child('players').hasChild(auth.uid)",
			".write": "auth != null && data.child('players').hasChild(auth.uid)"
		}
	},
	"mappings": { ".read": false, ".write": false }
}}
```

Poznámka: výše je koncept – bezpečnostní pravidla nutno upravit podle přesného modelu autentizace a teacher-rolí.

## G. Google Workspace přihlášení a server-side matchmaking

Matchmaking je implementován jako bezpečná volatelná Cloud Function.
- Volatelná funkce: `lookupMappingByEmail`
- Nasazeno na: `https://us-central1-uhk-game.cloudfunctions.net/lookupMappingByEmail`
- Klient se přihlásí přes Google Workspace účet (Firebase Auth), získá autorizovaný token a pošle své e-mailové jméno do funkce.
- Funkce načte `mappings/{encodedEmail}` z Realtime Database a vrátí pairing metadata včetně `pairId`.
- Klient použije `pairId` k připojení do pevně definované `rooms/{pairId}` místnosti.
- E-mailové klíče v DB jsou enkódovány tak, že `.` jsou nahrazeny čárkami `,`.

Tento přístup zajistí, že:
- Klient nečte přímo citlivou mapovací tabulku `/mappings`.
- Uživatelé i administrátor používají svůj Google Workspace účet.
- Mapovací tabulka obsahuje explicitní páry `email -> pairId`, takže párování není náhodné.

## H. Administrátorské rozhraní (Master Control)

Požadavky pro učitelské UI:
- Editace `mappings` a `matchings` (mapovací a párovací tabulky) – pouze pro ověřené učitele.
- Tlačítko **Spustit další fázi** (global phase advance): učitel může jedním klikem odemknout `reflectionStarted`/`reflectionUnlocked` pro všechny místnosti, čímž se zabrání předčasnému odhalení identity.
- Live Monitoring: seznam místností, stav, online/offline přehled, upozornění na offline hráče a možnost manuálního restartu místnosti.

## E. Řešení lichého počtu žáků

Poznámka: Lichý počet žáků se vyřeší na úrovni orchestrace (asistent systému nebo bot). Hra nepřidává logiku pro dynamické přerozdělování během běhu.

## F. UI a připojení (UX)

- UI musí jasně indikovat technické stavy: reconnecting, partner disconnected, waiting for teacher.
- Text pro disconnect: "Parťák se odpojil, čekejte na návrat".

---