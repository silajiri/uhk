const fs = require('fs');
const path = require('path');

// Read secretWarning.js
const filePath = path.join(__dirname, '../../src/game/secretWarning.js');
let fileContent = fs.readFileSync(filePath, 'utf8');

// Strip the ES import statement at the beginning
fileContent = fileContent.replace(
  /import\s+\{\s*ref,\s*update\s*\}\s+from\s+['"][^'"]+['"];?/g,
  ''
);

// Replace export function with function
fileContent = fileContent.replace(/export\s+function\s+/g, 'function ');

// We need to provide mocks for ref and update as globals or inject them
let refCalled = false;
let updateCalled = false;

global.ref = (db, path) => {
  refCalled = true;
  return { db, path };
};

global.update = (refObj, data) => {
  updateCalled = true;
  return Promise.resolve();
};

// Mock a simple DOM element representation
class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName;
    this.innerHTML = '';
    this.children = [];
    this.listeners = {};
    this.style = {};
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      const targetId = selector.substring(1);
      return this.findChildById(this, targetId);
    }
    return null;
  }

  findChildById(el, id) {
    if (el.id === id) return el;
    for (let child of el.children) {
      const found = this.findChildById(child, id);
      if (found) return found;
    }
    return null;
  }

  set innerHTML(val) {
    this._innerHTML = val;
    this.children = [];
    const idMatches = val.match(/id="([^"]+)"/g);
    if (idMatches) {
      idMatches.forEach(m => {
        const id = m.match(/id="([^"]+)"/)[1];
        const child = new MockElement(id, 'button');
        this.children.push(child);
      });
    }
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

// Mock document
const rootElement = new MockElement('game-root');
global.document = {
  getElementById: (id) => {
    if (id === 'game-root') return rootElement;
    return null;
  }
};

// Create a wrapper function to execute the module code
const runModule = new Function('exports', fileContent + '\nexports.showSecretWarningAndTest = showSecretWarningAndTest;');
const exportsObj = {};
runModule(exportsObj);
const showSecretWarningAndTest = exportsObj.showSecretWarningAndTest;

// Test execution
console.log("=== RUNNING SECRET WARNING UNIT TESTS ===");
let testPassed = true;

try {
  const dbMock = {};
  const userDataMock = {
    role: 'player1',
    pairId: 'room123',
    animal: 'Sova',
    avatar: 'sova.svg'
  };
  let onCompleteCalled = false;
  const onComplete = () => {
    onCompleteCalled = true;
  };

  // 1. Initial invocation should render warning screen
  showSecretWarningAndTest(dbMock, userDataMock, onComplete);

  if (!rootElement.innerHTML.includes('Přísně tajné poslání!')) {
    console.error("❌ FAILED: Warning screen title not found.");
    testPassed = false;
  } else {
    console.log("   Warning screen rendered correctly.");
  }

  // 2. Click understanding button
  const understandBtn = rootElement.querySelector('#btn-secret-understand');
  if (!understandBtn) {
    console.error("❌ FAILED: Understand button (#btn-secret-understand) not found.");
    testPassed = false;
  } else {
    console.log("   Understand button found.");
    understandBtn.onclick();
  }

  // 3. Test screen should render
  if (!rootElement.innerHTML.includes('Zkouška pozornosti')) {
    console.error("❌ FAILED: Test screen title not found.");
    testPassed = false;
  } else {
    console.log("   Test screen rendered correctly.");
  }

  // 4. Click wrong answer (green button)
  const wrongBtn = rootElement.querySelector('#btn-answer-wrong');
  if (!wrongBtn) {
    console.error("❌ FAILED: Wrong button (#btn-answer-wrong) not found.");
    testPassed = false;
  } else {
    console.log("   Wrong button found.");
    wrongBtn.onclick();
  }

  // 5. Scolding screen should render
  if (!rootElement.innerHTML.includes('Ajaj! Takhle by to nešlo.')) {
    console.error("❌ FAILED: Scolding screen not rendered.");
    testPassed = false;
  } else {
    console.log("   Scolding screen rendered correctly.");
  }

  // 6. Click retry button
  const retryBtn = rootElement.querySelector('#btn-secret-retry');
  if (!retryBtn) {
    console.error("❌ FAILED: Retry button (#btn-secret-retry) not found.");
    testPassed = false;
  } else {
    console.log("   Retry button found.");
    retryBtn.onclick();
  }

  // 7. Should be back on the test screen
  if (!rootElement.innerHTML.includes('Zkouška pozornosti')) {
    console.error("❌ FAILED: Did not return to test screen.");
    testPassed = false;
  } else {
    console.log("   Returned to test screen.");
  }

  // 8. Click correct answer (red button)
  const correctBtn = rootElement.querySelector('#btn-answer-correct');
  if (!correctBtn) {
    console.error("❌ FAILED: Correct button (#btn-answer-correct) not found.");
    testPassed = false;
  } else {
    console.log("   Correct button found. Clicking correct answer...");
    correctBtn.onclick();
  }

  // 9. Firebase update and onComplete should be called
  setTimeout(() => {
    if (!refCalled) {
      console.error("❌ FAILED: Firebase ref was not called.");
      testPassed = false;
    }
    if (!updateCalled) {
      console.error("❌ FAILED: Firebase update was not called.");
      testPassed = false;
    }
    if (!onCompleteCalled) {
      console.error("❌ FAILED: onComplete callback was not called.");
      testPassed = false;
    }

    if (testPassed) {
      console.log("\n🎉 ALL SECRET WARNING FLOW TESTS PASSED SUCCESSFULLY!");
      process.exit(0);
    } else {
      console.error("\n⚠️ TESTS ENCOUNTERED FAILURES.");
      process.exit(1);
    }
  }, 50);

} catch (err) {
  console.error("❌ FAILED with exception:", err);
  process.exit(1);
}
