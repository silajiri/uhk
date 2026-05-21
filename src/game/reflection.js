import { ref, onValue, set, update, serverTimestamp, push } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

export function initReflection(db, pairId, role, animal) {
  console.log(`Inicializace Reflexe pro místnost: ${pairId}, role: ${role}`);
  const root = document.getElementById('game-root');
  
  if (!root) return;

  const myPath = role === 'player1' ? 'animal1' : 'animal2';
  const partnerPath = role === 'player1' ? 'animal2' : 'animal1';
  
  const roomRef = ref(db, `rooms/${pairId}`);

  // Nejprve zapíšeme identitu hráče (jméno a avatar) do místnosti, aby ji partner mohl přečíst v odmaskování
  const userData = JSON.parse(localStorage.getItem('uhkUser') || sessionStorage.getItem('uhkUser') || '{}');
  if (userData.name) {
    update(ref(db, `rooms/${pairId}/identities/${myPath}`), {
      name: userData.name,
      avatar: userData.avatar || 'default.svg'
    }).then(() => console.log("Moje identita uložena pro reflexi."));
  }

  // Posluchač na stav místnosti
  onValue(roomRef, (snapshot) => {
    const room = snapshot.val();
    if (!room) return;

    const unlocked = room.teacherControl?.reflectionUnlocked || false;

    if (!unlocked) {
      // Zobrazení čekací obrazovky
      root.innerHTML = `
        <div class="level-transition-card waiting-reflection">
          <div class="success-icon">✨</div>
          <h1>Skvělá práce!</h1>
          <p>Společně jste dokončili všechny herní úrovně a přečkali nástrahy mlžného lesa.</p>
          <div class="spinner-row" style="margin-top: 2rem;">
            <div class="spinner"></div>
            <span>Čekání na učitele, až odemkne fázi reflexe…</span>
          </div>
        </div>
      `;
      return;
    }

    // Načtení statistik a identit
    const level1Resets = room.actions?.level1_darkness?.resetCount || 0;
    const level3Attempts = room.actions?.level3_truth?.attempts || 0;

    const partnerIdentity = room.identities?.[partnerPath] || { name: 'Tvůj parťák', avatar: 'default.svg' };
    const partnerAnimal = role === 'player1' ? (room.players?.animal2?.animal || 'Rys') : (room.players?.animal1?.animal || 'Sova');

    // Rozhodneme, zda se již odmaskovalo
    const isRevealed = localStorage.getItem(`reveal_${pairId}`) === 'true';

    if (!isRevealed) {
      renderRevealScreen(root, partnerAnimal, level1Resets, level3Attempts, partnerIdentity, pairId);
    } else {
      const avatarPath = `assets/avatars/${partnerIdentity.avatar || 'default.svg'}`;
      let finalCard = document.getElementById('reflection-final-card');
      if (!finalCard) {
        renderReflectionScreenOuter(root, partnerIdentity, avatarPath);
      }
      renderChatMessages(db, pairId, role, room.reflectionChat, partnerIdentity);
    }
  });
}

function renderRevealScreen(root, partnerAnimal, resets, attempts, partnerIdentity, pairId) {
  root.innerHTML = `
    <div class="module-card reflection-reveal-card" style="max-width: 650px; text-align: center; animation: fadeIn 0.5s;">
      <div class="module-tag">Fáze: Odhalení</div>
      <h1 style="margin: 1rem 0;">Kdo byl tvým parťákem?</h1>
      <p class="module-description">Společně jste úspěšně zvládli všechny překážky. Zde je přehled vaší spolupráce:</p>
      
      <div class="stats-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1.5rem 0;">
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 16px; border: 1px solid var(--border);">
          <div style="font-size: 2rem;">🛡️</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent); margin-top: 0.5rem;">${resets}</div>
          <div class="input-hint">pádů do pasti v Levelu 1</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 16px; border: 1px solid var(--border);">
          <div style="font-size: 2rem;">🔑</div>
          <div style="font-size: 1.2rem; font-weight: 700; color: var(--accent); margin-top: 0.5rem;">${attempts}</div>
          <div class="input-hint">neúspěšných pokusů v Levelu 3</div>
        </div>
      </div>

      <p class="module-description" style="font-size: 1.1rem; margin-top: 2rem;">
        Tvým partnerem ve hře byl anonymní <strong>${partnerAnimal}</strong>.
      </p>

      <button id="btn-reveal-identity" class="btn-crystal" style="margin-top: 1.5rem; padding: 1.2rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%;">
        🔍 Odhalit skutečné jméno partnera
      </button>
    </div>
  `;

  document.getElementById('btn-reveal-identity').onclick = () => {
    const card = root.querySelector('.reflection-reveal-card');
    card.style.transform = 'scale(0.95)';
    card.style.opacity = '0';
    card.style.transition = 'all 0.5s ease';
    
    setTimeout(() => {
      localStorage.setItem(`reveal_${pairId}`, 'true');
      document.dispatchEvent(new CustomEvent('uhk-reveal-done'));
    }, 500);
  };
}

