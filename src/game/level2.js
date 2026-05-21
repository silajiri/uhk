import { ref, onValue, set, update, serverTimestamp, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initLevel2(db, pairId, role, animal) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');
  
  // UI Konstrukce
  root.innerHTML = `
    <div id="level2-container">
      <div class="role-indicator-header" style="text-align: center; margin-bottom: 1.5rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.6rem 1.8rem; border-radius: 20px; font-size: 1.15rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-block;">
          Jsi: ${isSova ? '🦉 SOVA' : '🐾 RYS'}
        </span>
      </div>
      <div class="level-instructions" style="display: none;"></div>
      <div class="warmth-bars">
        <div class="bar-container">
          <label>Teplo Sovy ${isSova ? '<span class="role-ty-badge" style="background: rgba(52, 152, 219, 0.18); color: var(--sova-color, #3498db); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(52, 152, 219, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(52, 152, 219, 0.25);">TY</span>' : ''}</label>
          <div class="progress-bar"><div id="bar-player1" class="fill" style="width: 100%"></div></div>
        </div>
        <div class="bar-container">
          <label>Teplo Ryse ${!isSova ? '<span class="role-ty-badge" style="background: rgba(230, 126, 34, 0.18); color: var(--rys-color, #e67e22); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(230, 126, 34, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(230, 126, 34, 0.25);">TY</span>' : ''}</label>
          <div class="progress-bar"><div id="bar-player2" class="fill" style="width: 100%"></div></div>
        </div>
      </div>
      <div id="crystal-status">Načítání krystalu...</div>
      <div id="level2-controls"></div>
      <div id="timer-display">Přežijte: 120s</div>
    </div>
  `;

  const controlsEl = document.getElementById('level2-controls');
  const crystalStatusEl = document.getElementById('crystal-status');
  const timerEl = document.getElementById('timer-display');
  const levelRef = ref(db, `rooms/${pairId}/actions/level2_warmth`);

  // Zobrazení instrukcí jako modal ke schválení (vhodné pro pomalu čtoucí žáky)
  const title = isSova ? "Sova (Teplotní strážce)" : "Rys (Teplotní strážce)";
  const text = "Tvoje role v této úrovni: <strong style='color: " + (isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)") + "; font-size: 1.3rem;'>" + (isSova ? "🦉 SOVA" : "🐾 RYS") + "</strong>.<br><br>" +
    "Ocitli jste se v mrazivé mlze, která vám postupně ubírá teplo. Uprostřed obrazovky vidíte své teplotní bary.<br><br>" +
    "Pouze držitel krystalu se zahřívá, zatímco druhý hráč mrzne. **Musíte si krystal střídat** klikáním na tlačítko tak, aby nikdo z vás nezmrzl (teplota nesmí klesnout na 0).<br><br>" +
    "Pokud začínáte mrznout, klikněte na tlačítko <em>Mrznu! Potřebuji teplo!</em>, které upozorní vašeho parťáka. Musíte spolu vydržet 120 sekund.";
  showInstructionsModal(title, text);

  // Prvotní nastavení (pouze Sova inicializuje level)
  if (isSova) {
    update(levelRef, {
      crystalHolder: 'player1',
      'temperatures/player1': 100,
      'temperatures/player2': 100,
      startTime: serverTimestamp(),
      resetCount: 0
    });
  }

  let intervalId = null;
  let currentTemps = { player1: 100, player2: 100 };
  let lastKnownResetCount = null;

  // Hlavní listener stavu levelu
  onValue(levelRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // 1. Aktualizace ukazatelů teploty
    if (data.temperatures) {
      currentTemps = data.temperatures;
      
      const bar1 = document.getElementById('bar-player1');
      const bar2 = document.getElementById('bar-player2');
      const t1 = data.temperatures.player1;
      const t2 = data.temperatures.player2;

      bar1.style.width = `${t1}%`;
      const color1 = getWarmthColor(t1);
      bar1.style.background = color1;
      bar1.style.boxShadow = `0 0 20px ${color1.replace('rgb', 'rgba').replace(')', ', 0.5)')}`;

      bar2.style.width = `${t2}%`;
      const color2 = getWarmthColor(t2);
      bar2.style.background = color2;
      bar2.style.boxShadow = `0 0 20px ${color2.replace('rgb', 'rgba').replace(')', ', 0.5)')}`;
      
      const myTemp = isSova ? t1 : t2;
      document.getElementById('game-root').classList.toggle('low-warmth', myTemp < 30);
    }

    // 2. Výpočet času přežití
    if (data.startTime) {
      const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
      timerEl.textContent = `Přežijte: ${Math.max(0, 120 - elapsed)}s`;
      
      if (elapsed >= 120 && isSova) {
        handleSuccess(db, pairId);
      }
    }

    // 3. Detekce resetu hry přes resetCount
    if (data.resetCount !== undefined) {
      if (lastKnownResetCount !== null && data.resetCount > lastKnownResetCount) {
        showResetOverlay();
      }
      lastKnownResetCount = data.resetCount;
    }

    // 4. Zpracování nouzových signálů
    if (data.signal && role === data.crystalHolder) {
      flashSignal();
      set(ref(db, `rooms/${pairId}/actions/level2_warmth/signal`), null);
    }

    // 5. Správa ovládacích prvků a časovače mrazu
    updateHolderUI(data.crystalHolder, role, controlsEl, crystalStatusEl, levelRef, db, pairId);
    manageWarmthInterval(data.crystalHolder, role, db, pairId);
  });

  function manageWarmthInterval(holder, myRole, db, pairId) {
    const amIHolder = (myRole === holder);
    
    if (amIHolder && !intervalId) {
      // Jsem držitel: každou vteřinu počítám změnu a zapisuji do DB
      intervalId = setInterval(() => {
        let t1 = currentTemps.player1;
        let t2 = currentTemps.player2;

        if (myRole === 'player1') {
          t1 = Math.min(100, t1 + 2);
          t2 = Math.max(0, t2 - 4);
        } else {
          t2 = Math.min(100, t2 + 2);
          t1 = Math.max(0, t1 - 4);
        }

        if (t1 <= 0 || t2 <= 0) {
          handleFailure(db, pairId);
        } else {
          update(ref(db, `rooms/${pairId}/actions/level2_warmth/temperatures`), { player1: t1, player2: t2 });
        }
      }, 1000);
    } else if (!amIHolder && intervalId) {
      // Už nejsem držitel: zastavím svůj zapisovací interval
      clearInterval(intervalId);
      intervalId = null;
    }
  }
}

