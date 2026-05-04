// ============================================================
// ST Chat Tools - index.js
// Feature 1: Delete last message button (trash icon)
// Feature 2: Extension panel reorder + grouping
// ============================================================

const MODULE_NAME = 'Extension-manager';

// ── Helpers ──────────────────────────────────────────────────

function getCtx() {
    return SillyTavern.getContext();
}

function getSettings() {
    const { extensionSettings } = getCtx();
    if (!extensionSettings[MODULE_NAME]) {
        extensionSettings[MODULE_NAME] = {
            extensionOrder: [],   // [{ id: 'ext-folder-name', group: 'Group Name' | null }]
            groups: [],           // ['Group A', 'Group B', ...]
        };
    }
    return extensionSettings[MODULE_NAME];
}

// ============================================================
// FEATURE 1 — Delete Last Message Button
// ============================================================

function deleteLastMessage() {
    const { chat, saveChat } = getCtx();

    if (!chat || chat.length === 0) {
        toastr.warning('삭제할 메시지가 없습니다.');
        return;
    }

    // Remove the last message from the context array
    chat.pop();

    // Remove the last rendered message element from the DOM
    const messages = document.querySelectorAll('#chat .mes');
    if (messages.length > 0) {
        messages[messages.length - 1].remove();
    }

    // Persist
    saveChat();
    toastr.success('마지막 메시지가 삭제되었습니다.');
}

function injectDeleteButton() {
    // Don't inject twice
    if (document.getElementById('ct_delete_last_btn')) return;

    // Target: right before the send button
    const sendBtn = document.getElementById('send_but');
    if (!sendBtn) return;

    const btn = document.createElement('div');
    btn.id = 'ct_delete_last_btn';
    btn.title = '마지막 메시지 삭제';
    btn.classList.add('ct-icon-btn');
    btn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
    btn.addEventListener('click', deleteLastMessage);

    sendBtn.parentNode.insertBefore(btn, sendBtn);
}

// ============================================================
// FEATURE 2 — Extension Panel: Groups & Order
// ============================================================

// Returns all extension .inline-drawer entries inside #extensions_settings
function getExtensionEntries() {
    const container = document.getElementById('extensions_settings');
    if (!container) return [];
    return Array.from(container.querySelectorAll('.inline-drawer'));
}

// Read display names from rendered extension blocks
// Each .inline-drawer has a .inline-drawer-toggle button with a <b> tag containing the name
function readExtensionIds() {
    return getExtensionEntries().map(el => {
        const nameEl = el.querySelector('.inline-drawer-toggle b, b');
        return nameEl ? nameEl.textContent.trim() : '';
    }).filter(Boolean);
}

// ── Manager Panel ────────────────────────────────────────────

let managerPanel = null;

function closeManagerPanel() {
    const backdrop = document.getElementById('ct_ext_manager_backdrop');
    if (backdrop) backdrop.remove();
    if (managerPanel) {
        managerPanel.remove();
        managerPanel = null;
    }
}

function openExtensionManager() {
    if (managerPanel) {
        managerPanel.remove();
        managerPanel = null;
        return;
    }

    const settings = getSettings();

    // Sync: add any newly-installed extensions not yet tracked
    const liveIds = readExtensionIds();
    liveIds.forEach(id => {
        if (id && !settings.extensionOrder.find(e => e.id === id)) {
            settings.extensionOrder.push({ id, group: null });
        }
    });
    // Remove stale entries
    settings.extensionOrder = settings.extensionOrder.filter(e => liveIds.includes(e.id));

    renderManagerPanel();
}

