# Historie vývoje pomocí AI a použité modely

Tento dokument shrnuje forenzní zjištění o tom, jaké AI nástroje a konkrétní jazykové modely se podílely na návrhu, implementaci a ladění hry **Strážci světla** v tomto repozitáři.

---

## 1. Rychlý přehled

Vývoj proběhl ve **dvou hlavních fázích**, přičemž každá fáze probíhala v jiném vývojovém prostředí a s jinou sadou AI modelů:

| Fáze | Období | Nástroj / Prostředí | Konkrétní modely | Hlavní přínos |
| :--- | :--- | :--- | :--- | :--- |
| **1. Založení a původní hra** | 15. – 22. května 2026 | **Visual Studio Code**<br>(GitHub Copilot Agent Mode / Edits) | • **Raptor mini (Preview)**<br>• **GPT-5 mini**<br>• **Claude Haiku 4.5** | Architektura, Level 1 (Bludiště), Level 2 (Sdílené teplo), původní Level 3 (Kód pravdy), administrace |
| **2. Rozšíření a refaktoring** | 5. – 16. června 2026 | **Google Antigravity IDE** | • **Gemini 3.5 Flash**<br>• **Claude Sonnet 4.6 (Thinking)** | Nový Level 3 (Skleněný most), posun Kódu pravdy na Level 4, asynchronní reporting, zabezpečení rolí |

---

## 2. Detailní rozpad fází a modelů

### Fáze 1: Založení a původní implementace (15. – 22. května 2026)
*Původní architektura se třemi úrovněmi, Firebase RTDB synchronizací a učitelskou administrací.*

* **Prostředí:** Visual Studio Code s rozšířením GitHub Copilot Chat (Agent / Edits Mode).
* **Použité modely a jejich role:**
  1. **Raptor mini (Preview)** *(rodina `oswe-vscode-prime`, interní označení `raptor-mini`, Azure OpenAI)*
     * **Hlavní implementační model projektu** (provedl přes 36 rozsáhlých sad editací kódu).
     * Vygeneroval klientskou herní plochu (`game.html`), stylopis (`css/style.css`), generování a BFS validaci bludiště v Levelu 1 (`src/game/level1.js`), mechaniku mrznutí a střídání krystalu v Levelu 2 (`src/game/level2.js`) a administrátorské rozhraní (`src/admin/admin.js`).
  2. **GPT-5 mini** *(verze `gpt-5-mini-2025-08-07`, OpenAI / Azure OpenAI)*
     * Zpracoval počáteční architekturu a formátování PRD (`README.md`, `docs/architecture.md`).
     * Definoval metodická pravidla v `docs/gotchas.md` (zákaz veřejných žebříčků, psychologické bezpečí dětí, sokratovské dotazování).
  3. **Claude Haiku 4.5** *(verze `claude-haiku-4-5-20251001`, Anthropic přes GitHub Copilot)*
     * Použit 16. května v odpoledních hodinách na 6 dílčích požadavků (přechodové modaly, optimalizace a ladění chování avatarů).

* **Klíčové commity z této fáze:**
  * `ceea353` – *Initial commit* (15. 5. 2026 22:57)
  * `c757cf4` – *Start* (16. 5. 2026 00:37) – první funkční kostra projektu a dokumentace
  * `5144c62` – *administrace* (16. 5. 2026 13:22)
  * `c8f21aa` – *1) fix administrace 2) návrh hry* (16. 5. 2026 13:44)
  * `00544ae` – *hotovo* (16. 5. 2026 19:35)
  * `2d6bf93` – *avatars* (17. 5. 2026 00:11)
  * `0baed50` – *level 1 done* (19. 5. 2026 00:08)
  * `9363965` – *máme funkční hru!* (21. 5. 2026 14:59)
  * `60ae2b8` – *Implement warning screen and attention test for secrecy verification* (22. 5. 2026 23:18)

---

### Fáze 2: Rozšíření na 4 úrovně, Skleněný most a finální refaktoring (5. – 16. června 2026)
*Přechod projektu do prostředí Google Antigravity IDE a transformace na finální 4úrovňovou strukturu.*

