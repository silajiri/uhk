/*
  Hlavní herní vstup pro Strážce světla.
  Obsahuje inicializaci Firebase, načtení stavu místnosti a přepínání modulů.
*/

// TODO: implementovat Firebase init a připojení k Realtime Database
console.log('Aplikace Strážci světla spuštěna');

function initGame() {
  const root = document.getElementById('game-root');
  root.textContent = 'Hra je připravena. Čeká se na připojení...';
}

window.addEventListener('DOMContentLoaded', initGame);
