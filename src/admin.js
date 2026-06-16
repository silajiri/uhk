import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase, ref, remove, onValue, update, get } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";


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

let studentProfiles = [];
let studentPairs = [];
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

function parseStudentsList(text, profiles) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const pairs = [];

  for (const line of lines) {
    const parts = line.split(';').filter(p => p.trim()).map(s => s.trim());
    if (parts.length === 2) {
      const [name1, name2] = parts;
      
      // Vyhledání profilů podle jména (case-insensitive)
      const p1 = profiles.find(p => p.name.toLowerCase() === name1.toLowerCase());
      const p2 = profiles.find(p => p.name.toLowerCase() === name2.toLowerCase());

      if (!p1) throw new Error(`Žák "${name1}" nebyl nalezen v uložených profilech.`);
      if (!p2) throw new Error(`Žák "${name2}" nebyl nalezen v uložených profilech.`);

      pairs.push({ 
        email1: p1.email, animal1: p1.animal, 
        email2: p2.email, animal2: p2.animal 
      });
    } else if (parts.length === 4) {
      // Fallback pro starý formát (email1;animal1;email2;animal2)
      const [email1, animal1, email2, animal2] = parts;
      pairs.push({ email1, animal1, email2, animal2 });
    } else {
      throw new Error(`Neplatný řádek: "${line}". Použijte formát: Jméno 1; Jméno 2`);
    }
  }

  return pairs;
}

﻿async function saveStudents() {
  const text = document.getElementById('studentsList').value;
  if (!text.trim()) {
    showMessage('studentsMessage', 'Prosím, zadejte seznam párů ve formátu: Jméno1;Jméno2', 'error');
    return;
  }

  try {
    const pairs = parseStudentsList(text, studentProfiles);
    await savePairsToServer(pairs);
  } catch (err) {
    showMessage('studentsMessage', err.message, 'error');
  }
}

