/*
  Hlavní herní vstup pro Strážce světla.
  Obsahuje inicializaci Firebase, načtení stavu místnosti a přepínání modulů.
*/

// TODO: implementovat Firebase init a připojení k Realtime Database
console.log('Aplikace Strážci světla spuštěna');

function initGame() {
  const root = document.getElementById('game-root');
  root.textContent = 'Hra je připravena. Probíhá přihlášení...';

  // lazy-load matchmaking so the app remains simple until needed
  import('./matchmaking.js').then(({ startMatchmaking }) => {
    const btn = document.createElement('button');
    btn.textContent = 'Přihlásit a přejít do hry';
    btn.addEventListener('click', () => startMatchmaking());
    root.appendChild(document.createElement('br'));
    root.appendChild(btn);
  }).catch(err => {
    console.error('Failed to load matchmaking', err);
  });
}

window.addEventListener('DOMContentLoaded', initGame);
