// Hlavní administrátorský skript pro učitelské rozhraní
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getDatabase, ref, set, get } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

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

async function initAdmin() {
  const saveStudentsBtn = document.getElementById('saveStudentsBtn');
  const studentsListArea = document.getElementById('studentsList');
  const studentsMessage = document.getElementById('studentsMessage');

  // NAČÍTÁNÍ: Získání existujících párů z DB
  try {
    const snapshot = await get(ref(db, 'mappings'));
    if (snapshot.exists()) {
      const data = snapshot.val();
      const pairs = {};
      
      // Seskupení uživatelů podle pairId
      Object.values(data).forEach(item => {
        if (!pairs[item.pairId]) pairs[item.pairId] = [];
        pairs[item.pairId].push(item);
      });

      // Převod zpět na textový formát (email1;zvíře1;email2;zvíře2)
      const lines = Object.values(pairs)
        .filter(p => p.length === 2)
        .map(p => `${p[0].email};${p[0].animal};${p[1].email};${p[1].animal}`);
      
      studentsListArea.value = lines.join('\n');
    }
  } catch (error) {
    console.error("Chyba při načítání dat:", error);
    showStatus(studentsMessage, 'Nepodařilo se načíst seznam z databáze.', 'error');
  }

  saveStudentsBtn.addEventListener('click', async () => {
    const rawData = studentsListArea.value.trim();
    if (!rawData) return;

    const lines = rawData.split('\n');
    const mappings = {};

    const sanitize = (email) => email.toLowerCase().trim().replace(/\./g, ',').replace(/@/g, '_at_');

    try {
      lines.forEach((line, index) => {
        const [e1, a1, e2, a2] = line.split(';').map(s => s.trim());
        if (e1 && a1 && e2 && a2) {
          const pairId = `pair_${index + 1}`;
          // Sjednocená sanitace dle GAME_MODULES_DEEP_DIVE.md
          mappings[sanitize(e1)] = { email: e1, animal: a1, pairId, role: 'player1' };
          mappings[sanitize(e2)] = { email: e2, animal: a2, pairId, role: 'player2' };
        }
      });

      await set(ref(db, 'mappings'), mappings);
      showStatus(studentsMessage, 'Seznam žáků byl úspěšně uložen!', 'success');
    } catch (error) {
      showStatus(studentsMessage, 'Chyba při ukládání: ' + error.message, 'error');
    }
  });
}

function showStatus(el, text, type) {
  el.textContent = text;
  el.className = `message show ${type}`;
  setTimeout(() => el.classList.remove('show'), 5000);
}

export { initAdmin as initializeAdmin };
