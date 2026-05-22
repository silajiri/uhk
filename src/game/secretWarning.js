import { ref, update } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-database.js';

/**
 * Zobrazí varování o utajení identity a následný test pozornosti.
 * 
 * @param {object} db Firebase Database instance
 * @param {object} userData Data přihlášeného uživatele (role, pairId, animal, avatar, atd.)
 * @param {function} onComplete Callback zavolaný po úspěšném splnění testu
 */
export function showSecretWarningAndTest(db, userData, onComplete) {
  const root = document.getElementById('game-root');
  if (!root) return;

  renderWarningScreen(root, db, userData, onComplete);
}

function renderWarningScreen(root, db, userData, onComplete) {
  root.innerHTML = `
    <div class="module-card" style="max-width: 600px; text-align: center; animation: fadeIn 0.5s;">
      <div class="module-tag" style="background: rgba(231, 76, 60, 0.12); color: #e74c3c; border-color: rgba(231, 76, 60, 0.3);">DŮLEŽITÉ UPOZORNĚNÍ ⚠️</div>
      <h1 style="margin: 1.5rem 0; font-size: 2.2rem; color: #fff;">🤫 Přísně tajné poslání!</h1>
      <p class="module-description" style="font-size: 1.15rem; line-height: 1.6; color: var(--text); margin-bottom: 1.5rem;">
        Vítej ve hře <strong>Únik z Mlžného lesa</strong>. Tvoje zvířecí role a tvůj avatar jsou <strong>tvoje největší tajemství</strong>.
      </p>
      
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; margin-bottom: 2rem; text-align: left; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
        <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
          📜 Hlavní pravidlo hry:
        </h3>
        <p style="margin: 0; font-size: 1rem; line-height: 1.5; color: var(--text);">
          Nikomu ve třídě <strong>neříkej</strong>, jaké zvíře jsi, <strong>neukazuj</strong> svoji obrazovku a ani nijak <strong>nenapovídej</strong>. Celá hra funguje pouze tehdy, když nikdo neví, s kým přesně hraje!
        </p>
      </div>

      <button id="btn-secret-understand" class="btn-crystal" style="padding: 1.1rem 2.2rem; font-size: 1.15rem; cursor: pointer; font-weight: 600; width: 100%;">
        Přečetl(a) jsem a rozumím 📜
      </button>
    </div>
  `;

  const btn = root.querySelector('#btn-secret-understand');
  if (btn) {
    btn.onclick = () => {
      renderTestScreen(root, db, userData, onComplete);
    };
  }
}

