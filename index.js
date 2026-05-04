// ST Chat Tools - index.js v3.0

const MODULE_NAME = 'chat_tools';

function getCtx() { return SillyTavern.getContext(); }

function getSettings() {
    const { extensionSettings } = getCtx();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = { order: [], groups: [] };
    }
    const s = extensionSettings[MODULE_NAME];
    if (!Array.isArray(s.order)) s.order = [];
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
// FEATURE 1 — Delete Last Message
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

// Scan ALL .inline-drawer in the whole document that are
// extension entries: they must contain an .inline-drawer-toggle
// with a <b> tag, and must NOT be nested inside another .inline-drawer
function scanExtensions() {
    const results = [];
    document.querySelectorAll('.inline-drawer').forEach(el => {
        // Skip if nested inside another inline-drawer
        if (el.parentElement && el.parentElement.closest('.inline-drawer')) return;
        // Must have a toggle with a <b> name tag
        const toggle = el.querySelector('.inline-drawer-toggle');
        if (!toggle) return;
        const b = toggle.querySelector('b');
        if (!b) return;
        const name = b.textContent.trim();
        if (name) results.push({ name, el });
    });
    return results;
}

// ── Panel ────────────────────────────────────────────────────

let ctOpen = false;

function closePanel() {
    document.querySelectorAll('.ct-backdrop').forEach(e => e.remove());
    const p = document.getElementById('ct_ext_manager');
    if (p) p.remove();
    ctOpen = false;
}

function openPanel() {
    if (ctOpen) { closePanel(); return; }

    const settings = getSettings();
    const live = scanExtensions();

    // Sync: add new extensions not yet tracked
    live.forEach(({ name }) => {
        if (!settings.order.find(e => e.id === name)) {
            settings.order.push({ type: 'ext', id: name, group: null });
        }
    });
    // Remove stale
    const liveNames = live.map(x => x.name);
    settings.order = settings.order.filter(e => e.type === 'group' || liveNames.includes(e.id));

    renderPanel();
    ctOpen = true;
}

// order array contains two kinds of entries:
//   { type: 'ext',   id: 'Extension Name', group: null }
//   { type: 'group', id: 'Group Name', collapsed: false }
// Groups appear inline in the order array as separators

