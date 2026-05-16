import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase, ref, remove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8",
  authDomain: "uhk-game.firebaseapp.com",
  projectId: "uhk-game",
  databaseURL: 'https://uhk-game-default-rtdb.europe-west1.firebasedatabase.app/',
  storageBucket: "uhk-game.firebasestorage.app",
  messagingSenderId: "1049280155064",
  appId: "1:1049280155064:web:d7c1862e73aebbcfed534d",
  measurementId: "G-HXFMYDSK7F"
};

const SAVE_DATA_URL = 'https://europe-west1-uhk-game.cloudfunctions.net/saveGameData';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Questions array (temporary storage in memory)
let questionsArray = [];
let studentProfiles = [];
let availableAvatars = [];

const AVATAR_PATH = 'assets/avatars/';

function showMessage(elementId, message, type = 'success') {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `message show ${type}`;
  setTimeout(() => {
    el.classList.remove('show');
  }, 4000);
}

function setButtonLoading(btnId, isLoading, originalText) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ukládám...';
  } else {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function parseStudentsList(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const pairs = [];

  for (const line of lines) {
    const parts = line.split(';').filter(p => p.trim()).map(s => s.trim());
    if (parts.length !== 2) {
      throw new Error(`Neplatný řádek: "${line}". Formát: Jméno1;Jméno2`);
    }

    const [name1, name2] = parts;
    if (!name1 || !name2) {
      throw new Error(`Neplatný řádek: "${line}". Obě jména musí být vyplněná.`);
    }

    pairs.push({ name1, name2 });
  }

  return pairs;
}

async function saveStudents() {
  setButtonLoading('saveStudentsBtn', true, '✓ Uložit seznam žáků');
  
  try {
    const text = document.getElementById('studentsList').value;
    if (!text.trim()) {
      throw new Error('Prosím, zadejte seznam předefinovaných párů žáků');
    }

    const pairs = parseStudentsList(text);
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'pairs', data: pairs })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Chyba při ukládání');
    }

    showMessage('studentsMessage', result.message, 'success');
    await loadStudents();
  } catch (err) {
    showMessage('studentsMessage', err.message, 'error');
  } finally {
    setButtonLoading('saveStudentsBtn', false, '✓ Uložit seznam žáků');
  }
}

async function loadStudents() {
  try {
    const user = await new Promise((resolve) => {
      if (auth.currentUser) {
        return resolve(auth.currentUser);
      }
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        unsubscribe();
        resolve(currentUser);
      });
    });

    if (!user) {
      throw new Error('Uživatel není přihlášen');
    }

    const idToken = await user.getIdToken();
    const response = await fetch(`${SAVE_DATA_URL}?type=pairs`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Chyba při načítání studentů');
    }

    // Pokud se nepodaří načíst páry (např. chybí pairId v DB), zkusíme načíst aspoň jednotlivce
    if (result.data && result.data.length === 0) {
      const resStud = await fetch(`${SAVE_DATA_URL}?type=students`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      const studData = await resStud.json();
      if (studData.status === 'success' && studData.data.length > 0) {
        // Zobrazíme aspoň jednotlivce pro snadnější editaci
        const lines = studData.data.map(s => `${s.email};${s.animal};;`);
        document.getElementById('studentsList').value = lines.join('\n');
        return;
      }
    }

    if (result.status === 'success' && Array.isArray(result.data)) {
      const lines = result.data.map((pair) => `${pair.name1};${pair.name2}`);
      document.getElementById('studentsList').value = lines.join('\n');
    } else {
      document.getElementById('studentsList').value = '';
    }
  } catch (err) {
    console.warn('loadStudents error', err);
    showMessage('studentsMessage', err.message, 'error');
  }
}

