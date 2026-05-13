const fs = require("fs");
const crypto = require("crypto");
const { JSDOM } = require("jsdom");

const HTML = fs.readFileSync(__dirname + "/../site/index.html", "utf-8");
const APP_JS = fs.readFileSync(__dirname + "/../site/app.js", "utf-8");
const KEY = Buffer.from("21zTad0Pyq52CEsE26Ym8Mfp/S7lUfEyoJqsVZ6Y27w=", "base64");

function encrypt(data) {
  const pt = Buffer.from(JSON.stringify(data));
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv("aes-256-cbc", KEY, iv);
  return Buffer.concat([iv, c.update(pt), c.final()]).toString("base64");
}

const SAMPLE_STATS = {
  _pointsCurrent: 500, _heldPoints: 100, _arcadeTicketsCurrent: 25,
  _pointsEarnedLifetime: 1000, _pointsSpentLifetime: 500,
  _pointsGambledLifetime: 400, _pointsLostLifetime: 200,
  _pointsWonGambledLifetime: 100,
  _equippedCharacter: 2, _equippedSled: 1, _equippedHat: 3,
  _equippedScarf: -1, _equippedFacewear: -1, _fishInventorySize: 10,
  _hasCompletedDumbBabyGamerTutorial: true,
  _hasVisitedShopForFirstTime: true,
  _hasVisitedInventoryChestForFirstTime: false,
  _playersHitWithSnowballsWhileDefaultFrogEquipped: 5,
  _timesWonRaceWithBaikalSealEquipped: 3,
  _timesJumpedOnTrampolineWithDefaultFrogEquipped: 7,
  _timesKickedByYetiWhileWearingCape: 1,
  sledsData: [{ purchased: true, type: 1, points: 10.5, equippedDye: 0, equippedTrinkets: [] }],
  buildablesData: [], toolsData: [], _characterPurchases: [],
  hatsData: [], scarvesData: [], facewearsData: [], sledDyesData: [], trinketsSaveData: [],
};

const SAMPLE_SETTINGS = {
  _masterVolume: 0.8, _musicVolume: 0.5, _sfxVolume: 0.7,
  _voiceVolume: 0.6, _uiVolume: 0.9,
  _enableDrinkingSounds: true, _isMuted: false,
  _fullscreen: false, _vsyncEnabled: true, _frameRateLimit: 60,
  _snowTrailsEnabled: true, _lookSensitivity: 0.5, _peacefulMode: false,
  playerRegion: "us-east", currentLanguageString: "en",
  _voiceChatEnabledGeneral: true, _textChatEnabledGeneral: true,
  _showNameplates: true, _showChatUI: true, _showChatBubbles: true,
  _censorTextChat: false, _partyInvitesDisabled: false,
  _showInGameUI: true, _showNetworkGraph: false,
};

// --- Test runner ---

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log("  PASS: " + name);
    passed++;
  } else {
    console.error("  FAIL: " + name);
    failed++;
  }
}

function createDOM() {
  const dom = new JSDOM(HTML, {
    url: "http://localhost/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(w) {
      Object.defineProperty(w, "crypto", { value: crypto.webcrypto });
      w.TextEncoder = TextEncoder;
      w.TextDecoder = TextDecoder;
      // jsdom Blob lacks .text() and .arrayBuffer(), polyfill via FileReader
      const OrigBlob = w.Blob;
      w.Blob = class extends OrigBlob {
        text() {
          return new Promise((resolve, reject) => {
            const fr = new w.FileReader();
            fr.onload = () => resolve(fr.result);
            fr.onerror = () => reject(fr.error);
            fr.readAsText(this);
          });
        }
      };
    },
  });
  dom.window.eval(APP_JS);
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return dom;
}

// --- Tests ---

async function testNoInlineHandlers() {
  console.log("HTML: no inline event handlers");
  const dom = createDOM();
  const count = dom.window.document.querySelectorAll("[onclick],[onchange],[oninput]").length;
  assert(count === 0, "zero inline handlers in HTML");
  dom.window.close();
}

async function testDecryptRoundTrip() {
  console.log("Crypto: encrypt/decrypt round-trip");
  const dom = createDOM();
  const encryptSave = dom.window.eval("encryptSave");
  const decryptSave = dom.window.eval("decryptSave");

  const enc = await encryptSave(SAMPLE_STATS);
  assert(typeof enc === "string" && enc.length > 0, "encryptSave returns base64 string");

  const dec = await decryptSave(enc);
  assert(dec._pointsCurrent === 500, "decrypted _pointsCurrent matches");
  assert(dec._equippedHat === 3, "decrypted _equippedHat matches");
  assert(dec._hasCompletedDumbBabyGamerTutorial === true, "decrypted boolean matches");
  dom.window.close();
}

