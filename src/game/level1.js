import { ref, set, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

let localSignalState = { type: null, count: 0 };

export function initLevel1(db, pairId, role, animal, avatar) {
  const isSova = (role === 'player1');
  console.log(`Inicializace Level 1: Role=${role}, IsSova=${isSova}`);

  let myAnimal = animal || (isSova ? 'Sova' : 'Rys');
  let myAvatar = avatar || 'default.svg';
  let partnerAnimal = isSova ? 'Rys' : 'Sova';
  let partnerAvatar = 'default.svg';
  let player2Avatar = isSova ? 'default.svg' : myAvatar; // player2 is Rys/Poutník
  let instructionsShown = false;
  let renderGridFn = null;

  const gameRoot = document.getElementById('game-root');
  gameRoot.innerHTML = `
    <div id="level1-container" class="${isSova ? 'sova-view' : 'rys-view'}">
      <div id="level1-role-header" class="role-indicator-header" style="text-align: center; margin-bottom: 0.8rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 1rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
          <img src="assets/avatars/${myAvatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.4);" />
          <span>Jsi: <strong style="color: ${isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)'}">${myAnimal}</strong> (${isSova ? 'Navigátor' : 'Poutník'})</span>
        </span>
      </div>
      <div class="level-instructions" style="display: none;"></div>
      <div id="game-grid"></div>
      <div id="collision-message" class="hidden"></div>
      <div id="signal-overlay"></div>
      <div id="controls"></div>
    </div>
  `;

  const gridEl = document.getElementById('game-grid');
  const controlsEl = document.getElementById('controls');
  const signalOverlay = document.getElementById('signal-overlay');

  // Načtení detailů obou hráčů z DB
  const playersRef = ref(db, `rooms/${pairId}/players`);
  onValue(playersRef, (snapshot) => {
    const players = snapshot.val() || {};
    const p1 = players.animal1 || {};
    const p2 = players.animal2 || {};

    if (isSova) {
      if (p2.animal) partnerAnimal = p2.animal;
      if (p2.avatar) partnerAvatar = p2.avatar;
      player2Avatar = partnerAvatar;
    } else {
      if (p1.animal) partnerAnimal = p1.animal;
      if (p1.avatar) partnerAvatar = p1.avatar;
      player2Avatar = myAvatar;
    }

    // Aktualizace záhlaví
    const headerEl = document.getElementById('level1-role-header');
    if (headerEl) {
      headerEl.innerHTML = `
        <span style="background: var(--primary); color: white; padding: 0.4rem 1.2rem; border-radius: 20px; font-size: 1rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
          <img src="assets/avatars/${myAvatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1.5px solid rgba(255,255,255,0.4);" />
          <span>Jsi: <strong style="color: ${isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)'}">${myAnimal}</strong> (${isSova ? 'Navigátor' : 'Poutník'})</span>
        </span>
      `;
    }

    // Zobrazení instrukcí jako modal ke schválení (pouze jednou)
    if (!instructionsShown) {
      instructionsShown = true;
      const title = isSova ? `${myAnimal} (Navigátor)` : `${myAnimal} (Poutník)`;
      const text = `Tvoje role v této úrovni: <strong style="color: ${isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)"}; font-size: 1.3rem;">${myAnimal} (${isSova ? "Navigátor" : "Poutník"})</strong>.<br><br>` +
        (isSova 
          ? `Vidíš celou mapu lesa i skryté pasti. Tvým úkolem je bezpečně navigovat <strong>${partnerAnimal}</strong> (parťáka) do zeleného cíle.<br><br>Pomocí tlačítek ve tvaru šipek mu vysílej signály, kudy má jít, případně ho zastav tlačítkem STOP nebo upozorni na PAST.`
          : `Nacházíš se v absolutní tmě mlžného lesa a vidíš jen svůj svítící bod. Nemůžeš se hýbat sám bez rozmyslu, protože v lese číhají neviditelné pasti!<br><br>Sleduj velké blikající signály od <strong>${partnerAnimal}</strong> (parťáka), která má mapu, a pohybuj se šipkami na klávesnici podle jejích rad.`);
      showInstructionsModal(title, text);
    }

    // Pokud je již spuštěný render mřížky, vynutíme překreslení kvůli novému avataru na mřížce
    if (renderGridFn && currentPos) {
      renderGridFn(currentPos);
    }
  });

  if (isSova) {
    controlsEl.innerHTML = `
      <div class="navigation-pad" style="margin-top: 0.8rem; padding: 1rem;">
        <div class="nav-grid" style="display: grid; grid-template-columns: repeat(3, 60px); grid-template-rows: repeat(2, 60px); gap: 8px; justify-content: center; margin-bottom: 0.8rem;">
          <div></div>
          <button class="btn-nav" id="btn-sig-UP">↑</button>
          <div></div>
          <button class="btn-nav" id="btn-sig-LEFT">←</button>
          <button class="btn-nav" id="btn-sig-DOWN">↓</button>
          <button class="btn-nav" id="btn-sig-RIGHT">→</button>
        </div>
        <div class="action-buttons" style="display: flex; gap: 12px; width: 100%; max-width: 250px; margin: 0 auto;">
          <button class="btn-action" id="btn-sig-STOP" style="flex: 1; padding: 0.6rem; font-weight: 700; border-radius: 12px; cursor: pointer; background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 2px solid #e74c3c; transition: all 0.2s;">🛑 STOP!</button>
          <button class="btn-action" id="btn-sig-TRAP" style="flex: 1; padding: 0.6rem; font-weight: 700; border-radius: 12px; cursor: pointer; background: rgba(241, 196, 15, 0.15); color: #f1c40f; border: 2px solid #f1c40f; transition: all 0.2s;">⚠️ PAST</button>
        </div>
      </div>
    `;

    controlsEl.querySelectorAll('.btn-nav, .btn-action').forEach(btn => {
      btn.onmousedown = () => btn.style.transform = 'scale(0.95)';
      btn.onmouseup = () => btn.style.transform = 'scale(1)';
      btn.onmouseleave = () => btn.style.transform = 'scale(1)';
    });

    const bindSignal = (id) => {
      document.getElementById(`btn-sig-${id}`).onclick = () => {
        if (localSignalState.type === id) {
          localSignalState.count++;
        } else {
          localSignalState.type = id;
          localSignalState.count = 1;
        }
        set(ref(db, `rooms/${pairId}/actions/level1_darkness/lastSignal`), {
          type: id,
          count: localSignalState.count,
          timestamp: serverTimestamp()
        });
      };
    };

    ['UP', 'DOWN', 'LEFT', 'RIGHT', 'STOP', 'TRAP'].forEach(bindSignal);
  }

  let currentPos = { x: 0, y: 0 };
  let mapDataLoaded = false;
  let LEVEL1_MAP = null;
  let startPos = null;
  let goalPos = null;

  const levelRef = ref(db, `rooms/${pairId}/actions/level1_darkness`);

  // Posluchač na vygenerovaná data levelu v DB
  onValue(levelRef, (snapshot) => {
    const data = snapshot.val();
    
    const pathLength = (data && data.map && data.startPos && data.goalPos)
      ? getShortestPathLengthBFS(data.map, data.startPos.x, data.startPos.y, data.goalPos.x, data.goalPos.y)
      : -1;
    const hasInvalidPath = pathLength < 15;

    if (!data || !data.map || hasInvalidPath) {
      if (isSova) {
        console.log("Detekována neplatná nebo neprůchodná mapa. Generuji novou...");
        const levelData = generateLevel1Data();
        update(levelRef, {
          map: levelData.map,
          startPos: levelData.startPos,
          goalPos: levelData.goalPos
        }).then(() => {
          set(ref(db, `rooms/${pairId}/playerPosition`), levelData.startPos);
        });
      } else {
        gridEl.innerHTML = '<div style="margin: auto; color: var(--muted); text-align: center;"><span class="spinner" style="display: block; margin: 0 auto 1rem auto;"></span> Generování náhodného lesa parťákem...</div>';
      }
      return;
    }

    if (mapDataLoaded) return;
    mapDataLoaded = true;

    LEVEL1_MAP = data.map;
    startPos = data.startPos;
    goalPos = data.goalPos;

    // Spustíme hru se sdílenými daty
    setupGameplay(LEVEL1_MAP, startPos, goalPos);
  });

  function setupGameplay(LEVEL1_MAP, startPos, goalPos) {
    function renderGrid(currentPos) {
      gridEl.innerHTML = '';
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const cell = document.createElement('div');
          cell.className = 'cell';
          const type = LEVEL1_MAP[y][x];
          
          if (isSova) {
            if (type === 1) cell.classList.add('wall');
            if (type === 2) cell.classList.add('trap');
            if (x === goalPos.x && y === goalPos.y) cell.classList.add('goal');
          } else {
            // Rys je v absolutní tmě, nevidí zdi ani pasti kolem sebe
          }
          
          if (currentPos.x === x && currentPos.y === y) {
            cell.classList.add('player-node');
            const img = document.createElement('img');
            img.src = `assets/avatars/${player2Avatar}`;
            img.style.cssText = `
              width: 100%;
              height: 100%;
              border-radius: 50%;
              object-fit: cover;
              display: block;
            `;
            cell.appendChild(img);
          }
          gridEl.appendChild(cell);
        }
      }
    }
    renderGridFn = renderGrid;

    if (!isSova) {
      window.onkeydown = (e) => {
        let nextX = currentPos.x;
        let nextY = currentPos.y;
        if (e.key === 'ArrowUp') nextY--;
        if (e.key === 'ArrowDown') nextY++;
        if (e.key === 'ArrowLeft') nextX--;
        if (e.key === 'ArrowRight') nextX++;

        if (nextX >= 0 && nextX < 10 && nextY >= 0 && nextY < 10) {
          const targetTile = LEVEL1_MAP[nextY][nextX];
          if (targetTile !== 1) { // 1 = zeď
            if (targetTile === 2) { // 2 = past
              handleCollision(db, pairId, startPos, myAnimal);
            } else {
              set(ref(db, `rooms/${pairId}/playerPosition`), { x: nextX, y: nextY });
            }
          }
        }
      };
    }

    let isTransitioning = false;
    onValue(ref(db, `rooms/${pairId}/playerPosition`), (snapshot) => {
      const pos = snapshot.val() || startPos;
      currentPos = pos;
      renderGrid(pos);
      
      if (pos.x === goalPos.x && pos.y === goalPos.y && !isTransitioning) {
        isTransitioning = true;
        if (!isSova) window.onkeydown = null;
        set(ref(db, `rooms/${pairId}/actions/level2_warmth`), null).then(() => {
          set(ref(db, `rooms/${pairId}/state`), 'level2');
        });
      }
    });

    onValue(ref(db, `rooms/${pairId}/actions/level1_darkness/lastSignal`), (snapshot) => {
      const signal = snapshot.val();
      if (signal && !isSova) {
        showSignalOverlay(signal.type, signal.count || 1, signalOverlay);
      }
    });

    // Listener pro oznámení o srážce/chybě
    onValue(ref(db, `rooms/${pairId}/actions/level1_darkness/collision`), (snapshot) => {
      const collision = snapshot.val();
      if (collision) {
        if (!isSova) {
          showCollisionModal(collision.message, myAnimal);
        }
      }
    });
  }
}