async function savePairsToServer(pairs) {
  setButtonLoading('saveStudentsBtn', true, '✓ Uložit seznam žáků');
  try {
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
    if (studentProfiles.length === 0) await loadProfiles();

    const user = await new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        unsubscribe();
        resolve(currentUser);
      });
    });

    if (!user) throw new Error('Uživatel není přihlášen');

    const idToken = await user.getIdToken();
    const response = await fetch(`${SAVE_DATA_URL}?type=pairs`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${idToken}` }
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Chyba při načítání studentů');

    if (result.status === 'success' && Array.isArray(result.data)) {
      studentPairs = result.data;
      renderPairsTable();
      const lines = result.data.map((p) => {
        const profile1 = studentProfiles.find(s => s.email.toLowerCase() === p.email1.toLowerCase());
        const profile2 = studentProfiles.find(s => s.email.toLowerCase() === p.email2.toLowerCase());
        const name1 = profile1 ? profile1.name : p.email1;
        const name2 = profile2 ? profile2.name : p.email2;
        return `${name1};${name2}`;
      });
      document.getElementById('studentsList').value = lines.join('\n');
    } else {
      studentPairs = [];
      renderPairsTable();
      document.getElementById('studentsList').value = '';
    }
  } catch (err) {
    console.warn('loadStudents error', err);
    showMessage('studentsMessage', err.message, 'error');
  }
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

const LOOKUP_URL = 'https://europe-west1-uhk-game.cloudfunctions.net/lookupMappingByEmail';

/**
 * Ověří admin roli přes server (Firebase ID token) – nikoliv jen z localStorage.
 * Vrátí true pokud je uživatel admin, jinak přesměruje na index.html.
 */
async function checkAdminAccess() {
  // Počkáme na inicializaci Firebase Auth
  const user = await new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubscribe();
      resolve(u);
    });
  });

  if (!user) {
    window.location.href = 'index.html';
    return false;
  }

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(LOOKUP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'success' || data.role !== 'admin') {
      window.location.href = 'index.html';
      return false;
    }

    return true;
  } catch (err) {
    console.error('Admin access check failed:', err);
    window.location.href = 'index.html';
    return false;
  }
}

﻿async function saveProfiles() {
  const text = document.getElementById('profilesInput').value.trim();
  if (!text) return;
  
  const lines = text.split('\n');
  const profiles = lines.map(line => {
    const [email, name, avatar, animal] = line.split(';').map(s => s.trim());
    return { email, name, avatar, animal };
  });

  await saveProfilesToServer(profiles);
}

async function saveProfilesToServer(profiles) {
  const user = await new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubscribe();
      resolve(u);
    });
  });

  if (!user) return showMessage('profilesMessage', 'Uživatel není přihlášen', 'error');

  const idToken = await user.getIdToken();
  try {
    const response = await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'profiles', data: profiles })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Server vrátil chybu');
    
    showMessage('profilesMessage', 'Profily byly úspěšně uloženy do DB');
    await loadProfiles();
  } catch (err) {
    showMessage('profilesMessage', 'Chyba při ukládání: ' + err.message, 'error');
  }
}

async function loadProfiles() {
  const user = await new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubscribe();
      resolve(u);
    });
  });

  if (!user) return;

  const idToken = await user.getIdToken();
  try {
    const resp = await fetch(`${SAVE_DATA_URL}?type=profiles`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const result = await resp.json();
    if (result.status === 'success') {
      studentProfiles = result.data || [];
      renderProfilesTable();
    }
  } catch (err) {
    console.error("Chyba při načítání profilů:", err);
  }
}

﻿function renderProfilesTable() {
  const container = document.getElementById('profilesListContainer');
  if (!container) return;

  if (!studentProfiles || studentProfiles.length === 0) {
    container.innerHTML = '<p class="input-hint">Žádné uložené profily žáků.</p>';
    return;
  }

  let html = `
    <table class="monitoring-table" style="margin-top: 1rem; width: 100%;">
      <thead>
        <tr>
          <th>E-mail</th>
          <th>Jméno</th>
          <th>Avatar</th>
          <th>Náhled</th>
          <th>Zvíře</th>
          <th>Akce</th>
        </tr>
      </thead>
      <tbody>
  `;

  studentProfiles.forEach((profile, index) => {
    html += `
      <tr data-index="${index}" style="border-bottom: 1px solid var(--border);">
        <td style="padding: 0.75rem;">${profile.email}</td>
        <td style="padding: 0.75rem; font-weight: 600;">${profile.name}</td>
        <td style="padding: 0.75rem; font-family: monospace;">${profile.avatar}</td>
        <td style="padding: 0.75rem; text-align: center;">
          <img src="assets/avatars/${profile.avatar}" alt="${profile.avatar}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid var(--border); padding: 2px;" onerror="this.style.display='none';" />
        </td>
        <td style="padding: 0.75rem;">${profile.animal}</td>
        <td style="padding: 0.75rem;">
          <button class="btn-table-action btn-primary" data-action="edit-profile" data-index="${index}">✏️ Upravit</button>
          <button class="btn-table-action btn-secondary" data-action="delete-profile" data-index="${index}" style="background: #ffe0e0; color: #e74c3c;">🗑️ Smazat</button>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  // Bind actions
  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = (e) => {
      const action = btn.getAttribute('data-action');
      const idx = parseInt(btn.getAttribute('data-index'), 10);

      if (action === 'delete-profile') {
        if (confirm(`Opravdu chcete smazat profil žáka ${studentProfiles[idx].name}?`)) {
          const updated = [...studentProfiles];
          updated.splice(idx, 1);
          saveProfilesToServer(updated);
        }
      } else if (action === 'edit-profile') {
        startInlineEdit(idx);
      }
    };
  });
}

