import { ref, set, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

let localSignalState = { type: null, count: 0 };

export function initLevel1(db, pairId, role) {
  const isSova = (role === 'player1');
  console.log(`Inicializace Level 1: Role=${role}, IsSova=${isSova}`);

  const gameRoot = document.getElementById('game-root');
  gameRoot.innerHTML = `
    <div id="level1-container" class="${isSova ? 'sova-view' : 'rys-view'}">
      <div class="role-indicator-header" style="text-align: center; margin-bottom: 1.5rem; font-family: 'Fredoka', 'Segoe UI', sans-serif;">
        <span style="background: var(--primary); color: white; padding: 0.6rem 1.8rem; border-radius: 20px; font-size: 1.15rem; font-weight: bold; box-shadow: var(--shadow); border: 2px solid rgba(255, 255, 255, 0.1); display: inline-block;">
          Jsi: ${isSova ? '🦉 SOVA (Navigátor)' : '🐾 RYS (Poutník)'}
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

  // Zobrazení instrukcí jako modal ke schválení (vhodné pro pomalu čtoucí žáky)
  const title = isSova ? "Sova (Navigátor)" : "Rys (Poutník)";
  const text = "Tvoje role v této úrovni: <strong style='color: " + (isSova ? "var(--sova-color, #3498db)" : "var(--rys-color, #e67e22)") + "; font-size: 1.3rem;'>" + (isSova ? "🦉 SOVA (Navigátor)" : "🐾 RYS (Poutník)") + "</strong>.<br><br>" +
    (isSova 
      ? "Vidíš celou mapu lesa i skryté pasti. Tvým úkolem je bezpečně navigovat Rysa (parťáka) do zeleného cíle.<br><br>Pomocí tlačítek ve tvaru šipek mu vysílej signály, kudy má jít, případně ho zastav tlačítkem STOP nebo upozorni na PAST."
      : "Nacházíš se v absolutní tmě mlžného lesa a vidíš jen svůj svítící bod. Nemůžeš se hýbat sám bez rozmyslu, protože v lese číhají neviditelné pasti!<br><br>Sleduj velké blikající signály od Sovy (parťáka), která má mapu, a pohybuj se šipkami na klávesnici podle jejích rad.");
  showInstructionsModal(title, text);

  if (isSova) {
    controlsEl.innerHTML = `
      <div class="navigation-pad" style="display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-top: 1.5rem;">
        <div class="nav-grid" style="display: grid; grid-template-columns: repeat(3, 75px); grid-template-rows: repeat(2, 75px); gap: 10px; justify-content: center;">
          <div></div>
          <button class="btn-nav" id="btn-sig-UP" style="width: 75px; height: 75px; font-size: 1.8rem; font-weight: bold; border-radius: 18px; border: 2px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); transition: transform 0.1s;">↑</button>
          <div></div>
          <button class="btn-nav" id="btn-sig-LEFT" style="width: 75px; height: 75px; font-size: 1.8rem; font-weight: bold; border-radius: 18px; border: 2px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); transition: transform 0.1s;">←</button>
          <button class="btn-nav" id="btn-sig-DOWN" style="width: 75px; height: 75px; font-size: 1.8rem; font-weight: bold; border-radius: 18px; border: 2px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); transition: transform 0.1s;">↓</button>
          <button class="btn-nav" id="btn-sig-RIGHT" style="width: 75px; height: 75px; font-size: 1.8rem; font-weight: bold; border-radius: 18px; border: 2px solid var(--border); background: var(--card); color: var(--text); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow); transition: transform 0.1s;">→</button>
        </div>
        <div class="action-buttons" style="display: flex; gap: 12px; width: 100%; max-width: 250px;">
          <button class="btn-action" id="btn-sig-STOP" style="flex: 1; padding: 0.9rem; font-weight: 700; border-radius: 12px; cursor: pointer; background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 2px solid #e74c3c; transition: all 0.2s;">🛑 STOP!</button>
          <button class="btn-action" id="btn-sig-TRAP" style="flex: 1; padding: 0.9rem; font-weight: 700; border-radius: 12px; cursor: pointer; background: rgba(241, 196, 15, 0.15); color: #f1c40f; border: 2px solid #f1c40f; transition: all 0.2s;">⚠️ PAST</button>
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
    
    if (!data || !data.map) {
      if (isSova) {
        console.log("Generuji novou náhodnou mapu lesa...");
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
            // Rys vidí cíl až když na něj stoupne (asymetrická hra, navigátor ho musí navádět naslepo)
          }
          
          if (currentPos.x === x && currentPos.y === y) {
            cell.classList.add('player-node');
          }
          gridEl.appendChild(cell);
        }
      }
    }

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
              handleCollision(db, pairId, startPos);
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
        set(ref(db, `rooms/${pairId}/state`), 'level2');
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
          showCollisionModal(collision.message);
        }
      }
    });
  }
}

// Procedurální generátor náhodné mapy s garantovanou cestou ze startu do cíle
function generateLevel1Data() {
  const width = 10;
  const height = 10;
  
  // 1. Výběr náhodného startu a cíle s Manhattan vzdáleností alespoň 6
  let startX, startY, goalX, goalY;
  do {
    startX = Math.floor(Math.random() * width);
    startY = Math.floor(Math.random() * height);
    goalX = Math.floor(Math.random() * width);
    goalY = Math.floor(Math.random() * height);
  } while (Math.abs(startX - goalX) + Math.abs(startY - goalY) < 6);

  let map;
  let attempts = 0;
  
  while (attempts < 1000) {
    attempts++;
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

    // Kontrola průchodnosti zdi pomocí BFS
    if (hasPathBFS(map, startX, startY, goalX, goalY)) {
      break;
    }
  }

  return {
    map: map,
    startPos: { x: startX, y: startY },
    goalPos: { x: goalX, y: goalY }
  };
}

function hasPathBFS(map, sx, sy, gx, gy) {
  const width = 10;
  const height = 10;
  const queue = [[sx, sy]];
  const visited = Array.from({ length: height }, () => Array(width).fill(false));
  visited[sy][sx] = true;

  const dx = [0, 0, -1, 1];
  const dy = [-1, 1, 0, 0];

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === gx && y === gy) return true;

    for (let i = 0; i < 4; i++) {
      const nx = x + dx[i];
      const ny = y + dy[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (!visited[ny][nx] && map[ny][nx] !== 1) { // 1 = zeď
          visited[ny][nx] = true;
          queue.push([nx, ny]);
        }
      }
    }
  }
  return false;
}

function showSignalOverlay(type, count, el) {
  const icons = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', STOP: '🛑', TRAP: '⚠️' };
  const countDisplay = count > 1 ? `<span class="signal-count">${count}</span>` : '';
  el.innerHTML = `${icons[type] || ''}${countDisplay}`;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 1500);
}

function handleCollision(db, pairId, startPos) {
  const collisionData = {
    message: "⚠️ Pád do pasti! Rys narazil na neviditelnou překážku a vrací se na začátek lesa.",
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

function showCollisionModal(text) {
  const old = document.getElementById('collision-modal');
  if (old) return;

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
        Rys narazil na neviditelnou překážku a vrací se na začátek lesa. Sledujte pozorně navigaci!
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