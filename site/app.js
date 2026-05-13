// Catch any JS error and show it visibly on the page
window.onerror = function(msg, src, line) {
    var el = document.getElementById('status-msg');
    if (el) { el.textContent = 'JS Error: ' + msg + ' (line ' + line + ')'; el.className = 'err'; }
};

const KEY_B64 = '21zTad0Pyq52CEsE26Ym8Mfp/S7lUfEyoJqsVZ6Y27w=';
let cryptoKey = null;
let saveData = { stats: null, settings: null };
let loadedFilenames = { stats: 'DEMO_PlayerSavedStats.json', settings: 'DEMO_PlayerSavedSettings.json' };

// --- Crypto (Web Crypto API, all client-side) ---

function b64ToBytes(b64) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

function bytesToB64(bytes) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
}

async function getKey() {
    if (cryptoKey) return cryptoKey;
    const keyBytes = b64ToBytes(KEY_B64);
    cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    return cryptoKey;
}

async function decryptSave(b64Text) {
    const raw = b64ToBytes(b64Text.trim());
    const iv = raw.slice(0, 16);
    const ciphertext = raw.slice(16);
    const key = await getKey();
    const ptBuf = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, ciphertext);
    return JSON.parse(new TextDecoder().decode(ptBuf));
}

async function encryptSave(data) {
    const pt = new TextEncoder().encode(JSON.stringify(data));
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const key = await getKey();
    const ctBuf = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, pt);
    const ct = new Uint8Array(ctBuf);
    const combined = new Uint8Array(16 + ct.length);
    combined.set(iv);
    combined.set(ct, 16);
    return bytesToB64(combined);
}

// --- UI helpers ---

function setStatus(msg, type) {
    const el = document.getElementById('status-msg');
    el.textContent = msg;
    el.className = type || '';
    if (type === 'ok') setTimeout(() => { el.textContent = ''; el.className = ''; }, 4000);
}

function switchTab(name, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    btn.classList.add('active');
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((o, k) => o && o[k], obj);
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let o = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in o)) o[keys[i]] = {};
        o = o[keys[i]];
    }
    o[keys[keys.length - 1]] = value;
}

function showEditor() {
    document.getElementById('no-data').style.display = 'none';
    document.getElementById('editor-content').style.display = 'block';
    document.getElementById('btn-download').disabled = false;
}

function populateFields() {
    document.querySelectorAll('[data-path]').forEach(input => {
        const val = getNestedValue(saveData, input.dataset.path);
        if (val === undefined || val === null) return;
        if (input.type === 'checkbox') {
            input.checked = !!val;
        } else if (input.type === 'range') {
            input.value = val;
            const span = input.parentElement.querySelector('.range-val');
            if (span) span.textContent = parseFloat(val).toFixed(2);
        } else {
            input.value = val;
        }
    });

    document.querySelectorAll('[data-path]').forEach(input => {
        input.onchange = input.oninput = () => {
            let val;
            if (input.type === 'checkbox') val = input.checked;
            else if (input.type === 'number') val = parseFloat(input.value) || 0;
            else if (input.type === 'range') {
                val = parseFloat(input.value);
                const span = input.parentElement.querySelector('.range-val');
                if (span) span.textContent = val.toFixed(2);
            }
            else val = input.value;
            setNestedValue(saveData, input.dataset.path, val);
            updateRawJson();
            if (POINT_PATHS.includes(input.dataset.path)) validateCheckpoints();
        };
    });
}

// --- Checkpoints (point balance validation) ---

const POINT_PATHS = [
    'stats._pointsCurrent', 'stats._heldPoints',
    'stats._pointsEarnedLifetime', 'stats._pointsSpentLifetime',
    'stats._pointsGambledLifetime', 'stats._pointsLostLifetime',
    'stats._pointsWonGambledLifetime'
];

function getPointField(path) {
    return document.querySelector('[data-path="' + path + '"]');
}

function clearCheckpoints() {
    document.querySelectorAll('.checkpoint-warn').forEach(el => el.classList.remove('checkpoint-warn'));
    document.querySelectorAll('.checkpoint-hint').forEach(el => el.remove());
}

function addHint(input, msg) {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.add('checkpoint-warn');
    const hint = document.createElement('div');
    hint.className = 'checkpoint-hint';
    hint.textContent = msg;
    field.appendChild(hint);
}