﻿function startInlineEdit(idx) {
  const container = document.getElementById('profilesListContainer');
  const row = container.querySelector(`tr[data-index="${idx}"]`);
  if (!row) return;

  const profile = studentProfiles[idx];

  row.innerHTML = `
    <td style="padding: 0.75rem;"><input type="text" class="edit-email" value="${profile.email}" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: inherit;" /></td>
    <td style="padding: 0.75rem;"><input type="text" class="edit-name" value="${profile.name}" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-weight: 600; font-family: inherit;" /></td>
    <td style="padding: 0.75rem;"><input type="text" class="edit-avatar" value="${profile.avatar}" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: monospace;" /></td>
    <td style="padding: 0.75rem; text-align: center;">
      <img src="assets/avatars/${profile.avatar}" alt="${profile.avatar}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid var(--border); padding: 2px;" onerror="this.style.display='none';" />
    </td>
    <td style="padding: 0.75rem;"><input type="text" class="edit-animal" value="${profile.animal}" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: inherit;" /></td>
    <td style="padding: 0.75rem;">
      <button class="btn-table-action btn-primary" data-action="save-edit" style="background: rgba(46, 204, 113, 0.15); color: var(--success);">✓ Uložit</button>
      <button class="btn-table-action btn-secondary" data-action="cancel-edit">✕ Zrušit</button>
    </td>
  `;

  row.querySelector('button[data-action="save-edit"]').onclick = () => {
    const email = row.querySelector('.edit-email').value.trim();
    const name = row.querySelector('.edit-name').value.trim();
    const avatar = row.querySelector('.edit-avatar').value.trim();
    const animal = row.querySelector('.edit-animal').value.trim();

    if (!email || !name || !avatar || !animal) {
      alert("Všechna pole musí být vyplněna!");
      return;
    }

    const updated = [...studentProfiles];
    updated[idx] = { email, name, avatar, animal };
    saveProfilesToServer(updated);
  };

  row.querySelector('button[data-action="cancel-edit"]').onclick = () => {
    renderProfilesTable();
  };
}