function renderPanel() {
    document.querySelectorAll('.ct-backdrop').forEach(e => e.remove());
    const old = document.getElementById('ct_ext_manager');
    if (old) old.remove();

    const settings = getSettings();

    // Backdrop
    const bd = document.createElement('div');
    bd.className = 'ct-backdrop';
    bd.addEventListener('click', closePanel);
    document.documentElement.appendChild(bd);

    // Panel
    const panel = document.createElement('div');
    panel.id = 'ct_ext_manager';

    // Header
    panel.innerHTML = `
        <div class="ct-header">
            <span class="ct-title"><i class="fa-solid fa-layer-group"></i> Extension 관리자</span>
            <div class="ct-hbtns">
                <button class="ct-btn ct-sm" id="ct_add_group"><i class="fa-solid fa-folder-plus"></i> 그룹 추가</button>
                <button class="ct-btn ct-primary ct-sm" id="ct_apply"><i class="fa-solid fa-check"></i> 적용</button>
                <button class="ct-btn ct-sm" id="ct_close"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>`;

    const body = document.createElement('div');
    body.className = 'ct-body';

    // Debug info
    const live = scanExtensions();
    const debugEl = document.createElement('div');
    debugEl.className = 'ct-debug';
    debugEl.textContent = `감지된 확장: ${live.length}개 | 저장된 항목: ${settings.order.filter(e=>e.type!=='group').length}개`;
    body.appendChild(debugEl);

    // Unified order list (groups + extensions interleaved)
    const listLabel = document.createElement('div');
    listLabel.className = 'ct-label';
    listLabel.textContent = '순서 (그룹은 폴더, 확장은 퍼즐 아이콘)';
    body.appendChild(listLabel);

    const list = document.createElement('div');
    list.id = 'ct_order_list';

    settings.order.forEach((entry, idx) => {
        const row = document.createElement('div');
        const isGroup = entry.type === 'group';
        row.className = isGroup ? 'ct-row ct-group-row' : 'ct-row ct-ext-row' + (entry.group ? ' ct-grouped' : '');
        row.dataset.idx = idx;

        const isFirst = idx === 0;
        const isLast = idx === settings.order.length - 1;

        if (isGroup) {
            row.innerHTML = `
                <i class="fa-solid fa-folder ct-icon-folder"></i>
                <span class="ct-name">${esc(entry.id)}</span>
                <span class="ct-badge-group">${entry.collapsed ? '접힘' : '펼침'}</span>
                <div class="ct-spacer"></div>
                <button class="ct-btn ct-xs ct-toggle-collapse" data-idx="${idx}" title="접기/펼치기">
                    <i class="fa-solid ${entry.collapsed ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </button>
                <button class="ct-btn ct-xs ct-btn-danger ct-del-group" data-idx="${idx}">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
                <button class="ct-btn ct-xs ct-up" data-idx="${idx}" ${isFirst ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="ct-btn ct-xs ct-down" data-idx="${idx}" ${isLast ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>`;
        } else {
            const groupOpts = `<option value="">없음</option>` +
                settings.order.filter(e => e.type === 'group').map(g =>
                    `<option value="${esc(g.id)}" ${entry.group === g.id ? 'selected' : ''}>${esc(g.id)}</option>`
                ).join('');

            row.innerHTML = `
                <i class="fa-solid fa-puzzle-piece ct-icon-ext"></i>
                <span class="ct-name">${esc(entry.id)}</span>
                <div class="ct-spacer"></div>
                <select class="ct-sel ct-grp-sel" data-idx="${idx}">${groupOpts}</select>
                <button class="ct-btn ct-xs ct-up" data-idx="${idx}" ${isFirst ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                <button class="ct-btn ct-xs ct-down" data-idx="${idx}" ${isLast ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>`;
        }

        list.appendChild(row);
    });

    body.appendChild(list);
    panel.appendChild(body);
    document.documentElement.appendChild(panel);

    // ── Events ──

    panel.querySelector('#ct_close').addEventListener('click', closePanel);

    panel.querySelector('#ct_apply').addEventListener('click', applyToDOM);

    panel.querySelector('#ct_add_group').addEventListener('click', () => {
        const name = prompt('새 그룹 이름:');
        if (!name || !name.trim()) return;
        const trimmed = name.trim();
        if (settings.order.find(e => e.type === 'group' && e.id === trimmed)) {
            toastr.warning('이미 있는 이름입니다.');
            return;
        }
        // Insert group at end of order
        settings.order.push({ type: 'group', id: trimmed, collapsed: false });
        saveSettings();
        renderPanel();
    });

    panel.querySelectorAll('.ct-up').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (i === 0) return;
        [settings.order[i - 1], settings.order[i]] = [settings.order[i], settings.order[i - 1]];
        saveSettings(); renderPanel();
    }));

    panel.querySelectorAll('.ct-down').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (i >= settings.order.length - 1) return;
        [settings.order[i], settings.order[i + 1]] = [settings.order[i + 1], settings.order[i]];
        saveSettings(); renderPanel();
    }));

    panel.querySelectorAll('.ct-grp-sel').forEach(sel => sel.addEventListener('change', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        settings.order[i].group = e.currentTarget.value || null;
        saveSettings(); renderPanel();
    }));

    panel.querySelectorAll('.ct-toggle-collapse').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        settings.order[i].collapsed = !settings.order[i].collapsed;
        saveSettings(); renderPanel();
        // Apply collapse silently (no toast)
        applyToDOM(true);
    }));

    panel.querySelectorAll('.ct-del-group').forEach(btn => btn.addEventListener('click', e => {
        const i = parseInt(e.currentTarget.dataset.idx);
        const name = settings.order[i].id;
        // Unassign extensions that belonged to this group
        settings.order.forEach(entry => { if (entry.group === name) entry.group = null; });
        settings.order.splice(i, 1);
        saveSettings(); renderPanel();
    }));
}