function validateCheckpoints() {
    clearCheckpoints();
    if (!saveData.stats) return;
    const s = saveData.stats;

    const current = s._pointsCurrent || 0;
    const held = s._heldPoints || 0;
    const earned = s._pointsEarnedLifetime || 0;
    const spent = s._pointsSpentLifetime || 0;
    const gambled = s._pointsGambledLifetime || 0;
    const lost = s._pointsLostLifetime || 0;
    const won = s._pointsWonGambledLifetime || 0;

    // Balance check: earned - spent - lost + won should equal current + held
    const expectedBalance = earned - spent - lost + won;
    const actualBalance = current + held;
    if (expectedBalance !== actualBalance) {
        addHint(getPointField('stats._pointsCurrent'),
            'Set Current Points to ' + (expectedBalance - held) + ', or set Earned to ' + (actualBalance + spent + lost - won));
        addHint(getPointField('stats._pointsEarnedLifetime'),
            'Expected: earned - spent - lost + won = current + held (' + expectedBalance + ' vs ' + actualBalance + ')');
    }

    // Gambling check: lost should not exceed gambled
    if (lost > gambled) {
        addHint(getPointField('stats._pointsLostLifetime'),
            'Set Lost to ' + gambled + ', or set Gambled to ' + lost);
        addHint(getPointField('stats._pointsGambledLifetime'),
            'Set Gambled to ' + lost + ', or set Lost to ' + gambled);
    }

    // Spent should not exceed earned
    if (spent > earned) {
        addHint(getPointField('stats._pointsSpentLifetime'),
            'Set Spent to ' + earned + ', or set Earned to ' + spent);
    }
}

// --- Inventory rendering ---

function renderInventory() {
    if (!saveData.stats) return;
    const stats = saveData.stats;

    renderItemList('sleds-list', stats.sledsData || [], (sled, i) =>
        makeItemRow(`Sled Type ${sled.type}`, sled.purchased, v => {
            stats.sledsData[i].purchased = v; updateRawJson();
        }, 'Points:', sled.points, v => {
            stats.sledsData[i].points = v; updateRawJson();
        })
    );

    renderItemList('buildables-list', stats.buildablesData || [], (b, i) =>
        makeItemRow(`Type ${b.type}`, b.purchased, v => {
            stats.buildablesData[i].purchased = v; updateRawJson();
        })
    );

    renderItemList('tools-list', stats.toolsData || [], (t, i) =>
        makeItemRow(`Type ${t.type}`, t.purchased, v => {
            stats.toolsData[i].purchased = v; updateRawJson();
        })
    );

    const charList = document.getElementById('characters-list');
    charList.innerHTML = '';
    if ((stats._characterPurchases || []).length === 0) {
        charList.innerHTML = '<div class="item-row"><span class="item-label">No character purchases</span></div>';
    }

    renderSimpleInventory('hats-list', stats.hatsData || []);
    renderSimpleInventory('scarves-list', stats.scarvesData || []);
    renderSimpleInventory('facewear-list', stats.facewearsData || []);
    renderSimpleInventory('dyes-list', stats.sledDyesData || []);
    renderSimpleInventory('trinkets-list', stats.trinketsSaveData || []);
}

function renderItemList(elementId, items, makeFn) {
    const list = document.getElementById(elementId);
    list.innerHTML = '';
    if (items.length === 0) {
        list.innerHTML = '<div class="item-row"><span class="item-label">None</span></div>';
        return;
    }
    items.forEach((item, i) => list.appendChild(makeFn(item, i)));
}

function renderSimpleInventory(elementId, items) {
    const list = document.getElementById(elementId);
    list.innerHTML = '';
    if (items.length === 0) {
        list.innerHTML = '<div class="item-row"><span class="item-label">None</span></div>';
        return;
    }
    items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `<span class="item-label">#${i}</span><code>${JSON.stringify(item)}</code>`;
        list.appendChild(row);
    });
}

function makeItemRow(label, purchased, onToggle, extraLabel, extraVal, onExtra) {
    const row = document.createElement('div');
    row.className = 'item-row';

    const lbl = document.createElement('span');
    lbl.className = 'item-label';
    lbl.textContent = label;
    row.appendChild(lbl);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = purchased;
    row.appendChild(cb);

    const plbl = document.createElement('span');
    plbl.className = purchased ? 'purchased-label' : 'not-purchased-label';
    plbl.textContent = purchased ? 'Owned' : 'Not owned';
    row.appendChild(plbl);

    cb.onchange = () => {
        onToggle(cb.checked);
        plbl.textContent = cb.checked ? 'Owned' : 'Not owned';
        plbl.className = cb.checked ? 'purchased-label' : 'not-purchased-label';
    };

    if (extraLabel && onExtra !== undefined) {
        const el = document.createElement('span');
        el.className = 'item-label';
        el.textContent = extraLabel;
        row.appendChild(el);

        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = extraVal;
        inp.step = '0.1';
        inp.onchange = () => onExtra(parseFloat(inp.value) || 0);
        row.appendChild(inp);
    }

    return row;
}

function addSled() {
    if (!saveData.stats) return;
    const nextType = (saveData.stats.sledsData || []).length + 1;
    saveData.stats.sledsData.push({
        purchased: false, type: nextType, points: 0.0, equippedDye: 0,
        equippedTrinkets: Array.from({ length: 5 }, () => ({
            localPosition: { x: 0, y: 0, z: 0 },
            localRotation: { x: 0, y: 0, z: 0 },
            trinketIdentifierData: { trinketType: 0, trinketSize: 0, trinketRarity: 0 }
        }))
    });
    renderInventory();
    updateRawJson();
}

