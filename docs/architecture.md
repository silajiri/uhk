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
- `module_<name>_active` – aktivní modul (např. `module_secret_active`)
- `reflection_started` – reflexní fáze odemčena učitelem
- `finished` – hra dokončena

Klientská logika:
- Klient periodicky (např. každých 5 s) aktualizuje `players/{animal}/lastSeen` a `players/{animal}/status` (heartbeat).
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
- Funkce načte `mappings/{encodedEmail}` z Realtime Database a vrátí cílovou `room`.
- E-mailové klíče v DB jsou enkódovány tak, že `.` jsou nahrazeny čárkami `,`.

Tento přístup zajistí, že:
- Klient nečte přímo citlivou mapovací tabulku `/mappings`.
- Uživatelé i administrátor používají svůj Google Workspace účet.
- Mapovací tabulka může obsahovat páry `email -> room` pro přesné předdefinované spárování.

## D. Administrátorské rozhraní (Master Control)

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