async function loadQuestions() {
  try {
    const user = await new Promise((resolve) => {
      if (auth.currentUser) {
        return resolve(auth.currentUser);
      }
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        unsubscribe();
        resolve(currentUser);
      });
    });

    if (!user) {
      throw new Error('Uživatel není přihlášen');
    }

    const idToken = await user.getIdToken();
    const response = await fetch(`${SAVE_DATA_URL}?type=questions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.message || 'Chyba při načítání otázek');
    }
    questionsArray = Array.isArray(result.data) ? result.data : [];
    renderQuestions();
  } catch (err) {
    console.warn('loadQuestions error', err);
    showMessage('questionsMessage', err.message, 'error');
  }
}

function addQuestion() {
  const text = document.getElementById('questionText').value.trim();
  const optionA = document.getElementById('optionA').value.trim();
  const optionB = document.getElementById('optionB').value.trim();
  const optionC = document.getElementById('optionC').value.trim();
  const correctOption = document.getElementById('correctOption').value;

  if (!text || !optionA || !optionB || !optionC || !correctOption) {
    showMessage('questionsMessage', 'Prosím, vyplňte všechna pole', 'error');
    return;
  }

  const question = {
    text,
    options: { A: optionA, B: optionB, C: optionC },
    correctOption
  };

  questionsArray.push(question);
  
  // Clear form
  document.getElementById('questionText').value = '';
  document.getElementById('optionA').value = '';
  document.getElementById('optionB').value = '';
  document.getElementById('optionC').value = '';
  document.getElementById('correctOption').value = '';


  // After adding to local array, save the entire array to DB
  saveQuestions();
}

function renderQuestions() {
  const container = document.getElementById('questionsList');
  if (questionsArray.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  container.innerHTML = `<h3>Otázky k uložení (${questionsArray.length})</h3>`;
  
  questionsArray.forEach((q, idx) => {
    const html = `
      <div class="question-item">
        <p><strong>${idx + 1}. ${q.text}</strong></p>
        <p>A) ${q.options.A}</p>
        <p>B) ${q.options.B}</p>
        <p>C) ${q.options.C}</p>
        <p><strong>Správná: ${q.correctOption}</strong></p>
      </div>
    `;
    container.innerHTML += html;
  });
}

async function saveQuestions() {
  if (questionsArray.length === 0) {
    showMessage('questionsMessage', 'Prosím, přidejte alespoň jednu otázku', 'error');
    return;
  }

  setButtonLoading('addQuestionBtn', true, '+ Přidat otázku');

  try {
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'questions', data: questionsArray })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Chyba při ukládání');
    }

    showMessage('questionsMessage', `Otázky uloženy! (celkem: ${questionsArray.length})`, 'success');
    // No need to clear questionsArray here, as addQuestion just added one and we saved the whole list.
  } catch (err) {
    showMessage('questionsMessage', err.message, 'error');
  } finally {
    setButtonLoading('addQuestionBtn', false, '+ Přidat otázku');
  }
}

function clearQuestions() {
  questionsArray = [];
  renderQuestions();
  showMessage('questionsMessage', 'Otázky vymazány', 'success');
}

async function resetRooms() {
  const dialog = document.getElementById('resetConfirmDialog');
  const confirmBtn = document.getElementById('confirmResetBtn');
  const cancelBtn = document.getElementById('cancelResetBtn');

  dialog.showModal();
  cancelBtn.focus();

  // Použijeme event listenery místo přímého přiřazení
  const closeDialog = () => dialog.close();
  cancelBtn.addEventListener('click', closeDialog, { once: true });

  confirmBtn.addEventListener('click', async () => {
    closeDialog();
    setButtonLoading('resetRoomsBtn', true, '🗑️ Resetuji...');
    
    try {
      console.log("Pokus o smazání uzlu /rooms...");
      await remove(ref(db, 'rooms'));
      console.log("Smazání úspěšné.");
      showMessage('studentsMessage', 'Všechny herní místnosti byly smazány.', 'success');
    } catch (err) {
      console.error("Smazání selhalo:", err);
      showMessage('studentsMessage', 'Chyba: ' + err.message, 'error');
    } finally {
      setButtonLoading('resetRoomsBtn', false, '🗑️ Resetovat herní místnosti');
    }
  }, { once: true });
}

async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem('uhkUser');
    sessionStorage.removeItem('uhkUser');
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Logout error:', err);
    alert('Chyba při odhlášení');
  }
}

function checkAdminAccess() {
  const userData = JSON.parse(localStorage.getItem('uhkUser') || '{}');
  
  if (userData.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }
  
  return true;
}

async function saveProfiles() {
  const text = document.getElementById('profilesInput').value.trim();
  if (!text) return;
  
  const lines = text.split('\n');
  const profiles = lines.map(line => {
    const [email, name, avatar, animal] = line.split(';').map(s => s.trim());
    return { email, name, avatar, animal };
  });

  const idToken = await auth.currentUser.getIdToken();
  await fetch(SAVE_DATA_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'profiles', data: profiles })
  });
  showMessage('profilesMessage', 'Profily uloženy');
  await loadProfiles();
}

async function loadProfiles() {
  const idToken = await auth.currentUser.getIdToken();
  const resp = await fetch(`${SAVE_DATA_URL}?type=profiles`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });
  const result = await resp.json();
  if (result.status === 'success') {
    studentProfiles = result.data;
    // Zde by se v budoucnu naplnily dropdowny v UI pro párování
  }
}

async function loadAvatars() {
  try {
    // 1. Priorita: Zkusíme načíst statický manifest list.txt z adresáře
    const fileResp = await fetch(`${AVATAR_PATH}list.txt`);
    if (fileResp.ok) {
      const text = await fileResp.text();
      const list = text.split(/[;\r\n]+/).map(s => s.trim()).filter(s => s);
      if (list.length > 0) {
        console.log(`Načteno ${list.length} avatarů z list.txt`);
        availableAvatars = list;
        renderAvatarGrid();
        return;
      }
    }

    // 2. Fallback: Načtení z Firebase databáze
    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch(`${SAVE_DATA_URL}?type=avatars`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const result = await resp.json();
    if (result.status === 'success') {
      availableAvatars = result.data;
      renderAvatarGrid();
    }
  } catch (err) {
    console.error('Chyba při načítání avatarů:', err);
  }
}

async function syncAvatarsFromFile() {
  const btn = document.getElementById('syncAvatarsBtn');
  setButtonLoading('syncAvatarsBtn', true, '🔄 Synchronizovat z list.txt');
  
  try {
    const resp = await fetch(`${AVATAR_PATH}list.txt`);
    if (!resp.ok) throw new Error('Soubor list.txt v adresáři avatars nebyl nalezen.');

    const text = await resp.text();
    const list = text.split(/[;\r\n]+/).map(s => s.trim()).filter(s => s);
    
    if (list.length === 0) throw new Error('Soubor list.txt je prázdný.');

    const idToken = await auth.currentUser.getIdToken();
    await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'avatars', data: list })
    });

    showMessage('avatarsMessage', `Úspěšně synchronizováno ${list.length} avatarů.`, 'success');
    await loadAvatars();
  } catch (err) {
    console.error('Sync error:', err);
    showMessage('avatarsMessage', err.message, 'error');
  } finally {
    setButtonLoading('syncAvatarsBtn', false, '🔄 Synchronizovat z list.txt');
  }
}

async function saveAvatars() {
  const input = prompt('Vložte seznam názvů souborů (oddělené novým řádkem nebo středníkem):');
  if (!input) return;

  // Opraveno: Odstraněna duplicitní deklarace 'list' a sjednoceno rozdělení
  const list = input.split(/[;\r\n]+/).map(s => s.trim()).filter(s => s);
  
  if (list.length === 0) {
    showMessage('avatarsMessage', 'Nebyly nalezeny žádné platné názvy souborů.', 'error');
    return;
  }

  console.log(`Detekováno ${list.length} avatarů k uložení.`);
  const idToken = await auth.currentUser.getIdToken();
  
  try {
    await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'avatars', data: list })
    });
    showMessage('profilesMessage', 'Seznam avatarů aktualizován');
    showMessage('avatarsMessage', `Úspěšně aktualizováno ${list.length} avatarů.`, 'success');
    await loadAvatars();
  } catch (err) {
    alert('Chyba při ukládání: ' + err.message);
    console.error('Save avatars error:', err);
    showMessage('avatarsMessage', 'Chyba při ukládání: ' + err.message, 'error');
  }
}

function renderAvatarGrid() {
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = availableAvatars.map(filename => `
    <div class="avatar-card">
      <img src="${AVATAR_PATH}${filename}" alt="${filename}" onerror="this.src='${AVATAR_PATH}default.svg'">
      <div class="input-hint" style="font-family: monospace; user-select: all;">${filename}</div>
    </div>
  `).join('');
}

function setupAvatarGalleryToggle() {
  const toggle = document.getElementById('avatarToggle');
  const content = document.getElementById('avatarContent');
  const chevron = document.getElementById('avatarChevron');

  // Collapsible logika
  toggle.addEventListener('click', () => {
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'grid' : 'none';
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    
    // Plynulý scroll při otevření
    if (isHidden) {
      setTimeout(() => content.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  });
}

export function initializeAdmin() {
  if (!checkAdminAccess()) return;

  // Registrace posluchačů okamžitě
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('saveStudentsBtn').addEventListener('click', saveStudents);
  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  document.getElementById('clearQuestionsBtn').addEventListener('click', clearQuestions);
  document.getElementById('resetRoomsBtn').addEventListener('click', resetRooms);
  document.getElementById('saveProfilesBtn').addEventListener('click', saveProfiles);
  document.getElementById('avatarToggle').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    saveAvatars();
  });
  document.getElementById('syncAvatarsBtn').addEventListener('click', (e) => {
    e.stopPropagation(); // Zabráníme rozbalení/zabalení sekce při kliku na tlačítko
    syncAvatarsFromFile();
  });

  loadStudents();
  loadQuestions();
  loadProfiles();
  loadAvatars();
  setupAvatarGalleryToggle();
}
