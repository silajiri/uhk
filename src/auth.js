import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// TODO: Replace these values with your Firebase project configuration.
const firebaseConfig = {
  apiKey: "AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8",
  authDomain: "uhk-game.firebaseapp.com",
  projectId: "uhk-game",
  storageBucket: "uhk-game.firebasestorage.app",
  messagingSenderId: "1049280155064",
  appId: "1:1049280155064:web:d7c1862e73aebbcfed534d",
  measurementId: "G-HXFMYDSK7F"
};

const FUNCTION_URL = 'https://europe-west1-uhk-game.cloudfunctions.net/lookupMappingByEmail';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

function setLoading(isLoading) {
  const loginButton = document.getElementById('loginButton');
  const spinnerRow = document.getElementById('spinner');

  loginButton.disabled = isLoading;
  spinnerRow.classList.toggle('hidden', !isLoading);
}

function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('statusMessage');
  messageEl.textContent = text;
  messageEl.className = `status-message status-${type}`;
}

export async function loginWithGoogle() {
  setLoading(true);
  showMessage('', 'info');

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const idToken = await user.getIdToken();

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'success') {
      const errorMessage = data.message || 'Prosím, přihlas se svým školním e-mailem!';
      throw new Error(errorMessage);
    }

    if (data.role !== 'admin' && !data.pairId) {
      throw new Error('Žádný předdefinovaný pár nebyl přiřazen. Kontaktujte učitele.');
    }

    const userData = {
      animal: data.animal || '',
      pairId: data.pairId || '',
      status: data.status,
      role: data.role || 'student',
      avatar: data.avatar || 'default.svg',
      email: user.email,
      name: user.displayName,
      uid: user.uid
    };

    try {
      localStorage.setItem('uhkUser', JSON.stringify(userData));
    } catch (err) {
      console.warn('localStorage unavailable, storing in memory');
      sessionStorage.setItem('uhkUser', JSON.stringify(userData));
    }
    
    // Redirect based on role
    if (data.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'game.html';
    }
  } catch (error) {
    const message = /school|školní|edu/i.test(error.message)
      ? 'Prosím, přihlas se svým školním e-mailem!'
      : error.message || 'Nastala chyba při přihlášení. Zkus to prosím znovu.';

    showMessage(message, 'error');
    console.error('Login error:', error);
  } finally {
    setLoading(false);
  }
}

export function initializeLogin() {
  const loginButton = document.getElementById('loginButton');
  loginButton.addEventListener('click', () => {
    loginWithGoogle();
  });
}
