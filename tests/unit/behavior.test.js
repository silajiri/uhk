const fs = require('fs');
const path = require('path');

// Read report.js
const reportJsPath = path.join(__dirname, '../../src/report.js');
const reportJsContent = fs.readFileSync(reportJsPath, 'utf8');

// Extract the analyzeRoomBehavior function body
const functionKeyword = 'export function analyzeRoomBehavior(room) {';
const startIndex = reportJsContent.indexOf(functionKeyword);
if (startIndex === -1) {
  console.error("❌ ERROR: Could not find analyzeRoomBehavior function in report.js");
  process.exit(1);
}

// Find the function body by matching brackets
let bracketCount = 1;
let currentIndex = startIndex + functionKeyword.length;
while (bracketCount > 0 && currentIndex < reportJsContent.length) {
  const char = reportJsContent[currentIndex];
  if (char === '{') bracketCount++;
  else if (char === '}') bracketCount--;
  currentIndex++;
}

const functionBody = reportJsContent.substring(startIndex + functionKeyword.length, currentIndex - 1);

// Create the function using Function constructor
const analyzeRoomBehavior = new Function('room', functionBody);

// Test Cases
const testCases = [
  {
    name: "Test 1: Úplný začátek (neaktivní L3)",
    room: {
      actions: {
        level3_truth: {
          sovaShared: false,
          rysShared: false
        }
      }
    },
    expected: {
      type: "inprogress",
      desc: "Čeká se na rozhodnutí",
      details: "Dosud nebyly sdíleny všechny úlomky.",
      sChoice: "none",
      rChoice: "none",
      sOutcome: "waiting",
      rOutcome: "waiting",
      sDecrypted: false,
      rDecrypted: false
    }
  },
  {
    name: "Test 2: Částečné sdílení (pouze Sova)",
    room: {
      actions: {
        level3_truth: {
          sovaShared: true,
          sovaShardStatus: "true",
          rysShared: false
        }
      }
    },
    expected: {
      type: "inprogress",
      desc: "⏳ Částečné sdílení",
      details: "Sova již sdílela, Rys vyčkává.",
      sChoice: "truth",
      rChoice: "none",
      sOutcome: "waiting",
      rOutcome: "waiting",
      sDecrypted: false,
      rDecrypted: false
    }
  },
  {
    name: "Test 3: Úspěšná spolupráce (oba pravda)",
    room: {
      actions: {
        level3_truth: {
          sovaShared: true,
          sovaShardStatus: "true",
          rysShared: true,
          rysShardStatus: "true",
          escapedPlayers: { player1: "escaped", player2: "escaped" }
        }
      }
    },
    expected: {
      type: "cooperate",
      desc: "🤝 Spolupráce",
      details: "Oba partneři sdíleli pravdivý úlomek.",
      sChoice: "truth",
      rChoice: "truth",
      sOutcome: "escaped",
      rOutcome: "escaped",
      sDecrypted: false,
      rDecrypted: false
    }
  },
  {
    name: "Test 4: Jednostranná zrada - Sova podvedla Rysa, Rys dešifroval a utekl",
    room: {
      actions: {
        level3_truth: {
          sovaShared: true,
          sovaShardStatus: "fake",
          rysShared: true,
          rysShardStatus: "true",
          escapedPlayers: { player1: "escaped", player2: "escaped" }
        }
      }
    },
    expected: {
      type: "betrayal-one",
      desc: "⚠️ Sova oklamala Rysa",
      details: "Sova odeslala lež, Rys pravdu. Reakce: 🔓 Rys odhalil lež a získal správný kód.",
      sChoice: "lie",
      rChoice: "truth",
      sOutcome: "escaped",
      rOutcome: "escaped",
      sDecrypted: false,
      rDecrypted: true
    }
  },
  {
    name: "Test 5: Jednostranná zrada - Rys podvedl Sovu, Sova zůstala čekat/nedešifrovala",
    room: {
      actions: {
        level3_truth: {
          sovaShared: true,
          sovaShardStatus: "true",
          rysShared: true,
          rysShardStatus: "fake",
          escapedPlayers: { player1: "waiting", player2: "escaped" }
        }
      }
    },
    expected: {
      type: "betrayal-one",
      desc: "⚠️ Rys oklamala Sovu",
      details: "Rys odeslal lež, Sova pravdu. Reakce: ⏳ Sova dosud nezískala správný kód.",
      sChoice: "truth",
      rChoice: "lie",
      sOutcome: "waiting",
      rOutcome: "escaped",
      sDecrypted: false,
      rDecrypted: false
    }
  },
  {
    name: "Test 6: Vzájemná zrada - oba fake, oba uvězněni po dešifrování",
    room: {
      actions: {
        level3_truth: {
          sovaShared: true,
          sovaShardStatus: "fake",
          rysShared: true,
          rysShardStatus: "fake",
          escapedPlayers: { player1: "trapped", player2: "trapped" }
        }
      }
    },
    expected: {
      type: "betrayal-mutual",
      desc: "🚨 Vzájemná zrada",
      details: "Oba se oklamali. Reakce: Sova získala správný kód, Rys získal správný kód.",
      sChoice: "lie",
      rChoice: "lie",
      sOutcome: "trapped",
      rOutcome: "trapped",
      sDecrypted: false,
      rDecrypted: false
    }
  }
];

let failedTests = 0;

console.log("=== RUNNING BEHAVIOR LOGIC UNIT TESTS ===");

testCases.forEach((tc) => {
  try {
    const actual = analyzeRoomBehavior(tc.room);
    const diffs = [];

    for (const key in tc.expected) {
      if (actual[key] !== tc.expected[key]) {
        diffs.push(`  - key '${key}': expected '${tc.expected[key]}', got '${actual[key]}'`);
      }
    }

    if (diffs.length === 0) {
      console.log(`✅ PASS: ${tc.name}`);
    } else {
      console.log(`❌ FAIL: ${tc.name}`);
      diffs.forEach(d => console.log(d));
      failedTests++;
    }
  } catch (err) {
    console.log(`❌ FAIL: ${tc.name} with exception:`);
    console.error(err);
    failedTests++;
  }
});

console.log("\n=== TEST SUMMARY ===");
if (failedTests === 0) {
  console.log(`🎉 ALL ${testCases.length} TESTS PASSED SUCCESSFULLY!`);
  process.exit(0);
} else {
  console.log(`⚠️ ${failedTests} TESTS FAILED.`);
  process.exit(1);
}
