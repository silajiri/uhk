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
  'sila.tereza@gmail.com',
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
    const snap = await db.ref('/mappings').child(encodeEmailKey(email)).once('value');
    const val = snap.val();
    if (!val) {
      return res.status(404).json({ status: 'error', message: 'Nebylo nalezeno mapování pro tento e-mail' });
    }

    const response = {
      status: 'success',
      role: 'student',
      ...(val.animal ? { animal: val.animal } : {}),
      ...(val.pairId ? { pairId: val.pairId } : {}),
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
        const snap = await db.ref('/mappings').once('value');
        const mappings = snap.val() || {};
        const grouped = {};

        Object.entries(mappings).forEach(([key, value]) => {
          const email = key.replace(/,/g, '.');
          const pairId = value.pairId || 'pair_unknown';
          grouped[pairId] = grouped[pairId] || [];
          grouped[pairId].push({ email, animal: value.animal || '' });
        });

        const pairs = Object.entries(grouped).map(([pairId, members]) => {
          const [first = {}, second = {}] = members;
          return {
            pairId,
            email1: first.email || '',
            animal1: first.animal || '',
            email2: second.email || '',
            animal2: second.animal || ''
          };
        });

        return res.status(200).json({ status: 'success', data: pairs });
      }

      if (type === 'students') {
        const snap = await db.ref('/mappings').once('value');
        const mappings = snap.val() || {};
        const students = Object.entries(mappings).map(([key, value]) => ({
          email: key.replace(/,/g, '.'),
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
        const pairId = `pair_${index + 1}`;

        if (!pair.email1 || !pair.animal1 || !pair.email2 || !pair.animal2) {
          return res.status(400).json({ status: 'error', message: 'Každý pár musí obsahovat email1, animal1, email2 i animal2' });
        }

        mappings[encodeEmailKey(pair.email1)] = {
          animal: pair.animal1,
          pairId
        };
        mappings[encodeEmailKey(pair.email2)] = {
          animal: pair.animal2,
          pairId
        };
      }

      await db.ref('/mappings').set(mappings);
      return res.status(200).json({ status: 'success', message: `Uloženo ${data.length} párů studentů` });
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
        mappings[encodeEmailKey(student.email)] = { animal: student.animal };
      });
      await db.ref('/mappings').set(mappings);
      return res.status(200).json({ status: 'success', message: `Uloženo ${data.length} studentů` });
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
  return email.replace(/\./g, ',').toLowerCase();
}
