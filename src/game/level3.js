import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initLevel3(db, pairId, role) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');
  const dataRef = ref(db, `rooms/${pairId}/actions/level3_truth`);

  // UI Konstrukce
  root.innerHTML = `
    <div id="level3-container">
      <div class="role-indicator-header" style="text-align: center; margin-bottom: 1.5rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.6rem 1.8rem; border-radius: 20px; font-size: 1.15rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-block;">
          Jsi: ${isSova ? '🦉 SOVA (Skladač kódu)' : '🐾 RYS (Skladač kódu)'}
        </span>
      </div>
      <div class="level-instructions" style="display: none;"></div>
      <div class="shards-display">
        <div class="shard-box my-shard">
          <label>Tvůj úlomek</label>
          <div id="my-fragment-val" class="shard-value">???</div>
          <button id="btn-share-shard" class="btn-primary">⚡ Odeslat parťákovi</button>
        </div>
        <div class="shard-box partner-shard">
          <label>Úlomek parťáka</label>
          <div id="partner-fragment-val" class="shard-value">???</div>
        </div>
      </div>
      <div class="gate-input-section">
        <div id="gate-code-display" class="code-display">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="keypad" id="gate-keypad"></div>
        <div class="keypad-actions">
            <button id="btn-clear-code" class="btn-secondary">Smazat</button>
            <button id="btn-submit-code" class="btn-primary">Aktivovat bránu</button>
        </div>
      </div>
      <div id="attempts-info">Pokusy: 0/3</div>
    </div>
  `;

  const myFragEl = document.getElementById('my-fragment-val');
  const partnerFragEl = document.getElementById('partner-fragment-val');
  const shareBtn = document.getElementById('btn-share-shard');
  const codeDisplay = document.getElementById('gate-code-display');
  const attemptsEl = document.getElementById('attempts-info');

  // Zobrazení instrukcí jako modal ke schválení (vhodné pro pomalu čtoucí žáky)
  const title = isSova ? "Sova (Skladač kódu)" : "Rys (Skladač kódu)";
  const text = "Tvoje role v této úrovni: <strong style='color: " + (isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)") + "; font-size: 1.3rem;'>" + (isSova ? "🦉 SOVA (Skladač kódu)" : "🐾 RYS (Skladač kódu)") + "</strong>.<br><br>" +
    "Brána z lesa je uzamčena 5místným kódem. Každý z vás vidí pouze část kódu a zbytek má skrytý pod pomlčkami (např. <code>AB---</code> nebo <code>--CDE</code>).<br><br>" +
    "1. Kliknutím na tlačítko <strong>⚡ Odeslat parťákovi</strong> mu nasdílíš svůj úlomek.<br>" +
    "2. Jakmile vám parťák také nasdílí svůj úlomek, uvidíte ho v pravém boxu.<br>" +
    "3. **Složte kód dohromady** (doplňte chybějící písmena ze svého a parťákova úlomku).<br>" +
    "4. Vyťukejte kód na klávesnici níže a aktivujte bránu. Máte 3 pokusy, pak se kód změní.";
  showInstructionsModal(title, text);
  
  let enteredCode = "";
  let currentFullCode = "";
  let currentAttempts = 0;
  let lastKnownAttempts = 0;

  // Inicializace dat (Sova generuje kód)
  if (isSova) {
    get(dataRef).then(snap => {
      if (!snap.exists()) set(dataRef, generateLevel3Data());
    });
  }

  // Render klávesnice
  const keypadEl = document.getElementById('gate-keypad');
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".split('').forEach(char => {
    const btn = document.createElement('button');
    btn.textContent = char;
    btn.onclick = () => {
      if (enteredCode.length < 5) {
        console.log(`Zadán znak: ${char}`);
        enteredCode += char;
        updateCodeDisplay(enteredCode, codeDisplay);
      }
    };
    keypadEl.appendChild(btn);
  });

  document.getElementById('btn-clear-code').onclick = () => {
    enteredCode = "";
    updateCodeDisplay(enteredCode, codeDisplay);
  };

  document.getElementById('btn-submit-code').onclick = () => {
    if (enteredCode.length < 5) return;

    if (currentFullCode && enteredCode === currentFullCode) {
        set(ref(db, `rooms/${pairId}/state`), 'reflection');
    } else {
        console.log("Špatný kód!");
        enteredCode = "";
        updateCodeDisplay(enteredCode, codeDisplay);
        update(dataRef, { attempts: currentAttempts + 1 });
        root.classList.add('flash-red');
        setTimeout(() => root.classList.remove('flash-red'), 500);
    }
  };

  shareBtn.onclick = () => {
    update(dataRef, isSova ? { sovaShared: true } : { rysShared: true });
    shareBtn.disabled = true;
    shareBtn.textContent = "✅ Odesláno";
  };

  // Listener pro změny v kódu a sdílení
  onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    currentFullCode = data.fullCode;
    currentAttempts = data.attempts || 0;

    // Detekce resetu kódu po 3 pokusech
    if (lastKnownAttempts === 3 && currentAttempts === 0) {
      showCodeResetModal();
      shareBtn.disabled = false;
      shareBtn.textContent = "⚡ Odeslat parťákovi";
    }
    lastKnownAttempts = currentAttempts;

    myFragEl.textContent = isSova ? data.sovaFragment : data.rysFragment;
    
    const partnerShared = isSova ? data.rysShared : data.sovaShared;
    partnerFragEl.textContent = partnerShared ? (isSova ? data.rysFragment : data.sovaFragment) : "???";
    partnerFragEl.classList.toggle('revealed', partnerShared);

    attemptsEl.textContent = `Pokusy: ${currentAttempts}/3`;
    if (currentAttempts >= 3 && isSova) {
        console.log("Dosaženo limitu pokusů, regeneruji kód...");
        set(dataRef, generateLevel3Data()); // Regenerace při 3 chybách
    }
  });
}

