// ============================================================
// ST Chat Tools - index.js  v2.0
// ============================================================

const MODULE_NAME = 'Extension-Manager';

function getCtx() { return SillyTavern.getContext(); }

function getSettings() {
    const { extensionSettings } = getCtx();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = { extensionOrder: [], groups: [] };
    }
    const s = extensionSettings[MODULE_NAME];
    if (!Array.isArray(s.extensionOrder)) s.extensionOrder = [];
    if (!Array.isArray(s.groups)) s.groups = [];
    return s;
}

function saveSettings() { getCtx().saveSettingsDebounced(); }

function esc(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// FEATURE 1 — Delete Last Message Button
// ============================================================

function deleteLastMessage() {
    const { chat, saveChat } = getCtx();
    if (!chat || chat.length === 0) { toastr.warning('삭제할 메시지가 없습니다.'); return; }
    chat.pop();
    const msgs = document.querySelectorAll('#chat .mes');
    if (msgs.length > 0) msgs[msgs.length - 1].remove();
    saveChat();
    toastr.success('마지막 메시지가 삭제되었습니다.');
}

function injectDeleteButton() {
    if (document.getElementById('ct_delete_last_btn')) return;
    const sendBtn = document.getElementById('send_but');
    if (!sendBtn) return;
    const btn = document.createElement('div');
    btn.id = 'ct_delete_last_btn';
    btn.title = '마지막 메시지 삭제';
    btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    btn.addEventListener('click', deleteLastMessage);
    sendBtn.parentNode.insertBefore(btn, sendBtn);
}

// ============================================================
// FEATURE 2 — Extension Manager
// ============================================================

function readLiveExtensions() {
    const container = document.getElementById('extensions_settings');
    if (!container) return [];
    return Array.from(container.querySelectorAll(':scope > .inline-drawer'))
        .map(el => {
            const b = el.querySelector('.inline-drawer-toggle b');
            return b ? b.textContent.trim() : '';
        })
        .filter(Boolean);
}

// ── Panel ────────────────────────────────────────────────────

let ctPanelOpen = false;

function closePanel() {
    document.querySelectorAll('.ct-backdrop').forEach(el => el.remove());
    const p = document.getElementById('ct_ext_manager');
    if (p) p.remove();
    ctPanelOpen = false;
}

function openPanel() {
    if (ctPanelOpen) { closePanel(); return; }

    const settings = getSettings();
    const liveIds = readLiveExtensions();

    liveIds.forEach(id => {
        if (!settings.extensionOrder.find(e => e.id === id)) {
            settings.extensionOrder.push({ id, group: null });
        }
    });
    settings.extensionOrder = settings.extensionOrder.filter(e => liveIds.includes(e.id));

    renderPanel();
    ctPanelOpen = true;
}

function renderPanel() {
    // Clean up — remove ALL backdrops and panel
    document.querySelectorAll('.ct-backdrop').forEach(el => el.remove());
    const oldPanel = document.getElementById('ct_ext_manager');
    if (oldPanel) oldPanel.remove();

    const settings = getSettings();

    // Single backdrop
    const bd = document.createElement('div');
    bd.className = 'ct-backdrop';
    bd.addEventListener('click', closePanel);
    document.documentElement.appendChild(bd);

    // Panel element
    const panel = document.createElement('div');
    panel.id = 'ct_ext_manager';

    // Header
    const header = document.createElement('div');
    header.className = 'ct-header';
    header.innerHTML = `
        <span class="ct-title"><i class="fa-solid fa-layer-group"></i> Extension 관리자</span>
        <div class="ct-header-btns">
            <button class="ct-btn ct-btn-sm" id="ct_add_group_btn"><i class="fa-solid fa-folder-plus"></i> 그룹 추가</button>
            <button class="ct-btn ct-btn-primary ct-btn-sm" id="ct_apply_btn"><i class="fa-solid fa-check"></i> 적용</button>
            <button class="ct-btn ct-btn-sm" id="ct_close_btn"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    panel.appendChild(header);

    // Scrollable body
    const body = document.createElement('div');
    body.className = 'ct-body';

    // ── Group list ──
    const groupSec = document.createElement('div');
    groupSec.innerHTML = `<div class="ct-section-label">그룹 <span class="ct-hint">— 그룹에 속한 확장은 접어서 숨길 수 있어요</span></div>`;

    if (settings.groups.length === 0) {
        groupSec.insertAdjacentHTML('beforeend', '<div class="ct-empty">그룹 없음. 위 버튼으로 추가하세요.</div>');
    } else {
        settings.groups.forEach((grp, gi) => {
            const row = document.createElement('div');
            row.className = 'ct-group-row';
            row.innerHTML = `
                <i class="fa-solid fa-folder ct-folder-icon"></i>
                <span>${esc(grp.name)}</span>
                <div class="ct-spacer"></div>
                <button class="ct-btn ct-btn-xs ct-btn-danger ct-del-group" data-gi="${gi}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
            groupSec.appendChild(row);
        });
    }
    body.appendChild(groupSec);

    // ── Extension list ──
    const extSec = document.createElement('div');
    extSec.innerHTML = `<div class="ct-section-label" style="margin-top:12px">확장 순서 &amp; 그룹 배정</div>`;

    settings.extensionOrder.forEach((entry, idx) => {
        const groupOptions = `<option value="">— 없음 —</option>` +
            settings.groups.map(g =>
                `<option value="${esc(g.name)}" ${entry.group === g.name ? 'selected' : ''}>${esc(g.name)}</option>`
            ).join('');

        const row = document.createElement('div');
        row.className = 'ct-ext-row' + (entry.group ? ' ct-ext-grouped' : '');
        row.innerHTML = `
            <i class="fa-solid fa-puzzle-piece ct-dim"></i>
            <span class="ct-ext-name">${esc(entry.id)}</span>
            ${entry.group ? `<span class="ct-badge">${esc(entry.group)}</span>` : ''}
            <div class="ct-spacer"></div>
            <select class="ct-select ct-grp-sel" data-idx="${idx}">${groupOptions}</select>
            <button class="ct-btn ct-btn-xs ct-up" data-idx="${idx}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
            <button class="ct-btn ct-btn-xs ct-down" data-idx="${idx}" ${idx === settings.extensionOrder.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>`;
        extSec.appendChild(row);
    });

    body.appendChild(extSec);
    panel.appendChild(body);
    document.documentElement.appendChild(panel);

    // ── Events ──
    panel.querySelector('#ct_close_btn').addEventListener('click', closePanel);

    panel.querySelector('#ct_add_group_btn').addEventListener('click', () => {
        const name = prompt('새 그룹 이름:');
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        if (settings.groups.find(g => g.name === trimmed)) { toastr.warning('이미 있는 이름입니다.'); return; }
        settings.groups.push({ name: trimmed, collapsed: false });
        saveSettings();
        renderPanel();
    });

    panel.querySelector('#ct_apply_btn').addEventListener('click', applyToDOM);

    panel.querySelectorAll('.ct-del-group').forEach(btn => btn.addEventListener('click', e => {
        const gi = parseInt(e.currentTarget.dataset.gi);
        const name = settings.groups[gi].name;
        settings.extensionOrder.forEach(e => { if (e.group === name) e.group = null; });
        settings.groups.splice(gi, 1);
        saveSettings();
        renderPanel();
    }));

    panel.querySelectorAll('.ct-up').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (i === 0) return;
        [settings.extensionOrder[i - 1], settings.extensionOrder[i]] = [settings.extensionOrder[i], settings.extensionOrder[i - 1]];
        saveSettings(); renderPanel();
    }));

    panel.querySelectorAll('.ct-down').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (i >= settings.extensionOrder.length - 1) return;
        [settings.extensionOrder[i], settings.extensionOrder[i + 1]] = [settings.extensionOrder[i + 1], settings.extensionOrder[i]];
        saveSettings(); renderPanel();
    }));

    panel.querySelectorAll('.ct-grp-sel').forEach(sel => sel.addEventListener('change', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        settings.extensionOrder[i].group = e.currentTarget.value || null;
        saveSettings(); renderPanel();
    }));
}

