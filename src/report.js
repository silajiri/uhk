import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAuth, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { getDatabase, ref, onValue, remove, get } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js";

// Firebase Configuration (matching admin.js)
const firebaseConfig = {
  apiKey: "AIzaSyCq_5Ftr7L9c2zz7mFzVp4v-KfNdGuHyF8",
  authDomain: "uhk-game.firebaseapp.com",
  projectId: "uhk-game",
  databaseURL: 'https://uhk-game-default-rtdb.europe-west1.firebasedatabase.app/',
  storageBucket: "uhk-game.firebasestorage.app",
  messagingSenderId: "1049280155064",
  appId: "1:1049280155064:web:d7c1862e73aebbcfed534d",
  measurementId: "G-HXFMYDSK7F"
};

const SAVE_DATA_URL = 'https://europe-west1-uhk-game.cloudfunctions.net/saveGameData';
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let studentProfiles = [];
let roomsData = {}; // Store raw Firebase rooms data
let filteredRoomIds = []; // Filtered room IDs

// Authenticate and verify Admin role
function checkAdminAccess() {
  const userData = JSON.parse(localStorage.getItem('uhkUser') || sessionStorage.getItem('uhkUser') || '{}');
  if (userData.role !== 'admin') {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function showMessage(message, type = 'success') {
  const el = document.getElementById('reportingMessage');
  if (!el) return;
  el.textContent = message;
  el.className = `message show ${type}`;
  setTimeout(() => {
    el.classList.remove('show');
  }, 4000);
}

// Load student profiles from database to map emails to names
async function loadProfiles() {
  const user = await new Promise((resolve) => {
    if (auth.currentUser) return resolve(auth.currentUser);
    const unsubscribe = auth.onAuthStateChanged((u) => {
      unsubscribe();
      resolve(u);
    });
  });

  if (!user) return;

  try {
    const idToken = await user.getIdToken();
    const resp = await fetch(`${SAVE_DATA_URL}?type=profiles`, {
      headers: { 'Authorization': `Bearer ${idToken}` }
    });
    const result = await resp.json();
    if (result.status === 'success') {
      studentProfiles = result.data || [];
    }
  } catch (err) {
    console.error("Chyba při načítání profilů:", err);
  }
}

// Determine student name by email
function getStudentName(email, fallbackAnimal) {
  if (!email || email === 'Nenastaven') return fallbackAnimal || 'Neznámý';
  const profile = studentProfiles.find(s => s.email.toLowerCase() === email.toLowerCase());
  return profile ? profile.name : email;
}

// Perform behavioral analysis of a room
export function analyzeRoomBehavior(room) {
  const l4 = room.actions?.level4_truth || {};
  const sShared = l4.sovaShared || false;
  const rShared = l4.rysShared || false;
  const sStatus = l4.sovaShardStatus || ''; // 'true' | 'fake'
  const rStatus = l4.rysShardStatus || ''; // 'true' | 'fake'
  const escapedPlayers = l4.escapedPlayers || { player1: 'waiting', player2: 'waiting' };

  const sReveal = room.revealDecisions?.player1 || '';
  const rReveal = room.revealDecisions?.player2 || '';

  let type = 'inprogress'; // 'cooperate' | 'betrayal-one' | 'betrayal-mutual' | 'inprogress'
  let desc = 'Čeká se na rozhodnutí';
  let sChoice = 'none';
  let rChoice = 'none';
  let details = 'Dosud nebyly sdíleny všechny úlomky.';

  if (sShared) sChoice = sStatus === 'true' ? 'truth' : 'lie';
  if (rShared) rChoice = rStatus === 'true' ? 'truth' : 'lie';

  // Sova and Rys outcomes
  const sOutcome = escapedPlayers.player1 || 'waiting';
  const rOutcome = escapedPlayers.player2 || 'waiting';

  const sDecrypted = sChoice === 'lie' ? false : (rStatus === 'fake' && (sOutcome === 'escaped' || sOutcome === 'trapped'));
  const rDecrypted = rChoice === 'lie' ? false : (sStatus === 'fake' && (rOutcome === 'escaped' || rOutcome === 'trapped'));

  if (sShared && rShared) {
    if (sStatus === 'true' && rStatus === 'true') {
      type = 'cooperate';
      desc = '🤝 Spolupráce';
      details = 'Oba partneři sdíleli pravdivý úlomek.';
    } else if (sStatus === 'fake' && rStatus === 'fake') {
      type = 'betrayal-mutual';
      desc = '🚨 Vzájemná zrada';
      const sDecStr = sOutcome === 'trapped' ? 'Sova získala správný kód' : 'Sova nezískala správný kód';
      const rDecStr = rOutcome === 'trapped' ? 'Rys získal správný kód' : 'Rys nezískal správný kód';
      details = `Oba se oklamali. Reakce: ${sDecStr}, ${rDecStr}.`;
    } else if (sStatus === 'fake' && rStatus === 'true') {
      type = 'betrayal-one';
      desc = '⚠️ Sova oklamala Rysa';
      const decState = rDecrypted ? '🔓 Rys odhalil lež a získal správný kód' : '⏳ Rys dosud nezískal správný kód';
      details = `Sova odeslala lež, Rys pravdu. Reakce: ${decState}.`;
    } else if (sStatus === 'true' && rStatus === 'fake') {
      type = 'betrayal-one';
      desc = '⚠️ Rys oklamala Sovu';
      const decState = sDecrypted ? '🔓 Sova odhalila lež a získala správný kód' : '⏳ Sova dosud nezískala správný kód';
      details = `Rys odeslal lež, Sova pravdu. Reakce: ${decState}.`;
    }
  } else if (sShared || rShared) {
    desc = '⏳ Částečné sdílení';
    details = sShared ? 'Sova již sdílela, Rys vyčkává.' : 'Rys již sdílel, Sova vyčkává.';
  }

  return {
    type,
    desc,
    details,
    sChoice,
    rChoice,
    sOutcome,
    rOutcome,
    sDecrypted,
    rDecrypted,
    sReveal,
    rReveal
  };
}

// Calculate and render top metrics (KPIs)
function updateKPIs(rooms) {
  const roomList = Object.values(rooms);
  const totalRooms = roomList.length;

  let totalPlayers = 0;
  let totalL4Choices = 0;
  let totalL4Coops = 0;
  let totalL1Resets = 0;
  let totalL2WarmthResets = 0;
  let roomsWithL1 = 0;
  let roomsWithL2 = 0;

  roomList.forEach(room => {
    if (room.players?.animal1) totalPlayers++;
    if (room.players?.animal2) totalPlayers++;

    // L1 resets
    const l1Resets = room.actions?.level1_darkness?.resetCount;
    if (typeof l1Resets === 'number') {
      totalL1Resets += l1Resets;
      roomsWithL1++;
    }

    // L2 resets
    const l2Resets = room.actions?.level2_warmth?.resetCount;
    if (typeof l2Resets === 'number') {
      totalL2WarmthResets += l2Resets;
      roomsWithL2++;
    }

    // L4 behaviors
    const l4 = room.actions?.level4_truth || {};
    if (l4.sovaShared) {
      totalL4Choices++;
      if (l4.sovaShardStatus === 'true') totalL4Coops++;
    }
    if (l4.rysShared) {
      totalL4Choices++;
      if (l4.rysShardStatus === 'true') totalL4Coops++;
    }
  });

  // Render KPI values
  document.getElementById('kpi-total-rooms').textContent = totalRooms;
  document.getElementById('kpi-total-players').textContent = totalPlayers;

  const coopRate = totalL4Choices > 0 ? Math.round((totalL4Coops / totalL4Choices) * 100) : null;
  document.getElementById('kpi-coop-rate').textContent = coopRate !== null ? `${coopRate}%` : 'N/A';
  document.getElementById('kpi-coop-sub').textContent = totalL4Choices > 0 
    ? `${totalL4Coops} z ${totalL4Choices} voleb bylo čestných` 
    : 'Žádné volby zatím neproběhly';

  const avgL1 = roomsWithL1 > 0 ? (totalL1Resets / roomsWithL1).toFixed(1) : '0.0';
  document.getElementById('kpi-avg-errors-l1').textContent = avgL1;

  const avgL2 = roomsWithL2 > 0 ? (totalL2WarmthResets / roomsWithL2).toFixed(1) : '0.0';
  document.getElementById('kpi-avg-errors-l2').textContent = avgL2;
}

// Translate state string to Czech human readable name
function getStateLabel(state) {
  switch (state) {
    case 'level1': return 'Level 1 🦉🐾';
    case 'level2': return 'Level 2 ❄️🔥';
    case 'level3': return 'Level 3 🌉';
    case 'level4': return 'Level 4 🔒🗝️';
    case 'reflection': return 'Reflexe 💬✨';
    default: return state || 'level1';
  }
}

// Generate the visual output of Level 4 player status and decisions
function renderL4StatusColumn(sName, sChoice, sOutcome, sReveal, rName, rChoice, rOutcome, rReveal) {
  const getChoiceBadge = (choice) => {
    if (choice === 'truth') return '<span class="choice-tag truth">🟢 Pravda</span>';
    if (choice === 'lie') return '<span class="choice-tag lie">🔴 Lež</span>';
    return '<span class="choice-tag none">⏳ Vyčkává</span>';
  };

  const getOutcomeBadge = (outcome) => {
    if (outcome === 'escaped') return '<span class="status-badge online" style="font-size:0.75rem;">Útěk</span>';
    if (outcome === 'trapped') return '<span class="status-badge offline" style="font-size:0.75rem; background: rgba(231,76,60,0.15); color: #e74c3c;">Uvěznění</span>';
    return '<span class="status-badge offline" style="font-size:0.75rem;">Čeká</span>';
  };

  const getRevealLabel = (reveal) => {
    if (reveal === 'accepted') return '<span style="color:#2ecc71; font-weight:600;">Odhalení: Ano</span>';
    if (reveal === 'rejected') return '<span style="color:#e74c3c; font-weight:600;">Odhalení: Ne</span>';
    return '<span style="color:var(--muted);">Odhalení: —</span>';
  };

  return `
    <div style="margin-bottom: 0.4rem;">
      <strong>Sova (${sName}):</strong><br>
      ${getChoiceBadge(sChoice)} &nbsp; ${getOutcomeBadge(sOutcome)}<br>
      <small>${getRevealLabel(sReveal)}</small>
    </div>
    <div>
      <strong>Rys (${rName}):</strong><br>
      ${getChoiceBadge(rChoice)} &nbsp; ${getOutcomeBadge(rOutcome)}<br>
      <small>${getRevealLabel(rReveal)}</small>
    </div>
  `;
}

// Filter and render the Main table
function renderTable() {
  const tbody = document.getElementById('rooms-table-body');
  const countEl = document.getElementById('table-row-count');
  if (!tbody) return;

  const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
  const stateFilter = document.getElementById('filter-state').value;
  const behaviorFilter = document.getElementById('filter-behavior').value;

  filteredRoomIds = [];
  let html = '';

  Object.entries(roomsData).forEach(([roomId, room]) => {
    const p1 = room.players?.animal1 || {};
    const p2 = room.players?.animal2 || {};

    const p1Email = p1.email || 'Nenastaven';
    const p2Email = p2.email || 'Nenastaven';

    const p1Name = getStudentName(p1Email, 'Sova');
    const p2Name = getStudentName(p2Email, 'Rys');

    const p1Online = p1.status === 'online' ? 'online' : 'offline';
    const p2Online = p2.status === 'online' ? 'online' : 'offline';

    const state = room.state || 'level1';
    const l1Resets = room.actions?.level1_darkness?.resetCount || 0;
    const l2Resets = room.actions?.level2_warmth?.resetCount || 0;

    const chatCount = room.reflectionChat ? Object.keys(room.reflectionChat).length : 0;

    // Analyze behavioral outcomes
    const behavior = analyzeRoomBehavior(room);

    // Apply Search Filter (by student names or emails)
    const matchesSearch = 
      p1Name.toLowerCase().includes(searchVal) ||
      p1Email.toLowerCase().includes(searchVal) ||
      p2Name.toLowerCase().includes(searchVal) ||
      p2Email.toLowerCase().includes(searchVal) ||
      roomId.toLowerCase().includes(searchVal);

    // Apply Game State Filter
    const matchesState = stateFilter === 'all' || state === stateFilter;

    // Apply Behavior Filter
    let matchesBehavior = false;
    if (behaviorFilter === 'all') {
      matchesBehavior = true;
    } else if (behaviorFilter === 'cooperate' && behavior.type === 'cooperate') {
      matchesBehavior = true;
    } else if (behaviorFilter === 'betrayal-one' && behavior.type === 'betrayal-one') {
      matchesBehavior = true;
    } else if (behaviorFilter === 'betrayal-mutual' && behavior.type === 'betrayal-mutual') {
      matchesBehavior = true;
    } else if (behaviorFilter === 'inprogress' && behavior.type === 'inprogress') {
      matchesBehavior = true;
    }

    if (matchesSearch && matchesState && matchesBehavior) {
      filteredRoomIds.push(roomId);

      let behaviorBadgeClass = 'inprogress';
      if (behavior.type === 'cooperate') behaviorBadgeClass = 'cooperate';
      if (behavior.type === 'betrayal-one') behaviorBadgeClass = 'betrayal';
      if (behavior.type === 'betrayal-mutual') behaviorBadgeClass = 'mutual-betrayal';

      html += `
        <tr style="border-bottom: 1px solid var(--border);">
          <td style="font-family: monospace; font-size: 0.8rem; font-weight: 700;">${roomId}</td>
          <td>
            <strong>${p1Name}</strong><br>
            <span class="status-badge ${p1Online}">${p1Online}</span> <span class="input-hint" style="font-size:0.75rem;">${p1Email}</span>
          </td>
          <td>
            <strong>${p2Name}</strong><br>
            <span class="status-badge ${p2Online}">${p2Online}</span> <span class="input-hint" style="font-size:0.75rem;">${p2Email}</span>
          </td>
          <td>
            <span class="level-badge">${getStateLabel(state)}</span>
          </td>
          <td>
            L1: <span style="font-weight:600; color:${l1Resets > 0 ? 'var(--warning)' : 'var(--success)'}">${l1Resets}x</span><br>
            L2: <span style="font-weight:600; color:${l2Resets > 0 ? 'var(--warning)' : 'var(--success)'}">${l2Resets}x</span><br>
            <div style="font-size: 0.75rem; margin-top: 0.3rem; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 0.3rem; color: var(--muted); line-height: 1.3;">
              <strong>Most L3:</strong><br>
              Sova: ${room.actions?.level3_bridge?.stats?.player1?.success ? '🟢' : (room.actions?.level3_bridge?.stats?.player1?.attemptsUsed !== undefined ? '🔴' : '⏳')} (${room.actions?.level3_bridge?.stats?.player1?.attemptsUsed || 0}p, 👏${room.actions?.level3_bridge?.stats?.player1?.supportSent || 0}/😜${room.actions?.level3_bridge?.stats?.player1?.hateSent || 0})<br>
              Rys: ${room.actions?.level3_bridge?.stats?.player2?.success ? '🟢' : (room.actions?.level3_bridge?.stats?.player2?.attemptsUsed !== undefined ? '🔴' : '⏳')} (${room.actions?.level3_bridge?.stats?.player2?.attemptsUsed || 0}p, 👏${room.actions?.level3_bridge?.stats?.player2?.supportSent || 0}/😜${room.actions?.level3_bridge?.stats?.player2?.hateSent || 0})
            </div>
          </td>
          <td>
            ${renderL4StatusColumn(p1Name, behavior.sChoice, behavior.sOutcome, behavior.sReveal, p2Name, behavior.rChoice, behavior.rOutcome, behavior.rReveal)}
          </td>
          <td>
            <span class="behavior-badge ${behaviorBadgeClass}">${behavior.desc}</span>
            <div style="font-size: 0.75rem; color: var(--muted); margin-top: 0.3rem; max-width: 220px; line-height: 1.3;">
              ${behavior.details}
            </div>
          </td>
          <td style="text-align: center; font-weight: 700; color: var(--primary);">
            ${chatCount} msg
          </td>
          <td>
            <button class="btn-table-action view" data-action="view-chat" data-room="${roomId}" ${chatCount === 0 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
              💬 Chat
            </button>
            <button class="btn-table-action delete" data-action="delete-room" data-room="${roomId}">
              🗑️ Smazat
            </button>
          </td>
        </tr>
      `;
    }
  });

  if (filteredRoomIds.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--muted);">
          Žádné herní místnosti neodpovídají nastaveným filtrům.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = html;

    // Bind action buttons in table
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.onclick = async (e) => {
        const action = btn.getAttribute('data-action');
        const rId = btn.getAttribute('data-room');

        if (action === 'view-chat') {
          openChatInspector(rId);
        } else if (action === 'delete-room') {
          if (confirm(`Opravdu chcete kompletně smazat místnost ${rId}?`)) {
            try {
              await remove(ref(db, `rooms/${rId}`));
              showMessage(`Místnost ${rId} byla smazána.`, 'success');
            } catch (err) {
              console.error(err);
              showMessage('Chyba při mazání místnosti: ' + err.message, 'error');
            }
          }
        }
      };
    });
  }

  countEl.textContent = `Zobrazeno ${filteredRoomIds.length} z ${Object.keys(roomsData).length} místností`;
}