function renderReflectionScreenOuter(root, partnerIdentity, avatarPath) {
  root.innerHTML = `
    <div class="module-card reflection-final-card" id="reflection-final-card" style="max-width: 650px; text-align: center; animation: fadeIn 0.5s;">
      <div class="module-tag" style="background: rgba(46, 204, 113, 0.15); color: #2ecc71;">Fáze: Zpětný pohled</div>
      
      <div style="margin: 1.5rem 0; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
        <div style="width: 100px; height: 100px; border-radius: 50%; border: 3px solid var(--accent); box-shadow: var(--glow); overflow: hidden; background: rgba(255,255,255,0.05); display: grid; place-items: center;">
          <img src="${avatarPath}" alt="Avatar partnera" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='assets/avatars/default.svg'">
        </div>
        <h1 style="margin: 0; font-size: 1.8rem;">${partnerIdentity.name}</h1>
        <p style="color: #2ecc71; font-weight: 700; margin: 0; font-size: 1.1rem;">byl tvým herním parťákem!</p>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 20px; padding: 1.2rem; margin-bottom: 1.5rem; text-align: left;">
        <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: var(--text);">
          <strong>„Tento hráč ti věřil, i když tě neviděl.“</strong> Společnými silami jste se navigovali v absolutní tmě, střídali si hřejivý krystal a nakonec poskládali a sdíleli Kód pravdy. Děkujeme, že jste ukázali, že spolupráce a důvěra dokáží rozehnat jakoukoliv mlhu!
        </p>
      </div>

      <h3 style="text-align: left; margin: 1.5rem 0 0.5rem 0; color: #fff; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
        💬 Závěrečný chat s parťákem:
      </h3>

      <div id="reflection-chat-box" style="max-height: 250px; min-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem;">
        <!-- Zprávy budou vloženy dynamicky -->
      </div>

      <div class="chat-input-row" style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <input type="text" id="reflection-chat-input" placeholder="Napiš parťákovi zprávu..." style="flex-grow: 1; padding: 0.8rem 1rem; background: rgba(0,0,0,0.3); border: 1px solid var(--border); color: #fff; border-radius: 12px; font-family: inherit; font-size: 1rem;" />
        <button id="btn-send-chat-msg" class="btn-primary" style="padding: 0.8rem 1.5rem; border-radius: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;">Odeslat 🚀</button>
      </div>
      
      <div style="margin-top: 2rem; font-size: 0.82rem; color: var(--muted);">
        Strážci světla © 2026 – Hra pro rozvoj třídního kolektivu
      </div>
    </div>
  `;
}

function renderChatMessages(db, pairId, role, chatData, partnerIdentity) {
  const chatBox = document.getElementById('reflection-chat-box');
  if (!chatBox) return;

  if (!chatData || Object.keys(chatData).length === 0) {
    chatBox.innerHTML = `
      <div style="text-align: center; color: var(--muted); padding: 2rem 1rem; font-style: italic; margin: auto 0;">
        Zde se zobrazí vaše konverzace.<br>Napište parťákovi první zprávu a poděkujte za spolupráci!
      </div>
    `;
    setupChatInput(db, pairId, role);
    return;
  }

  // Převod na pole a seřazení podle timestampu
  const msgs = Object.keys(chatData).map(key => ({
    id: key,
    ...chatData[key]
  }));
  msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  let html = "";
  msgs.forEach(msg => {
    const isMe = msg.sender === role;
    if (isMe) {
      html += `
        <div style="align-self: flex-end; background: var(--primary); color: #fff; padding: 0.6rem 1rem; border-radius: 14px 14px 2px 14px; max-width: 75%; text-align: left; word-break: break-word; box-shadow: 0 2px 6px rgba(103, 82, 255, 0.2);">
          ${escapeHtml(msg.text)}
        </div>
      `;
    } else {
      html += `
        <div style="align-self: flex-start; max-width: 75%;">
          <span style="font-size: 0.75rem; color: var(--accent); margin-bottom: 2px; margin-left: 4px; display: block; text-align: left; font-weight: 500;">
            ${escapeHtml(partnerIdentity.name)}
          </span>
          <div style="background: rgba(255, 255, 255, 0.08); color: #fff; padding: 0.6rem 1rem; border-radius: 14px 14px 14px 2px; border: 1px solid var(--border); text-align: left; word-break: break-word;">
            ${escapeHtml(msg.text)}
          </div>
        </div>
      `;
    }
  });

  const wasAtBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 30;

  chatBox.innerHTML = html;

  if (wasAtBottom || chatBox.scrollTop === 0) {
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  setupChatInput(db, pairId, role);
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

function setupChatInput(db, pairId, role) {
  const sendBtn = document.getElementById('btn-send-chat-msg');
  const input = document.getElementById('reflection-chat-input');
  
  if (!sendBtn || !input) return;

  if (input.dataset.bound === 'true') return;
  input.dataset.bound = 'true';

  const sendMessage = () => {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    sendBtn.disabled = true;

    const chatRef = ref(db, `rooms/${pairId}/reflectionChat`);
    push(chatRef, {
      sender: role,
      text: text,
      timestamp: serverTimestamp()
    }).then(() => {
      sendBtn.disabled = false;
      input.focus();
    }).catch(err => {
      console.error("Chyba při odesílání zprávy:", err);
      sendBtn.disabled = false;
    });
  };

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };
}