function renderTestScreen(root, db, userData, onComplete) {
  root.innerHTML = `
    <div class="module-card" style="max-width: 600px; text-align: center; animation: fadeIn 0.5s;">
      <div class="module-tag">Zkouška strážce tajemství 🛡️</div>
      <h1 style="margin: 1.5rem 0; font-size: 2.2rem; color: #fff;">Zkouška pozornosti</h1>
      <p class="module-description" style="font-size: 1.15rem; line-height: 1.6; color: var(--text); margin-bottom: 2rem;">
        Odpověz správně na následující otázku, abys mohl(a) vstoupit do lesa:
      </p>

      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border); border-radius: 20px; padding: 1.5rem; margin-bottom: 2.5rem; text-align: center; font-size: 1.15rem; font-weight: 500; color: #fff; line-height: 1.5;">
        Můžeš se v průběhu hry bavit se spolužáky o tom, jaké zvíře jsi dostal(a)?
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.2rem;">
        <!-- ŠPATNÁ ODPOVĚĎ: Zelená, matoucí -->
        <button id="btn-answer-wrong" class="btn-crystal" style="background: linear-gradient(135deg, #2ecc71, #27ae60); color: white; border: none; box-shadow: 0 10px 25px rgba(46, 204, 113, 0.35); padding: 1.2rem; font-size: 1.1rem; cursor: pointer; font-weight: 600; text-transform: none; border-radius: 20px; transition: transform 0.2s, box-shadow 0.2s;">
          Ano, můžu to všem říct nebo jim ukázat svoji obrazovku. 🗣️
        </button>
        
        <!-- SPRÁVNÁ ODPOVĚĎ: Červená, matoucí -->
        <button id="btn-answer-correct" class="btn-crystal" style="background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; border: none; box-shadow: 0 10px 25px rgba(231, 76, 60, 0.35); padding: 1.2rem; font-size: 1.1rem; cursor: pointer; font-weight: 600; text-transform: none; border-radius: 20px; transition: transform 0.2s, box-shadow 0.2s;">
          Ne, musím to držet v úplné tajnosti a nikomu to neprozradit! 🤐
        </button>
      </div>
    </div>
  `;

  const wrongBtn = root.querySelector('#btn-answer-wrong');
  const correctBtn = root.querySelector('#btn-answer-correct');

  if (wrongBtn) {
    wrongBtn.onmouseover = () => {
      wrongBtn.style.transform = 'translateY(-2px)';
      wrongBtn.style.boxShadow = '0 12px 30px rgba(46, 204, 113, 0.5)';
    };
    wrongBtn.onmouseout = () => {
      wrongBtn.style.transform = 'none';
      wrongBtn.style.boxShadow = '0 10px 25px rgba(46, 204, 113, 0.35)';
    };
    wrongBtn.onclick = () => {
      renderScoldingScreen(root, db, userData, onComplete);
    };
  }

  if (correctBtn) {
    correctBtn.onmouseover = () => {
      correctBtn.style.transform = 'translateY(-2px)';
      correctBtn.style.boxShadow = '0 12px 30px rgba(231, 76, 60, 0.5)';
    };
    correctBtn.onmouseout = () => {
      correctBtn.style.transform = 'none';
      correctBtn.style.boxShadow = '0 10px 25px rgba(231, 76, 60, 0.35)';
    };
    correctBtn.onclick = () => {
      // Správná odpověď -> zapsat do Firebase a pokračovat
      const playerPath = userData.role === 'player1' ? 'animal1' : 'animal2';
      const playerRef = ref(db, `rooms/${userData.pairId}/players/${playerPath}`);
      
      update(playerRef, {
        secretTestPassed: true
      }).then(() => {
        console.log("Výsledek testu utajení úspěšně uložen do Firebase.");
        onComplete();
      }).catch((err) => {
        console.error("Chyba při ukládání výsledku testu do DB:", err);
        // I při chybě sítě necháme žáka hrát, abychom neblokovali výuku
        onComplete();
      });
    };
  }
}

function renderScoldingScreen(root, db, userData, onComplete) {
  root.innerHTML = `
    <div class="module-card" style="max-width: 600px; text-align: center; animation: fadeIn 0.5s; border-color: rgba(231, 76, 60, 0.4);">
      <div class="module-tag" style="background: rgba(231, 76, 60, 0.15); color: #e74c3c; border-color: rgba(231, 76, 60, 0.3);">CHYBA ⚠️</div>
      <div style="font-size: 4rem; margin: 1.5rem 0 1rem 0;">🤦‍♂️👂</div>
      <h1 style="margin: 0 0 1rem 0; font-size: 2rem; color: #fff;">Ajaj! Takhle by to nešlo.</h1>
      <p class="module-description" style="font-size: 1.1rem; line-height: 1.6; color: var(--text); margin-bottom: 2rem;">
        Proklouzl ti nejdůležitější herní pokyn. Tvoje zvířecí identita musí zůstat <strong>naprosto tajná</strong>! Pokud ji prozradíš, celá hra ztratí své kouzlo.
      </p>

      <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 16px; padding: 1.2rem; margin-bottom: 2rem; text-align: left; font-size: 0.95rem; color: var(--muted); line-height: 1.5;">
        Hra se zakládá na vzájemném spolehnutí a komunikaci naslepo. Prozrazením jména zvířete nebo ukázáním obrazovky spoluhráči bys pokazil(a) dobrodružství sobě i jemu.
      </div>

      <button id="btn-secret-retry" class="btn-crystal" style="padding: 1.1rem 2.2rem; font-size: 1.15rem; cursor: pointer; font-weight: 600; width: 100%;">
        Rozumím, slibuji, že udržím tajemství a zkusím to znovu 🤫
      </button>
    </div>
  `;

  const btn = root.querySelector('#btn-secret-retry');
  if (btn) {
    btn.onclick = () => {
      renderTestScreen(root, db, userData, onComplete);
    };
  }
}