// ── Apply order + group collapse to ST DOM ───────────────────

function applyToDOM() {
    const settings = getSettings();
    const container = document.getElementById('extensions_settings');
    if (!container) {
        toastr.error('확장 패널을 찾을 수 없습니다. 확장 탭을 열고 다시 시도하세요.');
        return;
    }

    // Map name → element
    const nameToEl = {};
    container.querySelectorAll(':scope > .inline-drawer').forEach(el => {
        const b = el.querySelector('.inline-drawer-toggle b');
        if (b) nameToEl[b.textContent.trim()] = el;
    });

    // Remove previously injected group headers
    container.querySelectorAll('.ct-group-header').forEach(el => el.remove());

    const injectedGroups = new Set();
    let lastGroup = null;

    settings.extensionOrder.forEach(entry => {
        const el = nameToEl[entry.id];
        if (!el) return;

        // Inject group header once per group
        if (entry.group && entry.group !== lastGroup && !injectedGroups.has(entry.group)) {
            const grpData = settings.groups.find(g => g.name === entry.group);
            const collapsed = grpData ? grpData.collapsed : false;

            const hdr = document.createElement('div');
            hdr.className = 'ct-group-header';
            hdr.dataset.group = entry.group;
            hdr.innerHTML = `
                <i class="fa-solid ${collapsed ? 'fa-folder' : 'fa-folder-open'}"></i>
                <span>${esc(entry.group)}</span>
                <span class="ct-collapse-hint">${collapsed ? '▶ 펼치기' : '▼ 접기'}</span>`;
            hdr.addEventListener('click', () => toggleCollapse(entry.group));
            container.appendChild(hdr);
            injectedGroups.add(entry.group);
        }

        lastGroup = entry.group || null;

        // Hide/show based on collapse
        if (entry.group) {
            const grpData = settings.groups.find(g => g.name === entry.group);
            el.style.display = (grpData && grpData.collapsed) ? 'none' : '';
        } else {
            el.style.display = '';
        }

        container.appendChild(el);
    });

    // Untracked extensions go to bottom, always visible
    Object.entries(nameToEl).forEach(([name, el]) => {
        if (!settings.extensionOrder.find(e => e.id === name)) {
            el.style.display = '';
            container.appendChild(el);
        }
    });

    saveSettings();
    toastr.success('적용 완료!');
}