function updateHolderUI(holder, role, controlsEl, statusEl, levelRef, db, pairId) {
  const amIHolder = (role === holder);
  statusEl.textContent = amIHolder ? "💎 DRŽÍŠ KRYSTAL" : "❄️ MRZNEŠ";
  statusEl.className = amIHolder ? "holder" : "freezing";

  controlsEl.innerHTML = '';
  if (amIHolder) {
    const btn = document.createElement('button');
    btn.className = 'btn-crystal';
    btn.textContent = '💎 Předat krystal parťákovi';
    btn.onclick = () => update(levelRef, { crystalHolder: role === 'player1' ? 'player2' : 'player1' });
    controlsEl.appendChild(btn);
  } else {
    const btn = document.createElement('button');
    btn.className = 'btn-signal';
    btn.textContent = '🥶 Mrznu! Potřebuji teplo!';
    btn.onclick = () => set(ref(db, `rooms/${pairId}/actions/level2_warmth/signal`), 'FREEZING');
    controlsEl.appendChild(btn);
  }
}

function flashSignal() {
  document.getElementById('game-root').classList.add('flash-blue');
  setTimeout(() => document.getElementById('game-root').classList.remove('flash-blue'), 1500);

  if (!document.getElementById('level2-extra-styles')) {
    const styles = document.createElement('style');
    styles.id = 'level2-extra-styles';
    styles.innerHTML = `
      @keyframes slideDownWarning {
        from { top: -100px; opacity: 0; }
        to { top: 20px; opacity: 1; }
      }
      @keyframes slideUpWarning {
        from { top: 20px; opacity: 1; }
        to { top: -100px; opacity: 0; }
      }
      @keyframes pulseWarning {
        from { transform: translateX(-50%) scale(1); }
        to { transform: translateX(-50%) scale(1.05); }
      }
    `;
    document.head.appendChild(styles);
  }

  let alertBanner = document.getElementById('crystal-alert-banner');
  if (!alertBanner) {
    alertBanner = document.createElement('div');
    alertBanner.id = 'crystal-alert-banner';
    alertBanner.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
      color: #fff;
      padding: 1.2rem 2.5rem;
      border-radius: 16px;
      font-weight: 700;
      font-size: 1.25rem;
      box-shadow: 0 15px 35px rgba(231, 76, 60, 0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      border: 2px solid #ff6b6b;
      font-family: 'Fredoka', 'Segoe UI', sans-serif;
      animation: slideDownWarning 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, pulseWarning 1s infinite alternate;
    `;
    alertBanner.innerHTML = `<span>🥶</span> <strong>PARŤÁK MRZNE! Rychle mu předej krystal!</strong>`;
    document.body.appendChild(alertBanner);
  }

  if (alertBanner.timeoutId) clearTimeout(alertBanner.timeoutId);
  alertBanner.timeoutId = setTimeout(() => {
    alertBanner.style.animation = 'slideUpWarning 0.3s ease forwards';
    setTimeout(() => alertBanner.remove(), 300);
  }, 3500);
}

function handleFailure(db, pairId) {
  const levelRef = ref(db, `rooms/${pairId}/actions/level2_warmth`);
  get(levelRef).then(snap => {
    const data = snap.val() || {};
    const newResets = (data.resetCount || 0) + 1;
    update(levelRef, {
      'temperatures/player1': 100,
      'temperatures/player2': 100,
      startTime: serverTimestamp(),
      resetCount: newResets
    });
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

function showResetOverlay() {
  const old = document.getElementById('reset-overlay');
  if (old) return;

  const overlay = document.createElement('div');
  overlay.id = 'reset-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 15, 25, 0.9);
    backdrop-filter: blur(12px);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: 'Fredoka', 'Segoe UI', sans-serif;
    animation: fadeInOverlay 0.4s ease forwards;
  `;
  overlay.innerHTML = `
    <div style="font-size: 5rem; margin-bottom: 1.5rem; animation: pulseWarning 1s infinite alternate;">🥶</div>
    <h1 style="color: #ff6f79; font-size: 2.2rem; margin: 0 0 1rem 0; text-shadow: 0 0 20px rgba(255, 111, 121, 0.4); text-align: center;">
      Jeden z vás zmrzl!
    </h1>
    <p style="font-size: 1.15rem; text-align: center; max-width: 500px; line-height: 1.6; color: #dfd5f0; margin: 0 0 2rem 0; padding: 0 1.5rem;">
      Teploty klesly na nulu. Čas přežití byl restartován zpět na začátek (<strong>120 sekund</strong>).<br>
      <span style="color: #fff; font-weight: 500;">Předávejte si krystal častěji!</span>
    </p>
    <button id="btn-dismiss-reset" class="btn-crystal" style="padding: 1rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%; max-width: 320px; margin-bottom: 1.5rem; background: #e74c3c; border-color: #ff6b6b; box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);">
      👍 Rozumím, zkusit znovu
    </button>
  `;

  if (!document.getElementById('reset-overlay-styles')) {
    const s = document.createElement('style');
    s.id = 'reset-overlay-styles';
    s.innerHTML = `
      @keyframes fadeInOverlay {
        from { opacity: 0; transform: scale(1.05); }
        to { opacity: 1; transform: scale(1); }
      }
      @keyframes fadeOutOverlay {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.95); }
      }
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(overlay);

  const btn = overlay.querySelector('#btn-dismiss-reset');
  if (btn) {
    btn.onclick = () => {
      overlay.style.animation = 'fadeOutOverlay 0.4s ease forwards';
      setTimeout(() => overlay.remove(), 400);
    };
  }
}

function handleSuccess(db, pairId) {
  set(ref(db, `rooms/${pairId}/state`), 'level3');
}

function getWarmthColor(percent) {
  // Interpolujeme: 100% -> červená, 50% -> zelená, 0% -> modrá
  if (percent > 50) {
    const ratio = (percent - 50) / 50; // 0 až 1
    const r = Math.round(46 + (231 - 46) * ratio);
    const g = Math.round(204 + (76 - 204) * ratio);
    const b = Math.round(113 + (60 - 113) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    const ratio = percent / 50; // 0 až 1
    const r = Math.round(52 + (46 - 52) * ratio);
    const g = Math.round(152 + (204 - 152) * ratio);
    const b = Math.round(219 + (113 - 219) * ratio);
    return `rgb(${r}, ${g}, ${b})`;
  }
}