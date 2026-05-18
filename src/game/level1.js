import { ref, set, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

// Mapa 10x10: 0=cesta, 1=zeď, 2=past, 3=cíl
const LEVEL1_MAP = [
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 1, 0, 1, 1, 1, 1, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 2, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 2, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 2, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 0]
];

let localSignalState = { type: null, count: 0 };

export function initLevel1(db, pairId, role) {
  const isSova = (role === 'player1');
  console.log(`Inicializace Level 1: Role=${role}, IsSova=${isSova}`);

  const instructions = isSova 
    ? "Jsi <strong>Sova (Navigátor)</strong>. Vidíš celou mapu i pasti. Pomocí tlačítek vysílej signály parťákovi, aby se bezpečně dostal do cíle (zelené pole)."
    : "Jsi <strong>Rys (Poutník)</strong>. Vidíš jen tmu a svůj bod. Sleduj signály od Sovy a pohybuj se pomocí šipek na klávesnici do bezpečí.";

  const gameRoot = document.getElementById('game-root');
  gameRoot.innerHTML = `
    <div id="level1-container" class="${isSova ? 'sova-view' : 'rys-view'}">
      <div class="level-instructions">${instructions}</div>
      <div id="game-grid"></div>
      <div id="collision-message" class="hidden"></div>
      <div id="signal-overlay"></div>
      <div id="controls"></div>
    </div>
  `;

  const gridEl = document.getElementById('game-grid');
  const controlsEl = document.getElementById('controls');
  const signalOverlay = document.getElementById('signal-overlay');
  const collisionMsgEl = document.getElementById('collision-message');

  if (isSova) {
    console.log("Sova nastavuje počáteční pozici v DB...");
    set(ref(db, `rooms/${pairId}/playerPosition`), { x: 0, y: 0 });
  }

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
          if (x === 9 && y === 9) cell.classList.add('goal');
        }
        if (currentPos.x === x && currentPos.y === y) {
          cell.classList.add('player-node');
        }
        gridEl.appendChild(cell);
      }
    }
  }

  if (isSova) {
    const signals = [
      { id: 'UP', label: '↑ Vpřed' }, { id: 'DOWN', label: '↓ Vzad' },
      { id: 'LEFT', label: '← Vlevo' }, { id: 'RIGHT', label: '→ Vpravo' },
      { id: 'STOP', label: 'STOP!' }, { id: 'TRAP', label: '⚠️ PAST' }
    ];
    signals.forEach(sig => {
      const btn = document.createElement('button');
      btn.textContent = sig.label;
      btn.onclick = () => {
        if (localSignalState.type === sig.id) {
          localSignalState.count++;
        } else {
          localSignalState.type = sig.id;
          localSignalState.count = 1;
        }
        set(ref(db, `rooms/${pairId}/actions/level1_darkness/lastSignal`), {
          type: sig.id,
          count: localSignalState.count,
          timestamp: serverTimestamp()
        });
      };
      controlsEl.appendChild(btn);
    });
  }

  if (!isSova) {
    window.onkeydown = (e) => {
      onValue(ref(db, `rooms/${pairId}/playerPosition`), (snapshot) => {
        const pos = snapshot.val() || { x: 0, y: 0 };
        let nextX = pos.x;
        let nextY = pos.y;
        if (e.key === 'ArrowUp') nextY--;
        if (e.key === 'ArrowDown') nextY++;
        if (e.key === 'ArrowLeft') nextX--;
        if (e.key === 'ArrowRight') nextX++;

        if (nextX >= 0 && nextX < 10 && nextY >= 0 && nextY < 10) {
          const targetTile = LEVEL1_MAP[nextY][nextX];
          if (targetTile !== 1) {
            if (targetTile === 2) {
              handleCollision(db, pairId);
            } else {
              set(ref(db, `rooms/${pairId}/playerPosition`), { x: nextX, y: nextY });
            }
          }
        }
      }, { onlyOnce: true });
    };
  }

  let isTransitioning = false;
  onValue(ref(db, `rooms/${pairId}/playerPosition`), (snapshot) => {
    const pos = snapshot.val() || { x: 0, y: 0 };
    renderGrid(pos);
    if (pos.x === 9 && pos.y === 9 && !isTransitioning) {
      isTransitioning = true;
      // Update místnosti na level 2
      if (!isSova) window.onkeydown = null; // Zastavíme ovládání u Ryse
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
      showCollisionMessage(collision.message, collisionMsgEl);
    }
  });
}

function showSignalOverlay(type, count, el) {
  const icons = { UP: '↑', DOWN: '↓', LEFT: '←', RIGHT: '→', STOP: '🛑', TRAP: '⚠️' };
  const countDisplay = count > 1 ? `<span class="signal-count">${count}</span>` : '';
  el.innerHTML = `${icons[type] || ''}${countDisplay}`;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 1500);
}

function showCollisionMessage(text, el) {
  el.textContent = text;
  el.classList.remove('hidden');
  el.classList.add('show');
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.classList.add('hidden'), 500);
  }, 4000);
}

function handleCollision(db, pairId) {
  const collisionData = {
    message: "⚠️ Pád do pasti! Rys narazil na neviditelnou překážku a vrací se na začátek lesa.",
    timestamp: serverTimestamp()
  };
  set(ref(db, `rooms/${pairId}/actions/level1_darkness/collision`), collisionData);
  
  set(ref(db, `rooms/${pairId}/playerPosition`), { x: 0, y: 0 });
  const resetRef = ref(db, `rooms/${pairId}/actions/level1_darkness/resetCount`);
  onValue(resetRef, (snap) => {
    set(resetRef, (snap.val() || 0) + 1);
  }, { onlyOnce: true });
}