// ── Apply to ST DOM ──────────────────────────────────────────

function applyToDOM(silent = false) {
    const settings = getSettings();

    // Build name→element map from ALL scanned extensions
    const live = scanExtensions();
    const nameToEl = {};
    live.forEach(({ name, el }) => { nameToEl[name] = el; });

    // Find a stable anchor container: parent of the first extension element
    // This is more reliable than #extensions_settings
    const firstEl = live[0] && live[0].el;
    if (!firstEl) {
        if (!silent) toastr.error('확장 요소를 찾을 수 없습니다.');
        return;
    }
    const container = firstEl.parentElement;

    // Remove previously injected group headers
    container.querySelectorAll('.ct-group-header-injected').forEach(e => e.remove());

    // Re-order DOM and inject group headers
    const seenGroups = new Set();

    settings.order.forEach(entry => {
        if (entry.type === 'group') {
            // Inject a visual group header if not already done
            if (!seenGroups.has(entry.id)) {
                seenGroups.add(entry.id);
                const hdr = document.createElement('div');
                hdr.className = 'ct-group-header-injected';
                hdr.dataset.group = entry.id;
                hdr.innerHTML = `
                    <i class="fa-solid ${entry.collapsed ? 'fa-folder' : 'fa-folder-open'}"></i>
                    <span>${esc(entry.id)}</span>
                    <span class="ct-collapse-hint">${entry.collapsed ? '▶ 펼치기' : '▼ 접기'}</span>`;
                hdr.addEventListener('click', () => {
                    const s = getSettings();
                    const g = s.order.find(e => e.type === 'group' && e.id === entry.id);
                    if (g) { g.collapsed = !g.collapsed; saveSettings(); applyToDOM(true); renderPanel(); }
                });
                container.appendChild(hdr);
            }
        } else {
            // It's an extension entry
            const el = nameToEl[entry.id];
            if (!el) return;

            // Find which group this ext belongs to by looking backwards in order
            // (the nearest preceding group entry that matches entry.group)
            if (entry.group) {
                const grpEntry = settings.order.find(e => e.type === 'group' && e.id === entry.group);
                el.style.display = (grpEntry && grpEntry.collapsed) ? 'none' : '';
            } else {
                el.style.display = '';
            }
            container.appendChild(el);
        }
    });

    // Append untracked extensions at bottom (visible)
    live.forEach(({ name, el }) => {
        if (!settings.order.find(e => e.type === 'ext' && e.id === name)) {
            el.style.display = '';
            container.appendChild(el);
        }
    });

    if (!silent) toastr.success('적용 완료!');
}

// ── Inject open button ────────────────────────────────────────

function injectManagerButton() {
    if (document.getElementById('ct_ext_manager_btn')) return;
    const btn = document.createElement('button');
    btn.id = 'ct_ext_manager_btn';
    btn.innerHTML = '<i class="fa-solid fa-sliders"></i> 순서/그룹 관리';
    btn.addEventListener('click', openPanel);

    const installBtn = document.getElementById('extensions_install');
    if (installBtn) { installBtn.insertAdjacentElement('afterend', btn); return; }
    const panel = document.getElementById('extensions_settings');
    if (panel) { panel.insertAdjacentElement('afterbegin', btn); return; }
}

function watchForExtPanel() {
    if (document.getElementById('ct_ext_manager_btn')) return;
    const obs = new MutationObserver(() => {
        if (document.getElementById('extensions_settings') || document.getElementById('extensions_install')) {
            obs.disconnect();
            setTimeout(injectManagerButton, 200);
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
        watchForExtPanel();
    });

    if (document.getElementById('send_but')) injectDeleteButton();
    if (document.getElementById('extensions_settings') || document.getElementById('extensions_install')) {
        injectManagerButton();
    } else {
        watchForExtPanel();
    }

    eventSource.on(event_types.CHAT_CHANGED, () => injectDeleteButton());
    console.log('[Chat Tools] v3.0 loaded');
})();
