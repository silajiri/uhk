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
      // Zobrazení čekací obrazovky pouze pokud ještě není zobrazená (zabraňuje nepříjemnému blikání)
      if (!root.querySelector('.waiting-reflection')) {
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
      }
      return;
    }

    // Načtení statistik a identit
    const level1Resets = room.actions?.level1_darkness?.resetCount || 0;
    const level3Attempts = room.actions?.level3_truth?.attempts || 0;
    const escapedPlayers = room.actions?.level3_truth?.escapedPlayers || { player1: 'waiting', player2: 'waiting' };

    const partnerIdentity = room.identities?.[partnerPath] || { name: 'Tvůj parťák', avatar: 'default.svg' };
    const partnerAnimal = role === 'player1' ? (room.players?.animal2?.animal || 'Rys') : (room.players?.animal1?.animal || 'Sova');

    // Rozhodneme, zda se již odmaskovalo
    const isRevealed = localStorage.getItem(`reveal_${pairId}`) === 'true';

    if (!isRevealed) {
      if (!root.querySelector('.reflection-reveal-card')) {
        renderRevealScreen(root, partnerAnimal, level1Resets, level3Attempts, partnerIdentity, pairId);
      } else {
        // Pouze aktualizujeme detaily, které mohly dorazit později (např. jméno partnera)
        const imgEl = root.querySelector('.reflection-card-back img');
        if (imgEl) {
          const newSrc = `assets/avatars/${partnerIdentity.avatar || 'default.svg'}`;
          if (!imgEl.src.includes(newSrc)) {
            imgEl.src = newSrc;
          }
        }
        const nameEl = root.querySelector('#revealed-name-display h2');
        if (nameEl && nameEl.textContent !== partnerIdentity.name) {
          nameEl.textContent = partnerIdentity.name;
        }
      }
    } else {
      const avatarPath = `assets/avatars/${partnerIdentity.avatar || 'default.svg'}`;
      let finalCard = document.getElementById('reflection-final-card');
      if (!finalCard) {
        renderReflectionScreenOuter(root, partnerIdentity, avatarPath, escapedPlayers, role);
      }
      
      const chatBox = document.getElementById('reflection-chat-box');
      if (chatBox) {
        const currentChatJson = JSON.stringify(room.reflectionChat || {});
        if (chatBox.dataset.lastJson !== currentChatJson) {
          chatBox.dataset.lastJson = currentChatJson;
          renderChatMessages(db, pairId, role, room.reflectionChat, partnerIdentity);
        }
      }
    }
  });
}