// Procedurální generátor náhodné mapy s garantovanou cestou ze startu do cíle (min. 15 kroků)
function generateLevel1Data() {
  const width = 10;
  const height = 10;
  
  let startX, startY, goalX, goalY;
  let attempts = 0;
  let map;
  
  while (attempts < 5000) {
    attempts++;
    
    // Generování startu a cíle s Manhattan vzdáleností alespoň 10 pro větší šanci na dlouhou cestu
    do {
      startX = Math.floor(Math.random() * width);
      startY = Math.floor(Math.random() * height);
      goalX = Math.floor(Math.random() * width);
      goalY = Math.floor(Math.random() * height);
    } while (Math.abs(startX - goalX) + Math.abs(startY - goalY) < 10);

    map = Array.from({ length: height }, () => Array(width).fill(0));
    
    // Umístění zhruba 24 náhodných zdí
    let wallsPlaced = 0;
    while (wallsPlaced < 24) {
      const rx = Math.floor(Math.random() * width);
      const ry = Math.floor(Math.random() * height);
      if ((rx === startX && ry === startY) || (rx === goalX && ry === goalY) || map[ry][rx] !== 0) {
        continue;
      }
      map[ry][rx] = 1; // Zeď
      wallsPlaced++;
    }

    // Umístění zhruba 6 náhodných pastí
    let trapsPlaced = 0;
    while (trapsPlaced < 6) {
      const rx = Math.floor(Math.random() * width);
      const ry = Math.floor(Math.random() * height);
      if ((rx === startX && ry === startY) || (rx === goalX && ry === goalY) || map[ry][rx] !== 0) {
        continue;
      }
      map[ry][rx] = 2; // Past
      trapsPlaced++;
    }

    // Kontrola délky nejkratší cesty pomocí BFS (požadujeme alespoň 15 kroků)
    const pathLength = getShortestPathLengthBFS(map, startX, startY, goalX, goalY);
    if (pathLength >= 15) {
      break;
    }
  }

  return {
    map: map,
    startPos: { x: startX, y: startY },
    goalPos: { x: goalX, y: goalY }
  };
}

