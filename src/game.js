import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getDatabase, ref, get, set, update, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';

const STORAGE_KEY_USER = 'uhkUser';

const MODULES = {
  secret: {
    id: 'secret',
    tag: 'Modul 1',
    title: 'Sdílení klíče',
    description: 'Získal jsi tajný kód pro postup. Můžeš si ho nechat pro vlastní výhodu, nebo ho poslat svému anonymnímu parťákovi.',
    reflection: 'Věříš mu, že tě nepodrazí?',
    btnShare: 'Ano, věřím mu<br><span>Sdílet kód</span>',
    btnKeep: 'Ne, nevěřím<br><span>Nechat si ho</span>'
  },
  help: { // Placeholder for the next module
    id: 'help',
    tag: 'Modul 2',
    title: 'Obranný štít',
    description: 'Tvůj parťák je v nesnázích. Pomůžeš mu, i když tě to něco stojí?',
    reflection: 'Zastane se mě parťák, i když ho to něco stojí?',
    btnShare: 'Ano, pomůžu<br><span>Osvobodit parťáka</span>',
    btnKeep: 'Ne, nepomůžu<br><span>Šetřit energii</span>'
  }
};

const firebaseConfig = {
  apiKey: 'AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8',
  authDomain: 'uhk-game.firebaseapp.com',
  projectId: 'uhk-game',
  databaseURL: 'https://uhk-game-default-rtdb.europe-west1.firebasedatabase.app/',
  storageBucket: 'uhk-game.firebasestorage.app',
  messagingSenderId: '1049280155064',
  appId: '1:1049280155064:web:d7c1862e73aebbcfed534d',
  measurementId: 'G-HXFMYDSK7F'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

function getStoredUser() {
  const stored = localStorage.getItem(STORAGE_KEY_USER) || sessionStorage.getItem(STORAGE_KEY_USER);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function updateNavbar(animalName) {
  const badgeEl = document.getElementById('playerBadge');
  const nameEl = document.getElementById('playerAnimalName');

  badgeEl.textContent = mapAnimalToEmoji(animalName);
  nameEl.textContent = animalName || 'Anonym';
}

function mapAnimalToEmoji(animalName) {
  const normalized = (animalName || '').trim().toLowerCase();
  const map = {
    slon: '🐘',
    lev: '🦁',
    tygr: '🐯',
    zebra: '🦓',
    opice: '🐒',
    papousek: '🦜',
    delfin: '🐬'
  };
  return map[normalized] || '🐾';
}

function renderModule(moduleId) {
  const module = MODULES[moduleId];
  if (!module) return;

  document.getElementById('moduleTitle').textContent = module.title;
  document.getElementById('moduleDescription').textContent = module.description;
  document.getElementById('moduleReflection').textContent = module.reflection;
  console.log(`Rendering module: ${module.title} (${moduleId})`);
  document.getElementById('shareButton').innerHTML = module.btnShare || 'Ano';
  document.getElementById('keepButton').innerHTML = module.btnKeep || 'Ne';
}

function showWaitingMessage(message = 'Čekám na parťáka...', title = 'Pracuji...') {
  document.getElementById('shareButton').classList.add('hidden');
  document.getElementById('keepButton').classList.add('hidden');
  document.getElementById('waitingPanel').classList.remove('hidden');
  
  document.getElementById('waitingText').textContent = message;
  const titleEl = document.getElementById('waitingTitle');
  if (titleEl) {
    titleEl.textContent = title;
  }
}

function showModule() {
  document.getElementById('shareButton').classList.remove('hidden');
  document.getElementById('keepButton').classList.remove('hidden');
  document.getElementById('waitingPanel').classList.add('hidden');
}

function setDecisionButtonsDisabled(isDisabled) {
  console.log(`setDecisionButtonsDisabled: Setting buttons disabled state to ${isDisabled}.`);
  document.getElementById('shareButton').disabled = isDisabled;
  document.getElementById('keepButton').disabled = isDisabled;
}

function getPlayerRole(room, uid) {
  if (!room || !room.players) return null;
  if (room.players.animal1?.uid === uid) return 'animal1';
  if (room.players.animal2?.uid === uid) return 'animal2';
  return null;
}

async function joinRoom(pairId, user) {
  const roomRef = ref(db, `rooms/${pairId}`);
  const snapshot = await get(roomRef);
  const room = snapshot.exists() ? snapshot.val() : null;

  if (!room) {
    await set(roomRef, {
      pairId,
      status: 'waiting',
      phase: 'action',
      currentModule: 'secret',
      createdAt: serverTimestamp(),
      players: {
        animal1: {
          uid: user.uid,
          email: user.email,
          animal: user.animal,
          lastSeen: Date.now(),
          status: 'waiting',
          joinedAt: serverTimestamp()
        }
      }
    });
    return { roomRef, roomStatus: 'waiting', playerRole: 'animal1' };
  }

  const players = room.players || {};
  const isPlayer1 = players.animal1?.uid === user.uid;
  const isPlayer2 = players.animal2?.uid === user.uid;

  if (isPlayer1) {
    await update(ref(db, `rooms/${pairId}/players/animal1`), { lastSeen: Date.now(), status: 'online' });
    return { roomRef, roomStatus: room.status || 'waiting', playerRole: 'animal1' };
  }

  if (isPlayer2) {
    await update(ref(db, `rooms/${pairId}/players/animal2`), { lastSeen: Date.now(), status: 'online' });
    return { roomRef, roomStatus: room.status || 'waiting', playerRole: 'animal2' };
  }

  if (room.status === 'waiting' && !players.animal2) {
    await update(roomRef, {
      status: 'playing',
      startedAt: serverTimestamp(),
      players: {
        ...players,
        animal2: {
          uid: user.uid,
          email: user.email,
          animal: user.animal,
          lastSeen: Date.now(),
          status: 'playing',
          joinedAt: serverTimestamp()
        }
      }
    });
    return { roomRef, roomStatus: 'playing', playerRole: 'animal2' };
  }

  return { roomRef, roomStatus: room.status || 'waiting', playerRole: null };
}

let heartbeatInterval = null; // Moved outside to be accessible for clearing
function startHeartbeat(pairId, playerRole, userUid) {
  if (!playerRole) return;

  // Heartbeat každých 5 sekund dle architecture.md
  return setInterval(async () => {
    const playerStatusRef = ref(db, `rooms/${pairId}/players/${playerRole}`);
    try {
      await update(playerStatusRef, {
        // Use current client time for lastSeen, as serverTimestamp is async and might be delayed
        lastSeen: Date.now(),
        status: 'online'
      });
    } catch (err) {
      console.error("Heartbeat failed", err);
    }
  }, 5000);
}

async function persistDecision(pairId, moduleId, playerRole, shared, user) {
  const actionRef = ref(db, `rooms/${pairId}/actions/${moduleId}/${playerRole}`);
  await set(actionRef, {
    shared,
    uid: user.uid,
    animal: user.animal,
    timestamp: serverTimestamp()
  });
}

function redirectToLoginPage() {
  window.location.href = 'index.html';
}

let activeModuleId = 'secret';

export async function initializeGame() {
  const user = getStoredUser();
  if (!user || !user.animal || !user.pairId) {
    return redirectToLoginPage();
  }

  updateNavbar(user.animal);
  renderModule('secret');
  showWaitingMessage('Připojuji tě ke správnému páru...', 'Vstupuji do hry');

  console.log('Inicializace hry pro uživatele:', user.email, 'Role v localStorage:', user.animal);

  // Oprava odhlášení: musí být i ve Firebase Auth
  document.getElementById('logoutButton').addEventListener('click', async () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('SignOut error', err);
    }
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_USER);
    window.location.href = 'index.html';
  });

  // Získáme referenci na místnost a roli
  const joinResult = await joinRoom(user.pairId, user);
  const roomRef = joinResult.roomRef;
  let currentPlayerRole = joinResult.playerRole;
  activeModuleId = 'secret';

  if (!currentPlayerRole) {
    showWaitingMessage('Nepodařilo se přiřadit herní roli. Zkus se přihlásit znovu.', 'Chyba role');
    return;
  }

  onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) {
      // Pokud místnost zmizela (např. reset v adminu), restartujeme hru
      window.location.reload();
      return;
    }

    currentPlayerRole = getPlayerRole(room, user.uid);
    if (currentPlayerRole && !heartbeatInterval) { // Start heartbeat only once
      heartbeatInterval = startHeartbeat(user.pairId, currentPlayerRole, user.uid);
    }

    const currentModuleId = room.currentModule;
    activeModuleId = currentModuleId;
    const partnerRole = currentPlayerRole === 'animal1' ? 'animal2' : 'animal1';
    const partner = room.players?.[partnerRole];
    
    // Parťák je offline pouze pokud už někdy byl online (má lastSeen) 
    // a zároveň je místnost ve stavu playing (nečeká se na první připojení)
    const isPartnerOffline = room.status === 'playing' && 
                             partner && 
                             partner.lastSeen && 
                             (Date.now() - partner.lastSeen > 25000); // tolerance zvýšena na 20s

    console.log('onValue listener triggered. Current room state:', room);
    console.log('Stav místnosti:', room.status, 'Modul:', currentModuleId, 'Partner offline:', isPartnerOffline);

    if (room.status !== 'waiting' && currentPlayerRole) { // Game is active and player has a role
      // Kontrola, zda se parťák neodpojil (tolerance 15 sekund)
      if (isPartnerOffline) {
        showWaitingMessage('Parťák se odpojil, čekejte na návrat...', 'Spojení přerušeno');
        setDecisionButtonsDisabled(true);
        return; // Zastav další zpracování, pokud je parťák offline
      }

      renderModule(currentModuleId); // Vždy vykresli UI pro aktuální modul

      const currentModuleActions = room.actions?.[currentModuleId];
      const playerDecision = currentModuleActions?.[currentPlayerRole];
      const partnerDecision = currentModuleActions?.[partnerRole];

      if (currentModuleId === 'secret') {
        if (playerDecision && partnerDecision) {
          // Oba hráči se rozhodli pro modul 'secret'
          const partnerShared = partnerDecision.shared;
          const message = partnerShared ? 'Tvůj parťák se rozhodl kód SDÍLET!' : 'Tvůj parťák se rozhodl kód NECHÁT SI!';
          showWaitingMessage(message + ' Přecházíme na další modul...', 'Rozhodnuto!');
          setDecisionButtonsDisabled(true);

          // Posun stavu modulu (pouze animal1 to dělá, aby se předešlo race conditions)
          if (currentPlayerRole === 'animal1') {
            // Malá prodleva pro zobrazení zprávy v UI před přechodem
            setTimeout(async () => {
              await update(roomRef, {
                currentModule: 'help', // Další modul
                status: 'module_help_active' // Nový status
              });
            }, 3000); // 3 sekundy prodleva
          }
        } else if (playerDecision && !partnerDecision) {
          // Aktuální hráč se rozhodl, čeká na parťáka
          showWaitingMessage('Čekám na tah parťáka...', 'Tvoje volba byla zaznamenána');
          setDecisionButtonsDisabled(true);
        } else {
          // Aktuální hráč se ještě nerozhodl
          showModule(); // Zobraz tlačítka pro rozhodování
          setDecisionButtonsDisabled(false);
        }
      } else if (currentModuleId === 'help') {
        if (playerDecision && partnerDecision) {
          // Vyhodnocení modulu help
          const partnerHelped = partnerDecision.shared;
          const message = partnerHelped ? 'Parťák tě OSVOBODIL ze štítu!' : 'Parťák se rozhodl ŠETŘIT energii.';
          showWaitingMessage(message + ' Hra prozatím končí.', 'Výsledek modulu');
          setDecisionButtonsDisabled(true);
          
          // Zde by následoval přechod na další modul, pokud by byl definován
          if (currentPlayerRole === 'animal1') {
             // update(roomRef, { status: 'finished' });
          }
        } else if (playerDecision && !partnerDecision) {
          showWaitingMessage('Čekám na rozhodnutí parťáka...', 'Tvá volba uložena');
          setDecisionButtonsDisabled(true);
        } else {
          showModule();
          setDecisionButtonsDisabled(false);
        }
      } else {
        // Prozatím, pokud je jiný modul, zobrazíme ho a povolíme tlačítka
        showModule();
        setDecisionButtonsDisabled(false);
      }
    } else {
      showWaitingMessage('Čekám, až se připojí druhý hráč...', 'Hledám parťáka');
    }
  });

  document.getElementById('shareButton').addEventListener('click', async () => {
    setDecisionButtonsDisabled(true);
    if (currentPlayerRole) {
      await persistDecision(user.pairId, activeModuleId, currentPlayerRole, true, user);
      // Listener onValue se postará o zobrazení zprávy a posun stavu
    } else {
      showWaitingMessage('Nelze uložit rozhodnutí. Zkus znovu načíst stránku.');
    }
  });

  document.getElementById('keepButton').addEventListener('click', async () => {
    setDecisionButtonsDisabled(true);
    if (currentPlayerRole) {
      await persistDecision(user.pairId, activeModuleId, currentPlayerRole, false, user);
      // Listener onValue se postará o zobrazení zprávy a posun stavu
    } else {
      showWaitingMessage('Nelze uložit rozhodnutí. Zkus znovu načíst stránku.');
    }
  });
}