function renderPairsTable() {
  const container = document.getElementById('pairsListContainer');
  if (!container) return;

  if (!studentPairs || studentPairs.length === 0) {
    container.innerHTML = '<p class="input-hint">Žádné vytvořené páry.</p>';
    return;
  }

  let html = `
    <table class="monitoring-table" style="margin-top: 1rem; width: 100%;">
      <thead>
        <tr>
          <th>Žák 1 (Sova)</th>
          <th>Žák 2 (Rys)</th>
          <th>Akce</th>
        </tr>
      </thead>
      <tbody>
  `;

  studentPairs.forEach((pair, index) => {
    const p1 = studentProfiles.find(s => s.email.toLowerCase() === pair.email1.toLowerCase());
    const p2 = studentProfiles.find(s => s.email.toLowerCase() === pair.email2.toLowerCase());

    const name1 = p1 ? p1.name : pair.email1;
    const name2 = p2 ? p2.name : pair.email2;

    html += `
      <tr data-index="${index}" style="border-bottom: 1px solid var(--border);">
        <td style="padding: 0.75rem;">
          <strong>${name1}</strong><br>
          <span class="input-hint">${pair.email1} (${pair.animal1 || 'Sova'})</span>
        </td>
        <td style="padding: 0.75rem;">
          <strong>${name2}</strong><br>
          <span class="input-hint">${pair.email2} (${pair.animal2 || 'Rys'})</span>
        </td>
        <td style="padding: 0.75rem;">
          <button class="btn-table-action btn-primary" data-action="edit-pair" data-index="${index}">✏️ Upravit</button>
          <button class="btn-table-action btn-secondary" data-action="delete-pair" data-index="${index}" style="background: #ffe0e0; color: #e74c3c;">🗑️ Smazat</button>
        </td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.onclick = (e) => {
      const action = btn.getAttribute('data-action');
      const idx = parseInt(btn.getAttribute('data-index'), 10);

      if (action === 'delete-pair') {
        const p = studentPairs[idx];
        const p1 = studentProfiles.find(s => s.email.toLowerCase() === p.email1.toLowerCase());
        const p2 = studentProfiles.find(s => s.email.toLowerCase() === p.email2.toLowerCase());
        const name1 = p1 ? p1.name : p.email1;
        const name2 = p2 ? p2.name : p.email2;

        if (confirm(`Opravdu chcete smazat pár ${name1} a ${name2}?`)) {
          const updated = [...studentPairs];
          updated.splice(idx, 1);
          savePairsToServer(updated);
        }
      } else if (action === 'edit-pair') {
        startInlinePairEdit(idx);
      }
    };
  });
}

﻿function startInlinePairEdit(idx) {
  const container = document.getElementById('pairsListContainer');
  const row = container.querySelector(`tr[data-index="${idx}"]`);
  if (!row) return;

  const pair = studentPairs[idx];

  let select1 = `<select class="edit-student1" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: inherit;">`;
  let select2 = `<select class="edit-student2" style="width: 100%; padding: 0.4rem; background: #ffffff; border: 1px solid var(--border); color: var(--text); border-radius: 6px; font-family: inherit;">`;

  studentProfiles.forEach(sp => {
    const isSel1 = sp.email.toLowerCase() === pair.email1.toLowerCase() ? 'selected' : '';
    const isSel2 = sp.email.toLowerCase() === pair.email2.toLowerCase() ? 'selected' : '';
    select1 += `<option value="${sp.email}" ${isSel1} style="background: #ffffff; color: var(--text);">${sp.name} (${sp.email})</option>`;
    select2 += `<option value="${sp.email}" ${isSel2} style="background: #ffffff; color: var(--text);">${sp.name} (${sp.email})</option>`;
  });
  select1 += `</select>`;
  select2 += `</select>`;

  row.innerHTML = `
    <td style="padding: 0.75rem;">${select1}</td>
    <td style="padding: 0.75rem;">${select2}</td>
    <td style="padding: 0.75rem;">
      <button class="btn-table-action btn-primary" data-action="save-pair-edit" style="background: rgba(46, 204, 113, 0.15); color: var(--success);">✓ Uložit</button>
      <button class="btn-table-action btn-secondary" data-action="cancel-pair-edit">✕ Zrušit</button>
    </td>
  `;

  row.querySelector('button[data-action="save-pair-edit"]').onclick = () => {
    const email1 = row.querySelector('.edit-student1').value;
    const email2 = row.querySelector('.edit-student2').value;

    if (email1 === email2) {
      alert("Nemůžete spárovat stejného žáka se sebou samým!");
      return;
    }

    const p1 = studentProfiles.find(s => s.email.toLowerCase() === email1.toLowerCase());
    const p2 = studentProfiles.find(s => s.email.toLowerCase() === email2.toLowerCase());

    const updated = [...studentPairs];
    updated[idx] = {
      email1: p1.email, animal1: p1.animal,
      email2: p2.email, animal2: p2.animal
    };
    savePairsToServer(updated);
  };

  row.querySelector('button[data-action="cancel-pair-edit"]').onclick = () => {
    renderPairsTable();
  };
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
    const user = await new Promise((resolve) => {
      if (auth.currentUser) return resolve(auth.currentUser);
      const unsubscribe = auth.onAuthStateChanged((u) => {
        unsubscribe();
        resolve(u);
      });
    });

    if (!user) return;
    const idToken = await user.getIdToken();
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

export async function initializeAdmin() {
  const isAdmin = await checkAdminAccess();
  if (!isAdmin) return;

  // Registrace posluchačů okamžitě
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('saveStudentsBtn').addEventListener('click', saveStudents);
  document.getElementById('resetRoomsBtn').addEventListener('click', resetRooms);
  document.getElementById('saveProfilesBtn').addEventListener('click', saveProfiles);
  document.getElementById('saveLevel3ConfigBtn').addEventListener('click', saveLevel3Config);
  document.getElementById('avatarToggle').addEventListener('contextmenu', (e) => {
    e.preventDefault();
    saveAvatars();
  });
  document.getElementById('syncAvatarsBtn').addEventListener('click', (e) => {
    e.stopPropagation(); // Zabráníme rozbalení/zabalení sekce při kliku na tlačítko
    syncAvatarsFromFile();
  });

  loadStudents();
  loadProfiles();
  loadAvatars();
  loadLevel3Config();
  setupAvatarGalleryToggle();
  initLiveMonitoring();
}

let monitoringListenerUnsubscribe = null;

﻿function initLiveMonitoring() {
  const container = document.getElementById('roomsMonitoringList');
  const refreshBtn = document.getElementById('refreshMonitoringBtn');
  const unlockAllBtn = document.getElementById('unlockAllReflectionBtn');

  if (!container) return;

  // Funkce pro odemčení reflexe pro všechny
  unlockAllBtn.onclick = async () => {
    setButtonLoading('unlockAllReflectionBtn', true, '🔓 Odemykám...');
    try {
      const snap = await get(ref(db, 'rooms'));
      const rooms = snap.val() || {};
      const updates = {};
      Object.keys(rooms).forEach(roomId => {
        updates[`${roomId}/teacherControl/reflectionUnlocked`] = true;
      });
      await update(ref(db, 'rooms'), updates);
      showMessage('monitoringMessage', 'Reflexe byla odemčena pro všechny místnosti.', 'success');
    } catch (err) {
      console.error(err);
      showMessage('monitoringMessage', 'Chyba při odemykání: ' + err.message, 'error');
    } finally {
      setButtonLoading('unlockAllReflectionBtn', false, '🔓 Odemknout reflexi pro všechny');
    }
  };

  // Funkce pro opětovné načtení
  refreshBtn.onclick = () => {
    showMessage('monitoringMessage', 'Stav místností byl aktualizován.', 'success');
  };

  const roomsRef = ref(db, 'rooms');
  if (monitoringListenerUnsubscribe) {
    monitoringListenerUnsubscribe();
  }

  monitoringListenerUnsubscribe = onValue(roomsRef, (snapshot) => {
    const rooms = snapshot.val();
    if (!rooms || Object.keys(rooms).length === 0) {
      container.innerHTML = '<p class="input-hint">Žádné aktivní herní místnosti nebyly nalezeny. Spusťte hru u studentů.</p>';
      return;
    }

    let html = `
      <table class="monitoring-table">
        <thead>
          <tr>
            <th>Místnost</th>
            <th>Hráč 1 (Sova)</th>
            <th>Hráč 2 (Rys)</th>
            <th>Stav hry</th>
            <th>Reflexe</th>
            <th>Akce</th>
          </tr>
        </thead>
        <tbody>
    `;

    Object.entries(rooms).forEach(([roomId, room]) => {
      const p1 = room.players?.animal1 || {};
      const p2 = room.players?.animal2 || {};

      const p1Email = p1.email || 'Nenastaven';
      const p2Email = p2.email || 'Nenastaven';

      const p1Name = studentProfiles.find(s => s.email.toLowerCase() === p1Email.toLowerCase())?.name || p1.animal || 'Sova';
      const p2Name = studentProfiles.find(s => s.email.toLowerCase() === p2Email.toLowerCase())?.name || p2.animal || 'Rys';

      const p1Online = p1.status === 'online' ? 'online' : 'offline';
      const p2Online = p2.status === 'online' ? 'online' : 'offline';

      const gameState = room.state || 'level1';
      const reflectionUnlocked = room.teacherControl?.reflectionUnlocked || false;

      // Akční tlačítka pro konkrétní místnost
      const reflectionBtnText = reflectionUnlocked ? '🔒' : '🔓';
      const reflectionBtnClass = reflectionUnlocked ? 'btn-secondary' : 'btn-primary';

      html += `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="padding: 0.75rem; font-family: monospace; font-size: 0.8rem;">${roomId}</td>
          <td style="padding: 0.75rem;">
            <strong>${p1Name}</strong><br>
            <span class="status-badge ${p1Online}">${p1Online}</span> <span class="input-hint">${p1Email}</span>
          </td>
          <td style="padding: 0.75rem;">
            <strong>${p2Name}</strong><br>
            <span class="status-badge ${p2Online}">${p2Online}</span> <span class="input-hint">${p2Email}</span>
          </td>
          <td style="padding: 0.75rem;">
            <span class="level-badge">${gameState}</span>
          </td>
          <td style="padding: 0.75rem; font-weight: 700; color: ${reflectionUnlocked ? 'var(--success)' : 'var(--muted)'};">
            ${reflectionUnlocked ? 'Odemčeno' : 'Uzamčeno'}
          </td>
          <td style="padding: 0.75rem;">
            <button class="btn-table-action ${reflectionBtnClass}" data-action="toggle-reflection" data-room="${roomId}" data-current="${reflectionUnlocked}">
              ${reflectionBtnText}
            </button>
            <button class="btn-table-action btn-secondary" data-action="restart-room" data-room="${roomId}" style="background: #ffe0d5; color: #ff6f79;">
              🔄 Restart
            </button>
            <button class="btn-table-action btn-secondary" data-action="delete-room" data-room="${roomId}" style="background: #ffe0e0; color: #e74c3c;">
              🗑️ Smazat
            </button>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;

    // Nabindování eventů na kliknutí v tabulce
    container.querySelectorAll('button[data-action]').forEach(btn => {
      btn.onclick = async (e) => {
        const action = btn.getAttribute('data-action');
        const rId = btn.getAttribute('data-room');

        if (action === 'toggle-reflection') {
          const current = btn.getAttribute('data-current') === 'true';
          await update(ref(db, `rooms/${rId}/teacherControl`), { reflectionUnlocked: !current });
          showMessage('monitoringMessage', `Stav reflexe pro ${rId} změněn.`, 'success');
        } else if (action === 'restart-room') {
          if (confirm(`Opravdu chcete restartovat místnost ${rId} na Level 1?`)) {
            await update(ref(db, `rooms/${rId}`), {
              state: 'level1',
              playerPosition: null,
              actions: null,
              'teacherControl/reflectionUnlocked': false
            });
            showMessage('monitoringMessage', `Místnost ${rId} byla restartována.`, 'success');
          }
        } else if (action === 'delete-room') {
          if (confirm(`Opravdu chcete kompletně smazat místnost ${rId}?`)) {
            await remove(ref(db, `rooms/${rId}`));
            showMessage('monitoringMessage', `Místnost ${rId} byla smazána.`, 'success');
          }
        }
      };
    });
  }, (err) => {
    console.error("Chyba při načítání místností:", err);
    container.innerHTML = `<p class="error-message" style="color: var(--error); background: rgba(231, 76, 60, 0.1); padding: 1rem; border-radius: 12px; border: 1px solid rgba(231, 76, 60, 0.2);">Chyba při načítání místností: ${err.message}.<br><br><small>Tip: Ujistěte se, že máte nasazená aktuální databázová pravidla (<code>firebase deploy --only database</code>) a že se váš přihlášený e-mail přesně shoduje s e-mailem v pravidlech.</small></p>`;
  });
}

async function saveLevel3Config() {
  const gridSize = parseInt(document.getElementById('bridgeGridSize').value) || 5;
  const previewTime = parseInt(document.getElementById('bridgePreviewTime').value) || 5;
  const tileCount = parseInt(document.getElementById('bridgeTileCount').value) || 7;

  setButtonLoading('saveLevel3ConfigBtn', true, 'Ukládám...');
  try {
    const configData = { gridSize, previewTime, tileCount };
    
    // Save to global config
    await update(ref(db, 'rooms/globalConfig/level3_bridge'), configData);
    
    // Push to all active rooms
    const snap = await get(ref(db, 'rooms'));
    const rooms = snap.val() || {};
    const updates = {};
    Object.keys(rooms).forEach(roomId => {
      if (roomId !== 'globalConfig') {
        updates[`${roomId}/config/level3_bridge`] = configData;
      }
    });
    
    if (Object.keys(updates).length > 0) {
      await update(ref(db, 'rooms'), updates);
    }
    
    showMessage('level3ConfigMessage', 'Konfigurace Skleněného mostu byla uložena.', 'success');
  } catch (err) {
    console.error(err);
    showMessage('level3ConfigMessage', 'Chyba při ukládání konfigurace: ' + err.message, 'error');
  } finally {
    setButtonLoading('saveLevel3ConfigBtn', false, 'Uložit konfiguraci mostu');
  }
}

async function loadLevel3Config() {
  try {
    const snap = await get(ref(db, 'rooms/globalConfig/level3_bridge'));
    if (snap.exists()) {
      const data = snap.val();
      if (data.gridSize) document.getElementById('bridgeGridSize').value = data.gridSize;
      if (data.previewTime) document.getElementById('bridgePreviewTime').value = data.previewTime;
      if (data.tileCount) document.getElementById('bridgeTileCount').value = data.tileCount;
    }
  } catch (err) {
    console.warn('loadLevel3Config error', err);
  }
}