// Open Chat inspector dialog for a specific room
async function openChatInspector(roomId) {
  const dialog = document.getElementById('chatInspectorDialog');
  const title = document.getElementById('chat-dialog-title');
  const history = document.getElementById('chat-dialog-history');

  if (!dialog || !history) return;

  const room = roomsData[roomId];
  if (!room) return;

  const p1Email = room.players?.animal1?.email;
  const p2Email = room.players?.animal2?.email;

  const p1Name = getStudentName(p1Email, 'Sova');
  const p2Name = getStudentName(p2Email, 'Rys');

  title.textContent = `💬 Chat v reflexi – Místnost ${roomId}`;
  history.innerHTML = '<div style="text-align:center; padding:2rem;"><div class="spinner"></div><br>Načítám zprávy...</div>';
  dialog.showModal();

  try {
    const chatSnap = await get(ref(db, `rooms/${roomId}/reflectionChat`));
    const chatData = chatSnap.val();

    if (!chatData) {
      history.innerHTML = '<div class="no-chat-data">Žádné chatové zprávy nebyly vyměněny.</div>';
      return;
    }

    // Sort messages by timestamp
    const sortedMsgs = Object.values(chatData).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    let html = '';
    sortedMsgs.forEach(msg => {
      const isSova = msg.sender === 'player1';
      const senderName = isSova ? p1Name : p2Name;
      const msgClass = isSova ? 'self' : 'partner';
      
      let timeStr = '';
      if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        timeStr = d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      html += `
        <div class="chat-msg ${msgClass}">
          <span class="msg-meta">${senderName} (${isSova ? 'Sova' : 'Rys'})</span>
          <span>${escapeHtml(msg.text)}</span>
          <span class="msg-time">${timeStr}</span>
        </div>
      `;
    });

    history.innerHTML = html;
    history.scrollTop = history.scrollHeight; // Auto Scroll to bottom
  } catch (err) {
    console.error(err);
    history.innerHTML = `<div class="no-chat-data" style="color:var(--error);">Chyba při načítání chatu: ${err.message}</div>`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Export summary reports to CSV (Excel compatible, Semicolon delimiter, UTF-8 with BOM)
function exportStatsToCSV() {
  if (!roomsData || Object.keys(roomsData).length === 0) {
    showMessage('Nejsou k dispozici žádná data k exportu.', 'error');
    return;
  }

  // Header row matching requested behavior metrics
  const headers = [
    'Místnost ID',
    'Stav hry',
    'Sova - Jméno',
    'Sova - Email',
    'Sova - L3 Most Úspěch',
    'Sova - L3 Most Pokusy',
    'Sova - L3 Most Podpory',
    'Sova - L3 Most Výsměchy',
    'Sova - L3 Most Reakce',
    'Sova - L4 Brána Volba',
    'Sova - L4 Brána Výsledek',
    'Sova - Odhalení',
    'Rys - Jméno',
    'Rys - Email',
    'Rys - L3 Most Úspěch',
    'Rys - L3 Most Pokusy',
    'Rys - L3 Most Podpory',
    'Rys - L3 Most Výsměchy',
    'Rys - L3 Most Reakce',
    'Rys - L4 Brána Volba',
    'Rys - L4 Brána Výsledek',
    'Rys - Odhalení',
    'L4 Kooperační scénář',
    'L4 Popis chování',
    'L1 Bludiště - Pády',
    'L2 Vánice - Resety',
    'Celkem zpráv v reflexi'
  ];

  const rows = [headers];

  Object.entries(roomsData).forEach(([roomId, room]) => {
    // Only include in CSV if matches the active filters
    if (!filteredRoomIds.includes(roomId)) return;

    const p1 = room.players?.animal1 || {};
    const p2 = room.players?.animal2 || {};

    const p1Email = p1.email || 'Nenastaven';
    const p2Email = p2.email || 'Nenastaven';

    const p1Name = getStudentName(p1Email, 'Sova');
    const p2Name = getStudentName(p2Email, 'Rys');

    const state = room.state || 'level1';
    const l1Resets = room.actions?.level1_darkness?.resetCount || 0;
    const l2Resets = room.actions?.level2_warmth?.resetCount || 0;
    const chatCount = room.reflectionChat ? Object.keys(room.reflectionChat).length : 0;

    const l3b = room.actions?.level3_bridge || {};
    const stats1 = l3b.stats?.player1 || {};
    const stats2 = l3b.stats?.player2 || {};

    const sBridgeSuccess = stats1.success !== undefined ? (stats1.success ? 'Ano' : 'Ne') : 'Nezahájeno';
    const rBridgeSuccess = stats2.success !== undefined ? (stats2.success ? 'Ano' : 'Ne') : 'Nezahájeno';
    
    const sBridgeAtt = stats1.attemptsUsed !== undefined ? stats1.attemptsUsed : 0;
    const rBridgeAtt = stats2.attemptsUsed !== undefined ? stats2.attemptsUsed : 0;

    const sSupport = stats1.supportSent || 0;
    const rSupport = stats2.supportSent || 0;
    const sHate = stats1.hateSent || 0;
    const rHate = stats2.hateSent || 0;

    const sFinal = stats1.finalReactionSent ? (stats1.finalReactionSent === 'support' ? 'Podpora' : 'Výsměch') : 'Žádná';
    const rFinal = stats2.finalReactionSent ? (stats2.finalReactionSent === 'support' ? 'Podpora' : 'Výsměch') : 'Žádná';

    const behavior = analyzeRoomBehavior(room);

    let choiceSova = 'Vyčkává';
    if (behavior.sChoice === 'truth') choiceSova = 'Pravda';
    if (behavior.sChoice === 'lie') choiceSova = 'Lež';

    let choiceRys = 'Vyčkává';
    if (behavior.rChoice === 'truth') choiceRys = 'Pravda';
    if (behavior.rChoice === 'lie') choiceRys = 'Lež';

    let outcomeSova = 'Čeká';
    if (behavior.sOutcome === 'escaped') outcomeSova = 'Útěk';
    if (behavior.sOutcome === 'trapped') outcomeSova = 'Uvěznění';

    let outcomeRys = 'Čeká';
    if (behavior.rOutcome === 'escaped') outcomeRys = 'Útěk';
    if (behavior.rOutcome === 'trapped') outcomeRys = 'Uvěznění';

    let revealSova = 'Čeká';
    if (behavior.sReveal === 'accepted') revealSova = 'Ano';
    if (behavior.sReveal === 'rejected') revealSova = 'Ne';

    let revealRys = 'Čeká';
    if (behavior.rReveal === 'accepted') revealRys = 'Ano';
    if (behavior.rReveal === 'rejected') revealRys = 'Ne';

    let scenario = 'Nedokončeno';
    if (behavior.type === 'cooperate') scenario = 'Spolupráce';
    if (behavior.type === 'betrayal-one') scenario = 'Jednostranná zrada';
    if (behavior.type === 'betrayal-mutual') scenario = 'Vzájemná zrada';

    rows.push([
      roomId,
      getStateLabel(state),
      p1Name,
      p1Email,
      sBridgeSuccess,
      sBridgeAtt,
      sSupport,
      sHate,
      sFinal,
      choiceSova,
      outcomeSova,
      revealSova,
      p2Name,
      p2Email,
      rBridgeSuccess,
      rBridgeAtt,
      rSupport,
      rHate,
      rFinal,
      choiceRys,
      outcomeRys,
      revealRys,
      scenario,
      behavior.desc + ' - ' + behavior.details,
      l1Resets,
      l2Resets,
      chatCount
    ]);
  });

  // Convert to CSV String (use Semicolon for European Excel)
  const csvContent = rows.map(r => r.map(val => {
    // Escape double quotes and wrap strings containing delimiters
    const strVal = String(val).replace(/"/g, '""');
    return `"${strVal}"`;
  }).join(';')).join('\n');

  // Trigger Download with UTF-8 BOM (\uFEFF)
  downloadBlobFile(csvContent, 'mlzny-les-behavioral-report.csv', 'text/csv;charset=utf-8;');
}

// Export all chats from all rooms to a single CSV for text analysis
async function exportChatsToCSV() {
  const activeRooms = Object.entries(roomsData).filter(([roomId]) => filteredRoomIds.includes(roomId));
  
  if (activeRooms.length === 0) {
    showMessage('Nejsou k dispozici žádná data k exportu.', 'error');
    return;
  }

  const headers = [
    'Místnost ID',
    'Sova (Jméno)',
    'Rys (Jméno)',
    'Odesílatel (Role)',
    'Odesílatel (Jméno)',
    'Text zprávy',
    'Čas odeslání'
  ];

  const rows = [headers];

  for (const [roomId, room] of activeRooms) {
    const chatData = room.reflectionChat;
    if (!chatData) continue;

    const p1Email = room.players?.animal1?.email;
    const p2Email = room.players?.animal2?.email;

    const p1Name = getStudentName(p1Email, 'Sova');
    const p2Name = getStudentName(p2Email, 'Rys');

    const sortedMsgs = Object.values(chatData).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    sortedMsgs.forEach(msg => {
      const isSova = msg.sender === 'player1';
      const senderRole = isSova ? 'Sova' : 'Rys';
      const senderName = isSova ? p1Name : p2Name;

      let timeStr = '';
      if (msg.timestamp) {
        const d = new Date(msg.timestamp);
        timeStr = d.toISOString(); // standardized ISO timestamp
      }

      rows.push([
        roomId,
        p1Name,
        p2Name,
        senderRole,
        senderName,
        msg.text,
        timeStr
      ]);
    });
  }

  if (rows.length === 1) {
    showMessage('Žádné chatové konverzace nebyly nalezeny ve vybraných místnostech.', 'warning');
    return;
  }

  const csvContent = rows.map(r => r.map(val => {
    const strVal = String(val).replace(/"/g, '""');
    return `"${strVal}"`;
  }).join(';')).join('\n');

  downloadBlobFile(csvContent, 'mlzny-les-chat-logs.csv', 'text/csv;charset=utf-8;');
}

// Download file utility supporting UTF-8 BOM
function downloadBlobFile(content, filename, mimeType) {
  const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), content], { type: mimeType }); // prepend UTF-8 BOM
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Handle Logout
async function handleLogout() {
  try {
    await signOut(auth);
    localStorage.removeItem('uhkUser');
    sessionStorage.removeItem('uhkUser');
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Logout error:', err);
    alert('Chyba při odhlášení');
  }
}

// Export initialization function
export async function initializeReport() {
  if (!checkAdminAccess()) return;

  // Bind top navbar controls
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  // Bind filter inputs to refresh table dynamically
  document.getElementById('search-input').addEventListener('input', renderTable);
  document.getElementById('filter-state').addEventListener('change', renderTable);
  document.getElementById('filter-behavior').addEventListener('change', renderTable);

  // Bind export buttons
  document.getElementById('btn-export-stats').addEventListener('click', exportStatsToCSV);
  document.getElementById('btn-export-chats').addEventListener('click', exportChatsToCSV);

  // Bind close modal events
  const dialog = document.getElementById('chatInspectorDialog');
  document.getElementById('btn-close-dialog').onclick = () => dialog.close();
  document.getElementById('btn-close-dialog-foot').onclick = () => dialog.close();

  // Load profiles first, then register the Realtime Database listener
  await loadProfiles();

  const roomsRef = ref(db, 'rooms');
  onValue(roomsRef, (snapshot) => {
    const data = snapshot.val();
    roomsData = data || {};
    
    // Update live metrics
    updateKPIs(roomsData);
    
    // Render the data table
    renderTable();
  }, (err) => {
    console.error("Chyba při načítání dat místností:", err);
    const tbody = document.getElementById('rooms-table-body');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2rem; color: var(--error); background: rgba(231,76,60,0.05);">
            Chyba při načítání dat z Firebase Realtime Database: ${err.message}<br>
            <small>Ujistěte se, že jste přihlášeni jako administrátor s odpovídajícím oprávněním.</small>
          </td>
        </tr>
      `;
    }
  });
}
