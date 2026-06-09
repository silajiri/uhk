import { ref, onValue, update, serverTimestamp, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { initLevel1 } from './level1.js';
import { initLevel2 } from './level2.js';
import { initLevel3 } from './level3.js';
import { initLevel4 } from './level4.js';
import { initReflection } from './reflection.js';

export function initGameRouter(db, pairId, role, animal, avatar) {
  // Posluchač pro překreslení po odhalení identity
  document.addEventListener('uhk-reveal-done', () => {
    initReflection(db, pairId, role, animal);
  });

  console.log(`Game Router spuštěn pro místnost: ${pairId}, role: ${role}`);

  if (!pairId || pairId === "undefined") {
    console.error("Chyba: Chybí pairId! Hráč není přiřazen do místnosti.");
    document.getElementById('game-root').innerHTML = '<div class="status-message">Chyba: Nejste přiřazeni do žádné dvojice. Prosím, kontaktujte učitele.</div>';
    return;
  }

  // 1. Registrace přítomnosti hráče (nutné pro Security Rules)
  const playerPath = role === 'player1' ? 'animal1' : 'animal2';
  update(ref(db, `rooms/${pairId}/players/${playerPath}`), {
    animal: animal,
    avatar: avatar || 'default.svg',
    status: 'online',
    lastSeen: serverTimestamp()
  }).then(() => console.log("Přítomnost hráče uložena do DB."));

  const stateRef = ref(db, `rooms/${pairId}/state`);

  onValue(stateRef, (snapshot) => {
    const state = snapshot.val() || 'level1';
    console.log("Aktuální stav hry v DB:", state);

    const root = document.getElementById('game-root');
    if (root) root.innerHTML = '';

    switch (state) {
      case 'level1':
        console.log("Spouštím Level 1...");
        initLevel1(db, pairId, role, animal, avatar);
        break;
      case 'level2': {
        // Před-inicializujeme data pro Level 2 ihned, aby se předešlo race conditions ze starých her
        const levelRef = ref(db, `rooms/${pairId}/actions/level2_warmth`);
        get(levelRef).then((snapshot) => {
          if (!snapshot.exists() || !snapshot.val() || !snapshot.val().crystalHolder) {
            update(levelRef, {
              crystalHolder: 'player1',
              'temperatures/player1': 100,
              'temperatures/player2': 100,
              startTime: null,
              resetCount: 0,
              'ready/player1': false,
              'ready/player2': false
            });
          }
        });

        // Načteme přezdívky zvířat z DB
        const playersRef = ref(db, `rooms/${pairId}/players`);
        get(playersRef).then((playersSnap) => {
          const players = playersSnap.val() || {};
          const p1Animal = players.animal1?.animal || 'Sova';
          const p2Animal = players.animal2?.animal || 'Rys';

          root.innerHTML = `
            <div class="level-transition-card">
              <div class="success-icon">🌟</div>
              <h1>Cíl dosažen!</h1>
              <p>Společně jste ruku v ruce bezpečně prošli temným lesem. <strong>${p1Animal}</strong> vedl(a) s rozvahou a <strong>${p2Animal}</strong> projevil(a) hlubokou důvěru.</p>
              <div class="status-message" style="margin-bottom: 1.5rem;">Připravte se, Mlžný les začíná chladnout...</div>
              <button id="btn-transition-continue" class="btn-crystal" style="width: 100%; padding: 1.1rem; font-size: 1.15rem; font-weight: 700; cursor: pointer; border-radius: 18px;">
                Pokračovat do další úrovně ➔
              </button>
            </div>
          `;

          const btn = document.getElementById('btn-transition-continue');
          if (btn) {
            btn.onclick = () => {
              initLevel2(db, pairId, role, animal, avatar);
            };
          }
        }).catch((err) => {
          console.error("Chyba při načítání přezdívek pro přechod:", err);
          root.innerHTML = `
            <div class="level-transition-card">
              <div class="success-icon">🌟</div>
              <h1>Cíl dosažen!</h1>
              <p>Společně jste ruku v ruce bezpečně prošli temným lesem. Sova vedla s rozvahou a Rys projevil hlubokou důvěru.</p>
              <div class="status-message" style="margin-bottom: 1.5rem;">Připravte se, Mlžný les začíná chladnout...</div>
              <button id="btn-transition-continue" class="btn-crystal" style="width: 100%; padding: 1.1rem; font-size: 1.15rem; font-weight: 700; cursor: pointer; border-radius: 18px;">
                Pokračovat do další úrovně ➔
              </button>
            </div>
          `;

          const btn = document.getElementById('btn-transition-continue');
          if (btn) {
            btn.onclick = () => {
              initLevel2(db, pairId, role, animal, avatar);
            };
          }
        });
        break;
      }
      case 'level3':
        root.innerHTML = `
          <div class="level-transition-card">
            <div class="success-icon">💎</div>
            <h1>Mráz ustupuje!</h1>
            <p>Díky vaší obětavosti jste přečkali nejhorší mrazivou noc. Cesta dál však vede přes hlubokou propast, nad kterou se tyčí tajuplný Skleněný most...</p>
            <div class="status-message" style="margin-bottom: 1.5rem;">Hledejte zelená políčka a zapamatujte si je...</div>
            <button id="btn-transition-continue" class="btn-crystal" style="width: 100%; padding: 1.1rem; font-size: 1.15rem; font-weight: 700; cursor: pointer; border-radius: 18px;">
              Pokračovat do další úrovně ➔
            </button>
          </div>
        `;

        const btn3 = document.getElementById('btn-transition-continue');
        if (btn3) {
          btn3.onclick = () => {
            initLevel3(db, pairId, role, animal, avatar);
          };
        }
        break;
      case 'level4':
        root.innerHTML = `
          <div class="level-transition-card">
            <div class="success-icon">🌉</div>
            <h1>Most překonán!</h1>
            <p>Úspěšně jste překročili nebezpečnou propast. Mlha se rozestupuje a před vámi stojí kamenná Brána pravdy.</p>
            <div class="status-message" style="margin-bottom: 1.5rem;">Hledejte úlomky kódu v záři brány...</div>
            <button id="btn-transition-continue" class="btn-crystal" style="width: 100%; padding: 1.1rem; font-size: 1.15rem; font-weight: 700; cursor: pointer; border-radius: 18px;">
              Pokračovat do další úrovně ➔
            </button>
          </div>
        `;

        const btn4 = document.getElementById('btn-transition-continue');
        if (btn4) {
          btn4.onclick = () => {
            initLevel4(db, pairId, role, animal, avatar);
          };
        }
        break;
      case 'reflection':
        initReflection(db, pairId, role, animal);
        break;

      default:
        console.warn("Neznámý stav hry:", state);
    }
  }, (error) => console.error("Chyba RTDB listeneru:", error));
}
