import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8",
  authDomain: "uhk-game.firebaseapp.com",
  projectId: "uhk-game",
  storageBucket: "uhk-game.firebasestorage.app",
  messagingSenderId: "1049280155064",
  appId: "1:1049280155064:web:d7c1862e73aebbcfed534d",
  measurementId: "G-HXFMYDSK7F"
};

const SAVE_DATA_URL = 'https://europe-west1-uhk-game.cloudfunctions.net/saveGameData';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Questions array (temporary storage in memory)
let questionsArray = [];

function showMessage(elementId, message, type = 'success') {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `message show ${type}`;
  setTimeout(() => {
    el.classList.remove('show');
  }, 4000);
}

function setButtonLoading(btnId, isLoading) {
  const btn = document.getElementById(btnId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Ukládám...';
  } else {
    btn.disabled = false;
    btn.textContent = btn.id === 'saveStudentsBtn' ? '✓ Uložit seznam žáků' : '+ Přidat otázku';
  }
}

function parseStudentsList(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  const students = [];
  
  for (const line of lines) {
    const [email, animal] = line.split(';').map(s => s.trim());
    if (!email || !animal) {
      throw new Error(`Neplatný řádek: "${line}". Formát: email;zvíře`);
    }
    students.push({ email, animal });
  }
  
  return students;
}

async function saveStudents() {
  setButtonLoading('saveStudentsBtn', true);
  
  try {
    const text = document.getElementById('studentsList').value;
    if (!text.trim()) {
      throw new Error('Prosím, zadejte seznam žáků');
    }

    const students = parseStudentsList(text);
    const idToken = await auth.currentUser.getIdToken();

    const response = await fetch(SAVE_DATA_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'students', data: students })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Chyba při ukládání');
    }

    showMessage('studentsMessage', result.message, 'success');
    document.getElementById('studentsList').value = '';
  } catch (err) {
    showMessage('studentsMessage', err.message, 'error');
  } finally {
    setButtonLoading('saveStudentsBtn', false);
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

  showMessage('questionsMessage', `Otázka přidána (celkem: ${questionsArray.length})`, 'success');
  renderQuestions();
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

  const btn = document.getElementById('addQuestionBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Ukládám...';

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

    showMessage('questionsMessage', result.message, 'success');
    questionsArray = [];
    renderQuestions();
  } catch (err) {
    showMessage('questionsMessage', err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Přidat otázku';
  }
}

function clearQuestions() {
  questionsArray = [];
  renderQuestions();
  showMessage('questionsMessage', 'Otázky vymazány', 'success');
}

async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem('uhkUser');
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

export function initializeAdmin() {
  if (!checkAdminAccess()) return;

  // Event listeners
  document.getElementById('saveStudentsBtn').addEventListener('click', saveStudents);
  document.getElementById('addQuestionBtn').addEventListener('click', addQuestion);
  document.getElementById('clearQuestionsBtn').addEventListener('click', clearQuestions);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
}
