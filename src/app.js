/*
  Hlavní herní vstup pro Strážce světla.
*/

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js';
import { getDatabase, ref, onValue } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';
import { initGameRouter } from './game/game.js';

// Použijeme stejnou konfiguraci jako v adminu
const firebaseConfig = {
  apiKey: 'AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8',
  authDomain: 'uhk-game.firebaseapp.com',
  projectId: 'uhk-game',
  databaseURL: 'https://uhk-game-default-rtdb.europe-west1.firebasedatabase.app/',
  storageBucket: 'uhk-game.firebasestorage.app',
  messagingSenderId: '1049280155064',
  appId: '1:1049280155064:web:d7c1862e73aebbcfed534d'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

function updateNavbar(role, animal, avatar) {
  const badgeEl = document.getElementById('playerBadge');
  const nameEl = document.getElementById('playerAnimalName');
  
  const isSova = (role === 'player1');
  const roleText = isSova ? '🦉 SOVA' : '🐾 RYS';
  const roleColor = isSova ? 'var(--sova-color, #3498db)' : 'var(--rys-color, #e67e22)';
  
  if (nameEl) {
    nameEl.innerHTML = `
      <div style="font-size: 0.78rem; font-weight: 700; letter-spacing: 0.05em; color: var(--muted); text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
        Role: <span style="color: ${roleColor}; font-weight: 800;">${roleText}</span>
      </div>
      <div style="font-size: 1.02rem; font-weight: 700; color: var(--text); margin-top: 1px;">
        ${animal || (isSova ? 'Sova' : 'Rys')}
      </div>
    `;
  }
  if (badgeEl) {
    const avatarPath = `assets/avatars/${avatar || 'default.svg'}`;
    badgeEl.innerHTML = `<img src="${avatarPath}" alt="Avatar" style="width:42px; height:42px; border-radius:50%; object-fit:cover;">`;
    badgeEl.style.border = `2px solid ${roleColor}`;
    badgeEl.style.boxShadow = `0 0 12px ${roleColor}66`;
  }
}

async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem('uhkUser');
    sessionStorage.removeItem('uhkUser');
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
}

function initGame() {
  const logoutBtn = document.getElementById('logoutButton');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Načtení reálných dat o uživateli uložených při přihlášení
  const storedUser = localStorage.getItem('uhkUser') || sessionStorage.getItem('uhkUser');
  const root = document.getElementById('game-root');

  if (!storedUser) {
    console.warn("Uživatel nenalezen, přesměrování na login.");
    if (root) root.innerHTML = '<div class="status-message">Chyba: Uživatel není přihlášen. Přesměrovávám...</div>';
    window.location.href = 'index.html';
    return;
  }

  const userData = JSON.parse(storedUser);
  if (root) root.innerHTML = '<div class="status-message">Načítání herních modulů...</div>';

  // Pokud se jedná o admina, na herní stránce nemá co dělat
  if (userData.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  console.log(`Hra inicializována jako ${userData.animal} (${userData.role})`);
  updateNavbar(userData.role, userData.animal, userData.avatar);
  initGameRouter(db, userData.pairId, userData.role, userData.animal, userData.avatar);
}

window.addEventListener('DOMContentLoaded', initGame);