function renderManagerPanel() {
    if (managerPanel) managerPanel.remove();

    const settings = getSettings();

    const panel = document.createElement('div');
    panel.id = 'ct_ext_manager';
    panel.classList.add('ct-manager-panel');

    // ── Header ──
    const header = document.createElement('div');
    header.classList.add('ct-manager-header');
    header.innerHTML = `
        <span><i class="fa-solid fa-layer-group"></i> Extension 관리자</span>
        <div class="ct-manager-header-actions">
            <button id="ct_add_group_btn" class="ct-btn ct-btn-sm" title="새 그룹 추가">
                <i class="fa-solid fa-folder-plus"></i> 그룹 추가
            </button>
            <button id="ct_apply_btn" class="ct-btn ct-btn-primary ct-btn-sm" title="순서 적용">
                <i class="fa-solid fa-check"></i> 적용
            </button>
            <button id="ct_close_manager_btn" class="ct-btn ct-btn-sm">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
    panel.appendChild(header);

    // ── Group management area ──
    const groupArea = document.createElement('div');
    groupArea.id = 'ct_group_area';
    groupArea.classList.add('ct-group-area');
    groupArea.innerHTML = `<div class="ct-section-label">그룹 목록</div>`;

    if (settings.groups.length === 0) {
        const empty = document.createElement('div');
        empty.classList.add('ct-empty-hint');
        empty.textContent = '그룹이 없습니다. 위 버튼으로 추가하세요.';
        groupArea.appendChild(empty);
    } else {
        settings.groups.forEach((grp, gi) => {
            const row = document.createElement('div');
            row.classList.add('ct-group-row');
            row.dataset.group = grp;
            row.innerHTML = `
                <i class="fa-solid fa-folder ct-group-icon"></i>
                <span class="ct-group-name">${escapeHtml(grp)}</span>
                <button class="ct-btn ct-btn-danger ct-btn-xs ct-delete-group-btn" data-index="${gi}" title="그룹 삭제">
                    <i class="fa-solid fa-trash-can"></i>
                </button>`;
            groupArea.appendChild(row);
        });
    }
    panel.appendChild(groupArea);

    // ── Extension list ──
    const listArea = document.createElement('div');
    listArea.id = 'ct_ext_list_area';
    listArea.classList.add('ct-ext-list-area');
    listArea.innerHTML = `<div class="ct-section-label">Extension 순서 및 그룹 배정</div>`;

    settings.extensionOrder.forEach((entry, idx) => {
        const row = buildExtensionRow(entry, idx, settings);
        listArea.appendChild(row);
    });

    panel.appendChild(listArea);

    // ── Backdrop (closes panel on tap outside) ──
    const backdrop = document.createElement('div');
    backdrop.id = 'ct_ext_manager_backdrop';
    backdrop.addEventListener('click', closeManagerPanel);
    document.documentElement.appendChild(backdrop);

    document.documentElement.appendChild(panel);
    managerPanel = panel;

    // ── Events ──
    panel.querySelector('#ct_close_manager_btn').addEventListener('click', closeManagerPanel);

    panel.querySelector('#ct_add_group_btn').addEventListener('click', promptAddGroup);

    panel.querySelector('#ct_apply_btn').addEventListener('click', applyOrder);

    panel.querySelectorAll('.ct-delete-group-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            deleteGroup(idx);
        });
    });

    panel.querySelectorAll('.ct-move-up-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            moveEntry(idx, -1);
        });
    });

    panel.querySelectorAll('.ct-move-down-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            moveEntry(idx, 1);
        });
    });

    panel.querySelectorAll('.ct-group-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            settings.extensionOrder[idx].group = e.currentTarget.value || null;
        });
    });
}

function buildExtensionRow(entry, idx, settings) {
    const row = document.createElement('div');
    row.classList.add('ct-ext-row');
    if (entry.group) row.classList.add('ct-ext-grouped');

    // Group colour badge
    const groupBadge = entry.group
        ? `<span class="ct-group-badge">${escapeHtml(entry.group)}</span>`
        : '';

    // Build group <select>
    const groupOptions = `<option value="">— 그룹 없음 —</option>` +
        settings.groups.map(g =>
            `<option value="${escapeHtml(g)}" ${entry.group === g ? 'selected' : ''}>${escapeHtml(g)}</option>`
        ).join('');

    row.innerHTML = `
        <div class="ct-ext-row-main">
            <div class="ct-ext-info">
                <i class="fa-solid fa-puzzle-piece ct-ext-icon"></i>
                <span class="ct-ext-name">${escapeHtml(entry.id)}</span>
                ${groupBadge}
            </div>
            <div class="ct-ext-controls">
                <select class="ct-group-select ct-select" data-index="${idx}" title="그룹 배정">
                    ${groupOptions}
                </select>
                <button class="ct-btn ct-btn-xs ct-move-up-btn" data-index="${idx}" title="위로" ${idx === 0 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-up"></i>
                </button>
                <button class="ct-btn ct-btn-xs ct-move-down-btn" data-index="${idx}" title="아래로"
                    ${idx === settings.extensionOrder.length - 1 ? 'disabled' : ''}>
                    <i class="fa-solid fa-arrow-down"></i>
                </button>
            </div>
        </div>`;

    return row;
}

}

function promptAddGroup() {
    const settings = getSettings();
    const name = prompt('새 그룹 이름을 입력하세요:');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (settings.groups.includes(trimmed)) {
        toastr.warning('이미 존재하는 그룹 이름입니다.');
        return;
    }
    settings.groups.push(trimmed);
    saveSettings();
    renderManagerPanel();
}

function deleteGroup(index) {
    const settings = getSettings();
    const groupName = settings.groups[index];
    // Unassign from all extensions
    settings.extensionOrder.forEach(e => {
        if (e.group === groupName) e.group = null;
    });
    settings.groups.splice(index, 1);
    saveSettings();
    renderManagerPanel();
}

function moveEntry(idx, direction) {
    const settings = getSettings();
    const order = settings.extensionOrder;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= order.length) return;
    [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
    saveSettings();
    renderManagerPanel();
}

// Apply order to the actual Extensions panel DOM
function applyOrder() {
    const settings = getSettings();
    // ST renders extension items directly inside #extensions_settings
    // as .inline-drawer elements (each one is one extension)
    const container = document.getElementById('extensions_settings');
    if (!container) {
        toastr.error('Extensions 패널을 찾을 수 없습니다. Extensions 탭을 먼저 열고 다시 시도하세요.');
        return;
    }

    // Build a map: name → element
    // Each extension is an .inline-drawer; its toggle button contains the name in a <b> tag
    const allBlocks = Array.from(container.querySelectorAll('.inline-drawer'));
    const nameToEl = {};
    allBlocks.forEach(el => {
        const nameEl = el.querySelector('.extension_name, .inline-drawer-toggle b, b');
        const name = nameEl ? nameEl.textContent.trim() : '';
        if (name) nameToEl[name] = el;
    });

    // Group headers map
    const groupHeaders = {};

    // Remove existing group header elements we injected
    container.querySelectorAll('.ct-group-header').forEach(el => el.remove());

    // Re-append in desired order
    let currentGroup = null;
    settings.extensionOrder.forEach(entry => {
        const el = nameToEl[entry.id];
        if (!el) return;

        if (entry.group !== currentGroup) {
            currentGroup = entry.group;
            if (currentGroup) {
                if (!groupHeaders[currentGroup]) {
                    const hdr = document.createElement('div');
                    hdr.classList.add('ct-group-header');
                    hdr.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${escapeHtml(currentGroup)}`;
                    groupHeaders[currentGroup] = hdr;
                }
                container.appendChild(groupHeaders[currentGroup]);
            }
        }
        container.appendChild(el);
    });

    // Append any untracked extensions at the bottom
    allBlocks.forEach(el => {
        if (!el.parentNode || el.parentNode !== container) return; // already moved
        // check if tracked
        const nameEl = el.querySelector('.extension_name, .inline-drawer-toggle b, b');
        const name = nameEl ? nameEl.textContent.trim() : '';
        if (!settings.extensionOrder.find(e => e.id === name)) {
            container.appendChild(el);
        }
    });

    saveSettings();
    toastr.success('Extension 순서가 적용되었습니다!');
}

