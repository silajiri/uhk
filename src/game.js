const TILE_COUNT = 20;
const TILE_LABELS = Array.from({ length: TILE_COUNT }, (_, index) => {
  if (index === 0) return 'START';
  if (index === TILE_COUNT - 1) return 'CÍL';
  return `${index + 1}`;
});

const QUESTIONS = [
  {
    text: 'Které zvíře je největší na souši?',
    options: { A: 'Slon', B: 'Lev', C: 'Žirafa' },
    correct: 'A'
  },
  {
    text: 'Které zvíře žije ve stádu?',
    options: { A: 'Tygr', B: 'Slon', C: 'Krokodýl' },
    correct: 'B'
  },
  {
    text: 'Které zvíře může létat?',
    options: { A: 'Kůň', B: 'Pták', C: 'Opice' },
    correct: 'B'
  }
];

let playerPosition = 1;
let animal = '';
let userEmail = '';
let isMoving = false;

function getStoredUser() {
  const stored = localStorage.getItem('uhkUser');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

function redirectToLogin() {
  window.location.href = 'index.html';
}

function updateNavbar() {
  const emailEl = document.getElementById('playerEmail');
  const badgeEl = document.getElementById('playerBadge');
  emailEl.textContent = `Uživatel: ${userEmail || 'Anonym'}`;
  badgeEl.textContent = animalToEmoji(animal);
}

function animalToEmoji(animalName) {
  const normalized = (animalName || '').trim().toLowerCase();
  const map = {
    slon: '🐘',
    lev: '🦁',
    tygr: '🐯',
    zviratko: '🐾',
    zebra: '🦓',
    opice: '🐒'
  };
  return map[normalized] || '🐾';
}

function createBoard() {
  const board = document.getElementById('gameBoard');
  board.innerHTML = '';

  TILE_LABELS.forEach((label, idx) => {
    const tile = document.createElement('div');
    tile.className = `tile tile-${idx + 1}`;
    tile.dataset.index = String(idx + 1);

    const labelEl = document.createElement('div');
    labelEl.className = 'tile-label';
    labelEl.textContent = label;
    tile.appendChild(labelEl);

    if (idx === 0) {
      const token = createPlayerToken();
      tile.appendChild(token);
    }

    board.appendChild(tile);
  });
}

function createPlayerToken() {
  const token = document.createElement('div');
  token.className = 'player-token';
  token.textContent = animalToEmoji(animal);
  return token;
}

function moveToken(steps) {
  if (isMoving) return;
  isMoving = true;
  const target = Math.min(playerPosition + steps, TILE_COUNT);
  const increment = playerPosition < target ? 1 : -1;
  let current = playerPosition;

  const stepDelay = 250;
  const moveStep = () => {
    const currentTile = document.querySelector(`.tile[data-index='${current}']`);
    const token = currentTile.querySelector('.player-token');
    if (token) currentTile.removeChild(token);

    current += increment;
    const nextTile = document.querySelector(`.tile[data-index='${current}']`);
    nextTile.appendChild(createPlayerToken());

    if (current < target) {
      setTimeout(moveStep, stepDelay);
    } else {
      playerPosition = current;
      isMoving = false;
      if (playerPosition < TILE_COUNT) {
        showQuestionModal();
      }
    }
  };

  setTimeout(moveStep, stepDelay);
}

function setDiceValue(value) {
  const dice = document.getElementById('diceDisplay');
  dice.textContent = value;
  dice.classList.add('dice-animated');
  setTimeout(() => dice.classList.remove('dice-animated'), 400);
}

function rollDice() {
  if (isMoving) return;
  const value = Math.floor(Math.random() * 6) + 1;
  setDiceValue(value);
  moveToken(value);
}

function getRandomQuestion() {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

function showQuestionModal() {
  const modal = document.getElementById('questionModal');
  const questionText = document.getElementById('questionText');
  const question = getRandomQuestion();
  modal.dataset.correct = question.correct;
  questionText.textContent = question.text;

  document.querySelectorAll('.answer-button').forEach((button) => {
    const answer = button.dataset.answer;
    button.textContent = `${answer}: ${question.options[answer]}`;
  });

  modal.classList.remove('hidden');
}

function hideQuestionModal() {
  document.getElementById('questionModal').classList.add('hidden');
}

function handleAnswer(event) {
  const button = event.target.closest('.answer-button');
  if (!button) return;

  const selected = button.dataset.answer;
  const modal = document.getElementById('questionModal');
  const correct = modal.dataset.correct;

  hideQuestionModal();

  if (selected === correct) {
    alert('Správně! Zůstáváš na místě a jsi připraven pokračovat.');
  } else {
    alert('Nesprávně. Vracíš se o jedno políčko zpět.');
    const previous = Math.max(playerPosition - 1, 1);
    moveTokenBackward(previous);
  }
}

function moveTokenBackward(previousPosition) {
  if (isMoving) return;
  isMoving = true;

  const currentTile = document.querySelector(`.tile[data-index='${playerPosition}']`);
  const token = currentTile.querySelector('.player-token');
  if (token) currentTile.removeChild(token);

  playerPosition = previousPosition;
  const prevTile = document.querySelector(`.tile[data-index='${playerPosition}']`);
  prevTile.appendChild(createPlayerToken());
  isMoving = false;
}

function handleLogout() {
  localStorage.removeItem('uhkUser');
  localStorage.removeItem('animal');
  window.location.href = 'index.html';
}

export function initializeGame() {
  const stored = getStoredUser();
  const storedAnimal = localStorage.getItem('animal');

  if (!stored && !storedAnimal) {
    return redirectToLogin();
  }

  animal = storedAnimal || (stored && stored.animal) || 'zvíře';
  userEmail = (stored && stored.email) || 'Neznámý uživatel';

  updateNavbar();
  createBoard();

  document.getElementById('rollButton').addEventListener('click', rollDice);
  document.getElementById('logoutButton').addEventListener('click', handleLogout);
  document.getElementById('closeModal').addEventListener('click', hideQuestionModal);
  document.querySelectorAll('.answer-button').forEach((button) => {
    button.addEventListener('click', handleAnswer);
  });
}
