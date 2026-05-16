import { auth, functions, signInWithGooglePopup, httpsCallable, onAuthStateChanged } from './firebaseClient.js';

// Start matchmaking flow: ensure user is signed in, call Cloud Function to get room, redirect
export async function startMatchmaking() {
  try {
    let user = auth.currentUser;
    if (!user) {
      user = await signInWithGooglePopup();
    }

    const email = user.email;
    if (!email) throw new Error('Email not available from user profile');

    const lookup = httpsCallable(functions, 'lookupMappingByEmail');
    const resp = await lookup({ email });
    const room = resp.data && resp.data.room;
    if (!room) throw new Error('No room returned');

    // Redirect to room page (assumes `public/room.html` is served at `/room.html`)
    window.location.href = `/room.html?room=${encodeURIComponent(room)}`;
  } catch (err) {
    console.error('Matchmaking error', err);
    alert('Nepodařilo se spárovat: ' + (err.message || err));
  }
}

// Optional helper to auto-run when auth state changes (not used by default)
export function onAuthReady(cb) {
  onAuthStateChanged(auth, (user) => cb(user));
}
