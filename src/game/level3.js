import { ref, onValue, set, update, get, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initLevel3(db, pairId, role, animal, avatar) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');
  const bridgeRef = ref(db, `rooms/${pairId}/actions/level3_bridge`);
  const configRef = ref(db, `rooms/${pairId}/config/level3_bridge`);

  // 1. Inject Level 3 Specific CSS Styles
  injectStyles();

  // 2. Fetch config and setup database
  get(configRef).then((configSnap) => {
    const config = configSnap.val() || {};
    const N = parseInt(config.gridSize) || 5;
    const T = parseInt(config.previewTime) || 5;
    const K = parseInt(config.tileCount) || 7;

    get(bridgeRef).then((snapshot) => {
      let data = snapshot.val();
      if (!data || !data.activePlayer) {
        // Initialize if not present
        const targetTiles = generateTargetTiles(N, K);
        data = {
          activePlayer: 'player1',
          targetTiles: targetTiles,
          attempts: 0,
          correctSelections: [],
          phase: 'preview', // preview | playing | evaluation | swapping | finished
          lastInteraction: null,
          finalReaction: null,
          stats: {
            player1: {
              supportSent: 0,
              hateSent: 0,
              success: false,
              attemptsUsed: 0,
              finalReactionSent: null
            },
            player2: {
              supportSent: 0,
              hateSent: 0,
              success: false,
              attemptsUsed: 0,
              finalReactionSent: null
            }
          }
        };
        set(bridgeRef, data).then(() => {
          startBridgeGame(db, pairId, role, animal, avatar, N, T, K, bridgeRef);
        });
      } else {
        startBridgeGame(db, pairId, role, animal, avatar, N, T, K, bridgeRef);
      }
    });
  });
}

function generateTargetTiles(N, K) {
  const allIndices = [];
  for (let i = 0; i < N * N; i++) {
    allIndices.push(i);
  }
  const selected = [];
  // Select K unique random positions
  for (let i = 0; i < K; i++) {
    if (allIndices.length === 0) break;
    const randIndex = Math.floor(Math.random() * allIndices.length);
    selected.push(allIndices.splice(randIndex, 1)[0]);
  }
  return selected;
}