// ── Inject manager button into Extensions panel header ────────
// Real ST DOM (confirmed from screenshot):
//   #extensions_settings
//     div.extensions_block (top button row)
//       button#extensions_update  ← "확장 프로그램 업데이트 알림"
//       button#extensions_open_manager ← "확장 프로그램 관리"
//     button#extensions_install  ← "확장 프로그램 설치"
//     ... inline-drawer extension items ...

function injectManagerButton() {
    if (document.getElementById('ct_ext_manager_btn')) return;

    const btn = document.createElement('button');
    btn.id = 'ct_ext_manager_btn';
    btn.classList.add('ct-btn', 'ct-ext-manager-open-btn');
    btn.title = 'Extension 관리자 열기';
    btn.innerHTML = '<i class="fa-solid fa-sliders"></i> 순서/그룹 관리';
    btn.addEventListener('click', openExtensionManager);

    // Strategy 1: insert right after the "확장 프로그램 설치" button row
    const installBtn = document.getElementById('extensions_install');
    if (installBtn) {
        installBtn.insertAdjacentElement('afterend', btn);
        return;
    }

    // Strategy 2: insert into the top button block
    const topBlock = document.querySelector('#extensions_settings .extensions_block, #extensions_settings > div:first-child');
    if (topBlock) {
        topBlock.appendChild(btn);
        return;
    }

    // Strategy 3: prepend to the whole extensions settings panel
    const panel = document.getElementById('extensions_settings');
    if (panel) {
        panel.insertAdjacentElement('afterbegin', btn);
        return;
    }

    // Strategy 4: watch for the panel to appear (user hasn't opened the tab yet)
    console.log('[Chat Tools] Extensions panel not found yet — will retry on tab open');
}

// Watch for the extensions tab being opened for the first time
function watchExtensionTabOpen() {
    // ST renders #extensions_settings lazily when the tab is first clicked
    const observer = new MutationObserver(() => {
        if (document.getElementById('extensions_install') || document.getElementById('extensions_settings')) {
            observer.disconnect();
            setTimeout(injectManagerButton, 100); // slight delay for full render
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// ── Save ─────────────────────────────────────────────────────

function saveSettings() {
    const { saveSettingsDebounced } = getCtx();
    saveSettingsDebounced();
}

// ── Utility ──────────────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// INIT
// ============================================================

(function init() {
    const { eventSource, event_types } = getCtx();

    // Wait for app to be fully ready
    eventSource.on(event_types.APP_READY, () => {
        injectDeleteButton();
        // Try injecting manager button; if panel not open yet, watch for it
        injectManagerButton();
        watchExtensionTabOpen();
    });

    // Also try immediately in case APP_READY already fired
    if (document.getElementById('send_but')) {
        injectDeleteButton();
    }
    if (document.getElementById('extensions_settings') || document.getElementById('extensions_install')) {
        injectManagerButton();
    } else {
        watchExtensionTabOpen();
    }

    // Re-inject on chat change (the send button sometimes re-renders)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        injectDeleteButton();
    });

    console.log('[Chat Tools] Extension loaded ✓');
})();
