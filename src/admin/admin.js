// Hlavní administrátorský skript pro učitelské rozhraní
console.log('Admin rozhraní spuštěno');

function initAdmin() {
  const root = document.getElementById('admin-root');
  root.textContent = 'Admin panel je připraven.';
}

window.addEventListener('DOMContentLoaded', initAdmin);
