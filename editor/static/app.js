let saveData = { stats: null, settings: null };

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

    // Bind change events
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
        };
    });
}

function renderInventory() {
    if (!saveData.stats) return;
    const stats = saveData.stats;

    // Sleds
    const sledsList = document.getElementById('sleds-list');
    sledsList.innerHTML = '';
    (stats.sledsData || []).forEach((sled, i) => {
        sledsList.appendChild(makeItemRow(`Sled Type ${sled.type}`, sled.purchased, (v) => {
            stats.sledsData[i].purchased = v;
            updateRawJson();
        }, `Points: `, sled.points, (v) => {
            stats.sledsData[i].points = v;
            updateRawJson();
        }));
    });

    // Buildables
    const buildList = document.getElementById('buildables-list');
    buildList.innerHTML = '';
    (stats.buildablesData || []).forEach((b, i) => {
        buildList.appendChild(makeItemRow(`Type ${b.type}`, b.purchased, (v) => {
            stats.buildablesData[i].purchased = v;
            updateRawJson();
        }));
    });

    // Tools
    const toolsList = document.getElementById('tools-list');
    toolsList.innerHTML = '';
    (stats.toolsData || []).forEach((t, i) => {
        toolsList.appendChild(makeItemRow(`Type ${t.type}`, t.purchased, (v) => {
            stats.toolsData[i].purchased = v;
            updateRawJson();
        }));
    });

    // Characters
    const charList = document.getElementById('characters-list');
    charList.innerHTML = '';
    if ((stats._characterPurchases || []).length === 0) {
        charList.innerHTML = '<div class="item-row"><span class="item-label">No character purchases</span></div>';
    }

    // Hats
    renderSimpleInventory('hats-list', stats.hatsData || []);
    renderSimpleInventory('scarves-list', stats.scarvesData || []);
    renderSimpleInventory('facewear-list', stats.facewearsData || []);
    renderSimpleInventory('dyes-list', stats.sledDyesData || []);
    renderSimpleInventory('trinkets-list', stats.trinketsSaveData || []);
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
    cb.onchange = () => onToggle(cb.checked);
    row.appendChild(cb);

    const plbl = document.createElement('span');
    plbl.className = purchased ? 'purchased-label' : 'not-purchased-label';
    plbl.textContent = purchased ? 'Owned' : 'Not owned';
    cb.onchange = () => {
        onToggle(cb.checked);
        plbl.textContent = cb.checked ? 'Owned' : 'Not owned';
        plbl.className = cb.checked ? 'purchased-label' : 'not-purchased-label';
    };
    row.appendChild(plbl);

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
    const newSled = {
        purchased: false,
        type: nextType,
        points: 0.0,
        equippedDye: 0,
        equippedTrinkets: Array.from({length: 5}, () => ({
            localPosition: {x: 0, y: 0, z: 0},
            localRotation: {x: 0, y: 0, z: 0},
            trinketIdentifierData: {trinketType: 0, trinketSize: 0, trinketRarity: 0}
        }))
    };
    saveData.stats.sledsData.push(newSled);
    renderInventory();
    updateRawJson();
}

function updateRawJson() {
    if (saveData.stats) {
        document.getElementById('raw-stats').value = JSON.stringify(saveData.stats, null, 2);
    }
    if (saveData.settings) {
        document.getElementById('raw-settings').value = JSON.stringify(saveData.settings, null, 2);
    }
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
    setStatus('JSON applied', 'ok');
}

async function loadSaves() {
    setStatus('Loading...', '');
    try {
        const resp = await fetch('/api/load');
        const data = await resp.json();
        if (data.stats) saveData.stats = data.stats;
        if (data.settings) saveData.settings = data.settings;
        if (!data.stats && !data.settings) {
            setStatus('No save files found in ' + data.save_dir, 'err');
            return;
        }
        document.getElementById('no-data').style.display = 'none';
        document.getElementById('btn-save').disabled = false;
        document.getElementById('btn-download').disabled = false;
        populateFields();
        renderInventory();
        updateRawJson();
        setStatus('Loaded: ' + (data.files_found || []).join(', '), 'ok');
    } catch (e) {
        setStatus('Load failed: ' + e.message, 'err');
    }
}

async function saveAll() {
    setStatus('Saving...', '');
    try {
        const body = {};
        if (saveData.stats) body.stats = saveData.stats;
        if (saveData.settings) body.settings = saveData.settings;
        const resp = await fetch('/api/save', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        const data = await resp.json();
        if (data.ok) {
            setStatus('Saved: ' + data.saved.join(', '), 'ok');
        } else {
            setStatus('Save failed', 'err');
        }
    } catch (e) {
        setStatus('Save failed: ' + e.message, 'err');
    }
}

async function uploadFile(input) {
    const file = input.files[0];
    if (!file) return;
    setStatus('Decrypting...', '');
    const formData = new FormData();
    formData.append('file', file);
    try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await resp.json();
        if (data.error) {
            setStatus(data.error, 'err');
            return;
        }
        // Detect which type based on content keys
        if ('_pointsCurrent' in data.data) {
            saveData.stats = data.data;
        } else if ('_masterVolume' in data.data || 'playerRegion' in data.data) {
            saveData.settings = data.data;
        } else {
            saveData.stats = data.data;
        }
        document.getElementById('no-data').style.display = 'none';
        document.getElementById('btn-save').disabled = false;
        document.getElementById('btn-download').disabled = false;
        populateFields();
        renderInventory();
        updateRawJson();
        setStatus('Uploaded: ' + file.name, 'ok');
    } catch (e) {
        setStatus('Upload failed: ' + e.message, 'err');
    }
    input.value = '';
}

async function downloadFile() {
    // Download stats
    if (saveData.stats) {
        await doDownload(saveData.stats, 'DEMO_PlayerSavedStats.json');
    }
    if (saveData.settings) {
        await doDownload(saveData.settings, 'DEMO_PlayerSavedSettings.json');
    }
}

async function doDownload(data, filename) {
    try {
        const resp = await fetch('/api/download', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ data, filename })
        });
        const result = await resp.json();
        if (result.ok) {
            const blob = new Blob([result.encrypted], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
            setStatus('Downloaded ' + filename, 'ok');
        }
    } catch (e) {
        setStatus('Download failed: ' + e.message, 'err');
    }
}

// Toggle unlock all for item lists
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('no-data').style.display = 'block';
});
