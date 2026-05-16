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

function updateNavbar(animalName, avatarFile) {
  const badgeEl = document.getElementById('playerBadge');
  const nameEl = document.getElementById('playerAnimalName');

  const avatarPath = `assets/avatars/${avatarFile || 'default.svg'}`;
  badgeEl.innerHTML = `<img src="${avatarPath}" alt="Avatar" style="width:100%; height:100%; border-radius:50%">`;
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

async function joinRoom(pairId, animal, uid) {
  const roomRef = ref(db, `rooms/${pairId}`);
  const snapshot = await get(roomRef);

  if (!snapshot.exists()) {
    await set(roomRef, {
      status: 'waiting',
      player1: animal,
      uid1: uid
    });
  } else {
    const room = snapshot.val();
    if (room.status === 'waiting' && room.uid1 !== uid) {
      await update(roomRef, {
        player2: animal,
        uid2: uid,
        status: 'playing'
      });
    }
  }
  return roomRef;
}

function redirectToLoginPage() {
  window.location.href = 'index.html';
}

export async function initializeGame() {
  const user = getStoredUser();
  if (!user || !user.animal || !user.pairId) {
    return redirectToLoginPage();
  }

  updateNavbar(user.animal);
  showWaitingMessage('Připojuji tě ke správnému páru...', 'Vstupuji do hry');

  console.log('Inicializace hry pro uživatele:', user.email, 'Role v localStorage:', user.animal);

  // Oprava odhlášení: musí být i ve Firebase Auth
  document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('SignOut error', err);
    }
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_USER);
    window.location.href = 'index.html';
  });

  const roomRef = await joinRoom(user.pairId, user.animal, user.uid);

  onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (room && room.status === 'playing') {
      renderModule('secret');
      showModule();
      console.log('Hra začala! Modul 1 aktivní.');
    } else {
      showWaitingMessage('Čekám, až se připojí druhý hráč...', 'Hledám parťáka');
    }
  });
}
