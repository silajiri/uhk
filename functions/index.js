const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.database();

// Allowed origins (only GitHub Pages and localhost for development)
const ALLOWED_ORIGINS = [
  'https://silajiri.github.io',
  'http://localhost:3000',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

// List of authorized admin emails
const ADMIN_EMAILS = [
  'sila.jiri@gmail.com',
  'silajiri@gmail.com',
  'sila.tereza@gmail.com',
  'silatereza@gmail.com',
  'tereza.silova@zsjrk.cz'
  // TODO: Add more admin emails here
];

function setCorsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function isAllowedOrigin(req) {
  const origin = req.get('origin') || req.get('referer');
  if (!origin) return false;
  
  // Check if origin matches allowed list
  return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

function isAdmin(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}


exports.lookupMappingByEmail = functions.region('europe-west1').https.onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Metoda není povolena' });
  }

  const authHeader = req.get('Authorization') || req.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Chybí autorizační token' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    return res.status(401).json({ status: 'error', message: 'Neplatný autorizační token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;
    if (!email) {
      return res.status(401).json({ status: 'error', message: 'Nelze získat e-mail z tokenu' });
    }

    // Check if user is admin
    if (isAdmin(email)) {
      return res.status(200).json({ status: 'success', role: 'admin', email });
    }

    // Otherwise, treat as student and lookup mapping
    const profileSnap = await db.ref('/profiles').child(encodeEmailKey(email)).once('value');
    const profile = profileSnap.val();

    if (!profile) {
      return res.status(404).json({ status: 'error', message: 'Profil nenalezen. Kontaktujte učitele.' });
    }

    const mappingSnap = await db.ref('/mappings').child(encodeEmailKey(email)).once('value');
    const mapping = mappingSnap.val();

    if (!mapping && !isAdmin(email)) {
      return res.status(404).json({ status: 'error', message: 'Nebylo nalezeno mapování pro tento e-mail' });
    }

    // Propojení UID s místností pro Security Rules
    if (mapping && mapping.pairId) {
      const playerKey = mapping.role === 'player1' ? 'animal1' : 'animal2';
      await db.ref(`/rooms/${mapping.pairId}/players/${playerKey}`).update({
        uid: decodedToken.uid,
        email: email
      });
    }

    const response = {
      status: 'success',
      role: mapping ? mapping.role : 'student',
      animal: profile.animal || 'Anonymní tvor',
      pairId: mapping ? mapping.pairId : '',
      avatar: profile.avatar || 'default.svg',
      realName: profile.name || 'Anonym',
      email
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('lookupMappingByEmail error', err);
    return res.status(500).json({ status: 'error', message: 'Chyba serveru při ověřování' });
  }
});