* **Prostředí:** Google Antigravity IDE.
* **Použité modely a jejich role:**
  1. **Gemini 3.5 Flash** *(profil `Gemini 3.5 Flash Medium`)*
     * **5. června 2026:**
       * Na prompt požadující novou úroveň zaměřenou na téma „Zastání se druhého / Obranný štít“ navrhl a kompletně naprogramoval **Level 3: Skleněný most** (`src/game/level3.js`) s mechanikou paměťového přechodu dlaždic, reakcemi pod tlakem (podpora vs. výsměch) a povinným finálním hodnocením.
       * Přesunul dosavadní Kód pravdy do Levelu 4 (`src/game/level4.js` / schéma RTDB) a upravil stavový automat v `src/game/game.js`.
       * Commit: `8a00128` (*feat: implement level 3 glass bridge, relocate code of truth to level 4, add admin configs, and extend reporting*).
     * **9. – 10. června 2026:**
       * Rozšířil reporting v `report.html` o metriky Skleněného mostu a Brány pravdy.
       * Vyřešil asynchronní načítání profilů studentů z Firebase a opravil race condition při registraci databázového listeneru před dokončením Firebase Auth (`2b13521`).
       * Implementoval dynamické zvířecí přezdívky napříč všemi úrovněmi namísto statických rolí Sova a Rys (`96d4562`).
  2. **Claude Sonnet 4.6** *(profil `Claude Sonnet 4.6 Thinking`)*
     * **16. června 2026:**
       * Bezpečnostní analýza a oprava autorizace administrátora (řešení otázky: *„jak je možné, že se uživatel po přihlášení dostane do administrace, i když není v ADMIN_EMAILS?“*).
       * Přenesl validaci admin role z nezabezpečeného `localStorage` na serverovou Cloud Function (`ed8532f`).

---

## 3. Forenzní důkazy a artefakty v systému

1. **Záznamy relací VS Code (`workspaceStorage/17f4022fa4f5783103ea57dbf0d10865`):**
   * Složka odpovídá unikátnímu ID tohoto repozitáře ve VS Code.
   * `chatSessions/834a31b4-b2ba-4a48-a139-98df7a9900a1.jsonl` (15.–16. 5. 2026): obsahuje explicitní záznamy `resolvedModel: "capi-cnc-ptuc-h200-oswe-vscode-prime"` (`Raptor mini (Preview)`) a `resolvedModel: "gpt-5-mini-2025-08-07"`.
   * `chatSessions/5172aee1-0ee8-40b2-bac5-b207876a80fd.jsonl` (16.–17. 5. 2026): obsahuje záznamy `Raptor mini (Preview)`, `Claude Haiku 4.5` (`claude-haiku-4-5-20251001`) a `GPT-5 mini`.
   * `GitHub.copilot-chat/codebase-external.sqlite`: databáze indexu s posledním zápisem 22. 5. 2026 ve 23:15:37 (těsně před commitem `60ae2b8`).

2. **Konfigurace `.vscode/settings.json`:**
   * Obsahuje direktivu `"chat.tools.terminal.autoApprove"`, kterou VS Code zavedlo specificky pro agentní provádění terminálových příkazů v GitHub Copilot Agent Mode (`Get-Item`, `Set-Content` atd.).

3. **Systémové transkripty Antigravity IDE (`.gemini/antigravity-ide/brain/`):**
   * Relace `e06d0b9b-0fbd-4dd0-8e50-29b120720a0f` (5. 6. 2026): zaznamenán prompt pro vytvoření čtvrté úrovně a přepnutí na `Gemini 3.5 Flash (Medium)`.
   * Relace `33cc404a-10d0-4c31-b56e-ca97c2d1ee26` a `e08e4db4-60ab-45f3-9282-25138e409e41` (9.–10. 6. 2026): záznamy oprav Firebase reportů s modelem `Gemini 3.5 Flash (Medium)`.
   * Relace `1f4599d1-6636-428f-8515-d58d00847363` (16. 6. 2026): zaznamenán dotaz na kontrolu oprávnění administrátora a přepnutí na `Claude Sonnet 4.6 (Thinking)`.

4. **Konfigurační soubor `.aiexclude` v kořenu repozitáře:**
   * Specifický formát zavedený společností Google (Gemini Code Assist / Cloud Code) pro zamezení indexace citlivých souborů (klíče, `.env`, `firebase.settings`) AI nástroji.