function generateLevel3Data() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return {
    fullCode: code,
    sovaFragment: code.substring(0, 2) + "---",
    rysFragment: "--" + code.substring(2, 5),
    sovaShared: false,
    rysShared: false,
    attempts: 0
  };
}

function updateCodeDisplay(code, el) {
  const spans = el.querySelectorAll('span');
  spans.forEach((s, i) => s.textContent = code[i] || "");
}

function showInstructionsModal(title, text) {
  const old = document.getElementById('instructions-modal');
  if (old) return;

  const overlay = document.createElement('div');
  overlay.id = 'instructions-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 15, 25, 0.95);
    backdrop-filter: blur(10px);
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Fredoka', 'Segoe UI', sans-serif;
  `;
  overlay.innerHTML = `
    <div style="background: var(--card); border: 2px solid var(--primary); border-radius: 24px; padding: 2.5rem; max-width: 550px; width: 90%; text-align: center; box-shadow: var(--shadow); color: var(--text);">
      <h2 style="color: var(--primary); margin: 0 0 1rem 0; font-size: 1.8rem;">📢 Nový úkol: ${title}</h2>
      <p style="font-size: 1.15rem; line-height: 1.6; margin: 0 0 2rem 0; color: var(--text);">
        ${text}
      </p>
      <button id="btn-dismiss-instruction" class="btn-crystal" style="padding: 1rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%;">
        👍 Přečetl jsem a rozumím
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = overlay.querySelector('#btn-dismiss-instruction');
  if (btn) {
    btn.onclick = () => {
      overlay.remove();
    };
  }
}

function showCodeResetModal() {
  const old = document.getElementById('code-reset-modal');
  if (old) return;

  const overlay = document.createElement('div');
  overlay.id = 'code-reset-modal';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 15, 25, 0.95);
    backdrop-filter: blur(10px);
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Fredoka', 'Segoe UI', sans-serif;
  `;
  overlay.innerHTML = `
    <div style="background: var(--card); border: 2px solid var(--accent); border-radius: 24px; padding: 2.5rem; max-width: 500px; width: 90%; text-align: center; box-shadow: var(--shadow); color: var(--text);">
      <div style="font-size: 4rem; margin-bottom: 1rem;">🔄</div>
      <h2 style="color: var(--accent); margin: 0 0 1rem 0; font-size: 1.6rem;">Kód se změnil!</h2>
      <p style="font-size: 1.15rem; line-height: 1.6; margin: 0 0 2rem 0; color: var(--text);">
        Zadali jste 3krát špatný kód. Zámek brány se resetoval, vygeneroval se **nový kód** a vaše fragmenty byly změněny.<br>
        <strong>Pošlete si nové úlomky a složte kód znovu!</strong>
      </p>
      <button id="btn-dismiss-code-reset" class="btn-crystal" style="padding: 1rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%;">
        👍 Rozumím, jdeme na to
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = overlay.querySelector('#btn-dismiss-code-reset');
  if (btn) {
    btn.onclick = () => {
      overlay.remove();
    };
  }
}