exports.saveGameData = functions.region('europe-west1').https.onRequest(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  if (req.method === 'GET') {
    if (!isAllowedOrigin(req)) {
      const origin = req.get('origin') || req.get('referer') || 'unknown';
      console.warn(`Unauthorized origin attempted GET: ${origin}`);
      return res.status(403).json({ status: 'error', message: 'Přístup z tohoto místa není povolen' });
    }

    const authHeader = req.get('Authorization') || req.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Chybí autorizační token' });
    }

    const idToken = authHeader.split('Bearer ')[1].trim();
    if (!idToken) {
      return res.status(401).json({ status: 'error', message: 'Neplatný autorizační token' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email;
      if (!email) {
        return res.status(401).json({ status: 'error', message: 'Nelze získat e-mail z tokenu' });
      }

      if (!isAdmin(email)) {
        return res.status(403).json({ status: 'error', message: 'Přístup odepřen. Pouze správci.' });
      }

      const type = req.query.type || 'students';
      if (type === 'pairs') {
        const mapSnap = await db.ref('/mappings').once('value');
        const mappings = mapSnap.val() || {};
        
        const grouped = {};
        Object.entries(mappings).forEach(([key, val]) => {
          const pId = val.pairId;
          if (pId) {
            if (!grouped[pId]) grouped[pId] = [];
            grouped[pId].push({
              email: val.email || key.replace(/,/g, '.').replace(/_at_/g, '@'),
              animal: val.animal || ''
            });
          }
        });

        const data = Object.entries(grouped).map(([pId, students]) => ({
          pairId: pId,
          email1: students[0]?.email || '',
          animal1: students[0]?.animal || '',
          email2: students[1]?.email || '',
          animal2: students[1]?.animal || ''
        }));
        return res.status(200).json({ status: 'success', data });
      }

      if (type === 'avatars') {
        const snap = await db.ref('/config/avatars').once('value');
        const list = snap.val() || ['elephant.svg', 'lion.svg']; // defaultní fallback
        return res.status(200).json({ status: 'success', data: list });
      }

      if (type === 'profiles') {
        const snap = await db.ref('/profiles').once('value');
        const profiles = snap.val() || {};
        const list = Object.entries(profiles).map(([key, value]) => ({
          email: key.replace(/,/g, '.').replace(/_at_/g, '@'),
          name: value.name,
          avatar: value.avatar,
          animal: value.animal
        }));
        return res.status(200).json({ status: 'success', data: list });
      }

      if (type === 'students') {
        const snap = await db.ref('/mappings').once('value');
        const mappings = snap.val() || {};
        const students = Object.entries(mappings).map(([key, value]) => ({
          email: key.replace(/,/g, '.').replace(/_at_/g, '@'),
          animal: value.animal || ''
        }));
        return res.status(200).json({ status: 'success', data: students });
      }

      if (type === 'questions') {
        const snap = await db.ref('/questions').once('value');
        const questions = snap.val() || [];
        return res.status(200).json({ status: 'success', data: questions });
      }

      return res.status(400).json({ status: 'error', message: 'Neznámý typ operace' });
    } catch (err) {
      console.error('saveGameData GET error', err);
      return res.status(500).json({ status: 'error', message: 'Chyba serveru při načítání dat' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Metoda není povolena' });
  }

  // Verify origin for write operations
  if (!isAllowedOrigin(req)) {
    const origin = req.get('origin') || req.get('referer') || 'unknown';
    console.warn(`Unauthorized origin attempted: ${origin}`);
    return res.status(403).json({ status: 'error', message: 'Přístup z tohoto místa není povolen' });
  }

  const authHeader = req.get('Authorization') || req.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Chybí autorizační token' });
  }

  const idToken = authHeader.split('Bearer ')[1].trim();
  if (!idToken) {
    return res.status(401).json({ status: 'error', message: 'Neplatný autorizační token' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;
    if (!email) {
      return res.status(401).json({ status: 'error', message: 'Nelze získat e-mail z tokenu' });
    }

    // Verify admin
    if (!isAdmin(email)) {
      return res.status(403).json({ status: 'error', message: 'Přístup odepřen. Pouze správci.' });
    }

    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).json({ status: 'error', message: 'Chybí parametry: type, data' });
    }

    // Save students mapping
    if (type === 'pairs') {
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ status: 'error', message: 'data musí být neprázdné pole párů studentů' });
      }

      const mappings = {};
      for (let index = 0; index < data.length; index += 1) {
        const pair = data[index];
        const pairId = `pair_${Date.now()}_${index + 1}`;

        if (!pair.email1 || !pair.animal1 || !pair.email2 || !pair.animal2) {
          return res.status(400).json({ status: 'error', message: 'Každý pár musí obsahovat email1, animal1, email2 i animal2' });
        }

        mappings[encodeEmailKey(pair.email1)] = {
          email: pair.email1.trim(),
          animal: pair.animal1.trim(),
          pairId,
          role: 'player1'
        };
        mappings[encodeEmailKey(pair.email2)] = {
          email: pair.email2.trim(),
          animal: pair.animal2.trim(),
          pairId,
          role: 'player2'
        };
      }

      await db.ref('/mappings').set(mappings);
      return res.status(200).json({ status: 'success', message: `Uloženo ${data.length} párů studentů` });
    }

    if (type === 'avatars') {
      if (!Array.isArray(data)) {
        return res.status(400).json({ status: 'error', message: 'data musí být pole názvů souborů' });
      }
      await db.ref('/config/avatars').set(data);
      return res.status(200).json({ status: 'success', message: 'Seznam dostupných avatarů aktualizován' });
    }

    if (type === 'students') {
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ status: 'error', message: 'data musí být neprázdné pole studentů' });
      }
      // Validate each student has email and animal
      for (const student of data) {
        if (!student.email || !student.animal) {
          return res.status(400).json({ status: 'error', message: 'Každý student musí mít email a animal' });
        }
      }
      // Write to /mappings
      const mappings = {};
      data.forEach((student) => {
        mappings[encodeEmailKey(student.email)] = { 
          email: student.email.trim(),
          animal: student.animal.trim() 
        };
      });
      await db.ref('/mappings').set(mappings);
      return res.status(200).json({ status: 'success', message: `Uloženo ${data.length} studentů` });
    }

    if (type === 'profiles') {
      if (!Array.isArray(data)) {
        return res.status(400).json({ status: 'error', message: 'data musí být pole profilů' });
      }
      const profiles = {};
      data.forEach(p => {
        if (p.email) {
          profiles[encodeEmailKey(p.email)] = {
            name: (p.name || '').trim(),
            avatar: (p.avatar || 'default.svg').trim(),
            animal: (p.animal || '').trim()
          };
        }
      });
      await db.ref('/profiles').set(profiles);
      return res.status(200).json({ status: 'success', message: `Uloženo ${Object.keys(profiles).length} profilů` });
    }

    // Save questions
    if (type === 'questions') {
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ status: 'error', message: 'data musí být neprázdné pole otázek' });
      }
      // Validate each question
      for (const q of data) {
        if (!q.text || !q.options || !q.correctOption) {
          return res.status(400).json({ status: 'error', message: 'Každá otázka musí mít text, options, correctOption' });
        }
      }
      // Write to /questions
      await db.ref('/questions').set(data);
      return res.status(200).json({ status: 'success', message: `Uloženo ${data.length} otázek` });
    }

    return res.status(400).json({ status: 'error', message: 'Neznámý typ operace' });
  } catch (err) {
    console.error('saveGameData error', err);
    return res.status(500).json({ status: 'error', message: 'Chyba serveru' });
  }
});

// Helper: encode email into a DB-safe key (replace '.' with ',')
function encodeEmailKey(email) {
  return email.toLowerCase().trim().replace(/\./g, ',').replace(/@/g, '_at_');
}