function renderRevealScreen(root, partnerAnimal, resets, attempts, partnerIdentity, pairId) {
  const avatarPath = `assets/avatars/${partnerIdentity.avatar || 'default.svg'}`;
  
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

      <p class="module-description" style="font-size: 1.1rem; margin-top: 1.5rem;">
        Tvým partnerem ve hře byl anonymní <strong>${partnerAnimal}</strong>.
      </p>

      <div class="reflection-card-wrap">
        <div id="reflection-card" class="reflection-card-inner">
          <div class="reflection-card-front">
            <div style="font-size: 3.5rem;">❓</div>
          </div>
          <div class="reflection-card-back">
            <img src="${avatarPath}" alt="Avatar partnera" onerror="this.src='assets/avatars/default.svg'">
          </div>
        </div>
      </div>

      <div id="revealed-name-display" style="opacity: 0; height: 0; overflow: hidden; transition: all 0.5s ease; margin-top: 0.5rem;">
        <h2 style="margin: 0; font-size: 1.8rem; color: #2ecc71;">${partnerIdentity.name}</h2>
        <p style="color: var(--muted); margin: 0 0 1rem 0;">byl tvým herním parťákem!</p>
      </div>

      <button id="btn-reveal-identity" class="btn-crystal" style="margin-top: 1.5rem; padding: 1.2rem 2.5rem; font-size: 1.2rem; cursor: pointer; width: 100%;">
        🔍 Odhalit skutečné jméno partnera
      </button>
    </div>
  `;

  const cardWrap = root.querySelector('.reflection-card-wrap');
  const cardInner = root.querySelector('#reflection-card');
  const revealBtn = root.querySelector('#btn-reveal-identity');
  const nameDisplay = root.querySelector('#revealed-name-display');

  // Parallax tilt efekt na myš
  if (cardWrap && cardInner) {
    cardWrap.onmousemove = (e) => {
      const rect = cardWrap.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const rotX = -(y / (rect.height / 2)) * 15;
      const rotY = (x / (rect.width / 2)) * 15;
      
      const isFlipped = cardInner.classList.contains('flipped');
      cardInner.style.transform = `rotateX(${rotX}deg) rotateY(${isFlipped ? 180 + rotY : rotY}deg)`;
    };
    
    cardWrap.onmouseleave = () => {
      const isFlipped = cardInner.classList.contains('flipped');
      cardInner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
    };
  }

  let step = 0; // 0 = neotočeno, 1 = otočeno a zobrazeno jméno
  revealBtn.onclick = () => {
    if (step === 0) {
      step = 1;
      
      // 3D Otočení a záblesk
      cardInner.classList.add('flipped');
      cardInner.classList.add('card-flash');
      
      // Zobrazení jména
      nameDisplay.style.height = 'auto';
      nameDisplay.style.opacity = '1';
      
      // Konfety
      spawnConfetti();
      
      revealBtn.innerHTML = '👍 Pokračovat k chatu a hodnocení';
      revealBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
      revealBtn.style.borderColor = '#2ecc71';
    } else {
      const card = root.querySelector('.reflection-reveal-card');
      card.style.transform = 'scale(0.95)';
      card.style.opacity = '0';
      card.style.transition = 'all 0.5s ease';
      
      setTimeout(() => {
        localStorage.setItem(`reveal_${pairId}`, 'true');
        document.dispatchEvent(new CustomEvent('uhk-reveal-done'));
      }, 500);
    }
  };
}

function spawnConfetti() {
  const colors = ['#f1c40f', '#2ecc71', '#3498db', '#e74c3c', '#9b59b6', '#e67e22'];
  for (let i = 0; i < 40; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed;
      top: -10px;
      left: ${Math.random() * 100}vw;
      width: ${Math.random() * 8 + 6}px;
      height: ${Math.random() * 8 + 6}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      border-radius: ${Math.random() > 0.5 ? '50%' : '0%'};
      opacity: ${Math.random() * 0.6 + 0.4};
      z-index: 10005;
      pointer-events: none;
      transform: rotate(${Math.random() * 360}deg);
      transition: transform 2.5s ease-out, top 2.5s ease-in, opacity 2.5s ease-out;
    `;
    document.body.appendChild(particle);
    
    setTimeout(() => {
      particle.style.top = '105vh';
      particle.style.transform = `translate(${Math.random() * 160 - 80}px, 0) rotate(${Math.random() * 720}deg)`;
      particle.style.opacity = '0';
    }, 50);
    
    setTimeout(() => particle.remove(), 2550);
  }
}

