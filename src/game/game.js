import { ref, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { initLevel1 } from './level1.js';
// import { initLevel2 } from './level2.js'; // Budeme implementovat později

export function initGameRouter(db, pairId, role, animal) {
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
        initLevel1(db, pairId, role);
        break;
      case 'level2':
        root.innerHTML = `
          <div class="level-transition-card">
            <div class="success-icon">🌟</div>
            <h1>Cíl dosažen!</h1>
            <p>Společně jste ruku v ruce bezpečně prošli temným lesem. Sova vedla s rozvahou a Rys projevil hlubokou důvěru.</p>
            <div class="status-message">Připravte se, Mlžný les začíná chladnout...</div>
          </div>
        `;
        break;
      case 'level3':
        root.innerHTML = "<div class='status-message'><h1>Level 3: Připravuje se...</h1></div>";
        break;
      case 'reflection':
        root.innerHTML = "<div class='status-message'><h1>Reflexe: Připravuje se...</h1></div>";
        break;
      default:
        console.warn("Neznámý stav hry:", state);
    }
  }, (error) => console.error("Chyba RTDB listeneru:", error));
}