async function testLoadStatsFile() {
  console.log("Load: stats file populates fields");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");

  const f = new dom.window.Blob([encrypt(SAMPLE_STATS)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedStats.json";
  await handleFiles([f]);

  assert(doc.getElementById("editor-content").style.display === "block", "editor is visible");
  assert(doc.getElementById("no-data").style.display === "none", "no-data is hidden");

  const checks = [
    ["stats._pointsCurrent", "500"],
    ["stats._heldPoints", "100"],
    ["stats._arcadeTicketsCurrent", "25"],
    ["stats._equippedCharacter", "2"],
    ["stats._equippedSled", "1"],
    ["stats._equippedHat", "3"],
    ["stats._pointsEarnedLifetime", "1000"],
  ];
  for (const [path, expected] of checks) {
    const input = doc.querySelector('[data-path="' + path + '"]');
    assert(input && String(input.value) === expected, path + " = " + expected);
  }

  const tutorialCb = doc.querySelector('[data-path="stats._hasCompletedDumbBabyGamerTutorial"]');
  assert(tutorialCb && tutorialCb.checked === true, "tutorial checkbox is checked");

  const rawStats = doc.getElementById("raw-stats");
  assert(rawStats && rawStats.value.includes('"_pointsCurrent"'), "raw JSON populated");

  dom.window.close();
}

async function testLoadSettingsFile() {
  console.log("Load: settings file populates fields");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");

  const f = new dom.window.Blob([encrypt(SAMPLE_SETTINGS)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedSettings.json";
  await handleFiles([f]);

  const vol = doc.querySelector('[data-path="settings._masterVolume"]');
  assert(vol && vol.value === "0.8", "master volume = 0.8");

  const region = doc.querySelector('[data-path="settings.playerRegion"]');
  assert(region && region.value === "us-east", "region = us-east");

  dom.window.close();
}

async function testEditRoundTrip() {
  console.log("Edit: change value and re-encrypt/decrypt");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");
  const encryptSave = dom.window.eval("encryptSave");
  const decryptSave = dom.window.eval("decryptSave");

  const f = new dom.window.Blob([encrypt(SAMPLE_STATS)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedStats.json";
  await handleFiles([f]);

  // Simulate editing current points
  const input = doc.querySelector('[data-path="stats._pointsCurrent"]');
  input.value = "9999";
  input.oninput();

  // Read edited data from raw JSON
  const edited = JSON.parse(doc.getElementById("raw-stats").value);
  assert(edited._pointsCurrent === 9999, "edited value in raw JSON");

  // Round-trip through encrypt/decrypt
  const enc = await encryptSave(edited);
  const dec = await decryptSave(enc);
  assert(dec._pointsCurrent === 9999, "round-trip preserves edit");

  dom.window.close();
}

async function testCheckpointsBalanced() {
  console.log("Checkpoints: balanced data shows no warnings");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");

  // earned(1000) - spent(500) - lost(200) + won(100) = 400
  // current(300) + held(100) = 400 — balanced
  const balanced = { ...SAMPLE_STATS, _pointsCurrent: 300 };
  const f = new dom.window.Blob([encrypt(balanced)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedStats.json";
  await handleFiles([f]);

  assert(doc.querySelectorAll(".checkpoint-warn").length === 0, "no warnings");
  dom.window.close();
}

async function testCheckpointsUnbalanced() {
  console.log("Checkpoints: unbalanced data shows warnings");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");

  // earned(1000) - spent(500) - lost(200) + won(100) = 400
  // current(9999) + held(100) = 10099 — off
  const unbalanced = { ...SAMPLE_STATS, _pointsCurrent: 9999 };
  const f = new dom.window.Blob([encrypt(unbalanced)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedStats.json";
  await handleFiles([f]);

  assert(doc.querySelectorAll(".checkpoint-warn").length > 0, "warnings shown");
  const hints = [...doc.querySelectorAll(".checkpoint-hint")].map(h => h.textContent);
  assert(hints.some(h => h.includes("Set Current Points to")), "hint suggests target value");
  dom.window.close();
}

async function testCheckpointsGambling() {
  console.log("Checkpoints: lost > gambled shows warnings");
  const dom = createDOM();
  const doc = dom.window.document;
  const handleFiles = dom.window.eval("handleFiles");

  const bad = { ...SAMPLE_STATS, _pointsCurrent: 300, _pointsLostLifetime: 500, _pointsGambledLifetime: 100 };
  const f = new dom.window.Blob([encrypt(bad)], { type: "text/plain" });
  f.name = "DEMO_PlayerSavedStats.json";
  await handleFiles([f]);

  const hints = [...doc.querySelectorAll(".checkpoint-hint")].map(h => h.textContent);
  assert(hints.some(h => h.includes("Set Gambled to 500") || h.includes("Set Lost to 100")), "gambling hint suggests target value");
  dom.window.close();
}

async function testBackupFilenames() {
  console.log("Download: backup filenames are generated correctly");
  const dom = createDOM();
  const backupName = dom.window.eval("backupName");

  assert(backupName("DEMO_PlayerSavedStats.json") === "DEMO_PlayerSavedStats_BACKUP.json", "stats backup name");
  assert(backupName("DEMO_PlayerSavedSettings.json") === "DEMO_PlayerSavedSettings_BACKUP.json", "settings backup name");
  assert(backupName("noext") === "noext_BACKUP", "no extension backup name");
  dom.window.close();
}

async function testTabSwitching() {
  console.log("UI: tab data attributes");
  const dom = createDOM();
  const doc = dom.window.document;

  const tabs = doc.querySelectorAll("[data-tab]");
  assert(tabs.length === 4, "4 tab buttons with data-tab");

  const names = [...tabs].map(t => t.dataset.tab);
  assert(names.includes("stats") && names.includes("settings") && names.includes("inventory") && names.includes("raw"),
    "tabs: stats, settings, inventory, raw");
  dom.window.close();
}

// --- Run ---

(async () => {
  console.log("");
  const tests = [
    testNoInlineHandlers,
    testDecryptRoundTrip,
    testLoadStatsFile,
    testLoadSettingsFile,
    testEditRoundTrip,
    testCheckpointsBalanced,
    testCheckpointsUnbalanced,
    testCheckpointsGambling,
    testBackupFilenames,
    testTabSwitching,
  ];

  for (const test of tests) {
    await test();
  }

  console.log("\n" + passed + " passed, " + failed + " failed");
  if (failed > 0) process.exit(1);
})();
