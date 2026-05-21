import { ref, onValue, set, update, serverTimestamp, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initLevel2(db, pairId, role, animal, avatar) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');
  
  let myAnimal = animal || (isSova ? 'Sova' : 'Rys');
  let myAvatar = avatar || 'default.svg';
  let partnerAnimal = isSova ? 'Rys' : 'Sova';
  let partnerAvatar = 'default.svg';
  let sovaAnimal = isSova ? myAnimal : partnerAnimal;
  let rysAnimal = !isSova ? myAnimal : partnerAnimal;

  let instructionsShown = false;
  let instructionsDismissed = false;
  let levelFinished = false;
  let intervalId = null;
  let currentTemps = { player1: 100, player2: 100 };
  let lastKnownResetCount = null;
  let levelStartTime = null;
  let levelRefListenerRegistered = false;

  // Reference pro odhlášení listenerů při opuštění levelu
  let unsubscribePlayers = null;
  let unsubscribeLevel = null;
  let unsubscribeState = null;

  // UI Konstrukce
  root.innerHTML = `
    <div id="level2-container">
      <div id="frost-overlay"></div>
      <div id="level2-role-header" class="role-indicator-header" style="text-align: center; margin-bottom: 0.8rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 1rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
          <img src="assets/avatars/${myAvatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.4);" />
          <span>Jsi: <strong style="color: ${isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)'}">${myAnimal}</strong> (Teplotní strážce)</span>
        </span>
      </div>
      <div class="level-instructions" style="display: none;"></div>
      <div class="warmth-bars">
        <div class="bar-container">
          <label id="label-player1">Teplo: Sova ${isSova ? '<span class="role-ty-badge" style="background: rgba(52, 152, 219, 0.18); color: var(--sova-color, #3498db); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(52, 152, 219, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(52, 152, 219, 0.25);">TY</span>' : ''}</label>
          <div class="progress-bar">
            <div id="bar-player1" class="fill" style="width: 100%"></div>
            <div class="progress-bar-bubbles" id="bubbles-player1"></div>
          </div>
        </div>
        <div class="bar-container">
          <label id="label-player2">Teplo: Rys ${!isSova ? '<span class="role-ty-badge" style="background: rgba(230, 126, 34, 0.18); color: var(--rys-color, #e67e22); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(230, 126, 34, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(230, 126, 34, 0.25);">TY</span>' : ''}</label>
          <div class="progress-bar">
            <div id="bar-player2" class="fill" style="width: 100%"></div>
            <div class="progress-bar-bubbles" id="bubbles-player2"></div>
          </div>
        </div>
      </div>
      
      <div class="crystal-scene">
        <!-- Levý avatar (Sova) -->
        <div id="crystal-avatar-player1" class="crystal-avatar player1-avatar">
          <img src="assets/avatars/default.svg" id="crystal-img-player1" alt="Sova" />
          <span class="avatar-label" id="crystal-label-player1">Sova</span>
        </div>

        <!-- Krystal -->
        <div id="crystal-svg-container" class="crystal-svg-container holder-none">
          <svg class="crystal-svg" viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg">
            <polygon points="50,5 95,45 80,105 50,115 20,105 5,45" fill="rgba(0, 210, 255, 0.45)" stroke="#00d2ff" stroke-width="2.5" />
            <polygon points="50,5 50,115 80,105 95,45" fill="rgba(0, 210, 255, 0.28)" />
            <polygon points="50,5 50,115 20,105 5,45" fill="rgba(0, 210, 255, 0.15)" />
            <line x1="50" y1="5" x2="50" y2="115" stroke="#ffffff" stroke-width="1.5" opacity="0.8" />
            <line x1="50" y1="5" x2="95" y2="45" stroke="#ffffff" stroke-width="0.5" opacity="0.6" />
            <line x1="50" y1="5" x2="5" y2="45" stroke="#ffffff" stroke-width="0.5" opacity="0.6" />
            <circle cx="50" cy="60" r="8" fill="#ffffff" filter="blur(3px)" opacity="0.6" />
          </svg>
        </div>

        <!-- Pravý avatar (Rys) -->
        <div id="crystal-avatar-player2" class="crystal-avatar player2-avatar">
          <img src="assets/avatars/default.svg" id="crystal-img-player2" alt="Rys" />
          <span class="avatar-label" id="crystal-label-player2">Rys</span>
        </div>
      </div>

      <div id="crystal-status">Načítání krystalu...</div>
      <div id="level2-controls"></div>
      <div class="timer-weather-wrapper">
        <div id="timer-display">Přežijte: 120s</div>
        <div id="weather-status" class="phase-1">❄️ Načítání počasí...</div>
      </div>
    </div>
  `;

  const controlsEl = document.getElementById('level2-controls');
  const crystalStatusEl = document.getElementById('crystal-status');
  const timerEl = document.getElementById('timer-display');
  const levelRef = ref(db, `rooms/${pairId}/actions/level2_warmth`);

  // Odhlášení všech listenerů a intervalů při opuštění Levelu 2
  const stateRef = ref(db, `rooms/${pairId}/state`);
  unsubscribeState = onValue(stateRef, (stateSnap) => {
    const currentState = stateSnap.val();
    if (currentState !== 'level2') {
      levelFinished = true;
      console.log("Cleaning up Level 2 resources...");
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (unsubscribePlayers) unsubscribePlayers();
      if (unsubscribeLevel) unsubscribeLevel();
      if (unsubscribeState) unsubscribeState();

      // Odstranění overlayů a bannerů Levelu 2 z dokumentu
      const overlays = ['instructions-modal', 'waiting-overlay', 'reset-overlay', 'crystal-alert-banner'];
      overlays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
    }
  });

  // Načtení detailů obou hráčů z DB
  const playersRef = ref(db, `rooms/${pairId}/players`);
  unsubscribePlayers = onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const p1 = players.animal1 || {};
    const p2 = players.animal2 || {};

    if (isSova) {
      if (p2.animal) partnerAnimal = p2.animal;
      if (p2.avatar) partnerAvatar = p2.avatar;
    } else {
      if (p1.animal) partnerAnimal = p1.animal;
      if (p1.avatar) partnerAvatar = p1.avatar;
    }

    sovaAnimal = p1.animal || (isSova ? myAnimal : partnerAnimal);
    rysAnimal = p2.animal || (!isSova ? myAnimal : partnerAnimal);

    const sovaAvatarVal = p1.avatar || (isSova ? myAvatar : partnerAvatar);
    const rysAvatarVal = p2.avatar || (!isSova ? myAvatar : partnerAvatar);

    const img1 = document.getElementById('crystal-img-player1');
    const img2 = document.getElementById('crystal-img-player2');
    const lbl1 = document.getElementById('crystal-label-player1');
    const lbl2 = document.getElementById('crystal-label-player2');

    if (img1) img1.src = `assets/avatars/${sovaAvatarVal}`;
    if (img2) img2.src = `assets/avatars/${rysAvatarVal}`;
    if (lbl1) lbl1.textContent = sovaAnimal;
    if (lbl2) lbl2.textContent = rysAnimal;

    // Aktualizace záhlaví
    const headerEl = document.getElementById('level2-role-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <span style="background: var(--primary); color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 1rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
          <img src="assets/avatars/${myAvatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.4);" />
          <span>Jsi: <strong style="color: ${isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)'}">${myAnimal}</strong> (Teplotní strážce)</span>
        </span>
      `;
    }

    // Aktualizace popisků u teplotních barů
    const label1 = document.getElementById('label-player1');
    const label2 = document.getElementById('label-player2');
    if (label1) {
      label1.innerHTML = `Teplo: ${sovaAnimal} ${isSova ? '<span class="role-ty-badge" style="background: rgba(52, 152, 219, 0.18); color: var(--sova-color, #3498db); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(52, 152, 219, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(52, 152, 219, 0.25);">TY</span>' : ''}`;
    }
    if (label2) {
      label2.innerHTML = `Teplo: ${rysAnimal} ${!isSova ? '<span class="role-ty-badge" style="background: rgba(230, 126, 34, 0.18); color: var(--rys-color, #e67e22); padding: 0.2rem 0.6rem; border-radius: 8px; font-size: 0.85rem; font-weight: 800; border: 1px solid rgba(230, 126, 34, 0.35); margin-left: 0.5rem; display: inline-block; box-shadow: 0 0 10px rgba(230, 126, 34, 0.25);">TY</span>' : ''}`;
    }

    if (!levelRefListenerRegistered) {
      levelRefListenerRegistered = true;

      // Hlavní listener stavu levelu
      unsubscribeLevel = onValue(levelRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        // 1. Aktualizace ukazatelů teploty
        if (data.temperatures) {
          currentTemps = data.temperatures;
          
          const bar1 = document.getElementById('bar-player1');
          const bar2 = document.getElementById('bar-player2');
          const t1 = data.temperatures.player1;
          const t2 = data.temperatures.player2;

          if (bar1) {
            bar1.style.width = `${t1}%`;
            const color1 = getWarmthColor(t1);
            bar1.style.background = color1;
            bar1.style.boxShadow = `0 0 20px ${color1.replace('rgb', 'rgba').replace(')', ', 0.5)')}`;
          }

          if (bar2) {
            bar2.style.width = `${t2}%`;
            const color2 = getWarmthColor(t2);
            bar2.style.background = color2;
            bar2.style.boxShadow = `0 0 20px ${color2.replace('rgb', 'rgba').replace(')', ', 0.5)')}`;
          }
          
          const myTemp = isSova ? t1 : t2;
          const frostOverlay = document.getElementById('frost-overlay');
          if (frostOverlay) {
            if (myTemp < 30) {
              frostOverlay.classList.add('active');
              const targetOpacity = Math.max(0.3, (30 - myTemp) / 30);
              frostOverlay.style.opacity = targetOpacity;
            } else {
              frostOverlay.classList.remove('active');
              frostOverlay.style.opacity = 0;
            }
          }
          const containerEl = document.getElementById('level2-container');
          if (containerEl) {
            containerEl.classList.toggle('low-warmth', myTemp < 30);
          }
        }

        // 2. Vyhodnocení stavu připravenosti a instrukcí
        const myReadyKey = isSova ? 'player1' : 'player2';
        const amIReady = data.ready && data.ready[myReadyKey];
        const ready1 = data.ready && data.ready.player1;
        const ready2 = data.ready && data.ready.player2;
        const bothReady = ready1 && ready2;
        const isGameRunning = !!data.startTime;

        if (!instructionsShown) {
          instructionsShown = true;
          if (amIReady || isGameRunning) {
            instructionsDismissed = true;
            if (!isGameRunning) {
              showWaitingOverlay();
            }
          } else {
            const title = `${myAnimal} (Teplotní strážce)`;
            const text = `Tvoje role v této úrovni: <strong style='color: ${isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)"}; font-size: 1.3rem;'>${myAnimal}</strong>.<br><br>` +
              `Ocitli jste se v mrazivé mlze, která vám postupně ubírá teplo. Uprostřed obrazovky vidíte své teplotní bary.<br><br>` +
              `Pouze držitel krystalu se zahřívá, zatímco druhý hráč mrzne. **Musíte si krystal střídat** klikáním na tlačítko tak, aby nikdo z vás nezmrzl (teplota nesmí klesnout na 0).<br><br>` +
              `Pokud začínáte mrznout, klikněte na tlačítko <em>Mrznu! Potřebuji teplo!</em>, které upozorní tvého parťáka <strong>${partnerAnimal}</strong>. Musíte spolu vydržet 120 sekund.`;

            showInstructionsModal(title, text, () => {
              const updates = {};
              updates[`ready/${myReadyKey}`] = true;
              update(levelRef, updates);
            });
          }
        } else {
          // Instrukce již byly zpracovány v rámci této relace
          if (bothReady || isGameRunning) {
            hideWaitingOverlay();
            instructionsDismissed = true;
            
            // Sova nastaví startovní čas, pokud ještě neběží
            if (isSova && !data.startTime) {
              update(levelRef, { startTime: serverTimestamp() });
            }
          } else if (amIReady) {
            showWaitingOverlay();
          }
        }

        // 3. Výpočet času přežití (pouze pokud hra běží)
        if (data.startTime) {
          levelStartTime = data.startTime;
          const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
          timerEl.textContent = `Přežijte: ${Math.max(0, 120 - elapsed)}s`;
          
          updateWeatherUI(elapsed);
          
          if (elapsed >= 120 && isSova && instructionsDismissed && !levelFinished) {
            levelFinished = true;
            handleSuccess(db, pairId);
          }
        } else {
          timerEl.textContent = `Přežijte: 120s`;
          const weatherStatusEl = document.getElementById('weather-status');
          if (weatherStatusEl) {
            weatherStatusEl.textContent = '❄️ Čekání na spuštění hry...';
            weatherStatusEl.className = 'phase-1';
          }
        }

        // 4. Detekce resetu hry přes resetCount
        if (data.resetCount !== undefined) {
          if (instructionsDismissed && lastKnownResetCount !== null && data.resetCount > lastKnownResetCount && !levelFinished) {
            showResetOverlay();
          }
          lastKnownResetCount = data.resetCount;
        }

        // 5. Zpracování nouzových signálů
        if (data.signal && role === data.crystalHolder && instructionsDismissed) {
          flashSignal();
          set(ref(db, `rooms/${pairId}/actions/level2_warmth/signal`), null);
        }

        // 6. Správa ovládacích prvků a časovače mrazu
        updateHolderUI(data.crystalHolder, role, controlsEl, crystalStatusEl, levelRef, db, pairId);
        
        // Interval teploměru běží pouze pokud hra odstartovala (oběma ready nebo nastaveným startTime)
        if (instructionsDismissed && (bothReady || isGameRunning)) {
          manageWarmthInterval(data.crystalHolder, role, db, pairId);
        } else {
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        }
      });
    }
  });

  function manageWarmthInterval(holder, myRole, db, pairId) {
    const amIHolder = (myRole === holder);
    
    if (amIHolder && !intervalId) {
      // Jsem držitel: každou vteřinu počítám změnu a zapisuji do DB
      intervalId = setInterval(() => {
        if (levelFinished) {
          clearInterval(intervalId);
          intervalId = null;
          return;
        }
        let t1 = currentTemps.player1;
        let t2 = currentTemps.player2;

        let elapsed = 0;
        if (levelStartTime) {
          elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
        }
        
        const rates = getWarmthRates(elapsed);

        if (myRole === 'player1') {
          t1 = Math.min(100, t1 + rates.gain);
          t2 = Math.max(0, t2 - rates.loss);
        } else {
          t2 = Math.min(100, t2 + rates.gain);
          t1 = Math.max(0, t1 - rates.loss);
        }

        if (t1 <= 0 || t2 <= 0) {
          if (!levelFinished) {
            get(ref(db, `rooms/${pairId}/state`)).then(stateSnap => {
              const currentState = stateSnap.val() || 'level1';
              if (currentState === 'level2' && !levelFinished) {
                handleFailure(db, pairId);
              }
            });
          }
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

  // Posuneme krystal na stranu držitele
  const crystalContainer = document.getElementById('crystal-svg-container');
  if (crystalContainer) {
    crystalContainer.className = `crystal-svg-container holder-${holder}`;
  }

  // Aktualizace tříd pro avatary držitele / mrznoucího
  const avatar1 = document.getElementById('crystal-avatar-player1');
  const avatar2 = document.getElementById('crystal-avatar-player2');
  if (avatar1 && avatar2) {
    if (holder === 'player1') {
      avatar1.className = 'crystal-avatar player1-avatar active-holder';
      avatar2.className = 'crystal-avatar player2-avatar freezing-holder';
    } else if (holder === 'player2') {
      avatar1.className = 'crystal-avatar player1-avatar freezing-holder';
      avatar2.className = 'crystal-avatar player2-avatar active-holder';
    } else {
      avatar1.className = 'crystal-avatar player1-avatar';
      avatar2.className = 'crystal-avatar player2-avatar';
    }
  }

  // Spustíme bublinky pro ohřívajícího se hráče
  const bubbles1 = document.getElementById('bubbles-player1');
  const bubbles2 = document.getElementById('bubbles-player2');
  if (bubbles1 && bubbles2) {
    if (holder === 'player1') {
      if (!bubbles1.children.length) setupBubbles(bubbles1);
      bubbles2.innerHTML = '';
    } else if (holder === 'player2') {
      if (!bubbles2.children.length) setupBubbles(bubbles2);
      bubbles1.innerHTML = '';
    } else {
      bubbles1.innerHTML = '';
      bubbles2.innerHTML = '';
    }
  }

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

function setupBubbles(container) {
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.style.left = `${Math.random() * 100}%`;
    bubble.style.animationDelay = `${Math.random() * 1.5}s`;
    bubble.style.animationDuration = `${1.2 + Math.random() * 0.8}s`;
    container.appendChild(bubble);
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

function showInstructionsModal(title, text, onDismiss) {
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
      if (onDismiss) onDismiss();
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
  set(ref(db, `rooms/${pairId}/actions/level3_truth`), null).then(() => {
    set(ref(db, `rooms/${pairId}/state`), 'level3');
  });
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

function updateWeatherUI(elapsed) {
  const weatherStatusEl = document.getElementById('weather-status');
  const timerEl = document.getElementById('timer-display');
  if (!weatherStatusEl || !timerEl) return;

  if (elapsed < 40) {
    weatherStatusEl.textContent = '❄️ Mírný chlad (teplo ubývá pomalu)';
    weatherStatusEl.className = 'phase-1';
    timerEl.classList.remove('timer-blizzard');
  } else if (elapsed < 80) {
    weatherStatusEl.textContent = '💨 Silný mráz (teplo ubývá rychleji!)';
    weatherStatusEl.className = 'phase-2';
    timerEl.classList.remove('timer-blizzard');
  } else {
    weatherStatusEl.textContent = '🚨 BLIZZARD! (Rychle si střídejte krystal!)';
    weatherStatusEl.className = 'phase-3';
    timerEl.classList.add('timer-blizzard');
  }
}

function getWarmthRates(elapsed) {
  if (elapsed < 40) {
    return { loss: 2, gain: 4 };
  } else if (elapsed < 80) {
    return { loss: 4, gain: 4 };
  } else {
    return { loss: 7, gain: 5 };
  }
}

function showWaitingOverlay() {
  const old = document.getElementById('waiting-overlay');
  if (old) return;

  const overlay = document.createElement('div');
  overlay.id = 'waiting-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 15, 25, 0.7);
    backdrop-filter: blur(8px);
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: 'Fredoka', 'Segoe UI', sans-serif;
  `;
  overlay.innerHTML = `
    <div style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 24px; padding: 2.5rem; max-width: 450px; width: 90%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.3); backdrop-filter: blur(10px);">
      <div class="waiting-spinner" style="margin: 0 auto 1.5rem auto; width: 50px; height: 50px; border: 5px solid rgba(255,255,255,0.1); border-top: 5px solid #00d2ff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <h2 style="color: #fff; margin: 0 0 1rem 0; font-size: 1.8rem;">Čekání na parťáka...</h2>
      <p style="font-size: 1.1rem; line-height: 1.5; color: #dfd5f0; margin: 0;">
        Hra se spustí, jakmile tvůj parťák potvrdí, že také rozumí zadání.
      </p>
    </div>
  `;

  if (!document.getElementById('waiting-overlay-styles')) {
    const s = document.createElement('style');
    s.id = 'waiting-overlay-styles';
    s.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(s);
  }

  document.body.appendChild(overlay);
}

function hideWaitingOverlay() {
  const overlay = document.getElementById('waiting-overlay');
  if (overlay) {
    overlay.remove();
  }
}