// --- Raw JSON tab ---

function updateRawJson() {
    if (saveData.stats)
        document.getElementById('raw-stats').value = JSON.stringify(saveData.stats, null, 2);
    if (saveData.settings)
        document.getElementById('raw-settings').value = JSON.stringify(saveData.settings, null, 2);
}

function applyRawJson() {
    try {
        const statsText = document.getElementById('raw-stats').value.trim();
        if (statsText) saveData.stats = JSON.parse(statsText);
    } catch (e) {
        setStatus('Invalid stats JSON: ' + e.message, 'err');
        return;
    }
    try {
        const settingsText = document.getElementById('raw-settings').value.trim();
        if (settingsText) saveData.settings = JSON.parse(settingsText);
    } catch (e) {
        setStatus('Invalid settings JSON: ' + e.message, 'err');
        return;
    }
    populateFields();
    renderInventory();
    validateCheckpoints();
    setStatus('JSON applied', 'ok');
}

// --- File I/O (all client-side) ---

async function handleFiles(files) {
    let count = 0;
    for (const file of files) {
        try {
            const text = await file.text();
            const data = await decryptSave(text);
            if ('_pointsCurrent' in data) {
                saveData.stats = data;
                loadedFilenames.stats = file.name;
            } else if ('_masterVolume' in data || 'playerRegion' in data) {
                saveData.settings = data;
                loadedFilenames.settings = file.name;
            } else {
                saveData.stats = data;
                loadedFilenames.stats = file.name;
            }
            count++;
        } catch (e) {
            setStatus('Failed to decrypt ' + file.name + ': ' + e.message, 'err');
            return;
        }
    }
    if (count > 0) {
        showEditor();
        populateFields();
        renderInventory();
        updateRawJson();
        validateCheckpoints();
        setStatus('Loaded ' + count + ' file(s)', 'ok');
    }
}

function uploadFiles(input) {
    if (input.files && input.files.length > 0) handleFiles(input.files);
    input.value = '';
}

function backupName(filename) {
    const dot = filename.lastIndexOf('.');
    if (dot === -1) return filename + '_BACKUP';
    return filename.slice(0, dot) + '_BACKUP' + filename.slice(dot);
}

async function downloadFile(which) {
    try {
        if (which === 'stats' && saveData.stats) {
            await doDownload(saveData.stats, loadedFilenames.stats);
            await doDownload(saveData.stats, backupName(loadedFilenames.stats));
        } else if (which === 'settings' && saveData.settings) {
            await doDownload(saveData.settings, loadedFilenames.settings);
            await doDownload(saveData.settings, backupName(loadedFilenames.settings));
        } else {
            if (saveData.stats) {
                await doDownload(saveData.stats, loadedFilenames.stats);
                await doDownload(saveData.stats, backupName(loadedFilenames.stats));
            }
            if (saveData.settings) {
                await doDownload(saveData.settings, loadedFilenames.settings);
                await doDownload(saveData.settings, backupName(loadedFilenames.settings));
            }
        }
    } catch (e) {
        setStatus('Download failed: ' + e.message, 'err');
    }
}

async function doDownload(data, filename) {
    const encrypted = await encryptSave(data);
    const blob = new Blob([encrypted], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Downloaded ' + filename, 'ok');
}

// --- Drag and drop ---

function initDropZone() {
    const body = document.body;
    const overlay = document.getElementById('drop-overlay');

    let dragCounter = 0;
    body.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCounter++;
        overlay.classList.add('active');
    });
    body.addEventListener('dragleave', e => {
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) { dragCounter = 0; overlay.classList.remove('active'); }
    });
    body.addEventListener('dragover', e => e.preventDefault());
    body.addEventListener('drop', e => {
        e.preventDefault();
        dragCounter = 0;
        overlay.classList.remove('active');
        if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
    });
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('no-data').style.display = 'block';
    document.getElementById('editor-content').style.display = 'none';
    initDropZone();

    // Bind all event handlers programmatically (CSP-safe, no inline handlers)
    document.getElementById('file-input').addEventListener('change', function () {
        uploadFiles(this);
    });
    document.getElementById('btn-download').addEventListener('click', () => downloadFile('all'));
    document.getElementById('btn-add-sled').addEventListener('click', addSled);
    document.getElementById('btn-apply-raw').addEventListener('click', applyRawJson);

    document.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab, btn));
    });

    // Verify crypto API is available
    if (!crypto || !crypto.subtle) {
        setStatus('Error: Web Crypto API not available. Try a different browser or disable security extensions.', 'err');
        return;
    }
    setStatus('Ready', 'ok');
});
