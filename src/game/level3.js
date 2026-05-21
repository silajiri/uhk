import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initLevel3(db, pairId, role) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');
  const dataRef = ref(db, `rooms/${pairId}/actions/level3_truth`);

  let partnerScanState = 'unscanned'; // 'unscanned' | 'scanning' | 'scanned_true' | 'scanned_fake' | 'decrypting' | 'decrypted'
  let transitionTimerStarted = false;
  let currentData = null;
  let currentFakeFragment = null;

  // UI Konstrukce
  root.innerHTML = `
    <div id="level3-container">
      <div class="role-indicator-header" style="text-align: center; margin-bottom: 0.8rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 1rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-block;">
          Jsi: ${isSova ? '🦉 SOVA (Skladač kódu)' : '🐾 RYS (Skladač kódu)'}
        </span>
      </div>
      <div class="level-instructions" style="display: none;"></div>
      <div class="shards-display">
        <div class="shard-box my-shard">
          <label>Tvůj úlomek</label>
          <div id="my-fragment-val" class="shard-value">???</div>
          <div id="my-share-container">
            <div style="font-size: 0.85rem; color: var(--muted); margin-top: 0.5rem; text-align: center;">Načítám možnosti sdílení...</div>
          </div>
        </div>
        <div class="shard-box partner-shard" id="partner-shard-box">
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
  const partnerShardBox = document.getElementById('partner-shard-box');
  const codeDisplay = document.getElementById('gate-code-display');
  const attemptsEl = document.getElementById('attempts-info');

  // Zobrazení instrukcí jako modal ke schválení (vhodné pro pomalu čtoucí žáky)
  const title = isSova ? "Sova (Skladač kódu)" : "Rys (Skladač kódu)";
  const text = "Tvoje role v této úrovni: <strong style='color: " + (isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)") + "; font-size: 1.3rem;'>" + (isSova ? "🦉 SOVA (Skladač kódu)" : "🐾 RYS (Skladač kódu)") + "</strong>.<br><br>" +
    "Brána z lesa je uzamčena 5místným kódem. Každý z vás vidí pouze část kódu a zbytek má skrytý pod pomlčkami.<br><br>" +
    "1. **Rozhodni se, zda budeš spolupracovat:** Můžeš poslat pravdivý úlomek, nebo parťáka oklamat a poslat falešný (lež).<br>" +
    "2. Jakmile ti partner pošle svůj úlomek, uvidíš ho v pravém boxu. **Můžeš otestovat jeho pravost** detektorem lži.<br>" +
    "3. Pokud odhalíš lež, můžeš spustit 15s dešifrování pro získání skutečného kódu.<br>" +
    "4. **Složte kód dohromady**, vyťukejte ho a aktivujte bránu. **Pokud jsi lhal, brána tě odhalí a uvězní!**";
  showInstructionsModal(title, text);
  
  let enteredCode = "";
  let currentFullCode = "";
  let currentAttempts = 0;
  let lastKnownAttempts = 0;

  // Inicializace dat (Sova generuje kód)
  if (isSova) {
    get(dataRef).then(snap => {
      if (!snap.exists()) {
        set(dataRef, generateLevel3Data());
      } else {
        const data = snap.val();
        if (!data.escapedPlayers) {
          update(dataRef, {
            escapedPlayers: {
              player1: 'waiting',
              player2: 'waiting'
            }
          });
        }
      }
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
        // Správný kód!
        const myStatusRef = ref(db, `rooms/${pairId}/actions/level3_truth/escapedPlayers/${isSova ? 'player1' : 'player2'}`);
        const myShardStatus = isSova ? (currentData?.sovaShardStatus || '') : (currentData?.rysShardStatus || '');
        const escapeState = (myShardStatus === 'fake') ? 'trapped' : 'escaped';
        
        set(myStatusRef, escapeState).then(() => {
          console.log(`Zapsán stav: ${escapeState}`);
        });
    } else {
        console.log("Špatný kód!");
        enteredCode = "";
        updateCodeDisplay(enteredCode, codeDisplay);
        update(dataRef, { attempts: currentAttempts + 1 });
        
        const container = document.getElementById('level3-container');
        if (container) {
          container.classList.add('shake');
          setTimeout(() => container.classList.remove('shake'), 500);
        }
        
        root.classList.add('flash-red');
        setTimeout(() => root.classList.remove('flash-red'), 500);
    }
  };

  // Funkce pro generování náhodného lživého kódu (záměna zobrazených písmen)
  function generateFakeFragment(trueFragment) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < trueFragment.length; i++) {
      const char = trueFragment[i];
      if (char === '-') {
        result += '-';
      } else {
        let fakeChar = char;
        while (fakeChar === char) {
          fakeChar = chars.charAt(Math.floor(Math.random() * chars.length));
        }
        result += fakeChar;
      }
    }
    return result;
  }

  // Funkce pro zobrazení výsledkové obrazovky
  function showOutcomeScreen(status) {
    const container = document.getElementById('level3-container');
    if (!container) return;
    if (container.querySelector('.gate-outcome-card')) return; // Zamezení zbytečného přepisování

    if (status === 'escaped') {
      container.innerHTML = `
        <div class="gate-outcome-card escaped">
          <div class="gate-outcome-icon">✨</div>
          <h2 style="color: #2ecc71; margin-bottom: 1rem;">Úspěšný únik!</h2>
          <p style="font-size: 1.1rem; line-height: 1.6;">Brána tě propustila z Mlžného lesa. Choval ses čestně, a proto jsi volný.</p>
          <div style="font-size: 0.95rem; color: var(--muted); margin-top: 1.5rem;">
            Čekání na dokončení druhého hráče...
          </div>
        </div>
      `;
    } else if (status === 'trapped') {
      container.innerHTML = `
        <div class="gate-outcome-card trapped">
          <div class="gate-outcome-icon">🔒</div>
          <h2 style="color: #e74c3c; margin-bottom: 1rem;">Byl jsi uvězněn!</h2>
          <p style="font-size: 1.1rem; line-height: 1.6;">Pokusil ses oklamat parťáka zasláním falešného kódu. Starobylá brána odhalila tvou zradu a navždy tě zablokovala v lese.</p>
          <div style="font-size: 0.95rem; color: var(--muted); margin-top: 1.5rem;">
            Čekání na dokončení druhého hráče...
          </div>
        </div>
      `;
    }
  }

  // Funkce pro skenování
  function startScanning(data) {
    partnerScanState = 'scanning';
    renderPartnerShardBox(data);
    
    setTimeout(() => {
      const partnerShardStatus = isSova ? data.rysShardStatus : data.sovaShardStatus;
      if (partnerShardStatus === 'true') {
        partnerScanState = 'scanned_true';
      } else {
        partnerScanState = 'scanned_fake';
      }
      renderPartnerShardBox(data);
    }, 2000);
  }

  // Funkce pro dešifrování
  function startDecrypting(data) {
    partnerScanState = 'decrypting';
    renderPartnerShardBox(data);

    const duration = 15000;
    const intervalTime = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalTime;
      const percentage = Math.min((elapsed / duration) * 100, 100);
      const secondsLeft = Math.ceil((duration - elapsed) / 1000);

      const fillEl = partnerShardBox.querySelector('.decrypt-bar-fill');
      const labelEl = partnerShardBox.querySelector('#decrypt-time-label');

      if (fillEl) fillEl.style.width = percentage + '%';
      if (labelEl) labelEl.textContent = `Dešifrování: ${secondsLeft}s`;

      if (elapsed >= duration) {
        clearInterval(timer);
        partnerScanState = 'decrypted';
        renderPartnerShardBox(data);
      }
    }, intervalTime);
  }

  // Funkce pro dynamický render partnerova boxu
  function renderPartnerShardBox(data) {
    const partnerShared = isSova ? data.rysShared : data.sovaShared;
    if (!partnerShared) {
      partnerShardBox.dataset.scanState = 'waiting_sharing';
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value">???</div>
        <div style="font-size: 0.85rem; color: var(--muted); margin-top: 0.5rem;">Čekání na sdílení...</div>
      `;
      return;
    }

    const partnerShardValue = isSova ? data.rysShardValue : data.sovaShardValue;
    const partnerTrueShard = isSova ? data.rysFragment : data.sovaFragment;

    // Zamezení překreslení DOM, pokud stav a hodnota zůstaly stejné
    if (partnerShardBox.dataset.scanState === partnerScanState && partnerShardBox.dataset.shardValue === partnerShardValue) {
      return;
    }
    partnerShardBox.dataset.scanState = partnerScanState;
    partnerShardBox.dataset.shardValue = partnerShardValue;

    if (partnerScanState === 'unscanned') {
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value">${partnerShardValue}</div>
        <button id="btn-scan-partner" class="btn-primary" style="margin-top: 0.5rem; width: 100%; font-size: 0.9rem; padding: 0.6rem 0.5rem; background: var(--accent); border-color: var(--accent-soft);">🔍 Otestovat pravost</button>
      `;
      const scanBtn = partnerShardBox.querySelector('#btn-scan-partner');
      if (scanBtn) {
        scanBtn.onclick = () => startScanning(data);
      }
    } else if (partnerScanState === 'scanning') {
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value">${partnerShardValue}</div>
        <div class="scanning-container">
          <div class="scanning-text">🔍 Skenování pravosti...</div>
          <div class="scanning-bar">
            <div class="scanning-bar-fill"></div>
          </div>
        </div>
      `;
    } else if (partnerScanState === 'scanned_true') {
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value revealed">${partnerShardValue}</div>
        <div style="margin-top: 0.5rem;">
          <span class="status-badge success">🟢 Úlomek je pravdivý</span>
        </div>
      `;
    } else if (partnerScanState === 'scanned_fake') {
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value" style="color: #e74c3c; border-color: #e74c3c;">${partnerShardValue}</div>
        <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
          <span class="status-badge error">🔴 Úlomek je falešný!</span>
          <button id="btn-decrypt" class="btn-primary" style="width: 100%; font-size: 0.85rem; padding: 0.5rem; background: #e67e22; border-color: #d35400;">⚡ Dešifrovat pravdivý kód (15s)</button>
        </div>
      `;
      const decryptBtn = partnerShardBox.querySelector('#btn-decrypt');
      if (decryptBtn) {
        decryptBtn.onclick = () => startDecrypting(data);
      }
    } else if (partnerScanState === 'decrypting') {
      partnerShardBox.innerHTML = `
        <label>Úlomek parťáka</label>
        <div class="shard-value" style="color: #e74c3c; border-color: #e74c3c;">${partnerShardValue}</div>
        <div style="margin-top: 0.5rem; width: 100%; display: flex; flex-direction: column; gap: 0.4rem; align-items: center;">
          <span class="status-badge error" style="font-size: 0.75rem;">🔴 Úlomek je falešný!</span>
          <div style="font-size: 0.85rem; color: #3498db;" id="decrypt-time-label">Dešifrování: 15s</div>
          <div class="decrypt-bar">
            <div class="decrypt-bar-fill" style="width: 0%;"></div>
          </div>
        </div>
      `;
    } else if (partnerScanState === 'decrypted') {
      partnerShardBox.innerHTML = `
        <label>Dešifrovaný úlomek parťáka</label>
        <div class="shard-value revealed">${partnerTrueShard}</div>
        <div style="margin-top: 0.5rem;">
          <span class="status-badge success" style="background: rgba(52, 152, 219, 0.15); color: #3498db; border-color: rgba(52, 152, 219, 0.3);">🔓 Skutečný kód dešifrován</span>
        </div>
      `;
    }
  }

  // Listener pro změny v kódu a sdílení
  onValue(dataRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    currentData = data;
    currentFullCode = data.fullCode;
    currentAttempts = data.attempts || 0;

    // Check my escape status
    const escapedPlayers = data.escapedPlayers || { player1: 'waiting', player2: 'waiting' };
    const myStatus = isSova ? escapedPlayers.player1 : escapedPlayers.player2;
    const partnerStatus = isSova ? escapedPlayers.player2 : escapedPlayers.player1;

    if (myStatus && myStatus !== 'waiting') {
      showOutcomeScreen(myStatus);
      
      // Sova controls transition
      if (isSova && partnerStatus && partnerStatus !== 'waiting') {
        if (!transitionTimerStarted) {
          transitionTimerStarted = true;
          setTimeout(() => {
            set(ref(db, `rooms/${pairId}/state`), 'reflection');
          }, 4000);
        }
      }
      return; // Skip normal UI updates since we are showing outcome
    }

    // Detekce resetu kódu po 3 pokusech
    if (lastKnownAttempts === 3 && currentAttempts === 0) {
      showCodeResetModal();
      partnerScanState = 'unscanned';
      currentFakeFragment = null;
      const shareContainer = document.getElementById('my-share-container');
      if (shareContainer) {
        delete shareContainer.dataset.rendered;
      }
    }
    lastKnownAttempts = currentAttempts;

    myFragEl.textContent = isSova ? data.sovaFragment : data.rysFragment;
    
    // Update my sharing UI (truth/lie buttons)
    const myShared = isSova ? data.sovaShared : data.rysShared;
    const shareContainer = document.getElementById('my-share-container');
    if (shareContainer) {
      if (myShared) {
        const myShardStatus = isSova ? data.sovaShardStatus : data.rysShardStatus;
        if (shareContainer.dataset.rendered !== 'shared') {
          shareContainer.innerHTML = `
            <div class="status-badge success" style="width: 100%; text-align: center; margin-top: 0.5rem; background: rgba(39, 174, 96, 0.15); color: #2ecc71; border-color: rgba(39, 174, 96, 0.3);">
              ✅ Odesláno (${myShardStatus === 'true' ? 'Pravda' : 'Lež'})
            </div>
          `;
          shareContainer.dataset.rendered = 'shared';
        }
      } else {
        if (shareContainer.dataset.rendered !== 'buttons') {
          const trueFragment = isSova ? data.sovaFragment : data.rysFragment;
          if (!currentFakeFragment) {
            currentFakeFragment = generateFakeFragment(trueFragment);
          }
          shareContainer.innerHTML = `
            <div class="share-choices" style="display: flex; gap: 8px; margin-top: 0.5rem; flex-wrap: wrap;">
              <button id="btn-share-truth" class="btn-primary" style="flex: 1; font-size: 0.9rem; padding: 0.6rem 0.3rem; background: #27ae60; border-color: #2ecc71;">🟢 Odeslat pravdu (${trueFragment})</button>
              <button id="btn-share-lie" class="btn-secondary" style="flex: 1; font-size: 0.9rem; padding: 0.6rem 0.3rem; background: rgba(231, 76, 60, 0.2); border-color: #e74c3c; color: #e74c3c;">🔴 Poslat lež (${currentFakeFragment})</button>
            </div>
          `;
          shareContainer.dataset.rendered = 'buttons';
          
          document.getElementById('btn-share-truth').onclick = () => {
            const trueFragment = isSova ? data.sovaFragment : data.rysFragment;
            update(dataRef, isSova ? {
              sovaShared: true,
              sovaShardValue: trueFragment,
              sovaShardStatus: 'true'
            } : {
              rysShared: true,
              rysShardValue: trueFragment,
              rysShardStatus: 'true'
            });
          };
          
          document.getElementById('btn-share-lie').onclick = () => {
            update(dataRef, isSova ? {
              sovaShared: true,
              sovaShardValue: currentFakeFragment,
              sovaShardStatus: 'fake'
            } : {
              rysShared: true,
              rysShardValue: currentFakeFragment,
              rysShardStatus: 'fake'
            });
          };
        }
      }
    }

    const partnerShared = isSova ? data.rysShared : data.sovaShared;
    if (!partnerShared) {
      partnerScanState = 'unscanned';
    }

    // Render partner box
    renderPartnerShardBox(data);

    attemptsEl.textContent = `Pokusy: ${currentAttempts}/3`;
    if (currentAttempts >= 3 && isSova) {
        console.log("Dosaženo limitu pokusů, regeneruji kód...");
        get(ref(db, `rooms/${pairId}/actions/level3_truth/escapedPlayers`)).then(snap => {
          const currentEscaped = snap.val() || { player1: 'waiting', player2: 'waiting' };
          const newData = generateLevel3Data();
          newData.escapedPlayers = currentEscaped;
          set(dataRef, newData);
        });
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
    sovaShardValue: "",
    rysShardValue: "",
    sovaShardStatus: "",
    rysShardStatus: "",
    attempts: 0,
    escapedPlayers: {
      player1: 'waiting',
      player2: 'waiting'
    }
  };
}

function updateCodeDisplay(code, el) {
  const spans = el.querySelectorAll('span');
  spans.forEach((s, i) => {
    s.textContent = code[i] || "";
    s.classList.toggle('filled', !!code[i]);
  });
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