function startBridgeGame(db, pairId, role, animal, avatar, N, T, K, bridgeRef) {
  const isSova = (role === 'player1');
  const root = document.getElementById('game-root');

  let currentData = null;
  let localSelected = [];
  let feedbackTimer = null;
  let instructionsShown = false;
  let localPreviewTimer = null;

  // Render core container structure
  root.innerHTML = `
    <div id="bridge-container">
      <div class="role-indicator-header" style="text-align: center; margin-bottom: 0.8rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span class="role-badge" id="role-badge-display">
          Jsi: ${animal || (isSova ? 'Sova' : 'Rys')}
        </span>
      </div>
      
      <div class="bridge-status-card">
        <div id="bridge-phase-status" class="phase-status-text">Připravte se...</div>
        <div id="bridge-attempts" class="attempts-counter">Pokusy: 0/3</div>
      </div>

      <div class="bridge-grid-wrapper">
        <div id="bridge-grid" class="bridge-grid"></div>
        <div id="interaction-feedback-overlay" class="feedback-overlay"></div>
      </div>

      <div id="interaction-controls-container"></div>
    </div>
  `;

  const gridEl = document.getElementById('bridge-grid');
  const phaseStatusEl = document.getElementById('bridge-phase-status');
  const attemptsEl = document.getElementById('bridge-attempts');
  const controlsContainer = document.getElementById('interaction-controls-container');
  const feedbackOverlay = document.getElementById('interaction-feedback-overlay');
  const badgeEl = document.getElementById('role-badge-display');

  // Configure grid columns/rows dynamically
  gridEl.style.gridTemplateColumns = `repeat(${N}, 1fr)`;
  gridEl.style.gridTemplateRows = `repeat(${N}, 1fr)`;

  // Fetch player details (avatars)
  let partnerAnimal = isSova ? 'Rys' : 'Sova';
  let partnerAvatar = 'default.svg';
  let myAnimal = animal || (isSova ? 'Sova' : 'Rys');
  let myAvatar = avatar || 'default.svg';

  const playersRef = ref(db, `rooms/${pairId}/players`);
  onValue(playersRef, (snapshot) => {
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

    if (badgeEl) {
      badgeEl.innerHTML = `
        <img src="assets/avatars/${myAvatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.4);" />
        <span>Jsi: <strong style="color: ${isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)'}">${myAnimal}</strong></span>
      `;
    }

    if (!instructionsShown) {
      instructionsShown = true;
      showWelcomeInstructions();
    }
  });

  // Welcome modal depending on active player
  function showWelcomeInstructions() {
    const title = `Skleněný most`;
    let text = "";

    // We look at the starting activePlayer (which is player1 by default)
    if (isSova) {
      text = `Tvoje role v této úrovni: <strong style="color: var(--sova-color, #3498db); font-size: 1.25rem;">Hledáš pochozí cestu!</strong><br><br>
        1. Na začátku se vám oběma na <strong>${T} sekund</strong> ukáže správná cesta složená z <strong>${K} pochozích dlaždic</strong>.<br>
        2. Zapamatuj si jejich polohu!<br>
        3. Jakmile cesta zmizí, **klikni na všechna pochozí pole**. Splašíš-li se a šlápneš vedle, spadl jsi a zkoušíš to znovu.<br>
        4. Máš celkem **3 pokusy** na bezpečné překročení propasti.<br><br>
        *Parťák tě sleduje v reálném čase a může tě podporovat!*`;
    } else {
      text = `Tvoje role v této úrovni: <strong style="color: var(--rys-color, #e67e22); font-size: 1.25rem;">Sleduješ parťáka!</strong><br><br>
        1. Na začátku uvidíš správnou cestu po dobu <strong>${T} sekund</strong>. Zapamatuj si ji také!<br>
        2. Hráč <strong>${partnerAnimal}</strong> se pokusí cestu přejít. Ty v reálném čase vidíš jeho pokrok a úspěšná pole.<br>
        3. Pomocí tlačítek na obrazovce mu posílej průběžnou **podporu 👏** nebo **výsměch 😜**.<br>
        4. Na konci jeho pokusů musíš povinně vybrat finální reakci (👏 nebo 😂), aby hra pokračovala.`;
    }
    showInstructionsModal(title, text);
  }

  // Subscribe to level updates
  onValue(bridgeRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    currentData = data;
    const activePlayer = data.activePlayer;
    const isActive = (activePlayer === role);
    const phase = data.phase;
    const targetTiles = data.targetTiles || [];
    const correctSelections = data.correctSelections || [];
    const attempts = data.attempts || 0;

    attemptsEl.textContent = `Pokusy: ${attempts}/3`;

    // Phase UI renderer
    if (phase === 'preview') {
      phaseStatusEl.innerHTML = `🌟 Náhled cesty...`;
      phaseStatusEl.style.color = '#f1c40f';
      localSelected = [];
      renderPreviewGrid(targetTiles);
      controlsContainer.innerHTML = '';
      
      // Active player runs the countdown timer and updates DB state
      if (isActive && !localPreviewTimer) {
        let secondsLeft = T;
        phaseStatusEl.innerHTML = `⏱️ Cesta zmizí za ${secondsLeft}s`;
        localPreviewTimer = setInterval(() => {
          secondsLeft--;
          if (secondsLeft <= 0) {
            clearInterval(localPreviewTimer);
            localPreviewTimer = null;
            update(bridgeRef, { phase: 'playing' });
          } else {
            phaseStatusEl.innerHTML = `⏱️ Cesta zmizí za ${secondsLeft}s`;
          }
        }, 1000);
      }
    } else if (phase === 'playing') {
      phaseStatusEl.innerHTML = isActive 
        ? `🏃 Tvůj tah! Najdi všech ${K} pochozích dlaždic.` 
        : `👀 Sleduješ tahy hráče ${partnerAnimal}...`;
      phaseStatusEl.style.color = isActive ? '#3498db' : '#9b59b6';
      
      // Render interactive/view grid
      renderPlayingGrid(isActive, targetTiles, correctSelections);

      // Render watcher controls
      if (!isActive) {
        renderWatcherControls();
      } else {
        controlsContainer.innerHTML = '';
      }
    } else if (phase === 'evaluation') {
      phaseStatusEl.innerHTML = `📋 Vyhodnocení pokusu...`;
      phaseStatusEl.style.color = '#e74c3c';
      
      const activeSuccess = correctSelections.length === targetTiles.length;
      renderPlayingGrid(false, targetTiles, correctSelections);

      if (isActive) {
        // Wait screen for the active player
        controlsContainer.innerHTML = `
          <div class="evaluation-wait-card">
            <h2>${activeSuccess ? '🎉 Výborně! Cesta je volná!' : '😢 Všechny pokusy vyčerpány!'}</h2>
            <p>Čekáme na reakci od parťáka...</p>
            <div class="spinner-loader"></div>
          </div>
        `;
      } else {
        // Required reaction popup overlay for the watcher
        showFinalReactionModal(activeSuccess, targetTiles, correctSelections);
      }
    } else if (phase === 'swapping') {
      phaseStatusEl.innerHTML = `🔄 Prohození rolí...`;
      phaseStatusEl.style.color = '#e67e22';
      renderPlayingGrid(false, targetTiles, correctSelections);
      controlsContainer.innerHTML = `
        <div class="evaluation-wait-card">
          <h2>Výměna rolí!</h2>
          <p>Nyní se aktivním hráčem stává partner. Připravte se na novou mapu...</p>
        </div>
      `;
    } else if (phase === 'finished') {
      phaseStatusEl.innerHTML = `🏁 Hra dokončena!`;
      phaseStatusEl.style.color = '#2ecc71';
      renderPlayingGrid(false, targetTiles, correctSelections);
      controlsContainer.innerHTML = `
        <div class="evaluation-wait-card">
          <h2>Level dokončen!</h2>
          <p>Mlha ustupuje... Přecházíme k Bráně pravdy.</p>
        </div>
      `;
    }

    // Listener for continuous support/hate overlay messages
    if (data.lastInteraction && data.lastInteraction.sender !== role) {
      handleInteractionFeedback(data.lastInteraction);
    }

    // Listener for final reaction to show feedback banner before next step
    if (data.finalReaction && data.finalReaction.sender !== role) {
      showFinalReactionBanner(data.finalReaction);
    }
  });

  // Render Grid in Preview State
  function renderPreviewGrid(targetTiles) {
    gridEl.innerHTML = '';
    const totalTiles = N * N;
    for (let i = 0; i < totalTiles; i++) {
      const tile = document.createElement('div');
      tile.className = 'bridge-tile preview';
      tile.textContent = `${i + 1}`;
      if (targetTiles.includes(i)) {
        tile.classList.add('target');
      }
      gridEl.appendChild(tile);
    }
  }

  // Render Grid in Active Playing or Watching State
  function renderPlayingGrid(isActive, targetTiles, correctSelections) {
    gridEl.innerHTML = '';
    const totalTiles = N * N;

    for (let i = 0; i < totalTiles; i++) {
      const tile = document.createElement('button');
      tile.className = 'bridge-tile';
      tile.textContent = `${i + 1}`;

      const isCorrect = correctSelections.includes(i);
      const isLocallySelected = localSelected.includes(i);

      if (isCorrect) {
        tile.classList.add('correct');
        tile.disabled = true;
      } else if (isLocallySelected) {
        tile.classList.add('locally-selected');
      }

      if (isActive) {
        tile.onclick = () => {
          handleTileClick(i, targetTiles, correctSelections);
        };
      } else {
        tile.disabled = true;
      }

      gridEl.appendChild(tile);
    }
  }

  // Handle click on grid tile
  function handleTileClick(index, targetTiles, correctSelections) {
    if (currentData.phase !== 'playing') return;

    if (targetTiles.includes(index)) {
      // Correct click
      if (!correctSelections.includes(index) && !localSelected.includes(index)) {
        localSelected.push(index);
        
        // Show correct locally
        const tiles = gridEl.querySelectorAll('.bridge-tile');
        if (tiles[index]) {
          tiles[index].classList.add('correct');
        }

        // Check if all correct tiles are selected
        const allFound = targetTiles.every(t => localSelected.includes(t));
        if (allFound) {
          // Success!
          const activePlayer = currentData.activePlayer;
          const currentAttempts = currentData.attempts || 0;
          
          const statsUpdate = {};
          statsUpdate[`stats/${activePlayer}/success`] = true;
          statsUpdate[`stats/${activePlayer}/attemptsUsed`] = currentAttempts + 1;
          statsUpdate[`correctSelections`] = localSelected;
          statsUpdate[`phase`] = 'evaluation';
          
          update(bridgeRef, statsUpdate);
        } else {
          // Sync correctSelections with DB so watcher can see progress
          update(bridgeRef, {
            correctSelections: localSelected
          });
        }
      }
    } else {
      // Wrong click!
      const wrongTile = gridEl.querySelectorAll('.bridge-tile')[index];
      if (wrongTile) {
        wrongTile.classList.add('wrong');
        setTimeout(() => wrongTile.classList.remove('wrong'), 500);
      }

      // Play shake animation on grid container
      const container = document.getElementById('bridge-container');
      if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
      }

      // Reset local selections for the current attempt
      localSelected = [];
      const currentAttempts = (currentData.attempts || 0) + 1;

      if (currentAttempts >= 3) {
        // Exhausted all attempts!
        const activePlayer = currentData.activePlayer;
        const statsUpdate = {};
        statsUpdate[`stats/${activePlayer}/success`] = false;
        statsUpdate[`stats/${activePlayer}/attemptsUsed`] = 3;
        statsUpdate[`attempts`] = 3;
        statsUpdate[`correctSelections`] = [];
        statsUpdate[`phase`] = 'evaluation';
        
        update(bridgeRef, statsUpdate);
      } else {
        // Increment attempts, clear selections in DB
        update(bridgeRef, {
          attempts: currentAttempts,
          correctSelections: []
        });
      }
    }
  }

  // Render continuous reaction buttons for watcher
  function renderWatcherControls() {
    controlsContainer.innerHTML = `
      <div class="watcher-interaction-card">
        <h3>Průběžná reakce:</h3>
        <div class="watcher-buttons">
          <button id="btn-support-cont" class="btn-crystal btn-support-cont">👏 Podpořit</button>
          <button id="btn-hate-cont" class="btn-crystal btn-hate-cont">😜 Výsměch</button>
        </div>
      </div>
    `;

    document.getElementById('btn-support-cont').onclick = () => sendContinuousInteraction('support');
    document.getElementById('btn-hate-cont').onclick = () => sendContinuousInteraction('hate');
  }

  function sendContinuousInteraction(type) {
    const myStatsRef = ref(db, `rooms/${pairId}/actions/level3_bridge/stats/${role}`);
    get(myStatsRef).then((snap) => {
      const stats = snap.val() || {};
      const updateData = {};
      if (type === 'support') {
        updateData.supportSent = (stats.supportSent || 0) + 1;
      } else {
        updateData.hateSent = (stats.hateSent || 0) + 1;
      }
      update(myStatsRef, updateData);

      update(bridgeRef, {
        lastInteraction: {
          sender: role,
          type: type,
          timestamp: serverTimestamp(),
          rand: Math.random()
        }
      });
    });
  }

  // Show visual feedback on screen from continuous interaction
  let lastProcessedInteractionTimestamp = 0;
  function handleInteractionFeedback(interaction) {
    if (interaction.timestamp === lastProcessedInteractionTimestamp) return;
    lastProcessedInteractionTimestamp = interaction.timestamp;

    // Remove old class
    feedbackOverlay.className = 'feedback-overlay';
    feedbackOverlay.innerHTML = '';
    if (feedbackTimer) clearTimeout(feedbackTimer);

    if (interaction.type === 'support') {
      feedbackOverlay.classList.add('show-support');
      feedbackOverlay.innerHTML = `<div class="feedback-text">👏 Parťák tě podporuje!</div>`;
      spawnHeartsParticles();
    } else {
      feedbackOverlay.classList.add('show-hate');
      feedbackOverlay.innerHTML = `<div class="feedback-text">😜 Parťák se ti směje!</div>`;
      
      const container = document.getElementById('bridge-container');
      if (container) {
        container.classList.add('shake');
        setTimeout(() => container.classList.remove('shake'), 400);
      }
    }

    feedbackTimer = setTimeout(() => {
      feedbackOverlay.classList.remove('show-support', 'show-hate');
      feedbackOverlay.innerHTML = '';
    }, 2500);
  }

  function spawnHeartsParticles() {
    for (let i = 0; i < 12; i++) {
      const p = document.createElement('div');
      p.className = 'heart-particle';
      p.textContent = Math.random() > 0.5 ? '❤️' : '🌟';
      p.style.left = `${Math.random() * 80 + 10}%`;
      p.style.bottom = `0px`;
      p.style.fontSize = `${Math.random() * 1.5 + 1}rem`;
      p.style.animationDuration = `${Math.random() * 1.5 + 1}s`;
      feedbackOverlay.appendChild(p);
      setTimeout(() => p.remove(), 2500);
    }
  }

  // Show final reaction choice card for Watcher
  function showFinalReactionModal(activeSuccess, targetTiles, correctSelections) {
    // Check if watcher has already chosen
    const myStatsPath = isSova ? 'player1' : 'player2';
    const finalSent = currentData?.stats?.[myStatsPath]?.finalReactionSent;
    if (finalSent) {
      controlsContainer.innerHTML = `
        <div class="evaluation-wait-card">
          <h2>Reakce uložena!</h2>
          <p>Odeslal jsi: ${finalSent === 'support' ? '👏 (Podpora)' : '😂 (Výsměch)'}</p>
          <p>Čekání na přechod...</p>
        </div>
      `;
      return;
    }

    controlsContainer.innerHTML = `
      <div class="final-reaction-overlay">
        <div class="final-reaction-modal">
          <h2>${activeSuccess ? '👏 Parťák most překonal!' : '😢 Parťák z mostu spadl!'}</h2>
          <p style="margin-bottom: 1.5rem; color: var(--muted); font-size: 1.05rem;">
            Hráč ${partnerAnimal} svou cestu dokončil s výsledkem: ${activeSuccess ? 'ÚSPĚCH' : 'NEÚSPĚCH'}.<br>
            <strong>Musíš zvolit jednu z reakcí, aby hra mohla pokračovat:</strong>
          </p>
          <div class="final-buttons">
            <button id="btn-final-support" class="btn-final btn-final-support">👏 Podpora</button>
            <button id="btn-final-hate" class="btn-final btn-final-hate">😂 Výsměch</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-final-support').onclick = () => submitFinalReaction('support');
    document.getElementById('btn-final-hate').onclick = () => submitFinalReaction('hate');
  }

  function submitFinalReaction(choice) {
    const myStatsPath = isSova ? 'player1' : 'player2';
    const myStatsRef = ref(db, `rooms/${pairId}/actions/level3_bridge/stats/${role}`);

    get(myStatsRef).then((snap) => {
      const stats = snap.val() || {};
      const updates = {
        finalReactionSent: choice
      };
      if (choice === 'support') {
        updates.supportSent = (stats.supportSent || 0) + 1;
      } else {
        updates.hateSent = (stats.hateSent || 0) + 1;
      }

      update(myStatsRef, updates).then(() => {
        // Write the main final reaction event
        update(bridgeRef, {
          finalReaction: {
            sender: role,
            choice: choice,
            timestamp: serverTimestamp()
          }
        }).then(() => {
          handlePostReactionRouting();
        });
      });
    });
  }

  // Show final reaction feedback banner to the active player
  let lastProcessedFinalReactionTimestamp = 0;
  function showFinalReactionBanner(reaction) {
    if (reaction.timestamp === lastProcessedFinalReactionTimestamp) return;
    lastProcessedFinalReactionTimestamp = reaction.timestamp;

    // Display a fullscreen modal/overlay for 4 seconds showing partner's choice
    const overlay = document.createElement('div');
    overlay.className = 'final-feedback-fullscreen-overlay';
    overlay.innerHTML = `
      <div class="final-feedback-fullscreen-card ${reaction.choice === 'support' ? 'support' : 'hate'}">
        <div style="font-size: 5rem; margin-bottom: 1rem;">
          ${reaction.choice === 'support' ? '👏' : '😂'}
        </div>
        <h2>Reakce od parťáka:</h2>
        <h1 style="font-size: 2.2rem; font-weight: bold; margin-bottom: 1rem;">
          ${reaction.choice === 'support' ? 'Podpořil tě!' : 'Vysmál se ti!'}
        </h1>
        <p style="color: var(--muted); font-size: 1.1rem;">
          Pamatujte, že toto je stále jen hra. Za chvíli budeme pokračovat.
        </p>
      </div>
    `;
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.remove();
      handlePostReactionRouting();
    }, 4000);
  }

  // Handle swapping roles or moving to Level 4
  function handlePostReactionRouting() {
    // Sova coordinates routing to avoid double triggers
    if (!isSova) return;

    const activePlayer = currentData.activePlayer;
    const correctSelections = currentData.correctSelections || [];
    const targetTiles = currentData.targetTiles || [];
    const activeSuccess = correctSelections.length === targetTiles.length;

    if (activeSuccess) {
      // Active player succeeded: move to Level 4
      update(bridgeRef, { phase: 'finished' });
      setTimeout(() => {
        set(ref(db, `rooms/${pairId}/state`), 'level4');
      }, 2000);
    } else {
      // Active player failed
      if (activePlayer === 'player1') {
        // Swap roles!
        update(bridgeRef, { phase: 'swapping' });
        setTimeout(() => {
          const newTargetTiles = generateTargetTiles(N, K);
          update(bridgeRef, {
            activePlayer: 'player2',
            targetTiles: newTargetTiles,
            attempts: 0,
            correctSelections: [],
            phase: 'preview',
            lastInteraction: null,
            finalReaction: null
          });
        }, 3000);
      } else {
        // Both have played and failed: proceed to Level 4 anyway
        update(bridgeRef, { phase: 'finished' });
        setTimeout(() => {
          set(ref(db, `rooms/${pairId}/state`), 'level4');
        }, 2000);
      }
    }
  }
}

function showInstructionsModal(title, text) {
  const old = document.getElementById('instructions-modal');
  if (old) return;

  const overlay = document.createElement('div');
  overlay.id = 'instructions-modal';
  overlay.className = 'instructions-modal-overlay';
  overlay.innerHTML = `
    <div class="instructions-modal-card">
      <h2 class="modal-title">📢 Úkol: ${title}</h2>
      <p class="modal-body">${text}</p>
      <button id="btn-dismiss-instruction" class="btn-crystal modal-btn">
        👍 Přečetl jsem a rozumím
      </button>
    </div>
  `;
  document.body.appendChild(overlay);

  const btn = overlay.querySelector('#btn-dismiss-instruction');
  if (btn) {
    btn.onclick = () => overlay.remove();
  }
}

function injectStyles() {
  const styleId = 'level3-bridge-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    #bridge-container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      padding: 1rem;
      font-family: 'Fredoka', 'Segoe UI', sans-serif;
      box-sizing: border-box;
      animation: fadeIn 0.4s ease;
    }
    .role-badge {
      background: var(--primary); 
      color: white; 
      padding: 0.5rem 1.4rem; 
      border-radius: 20px; 
      font-size: 1rem; 
      font-weight: bold; 
      box-shadow: var(--shadow); 
      border: 2px solid rgba(255, 255, 255, 0.1); 
      display: inline-flex;
      align-items: center;
      gap: 10px;
      justify-content: center;
    }
    .bridge-status-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(20, 24, 54, 0.6);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1rem 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: var(--shadow);
    }
    .phase-status-text {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .attempts-counter {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--muted);
    }
    .bridge-grid-wrapper {
      position: relative;
      background: rgba(10, 10, 25, 0.4);
      border: 2px solid rgba(127, 107, 255, 0.15);
      border-radius: 24px;
      padding: 1.2rem;
      box-shadow: inset 0 4px 20px rgba(0,0,0,0.6);
    }
    .bridge-grid {
      display: grid;
      gap: 10px;
      width: 100%;
      aspect-ratio: 1;
    }
    .bridge-tile {
      background: rgba(255, 255, 255, 0.05);
      border: 1.5px solid rgba(127, 107, 255, 0.2);
      border-radius: 12px;
      color: var(--muted);
      font-size: 1.3rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.3);
    }
    .bridge-tile:hover:not(:disabled) {
      background: rgba(127, 107, 255, 0.15);
      border-color: var(--primary-soft);
      color: white;
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 5px 15px rgba(103, 82, 255, 0.2);
    }
    .bridge-tile:active:not(:disabled) {
      transform: scale(0.96);
    }
    .bridge-tile.preview {
      cursor: default;
    }
    .bridge-tile.preview.target {
      background: linear-gradient(135deg, #f1c40f, #e67e22);
      border-color: #f39c12;
      color: #070b1d;
      box-shadow: 0 0 15px rgba(241, 196, 15, 0.5), inset 0 2px 4px rgba(255,255,255,0.3);
    }
    .bridge-tile.correct {
      background: linear-gradient(135deg, #27ae60, #2ecc71) !important;
      border-color: #2ecc71 !important;
      color: white !important;
      box-shadow: 0 0 15px rgba(46, 204, 113, 0.5) !important;
      text-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: not-allowed;
    }
    .bridge-tile.locally-selected {
      background: rgba(46, 204, 113, 0.3);
      border-color: #2ecc71;
      color: white;
    }
    .bridge-tile.wrong {
      background: linear-gradient(135deg, #c0392b, #e74c3c) !important;
      border-color: #e74c3c !important;
      color: white !important;
      animation: tileShake 0.4s ease;
      box-shadow: 0 0 15px rgba(231, 76, 60, 0.6) !important;
    }
    @keyframes tileShake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-4px); }
      40%, 80% { transform: translateX(4px); }
    }
    .feedback-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      border-radius: 24px;
      z-index: 10;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      overflow: hidden;
    }
    .feedback-overlay.show-support {
      background: rgba(39, 174, 96, 0.1);
      border: 3px solid #2ecc71;
    }
    .feedback-overlay.show-hate {
      background: rgba(192, 41, 43, 0.15);
      border: 3px solid #e74c3c;
    }
    .feedback-text {
      background: rgba(0,0,0,0.85);
      padding: 0.8rem 1.6rem;
      border-radius: 40px;
      font-size: 1.2rem;
      font-weight: 700;
      color: white;
      box-shadow: var(--shadow);
      animation: popScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes popScale {
      from { transform: scale(0.6); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .heart-particle {
      position: absolute;
      pointer-events: none;
      animation: floatUpAndOut 2.5s ease-in forwards;
      opacity: 0.8;
      z-index: 11;
    }
    @keyframes floatUpAndOut {
      0% { transform: translateY(0) scale(0.6) rotate(0deg); opacity: 1; }
      80% { opacity: 0.6; }
      100% { transform: translateY(-300px) scale(1.2) rotate(360deg); opacity: 0; }
    }
    .watcher-interaction-card {
      background: rgba(20, 24, 54, 0.6);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 1.2rem;
      margin-top: 1.5rem;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .watcher-interaction-card h3 {
      margin: 0 0 0.8rem 0;
      font-size: 1rem;
      color: var(--muted);
    }
    .watcher-buttons {
      display: flex;
      gap: 12px;
    }
    .btn-support-cont {
      flex: 1;
      background: rgba(39, 174, 96, 0.15) !important;
      border-color: #27ae60 !important;
      color: #2ecc71 !important;
    }
    .btn-support-cont:hover {
      background: #27ae60 !important;
      color: white !important;
    }
    .btn-hate-cont {
      flex: 1;
      background: rgba(231, 76, 60, 0.15) !important;
      border-color: #e74c3c !important;
      color: #e74c3c !important;
    }
    .btn-hate-cont:hover {
      background: #e74c3c !important;
      color: white !important;
    }
    .evaluation-wait-card {
      background: rgba(20, 24, 54, 0.6);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 2.2rem;
      margin-top: 1.5rem;
      text-align: center;
      box-shadow: var(--shadow);
    }
    .evaluation-wait-card h2 {
      margin: 0 0 0.6rem 0;
      color: white;
      font-size: 1.4rem;
    }
    .evaluation-wait-card p {
      margin: 0 0 1.5rem 0;
      color: var(--muted);
    }
    .spinner-loader {
      width: 40px;
      height: 40px;
      border: 3.5px solid rgba(255,255,255,0.06);
      border-top-color: var(--primary);
      border-radius: 50%;
      margin: 0 auto;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .final-reaction-overlay {
      background: rgba(15,15,25,0.9);
      border: 2px solid var(--border);
      border-radius: 24px;
      padding: 1.8rem;
      margin-top: 1.5rem;
      box-shadow: var(--shadow);
    }
    .final-reaction-modal {
      text-align: center;
    }
    .final-reaction-modal h2 {
      margin: 0 0 0.5rem 0;
      font-size: 1.35rem;
    }
    .final-buttons {
      display: flex;
      gap: 12px;
      margin-top: 1rem;
    }
    .btn-final {
      flex: 1;
      padding: 1rem;
      font-size: 1.1rem;
      font-weight: 700;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-final-support {
      border: 2px solid #2ecc71;
      background: rgba(46, 204, 113, 0.12);
      color: #2ecc71;
    }
    .btn-final-support:hover {
      background: #2ecc71;
      color: white;
    }
    .btn-final-hate {
      border: 2px solid #e74c3c;
      background: rgba(231, 76, 60, 0.12);
      color: #e74c3c;
    }
    .btn-final-hate:hover {
      background: #e74c3c;
      color: white;
    }
    .final-feedback-fullscreen-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15,15,25,0.98);
      z-index: 20000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Fredoka', sans-serif;
    }
    .final-feedback-fullscreen-card {
      background: var(--card);
      border-radius: 28px;
      padding: 3.5rem 2.5rem;
      max-width: 500px;
      width: 90%;
      text-align: center;
      box-shadow: 0 30px 100px rgba(0,0,0,0.6);
      animation: popScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .final-feedback-fullscreen-card.support {
      border: 2.5px solid #2ecc71;
      box-shadow: 0 0 40px rgba(46, 204, 113, 0.3);
    }
    .final-feedback-fullscreen-card.hate {
      border: 2.5px solid #e74c3c;
      box-shadow: 0 0 40px rgba(231, 76, 60, 0.3);
    }
    .instructions-modal-overlay {
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
    }
    .instructions-modal-card {
      background: var(--card);
      border: 2px solid var(--primary);
      border-radius: 24px;
      padding: 2.5rem;
      max-width: 550px;
      width: 90%;
      text-align: center;
      box-shadow: var(--shadow);
      color: var(--text);
      animation: popScale 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .modal-title {
      color: var(--primary);
      margin: 0 0 1rem 0;
      font-size: 1.8rem;
    }
    .modal-body {
      font-size: 1.15rem;
      line-height: 1.6;
      margin: 0 0 2rem 0;
      color: var(--text);
      text-align: left;
    }
    .modal-btn {
      padding: 1rem 2.5rem;
      font-size: 1.2rem;
      cursor: pointer;
      width: 100%;
    }
  `;
  document.head.appendChild(style);
}