function getShortestPathLengthBFS(map, sx, sy, gx, gy) {
  const width = 10;
  const height = 10;
  const queue = [[sx, sy, 0]];
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  visited[sy][sx] = true;

  const dx = [0, 0, -1, 1];
  const dy = [-1, 1, 0, 0];

  while (queue.length > 0) {
    const [x, y, dist] = queue.shift();
    if (x === gx && y === gy) return dist;

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (!visited[ny][nx] && map[ny][nx] === 0) { // 0 = volná cesta (bez zdí i pastí)
          visited[ny][nx] = true;
          queue.push([nx, ny, dist + 1]);
        }
      }
    }
  }
  return -1;
}

function showSignalOverlay(type, count, el) {
  const icons = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', STOP: '🛑', TRAP: '⚠️' };
  const countDisplay = count > 1 ? `<span class="signal-count">${count}</span>` : '';
  el.innerHTML = `${icons[type] || ''}${countDisplay}`;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 1500);
}

function handleCollision(db, pairId, startPos, myAnimal) {
  const name = myAnimal || "Poutník";
  const collisionData = {
    message: `⚠️ Pád do pasti! ${name} narazil na neviditelnou překážku a vrací se na začátek lesa.`,
    timestamp: serverTimestamp()
  };
  set(ref(db, `rooms/${pairId}/actions/level1_darkness/collision`), collisionData);
  
  set(ref(db, `rooms/${pairId}/playerPosition`), startPos);
  const resetRef = ref(db, `rooms/${pairId}/actions/level1_darkness/resetCount`);
  onValue(resetRef, (snap) => {
    set(resetRef, (snap.val() || 0) + 1);
  }, { onlyOnce: true });
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

function showCollisionModal(text, myAnimal) {
  const old = document.getElementById('collision-modal');
  if (old) return;
  const name = myAnimal || "Poutník";

  const overlay = document.createElement('div');
  overlay.id = 'collision-modal';
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
    <div style="background: var(--card); border: 2px solid var(--error); border-radius: 24px; padding: 2.5rem; max-width: 500px; width: 90%; text-align: center; box-shadow: var(--shadow); color: var(--text);">
      <div style="font-size: 4rem; margin-bottom: 1rem;">⚠️</div>
      <h2 style="color: var(--error); margin: 0 0 1rem 0; font-size: 1.6rem;">Pozor! Pád do pasti!</h2>
      <p style="font-size: 1.15rem; line-height: 1.6; margin: 0 0 2rem 0; color: var(--text);">
        ${name} narazil na neviditelnou překážku a vrací se na začátek lesa. Sledujte pozorně navigaci!
      </p>
      <button id="btn-dismiss-collision" class="btn-crystal" style="background: var(--error); color: white; border: none; padding: 1rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%;">
        🏃 Rozumím, zkusit znovu
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  
  const btn = overlay.querySelector('#btn-dismiss-collision');
  if (btn) {
    btn.onclick = () => {
      overlay.remove();
    };
  }
}