function toggleCollapse(groupName) {
    const settings = getSettings();
    const grp = settings.groups.find(g => g.name === groupName);
    if (!grp) return;
    grp.collapsed = !grp.collapsed;
    saveSettings();
    applyToDOM();
}

// ── Inject manager open-button ────────────────────────────────

function injectManagerButton() {
    if (document.getElementById('ct_ext_manager_btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ct_ext_manager_btn';
    btn.className = 'ct-manager-open-btn';
    btn.innerHTML = '<i class="fa-solid fa-sliders"></i> 순서/그룹 관리';
    btn.addEventListener('click', openPanel);

    const installBtn = document.getElementById('extensions_install');
    if (installBtn) { installBtn.insertAdjacentElement('afterend', btn); return; }
    const topBlock = document.querySelector('#extensions_settings .extensions_block');
    if (topBlock) { topBlock.appendChild(btn); return; }
    const panel = document.getElementById('extensions_settings');
    if (panel) { panel.insertAdjacentElement('afterbegin', btn); return; }
}

function watchForExtensionsPanel() {
    if (document.getElementById('ct_ext_manager_btn')) return;
    const obs = new MutationObserver(() => {
        if (document.getElementById('extensions_settings') || document.getElementById('extensions_install')) {
            obs.disconnect();
            setTimeout(injectManagerButton, 150);
        }
    });
    obs.observe(document.body, { childList: true, subtree: true });
}

// ============================================================
// INIT
// ============================================================

(function init() {
    const { eventSource, event_types } = getCtx();

    eventSource.on(event_types.APP_READY, () => {
        injectDeleteButton();
        injectManagerButton();
        watchForExtensionsPanel();
    });

    if (document.getElementById('send_but')) injectDeleteButton();

    if (document.getElementById('extensions_settings') || document.getElementById('extensions_install')) {
        injectManagerButton();
    } else {
        watchForExtensionsPanel();
    }

    eventSource.on(event_types.CHAT_CHANGED, () => injectDeleteButton());

    console.log('[Chat Tools] v2.0 loaded');
})();