function renderReflectionScreenOuter(root, partnerIdentity, avatarPath, escapedPlayers, role) {
  const myStatus = role === 'player1' ? escapedPlayers.player1 : escapedPlayers.player2;
  const partnerStatus = role === 'player1' ? escapedPlayers.player2 : escapedPlayers.player1;

  let outcomeTitle = "";
  let outcomeText = "";
  let bannerBg = "";
  let bannerBorder = "";
  let bannerColor = "";
  let bannerIcon = "";
  let dynamicQuote = "";

  if (myStatus === 'escaped' && partnerStatus === 'escaped') {
    outcomeTitle = "Společné vítězství!";
    outcomeText = "Projevili jste vzájemnou důvěru a nezištně sdíleli pravdu. Brána vás propustila oba naráz.";
    bannerBg = "rgba(46, 204, 113, 0.1)";
    bannerBorder = "1px solid #2ecc71";
    bannerColor = "#2ecc71";
    bannerIcon = "🟢";
    dynamicQuote = "<strong>„Důvěra je klíčem k přežití.“</strong> Společnými silami jste se navigovali v absolutní tmě, střídali si hřejivý krystal a nakonec poskládali a sdíleli Kód pravdy. Děkujeme, že jste ukázali, že spolupráce a důvěra dokáží rozehnat jakoukoliv mlhu!";
  } else if (myStatus === 'escaped' && partnerStatus === 'trapped') {
    outcomeTitle = "Unikl jsi sám!";
    outcomeText = "Tvůj partner tě zkusil oklamat a poslal ti falešný úlomek. Starobylá brána však jeho lež odhalila a zablokovala ho. Ty jsi díky své upřímnosti prošel.";
    bannerBg = "rgba(52, 152, 219, 0.1)";
    bannerBorder = "1px solid #3498db";
    bannerColor = "#3498db";
    bannerIcon = "⚡";
    dynamicQuote = "<strong>„Pravda vítězí.“</strong> Společnými silami jste se sice navigovali tmou, ale u brány se tvůj parťák pokusil o zradu. Tvůj čestný přístup tě zachránil, zatímco les si zrádce ponechal. Reflexe je správný čas popovídat si o tom, proč k tomu došlo.";
  } else if (myStatus === 'trapped' && partnerStatus === 'escaped') {
    outcomeTitle = "Byl jsi uvězněn bránou!";
    outcomeText = "Pokusil ses partnera oklamat zasláním falešného kódu. Brána detekovala tvůj podvrh a potrestala tě. Tvůj poctivý partner úspěšně unikl.";
    bannerBg = "rgba(230, 126, 34, 0.1)";
    bannerBorder = "1px solid #e67e22";
    bannerColor = "#e67e22";
    bannerIcon = "⚠️";
    dynamicQuote = "<strong>„Každý čin má své následky.“</strong> Navigovali jste se tmou, ale na konci ses pokusil parťáka oklamat a poslal jsi mu falešný úlomek. Brána tvůj podvod prohlédla a uvěznila tě, zatímco tvůj poctivý partner unikl. Popište si v chatu, proč ses tak rozhodl.";
  } else if (myStatus === 'trapped' && partnerStatus === 'trapped') {
    outcomeTitle = "Vzájemná zrada potrestána!";
    outcomeText = "Oba jste se pokusili oklamat toho druhého. Brána detekovala oboustranný podvrh a uzavřela vás oba navždy v chladném lese.";
    bannerBg = "rgba(231, 76, 60, 0.15)";
    bannerBorder = "1px solid #e74c3c";
    bannerColor = "#e74c3c";
    bannerIcon = "🚨";
    dynamicQuote = "<strong>„Kdo jinému jámu kopá...“</strong> Oba jste se pokusili oklamat toho druhého. Důsledkem je, že jste oba zůstali uvězněni v lese. Vzájemná zrada vedla k oboustranné porážce. Napište si, jaké pocity to ve vás vyvolává.";
  } else {
    outcomeTitle = "Konec hry";
    outcomeText = "Prošli jste starobylou bránou.";
    bannerBg = "rgba(255, 255, 255, 0.05)";
    bannerBorder = "1px solid var(--border)";
    bannerColor = "var(--text)";
    bannerIcon = "✨";
    dynamicQuote = "Společnými silami jste se navigovali v absolutní tmě, střídali si hřejivý krystal a nakonec poskládali a sdíleli kód.";
  }

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

      <!-- Morální vyhodnocení brány -->
      <div style="background: ${bannerBg}; border: ${bannerBorder}; color: ${bannerColor}; border-radius: 16px; padding: 1.2rem; margin-bottom: 1.5rem; text-align: left; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; color: ${bannerColor};">
          <span>${bannerIcon}</span> ${outcomeTitle}
        </h3>
        <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: var(--text);">
          ${outcomeText}
        </p>
      </div>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 20px; padding: 1.2rem; margin-bottom: 1.5rem; text-align: left;">
        <p style="margin: 0; font-size: 0.95rem; line-height: 1.5; color: var(--text);">
          ${dynamicQuote}
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
        Únik z Mlžného lesa © 2026 – Hra pro rozvoj třídního kolektivu
      </div>
    </div>
  `;}

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
