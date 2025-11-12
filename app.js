// Generic modal factory (lightweight, non-invasive)
function createModal({ title, bodyHTML, actions = [], ariaLabel = null, initialFocusSelector = null }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-accessible';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (ariaLabel) overlay.setAttribute('aria-label', ariaLabel);

    const box = document.createElement('div');
    box.className = 'app-modal';
    box.innerHTML = `
        <h3>${title}</h3>
        <div class="modal-body">${bodyHTML}</div>
        <div class="modal-actions"></div>
    `;
    const actionsContainer = box.querySelector('.modal-actions');
    actions.forEach(a => {
        const btn = document.createElement('button');
        btn.textContent = a.label;
        btn.type = 'button';
        btn.id = a.id || '';
        btn.className = a.variant === 'primary' ? 'modal-btn-primary' : 'modal-btn-secondary';
        btn.addEventListener('click', async () => {
            if (a.handler) {
                await a.handler({ close });
            }
        });
        actionsContainer.appendChild(btn);
    });

    function close() {
        document.removeEventListener('keydown', handleKey);
        overlay.remove();
        // Restore focus to previously focused element
        if (previousActive) previousActive.focus();
    }

    function handleKey(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        } else if (e.key === 'Enter') {
            // Submit on Enter unless typing in a multiline field
            const ae = document.activeElement;
            if (ae && ae.tagName === 'TEXTAREA') return;
            const primary = box.querySelector('.modal-btn-primary');
            if (primary) {
                e.preventDefault();
                primary.click();
            }
        }
    }

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlay.appendChild(box);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', handleKey);

    // Initial focus
    if (initialFocusSelector) {
        const el = box.querySelector(initialFocusSelector);
        if (el) el.focus();
    } else {
        // Focus first focusable
        const first = box.querySelector('button, [href], input, select, textarea');
        if (first) first.focus();
    }

    return { overlay, box, close };
}

// Refactored report dialog using createModal
function openDeliveryIssueDialog(subscriber, circuitId) {
    const hasMultiple = subscriber.products.length > 1;
    const productHTML = hasMultiple ? `
        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:.5rem;font-weight:500;">Valitse tuote(et) jotka eivät toimitettu:</label>
          <div id="reportProducts" style="display:flex;flex-direction:column;gap:.5rem;padding:.75rem;background:var(--warm-gray);border-radius:8px;">
            ${subscriber.products.map((p,i)=>`<label style='display:flex;align-items:center;cursor:pointer;'>
              <input type='checkbox' value='${p}' data-idx='${i}' style='margin-right:.5rem;width:18px;height:18px;cursor:pointer;'>
              <span>${p}</span>
            </label>`).join('')}
          </div>
        </div>` : '';
                const bodyHTML = `
        ${productHTML}
        <select id='reportIssue' style='width:100%;padding:.75rem;border:2px solid var(--border-color);border-radius:8px;font-size:1rem;margin-bottom:1rem;background:var(--card-bg);color:var(--text-color);'>
          <option value=''>Valitse syy</option>
          <option value='Ei pääsyä'>Ei pääsyä</option>
          <option value='Avainongelma'>Avainongelma</option>
          <option value='Lehtipuute'>Lehtipuute</option>
          <option value='Muu'>Muu</option>
        </select>
        <div id='reportCustomWrap' style='display:none;margin-bottom:1rem;'>
          <label style='display:block;margin-bottom:.5rem;font-weight:500;'>Tarkenna:</label>
          <textarea id='reportCustomText' rows='3' style='width:100%;padding:.75rem;border:2px solid var(--border-color);border-radius:8px;font-size:1rem;resize:vertical;background:var(--card-bg);color:var(--text-color);'></textarea>
        </div>
        <div style='margin-bottom:1rem;'>
          <label style='display:block;margin-bottom:.5rem;font-weight:500;'>Liitä kuva (valinnainen):</label>
          <input type='file' id='reportPhoto' accept='image/*' capture='environment' style='width:100%;padding:.5rem;border:2px solid var(--border-color);border-radius:8px;background:var(--card-bg);color:var(--text-color);'/>
          <div id='reportPhotoPreview' style='margin-top:.5rem;display:none;'>
            <img id='reportPhotoImg' style='max-width:100%;height:auto;border-radius:8px;' alt='Kuvan esikatselu'/>
          </div>
        </div>`;
    const { box, close } = createModal({
        title: 'Jakeluhäiriön ilmoitus',
        bodyHTML,
        actions: [
            { id: 'reportCancel', label: 'Peruuta', variant: 'secondary', handler: () => close() },
            { id: 'reportSubmit', label: 'Lähetä', variant: 'primary', handler: async ({ close: modalClose }) => {
                const issueSelect = box.querySelector('#reportIssue');
                const submitBtn = box.querySelector('#reportSubmit');
                
                let reason = issueSelect.value;
                if (!reason) { showNotification('Valitse syy', 'error'); return; }
                if (reason === 'Muu') {
                    const customTxt = box.querySelector('#reportCustomText').value.trim();
                    if (!customTxt) { showNotification('Kirjoita tarkennusviesti', 'error'); return; }
                    reason = `Muu: ${customTxt}`;
                }
                let selectedProducts = subscriber.products;
                if (hasMultiple) {
                    const checked = Array.from(box.querySelectorAll('#reportProducts input[type="checkbox"]:checked')).map(cb => cb.value);
                    if (checked.length === 0) { showNotification('Valitse vähintään yksi tuote', 'error'); return; }
                    selectedProducts = checked;
                }
                
                // Get photo if uploaded
                const photoInput = box.querySelector('#reportPhoto');
                const photoFile = photoInput && photoInput.files && photoInput.files[0];
                
                const report = {
                    timestamp: new Date().toISOString(),
                    circuit: circuitId,
                    address: subscriber.address,
                    name: subscriber.name,
                    products: selectedProducts.join(', '),
                    reason,
                    hasPhoto: !!photoFile
                };
                
                // Disable button and show loading state
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Lähetetään...';
                }
                
                try {
                    await saveRouteMessage(report, photoFile);
                    showNotification('Raportti tallennettu!', 'success');
                    modalClose();
                } catch (error) {
                    console.error('Error saving report:', error);
                    showNotification('Raportin tallennus epäonnistui', 'error');
                    // Re-enable button on error
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Lähetä';
                    }
                }
            } }
        ]
    });
    // Toggle custom reason field
    const issueSelect = box.querySelector('#reportIssue');
    const customWrap = box.querySelector('#reportCustomWrap');
    issueSelect.addEventListener('change', () => {
        customWrap.style.display = issueSelect.value === 'Muu' ? 'block' : 'none';
    });
    
    // Photo preview handler
    const photoInput = box.querySelector('#reportPhoto');
    const photoPreview = box.querySelector('#reportPhotoPreview');
    const photoImg = box.querySelector('#reportPhotoImg');
    if (photoInput && photoPreview && photoImg) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    photoImg.src = event.target.result;
                    photoPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                photoPreview.style.display = 'none';
            }
        });
    }
}

// Key info dialog for admin
function openKeyInfoDialog(subscriber, circuitId) {
    const currentInfo = subscriber.key_info || '';
    const bodyHTML = `
        <div style="margin-bottom:1rem;">
          <label style="display:block;margin-bottom:.5rem;font-weight:500;">Avaintiedot (porttikoodit, huomiot, yms.):</label>
          <textarea id="keyInfoText" rows="4" style="width:100%;padding:.75rem;border:2px solid var(--border-color);border-radius:8px;font-size:1rem;resize:vertical;background:var(--card-bg);color:var(--text-color);" placeholder="Esim: Porttikoodi 1234, avainta tarvitaan, koira pihalla">${currentInfo}</textarea>
        </div>
        <div style="color:var(--text-muted);font-size:0.9rem;">
          <strong>Osoite:</strong> ${subscriber.address}<br>
          <strong>Nimi:</strong> ${subscriber.name}
        </div>
    `;
    
    const { box, close } = createModal({
        title: 'Muokkaa avaintietoja',
        bodyHTML,
        actions: [
            { id: 'keyCancel', label: 'Peruuta', variant: 'secondary', handler: () => close() },
            { id: 'keyClear', label: 'Tyhjennä', variant: 'secondary', handler: () => {
                const textarea = box.querySelector('#keyInfoText');
                if (textarea) textarea.value = '';
            }},
            { id: 'keySave', label: 'Tallenna', variant: 'primary', handler: async () => {
                const textarea = box.querySelector('#keyInfoText');
                const newInfo = textarea ? textarea.value.trim() : '';
                
                try {
                    // Save via API
                    if (window.mailiaAPI && window.mailiaAPI.isAuthenticated() && subscriber.id) {
                        await window.mailiaAPI.makeRequest(`/subscriptions/subscribers/${subscriber.id}/key-info`, {
                            method: 'PUT',
                            body: JSON.stringify({ key_info: newInfo })
                        });
                        
                        // Update local data
                        subscriber.key_info = newInfo;
                        
                        // Reload circuit to refresh UI
                        if (currentCircuit === circuitId) {
                            await loadCircuit(circuitId);
                        }
                        
                        showNotification('Avaintiedot tallennettu', 'success');
                        close();
                    } else {
                        showNotification('Tallennus epäonnistui: ei yhteyttä', 'error');
                    }
                } catch (error) {
                    console.error('Failed to save key info:', error);
                    showNotification('Virhe tallentaessa', 'error');
                }
            }}
        ],
        initialFocusSelector: '#keyInfoText'
    });
}

// Helper: collect checked product values from a container
function getCheckedProducts(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}
// Mailia Delivery Tracking Application

// ============= Global State =============
let allData = {};  // Changed to object for easier circuit lookup
let currentCircuit = null;
let isAuthenticated = false;
let userRole = null; // 'delivery', 'admin', or 'manager'
let routeMessages = []; // Store route messages for admin panel
let showCheckboxes = false; // Control checkbox visibility (default: OFF - swipe is primary method)
let isLoadingCircuit = false; // Prevent concurrent circuit loads
let isRenderingTracker = false; // Prevent concurrent tracker renders
let websocketListenersInitialized = false; // Prevent duplicate WebSocket event bindings

// ============= Haptic Feedback =============
function triggerHaptic(intensity = 'light') {
    if ('vibrate' in navigator) {
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 30,
            success: [10, 50, 10],
            error: [30, 100, 30],
            warning: [20, 80, 20]
        };
        navigator.vibrate(patterns[intensity] || patterns.light);
    }
}

// ============= Skeleton Loading Screens =============
function createSkeletonCircuitCard() {
    return `
        <div class="skeleton-circuit-card">
            <div class="skeleton-circuit-header">
                <div class="skeleton skeleton-circuit-title"></div>
                <div class="skeleton skeleton-circuit-status"></div>
            </div>
            <div class="skeleton skeleton-progress-bar"></div>
            <div class="skeleton-stats">
                <div class="skeleton skeleton-stat"></div>
                <div class="skeleton skeleton-stat"></div>
                <div class="skeleton skeleton-stat"></div>
            </div>
        </div>
    `;
}

function createSkeletonSubscriberCard() {
    return `
        <div class="skeleton-subscriber-card">
            <div class="skeleton skeleton-checkbox"></div>
            <div class="skeleton-subscriber-content">
                <div class="skeleton skeleton-address"></div>
                <div class="skeleton-products">
                    <div class="skeleton skeleton-product-badge"></div>
                    <div class="skeleton skeleton-product-badge"></div>
                    <div class="skeleton skeleton-product-badge"></div>
                </div>
            </div>
        </div>
    `;
}

function createSkeletonMessageCard() {
    return `
        <div class="skeleton-card">
            <div class="skeleton-header">
                <div class="skeleton skeleton-avatar"></div>
                <div style="flex: 1;">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-subtitle"></div>
                </div>
            </div>
            <div class="skeleton skeleton-text long"></div>
            <div class="skeleton skeleton-text short"></div>
        </div>
    `;
}

function createSkeletonTableRow() {
    return `
        <div class="skeleton-table-row">
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
            <div class="skeleton skeleton-table-cell"></div>
        </div>
    `;
}

function showSkeletonLoader(container, type = 'card', count = 3) {
    if (!container) return;
    
    const skeletonContainer = document.createElement('div');
    skeletonContainer.className = 'skeleton-container';
    skeletonContainer.setAttribute('data-skeleton', 'true');
    
    let skeletonHTML = '';
    for (let i = 0; i < count; i++) {
        switch (type) {
            case 'circuit':
                skeletonHTML += createSkeletonCircuitCard();
                break;
            case 'subscriber':
                skeletonHTML += createSkeletonSubscriberCard();
                break;
            case 'message':
                skeletonHTML += createSkeletonMessageCard();
                break;
            case 'table':
                skeletonHTML += createSkeletonTableRow();
                break;
            default:
                skeletonHTML += createSkeletonCard();
        }
    }
    
    skeletonContainer.innerHTML = skeletonHTML;
    container.appendChild(skeletonContainer);
}

function hideSkeletonLoader(container) {
    if (!container) return;
    
    const skeletons = container.querySelectorAll('[data-skeleton="true"]');
    skeletons.forEach(skeleton => {
        skeleton.classList.add('loaded');
        setTimeout(() => skeleton.remove(), 300);
    });
}

// ============= Offline Mode Integration =============
let offlineDB = null;
let syncManager = null;
let conflictUI = null;
let offlineStatusInitialized = false;

// Initialize offline modules
async function initializeOfflineMode() {
    if (offlineStatusInitialized) {
        console.log('Offline mode already initialized');
        return;
    }
    
    try {
        // Initialize IndexedDB wrapper
        if (typeof OfflineDB !== 'undefined') {
            offlineDB = new OfflineDB();
            await offlineDB.init();
            console.log('✅ OfflineDB initialized');
        }
        
        // Initialize sync manager
        if (typeof SyncManager !== 'undefined' && offlineDB) {
            syncManager = new SyncManager(offlineDB, window.mailiaAPI);
            syncManager.startPeriodicSync();
            console.log('✅ SyncManager initialized');
        }
        
        // Initialize conflict UI
        if (typeof ConflictResolutionUI !== 'undefined' && offlineDB) {
            conflictUI = new ConflictResolutionUI(offlineDB, syncManager);
            console.log('✅ ConflictUI initialized');
        }
        
        // Setup offline status indicator
        setupOfflineStatusIndicator();
        
        // Listen for online/offline events
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
        
        offlineStatusInitialized = true;
        console.log('✅ Offline mode fully initialized');
    } catch (error) {
        console.error('❌ Failed to initialize offline mode:', error);
    }
}

// Setup offline status indicator UI
function setupOfflineStatusIndicator() {
    const statusEl = document.getElementById('offlineStatus');
    if (!statusEl) return;
    
    const dotEl = statusEl.querySelector('.offline-status-dot');
    const textEl = statusEl.querySelector('.offline-status-text');
    const pendingBadge = document.getElementById('pendingSyncBadge');
    const conflictsBadge = document.getElementById('conflictsBadge');
    
    // Update status based on network
    const updateNetworkStatus = () => {
        const isOnline = navigator.onLine;
        
        if (dotEl) {
            dotEl.classList.remove('online', 'offline', 'syncing');
            dotEl.classList.add(isOnline ? 'online' : 'offline');
        }
        
        if (textEl) {
            textEl.textContent = isOnline ? 'Online' : 'Offline';
        }
        
        // Show/hide status indicator
        if (isOnline && pendingBadge && conflictsBadge) {
            const hasPending = pendingBadge.textContent !== '0';
            const hasConflicts = conflictsBadge.textContent !== '0';
            statusEl.classList.toggle('hidden', !hasPending && !hasConflicts);
        } else {
            statusEl.classList.remove('hidden');
        }
    };
    
    // Initial status update
    updateNetworkStatus();
    
    // Periodic status update (check for pending items)
    setInterval(async () => {
        if (!offlineDB) return;
        
        try {
            const pending = await offlineDB.getPendingSyncItems();
            const conflicts = await offlineDB.getAllConflicts();
            
            if (pendingBadge) {
                pendingBadge.textContent = pending.length;
                pendingBadge.style.display = pending.length > 0 ? 'inline-flex' : 'none';
            }
            
            if (conflictsBadge) {
                conflictsBadge.textContent = conflicts.length;
                conflictsBadge.style.display = conflicts.length > 0 ? 'inline-flex' : 'none';
            }
            
            // Show sync indicator when syncing
            const dotEl = statusEl.querySelector('.offline-status-dot');
            if (syncManager && syncManager.isSyncing && dotEl) {
                dotEl.classList.remove('online', 'offline');
                dotEl.classList.add('syncing');
            } else {
                updateNetworkStatus();
            }
            
            // Check for conflicts to show UI
            if (conflictUI && conflicts.length > 0) {
                await conflictUI.checkAndShowConflicts();
            }
        } catch (error) {
            console.error('Error updating offline status:', error);
        }
    }, 5000); // Update every 5 seconds
}

// Handle online status
function handleOnlineStatus() {
    console.log('📶 Network online - starting sync');
    const statusEl = document.getElementById('offlineStatus');
    if (statusEl) {
        const textEl = statusEl.querySelector('.offline-status-text');
        if (textEl) textEl.textContent = 'Syncing...';
    }
    
    // Trigger sync when coming back online
    if (syncManager) {
        syncManager.syncAll().then(() => {
            console.log('✅ Sync completed after coming online');
        }).catch(error => {
            console.error('❌ Sync failed after coming online:', error);
        });
    }
}

// Handle offline status
function handleOfflineStatus() {
    console.log('📵 Network offline - changes will be queued');
    showToast('Offline-tilassa. Muutokset synkronoidaan kun yhteys palaa.', 'info');
}

// Small helper: get current role from memory or storage
function getEffectiveUserRole() {
    try {
        return userRole || sessionStorage.getItem('mailiaUserRole') || null;
    } catch (_) {
        return userRole || null;
    }
}

// ============= Backend Integration =============
// Check if user is already logged in
window.addEventListener('DOMContentLoaded', async () => {
    try {
        if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
            // Verify the token is still valid by trying to fetch user data
            try {
                await window.mailiaAPI.makeRequest('/auth/me');
                // Token is valid, show main app (this handles all initialization)
                await showMainApp();
            } catch (error) {
                // Token is invalid, clear it and show login
                console.log('Session expired, please login again');
                await window.mailiaAPI.logout();
                showLoginScreen();
            }
        } else {
            // Show login screen
            showLoginScreen();
        }
    } catch (error) {
        // If anything fails during initialization, show login screen
        console.error('Initialization error:', error);
        showLoginScreen();
    }
});

// Handle login form submission
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleLogin();
        });
    }
});

async function handleLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginError = document.getElementById('loginError');
    
    try {
        loginError.style.display = 'none';
        const loginButton = document.querySelector('.phone-login-button');
        loginButton.disabled = true;
        loginButton.textContent = 'Kirjaudutaan sisään...';
        
        // Login via backend API
        await window.mailiaAPI.login(username, password);
        
        // Persist role ASAP after login (before async UI init)
        const currentUser = window.mailiaAPI.getCurrentUser();
        if (currentUser && currentUser.role) {
            userRole = currentUser.role; // set global
            try { sessionStorage.setItem('mailiaUserRole', currentUser.role); } catch(_) {}
            console.log('[handleLogin] stored role:', currentUser.role);
        }

        // Success - show main app (this is async and calls populateCircuitSelector)
        await showMainApp();

    } catch (error) {
        console.error('Login failed:', error);
        loginError.textContent = error.message || 'Kirjautuminen epäonnistui. Tarkista tunnukset.';
        loginError.style.display = 'block';
        
        const loginButton = document.querySelector('.phone-login-button');
        loginButton.disabled = false;
        loginButton.textContent = 'Kirjaudu sisään';
    }
}

function initAdminDuplicatesUI() {
    const btn = document.getElementById('adminDuplicatesBtn');
    if (!btn) return;
    btn.addEventListener('click', openAdminDuplicatesModal);
}

async function fetchAdminDuplicates() {
    try {
        const data = await window.mailiaAPI.makeRequest('/admin/duplicates');
        return data;
    } catch (e) {
        console.error('Failed to fetch duplicates', e);
        showNotification('Virhe ladattaessa päällekkäisyyksiä', 'error');
        return null;
    }
}

function formatCircuitBadges(circuits) {
    return circuits.map(c => `<span class="circuit-badge">${c}</span>`).join('');
}

function renderOverlapTable(items, type) {
    if (!items || !items.length) return `<p class='empty-msg'>Ei päällekkäisiä (${type}).</p>`;
    return `<table class='overlap-table' aria-label='${type} päällekkäisyydet'>
        <thead><tr><th>Avain</th><th>Piirit</th><th>Lkm</th><th>Esimerkki</th><th>Whitelist</th></tr></thead>
        <tbody>
        ${items.map(r => {
            const key = r.key;
            const rowId = `${type}-row-${key.replace(/[^a-z0-9]/gi,'_')}`;
            return `<tr id='${rowId}'>
                <td class='key-cell'>${key}</td>
                <td>${formatCircuitBadges(r.circuits)}</td>
                <td>${r.total}</td>
                <td class='example-cell'>${r.example || ''}</td>
                <td><button type='button' class='whitelist-add-btn' data-key='${key}' data-type='${type}'>Lisää</button></td>
            </tr>`;
        }).join('')}
        </tbody>
    </table>`;
}

function buildWhitelistPreview(whitelist) {
    const b = whitelist?.buildings?.length || 0;
    const u = whitelist?.units?.length || 0;
    return `<div class='whitelist-summary'>Whitelist: ${b} rakennusta, ${u} yksikköä</div>`;
}

function openAdminDuplicatesModal() {
    createModal({
        title: 'Päällekkäiset osoitteet',
        bodyHTML: `<div class='admin-duplicates-loading'>Ladataan...</div>`,
        actions: [
            { id: 'closeAdminDup', label: 'Sulje', variant: 'secondary', handler: ({ close }) => close() },
            { id: 'saveWhitelist', label: 'Tallenna whitelist', variant: 'primary', handler: ({ close }) => submitWhitelistChanges(close) }
        ],
        ariaLabel: 'Admin päällekkäiset osoitteet'
    });
    // After slight delay fetch data
    setTimeout(async () => {
        const modalBody = document.querySelector('.modal-body');
        const data = await fetchAdminDuplicates();
        if (!data) { modalBody.innerHTML = '<p>Virhe datassa</p>'; return; }
        const { overlaps, whitelist } = data;
        const buildingsHTML = `<h4>Rakennukset</h4>${renderOverlapTable(overlaps.buildings, 'building')}`;
        const unitsHTML = `<h4>Yksiköt</h4>${renderOverlapTable(overlaps.units, 'unit')}`;
        modalBody.innerHTML = `
            ${buildWhitelistPreview(whitelist)}
            <div class='overlaps-section'>${buildingsHTML}${unitsHTML}</div>
            <details class='current-whitelist'>
              <summary>Nykyinen whitelist JSON</summary>
              <pre id='whitelistJson'>${escapeHtml(JSON.stringify(whitelist, null, 2))}</pre>
            </details>
            <div class='pending-additions' aria-live='polite'>Ei valintoja</div>
        `;
        setupWhitelistAdditions(whitelist);
    }, 50);
}

function escapeHtml(str) {
    return str.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

let pendingWhitelist = { buildings: [], units: [] };

function setupWhitelistAdditions(existing) {
    pendingWhitelist = { buildings: [], units: [] };
    const body = document.querySelector('.modal-body');
    if (!body) return;
    body.addEventListener('click', e => {
        const btn = e.target.closest('.whitelist-add-btn');
        if (!btn) return;
        const key = btn.getAttribute('data-key');
        const type = btn.getAttribute('data-type');
        if (!key || !type) return;
        const arr = pendingWhitelist[type === 'building' ? 'buildings' : 'units'];
        if (!arr.some(entry => (typeof entry === 'string' ? entry.toLowerCase() === key.toLowerCase() : String(entry.key).toLowerCase() === key.toLowerCase()))) {
            arr.push(key);
            btn.disabled = true;
            btn.textContent = 'Lisätty';
            updatePendingAdditions();
        }
    });
}

function updatePendingAdditions() {
    const el = document.querySelector('.pending-additions');
    if (!el) return;
    const b = pendingWhitelist.buildings.length;
    const u = pendingWhitelist.units.length;
    if (b === 0 && u === 0) {
        el.textContent = 'Ei valintoja';
    } else {
        el.textContent = `Lisätään whitelist: ${b} rakennusta, ${u} yksikköä`;
    }
}

async function submitWhitelistChanges(close) {
    if (!pendingWhitelist.buildings.length && !pendingWhitelist.units.length) {
        showNotification('Ei uusia kohteita', 'info');
        return;
    }
    try {
        await window.mailiaAPI.makeRequest('/admin/whitelist', {
            method: 'PUT',
            body: JSON.stringify({ mode: 'merge', buildings: pendingWhitelist.buildings, units: pendingWhitelist.units }),
            headers: { 'Content-Type': 'application/json' }
        });
        showNotification('Whitelist päivitetty', 'success');
        close();
    } catch (e) {
        console.error('Whitelist save failed', e);
        showNotification('Whitelist tallennus epäonnistui', 'error');
    }
}

// WebSocket real-time event listeners
function initializeWebSocketListeners() {
    if (websocketListenersInitialized) {
        return;
    }
    websocketListenersInitialized = true;
    // --- Batched delivery update handling ---
    let deliveryUpdateQueue = [];
    let deliveryFlushTimer = null;
    const DELIVERY_BATCH_INTERVAL = 200; // ms debounce window

    function enqueueDeliveryUpdate(data) {
        deliveryUpdateQueue.push(data);
        if (!deliveryFlushTimer) {
            deliveryFlushTimer = setTimeout(flushDeliveryUpdates, DELIVERY_BATCH_INTERVAL);
        }
    }

    function flushDeliveryUpdates() {
        const batch = deliveryUpdateQueue.slice();
        deliveryUpdateQueue = [];
        deliveryFlushTimer = null;
        if (!batch.length) return;

        // Apply checkbox state changes without multiple DOM queries per update
        const bySubscriberId = {};
        batch.forEach(update => {
            if (update?.subscriberId != null) {
                bySubscriberId[update.subscriberId] = update.isDelivered;
            }
        });

        Object.entries(bySubscriberId).forEach(([subId, isDelivered]) => {
            const checkbox = document.querySelector(`input[data-subscriber-id="${subId}"]`);
            if (!checkbox) return;
            const changed = checkbox.checked !== isDelivered;
            checkbox.checked = isDelivered;
            const card = checkbox.closest('.subscriber-card');
            if (card) {
                card.classList.toggle('delivered', isDelivered);
            }
            if (changed) {
                // Avoid firing global change listeners redundantly; manually update styles
                if (typeof updateDeliveredCardStyles === 'function') updateDeliveredCardStyles();
            }
        });

        // Single progress recalculation after batch
        if (typeof recalcAndRenderProgress === 'function') {
            recalcAndRenderProgress();
        }

        // Refresh tracker & dashboard once per batch if visible
        const trackerTab = document.getElementById('trackerTab');
        if (trackerTab && trackerTab.classList.contains('active') && typeof renderCircuitTracker === 'function') {
            renderCircuitTracker();
        }
        const dashboardTab = document.querySelector('.tab-content.active#dashboardTab');
        if (dashboardTab && typeof loadTodayDeliveryCount === 'function') {
            loadTodayDeliveryCount();
        }
    }
    // Listen for route updates from other users
    window.addEventListener('routeUpdated', async (event) => {
        const data = event.detail;
        console.log('Route updated event received:', data);
        console.log('Current circuit:', currentCircuit);
        console.log('Data circuit:', data.circuitId);
        console.log('Event data:', data);
        
        // Update localStorage with the route status from the event
        if (data.circuitId) {
            const startKey = `route_start_${data.circuitId}`;
            const endKey = `route_end_${data.circuitId}`;
            const routeIdKey = `route_id_${data.circuitId}`;
            
            // Store route ID
            if (data.routeId) {
                localStorage.setItem(routeIdKey, data.routeId);
            }
            
            // Handle reset to not-started: clear all times
            if (data.status === 'not-started' || data.action === 'reset') {
                localStorage.removeItem(startKey);
                localStorage.removeItem(endKey);
                console.log(`Reset route: cleared ${startKey} and ${endKey}`);
            }
            // Handle completed status
            else if (data.status === 'completed' && data.endTime) {
                if (data.startTime) {
                    localStorage.setItem(startKey, data.startTime);
                }
                localStorage.setItem(endKey, data.endTime);
                console.log(`Completed route: set ${startKey} and ${endKey}`);
            }
            // Handle started/in-progress status
            else if (data.status === 'in-progress' || (data.startTime && !data.endTime)) {
                localStorage.setItem(startKey, data.startTime);
                localStorage.removeItem(endKey);
                console.log(`Started route: set ${startKey}, cleared ${endKey}`);
            }
        }
        
        // Update UI if it's the current circuit
        if (currentCircuit && data.circuitId === currentCircuit) {
            console.log('Updating route buttons for current circuit...');
            // Refresh route status display
            updateRouteButtons(currentCircuit);
            
            // Show notification only if the update is from another user
            const currentUser = window.mailiaAPI.getCurrentUser();
            const currentUsername = currentUser?.username;
            if (data.updatedBy && data.updatedBy !== currentUsername) {
                showNotification(`Reitin tila päivitetty käyttäjältä: ${data.updatedBy}`, 'info');
            }
        } else {
            console.log('Circuit mismatch or no current circuit, not updating buttons');
        }
        
        // Refresh tracker if visible (admin view)
        const trackerTab = document.getElementById('trackerTab');
        console.log('Tracker tab element:', trackerTab);
        console.log('Tracker tab active?', trackerTab?.classList.contains('active'));
        if (trackerTab && trackerTab.classList.contains('active')) {
            console.log('Refreshing circuit tracker...');
            renderCircuitTracker();
        }
        
        // Also refresh dashboard if it's active (route completion affects delivery counts)
        const dashboardTab = document.querySelector('.tab-content.active#dashboardTab');
        if (dashboardTab && (data.status === 'completed' || data.action === 'complete')) {
            console.log('Route completed - refreshing dashboard delivery count...');
            if (typeof loadTodayDeliveryCount === 'function') {
                loadTodayDeliveryCount();
            }
            if (typeof loadPeriodDeliveryCount === 'function') {
                loadPeriodDeliveryCount();
            }
        }
    });
    
    // Listen for subscriber updates (manual additions/changes by admin)
    window.addEventListener('subscriberUpdated', async (event) => {
        const data = event.detail;
        console.log('Subscriber updated event received:', data);
        
        // Reload circuit if it matches current view
        if (currentCircuit && data.circuitId === currentCircuit) {
            console.log('Reloading current circuit due to subscriber update...');
            
            // Clear cache to force reload from backend
            delete allData[currentCircuit];
            
            await loadCircuit(currentCircuit);
            
            // Show notification based on action
            if (data.action === 'key_info_updated') {
                showNotification('Avaintiedot päivitetty', 'success');
            } else if (data.action === 'created') {
                showNotification('Uusi tilaaja lisätty piirille', 'success');
            } else {
                showNotification('Tilaaja päivitetty', 'success');
            }
        }
    });
    
    // Listen for route messages
    window.addEventListener('messageReceived', (event) => {
        const data = event.detail;
        console.log('Message received event:', data);
        
        // Only show notification if from another user
        const currentUser = window.mailiaAPI.getCurrentUser();
        const currentUsername = currentUser?.username;
        if (data.username && data.username !== currentUsername) {
            const messageText = data.message || 'Uusi viesti';
            const username = data.username || 'Tuntematon';
            showNotification(`${username}: ${messageText}`, 'info');
        }
        
        // Refresh messages if messages view is active
        const messagesTab = document.querySelector('.tab-content.active#messagesTab');
        if (messagesTab) {
            console.log('Refreshing messages view...');
            renderRouteMessages();
        } else {
            console.log('Messages tab not active, skipping render');
        }
        
        // Also refresh dashboard if it's active
        const dashboardTab = document.querySelector('.tab-content.active#dashboardTab');
        if (dashboardTab && typeof loadTodayDeliveryCount === 'function') {
            console.log('Refreshing dashboard delivery count...');
            loadTodayDeliveryCount();
        }
    });
    
    // Listen for message read events
    window.addEventListener('messageRead', (event) => {
        const data = event.detail;
        console.log('Message read event received:', data);
        
        // Refresh messages if messages view is active
        const messagesTab = document.querySelector('.tab-content.active#messagesTab');
        if (messagesTab) {
            console.log('Refreshing messages view after message read...');
            renderRouteMessages();
        }
    });
    
    // Listen for delivery updates (batched)
    window.addEventListener('deliveryUpdated', (event) => {
        const data = event.detail;
        enqueueDeliveryUpdate(data);
    });
}

// Show notification helper
function showNotification(message, type = 'info') {
    // Accessible toast with inline icon & status role
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const icons = {
        success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12" y2="16"></line></svg>',
        info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="8"></line></svg>'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
        <div class="toast-content">${icons[type] || icons.info}<span class="toast-message">${message}</span></div>
        <button class="toast-dismiss" aria-label="Sulje ilmoitus">×</button>
    `;
    const dismissBtn = toast.querySelector('.toast-dismiss');
    dismissBtn.addEventListener('click', () => {
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 250);
    });
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('enter'));
    setTimeout(() => dismissBtn.click(), 5000);
}

function showCircuitManagementMenu(circuitId, routeData, status) {
    const buttons = [];
    
    // Map button omitted in management menu
    
    if (!routeData || status === 'not-started') {
        buttons.push({ id: 'startRoute', label: 'Aloita reitti', variant: 'primary', icon: 'play', handler: async ({ close }) => {
            try {
                const route = await window.mailiaAPI.startRoute(circuitId);
                localStorage.setItem(`route_id_${circuitId}`, route.id);
                localStorage.setItem(`route_start_${circuitId}`, new Date(route.start_time || Date.now()).toISOString());
                showNotification(`Reitti ${circuitId} aloitettu`, 'success');
                if (currentCircuit === circuitId) {
                    showSubscriberListWithAnimation();
                    updateRouteButtons(circuitId);
                }
                renderCircuitTracker();
                close();
            } catch(e){ console.error(e); showNotification('Reitin aloitus epäonnistui', 'error'); }
        }});
        buttons.push({ id: 'completeRoute', label: 'Merkitse valmiiksi', variant: 'secondary', icon: 'check', handler: async ({ close }) => {
            try {
                let routeId = routeData?.id;
                if (!routeId) {
                    const route = await window.mailiaAPI.startRoute(circuitId);
                    routeId = route.id;
                    localStorage.setItem(`route_id_${circuitId}`, route.id);
                    localStorage.setItem(`route_start_${circuitId}`, new Date(route.start_time || Date.now()).toISOString());
                }
                await window.mailiaAPI.resetRoute(routeId, 'completed');
                localStorage.setItem(`route_end_${circuitId}`, new Date().toISOString());
                showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
                if (currentCircuit === circuitId) {
                    hideSubscriberListWithAnimation();
                    updateRouteButtons(circuitId);
                }
                renderCircuitTracker();
                close();
            } catch(e){ console.error(e); showNotification('Reitin merkkaus epäonnistui', 'error'); }
        }});
    } else {
        buttons.push({ id: 'resetRoute', label: 'Nollaa reitti', variant: 'secondary', icon: 'reset', handler: async ({ close }) => {
            try {
                await window.mailiaAPI.resetRoute(routeData.id, 'not-started');
                localStorage.removeItem(`route_start_${circuitId}`);
                localStorage.removeItem(`route_end_${circuitId}`);
                showNotification('Jakelustatus nollattu', 'success');
                if (currentCircuit === circuitId) {
                    updateRouteButtons(circuitId);
                }
                renderCircuitTracker();
                close();
            } catch(e){ console.error(e); showNotification('Reitin nollaus epäonnistui', 'error'); }
        }});
        if (status !== 'completed') {
            buttons.push({ id: 'completeRoute', label: 'Merkitse valmiiksi', variant: 'primary', icon: 'check', handler: async ({ close }) => {
                try {
                    await window.mailiaAPI.resetRoute(routeData.id, 'completed');
                    localStorage.setItem(`route_end_${circuitId}`, new Date().toISOString());
                    showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
                    if (currentCircuit === circuitId) {
                        hideSubscriberListWithAnimation();
                        updateRouteButtons(circuitId);
                    }
                    renderCircuitTracker();
                    close();
                } catch(e){ console.error(e); showNotification('Reitin merkkaus epäonnistui', 'error'); }
            }});
        }
    }
    const iconMap = {
        map: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
        play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
        check: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>',
        reset: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>'
    };
    const bodyHTML = `<div class="route-mgmt-buttons">${buttons.map(b=>`<button type=\"button\" data-btn=\"${b.id}\" class=\"modal-btn-${b.variant}\">${iconMap[b.icon]||''}<span>${b.label}</span></button>`).join('')}</div>`;
    const { box, close } = createModal({
        title: `Hallitse reittiä ${circuitId}`,
        bodyHTML,
        actions:[{ id:'closeMgmt', label:'Sulje', variant:'secondary', handler: ({close})=>close()}],
        ariaLabel:`Reitin ${circuitId} hallinta`,
        initialFocusSelector: '#closeMgmt'
    });
    buttons.forEach(b=>{ const el=box.querySelector(`[data-btn="${b.id}"]`); if(el) el.addEventListener('click', ()=>b.handler({ close })); });
}

function showRouteStatusModal(circuitId, routeData) {
    const { box, close } = createModal({
        title: `Muuta reitin ${circuitId} tilaa`,
        bodyHTML: `
            <div class="route-status-actions">
                <button type="button" class="modal-btn-secondary" data-action="reset">🔴 Merkitse aloittamattomaksi</button>
                <button type="button" class="modal-btn-primary" data-action="complete">🟢 Merkitse valmiiksi</button>
            </div>
        `,
        actions: [{ id: 'closeRouteStatus', label: 'Sulje', variant: 'secondary', handler: ({ close }) => close() }],
        ariaLabel: `Reitin ${circuitId} tilan muutokset`
    });
    const resetBtn = box.querySelector('[data-action="reset"]');
    const completeBtn = box.querySelector('[data-action="complete"]');
    if (resetBtn) resetBtn.addEventListener('click', async () => {
        try {
            await window.mailiaAPI.resetRoute(routeData.id, 'not-started');
            
            // Update localStorage to reflect the reset
            localStorage.removeItem(`route_start_${circuitId}`);
            localStorage.removeItem(`route_end_${circuitId}`);
            
            showNotification('Jakelustatus nollattu', 'success');
            renderCircuitTracker();
            
            // Update route buttons if this is the current circuit
            if (currentCircuit === circuitId) {
                updateRouteButtons(circuitId);
            }
            
            close();
        } catch(e) {
            console.error(e);
            showNotification('Reitin nollaus epäonnistui', 'error');
        }
    });
    if (completeBtn) completeBtn.addEventListener('click', async () => {
        try {
            await window.mailiaAPI.resetRoute(routeData.id, 'completed');
            
            // Update localStorage to reflect the completion
            const now = new Date().toISOString();
            if (!localStorage.getItem(`route_start_${circuitId}`)) {
                localStorage.setItem(`route_start_${circuitId}`, now);
            }
            localStorage.setItem(`route_end_${circuitId}`, now);
            
            showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
            renderCircuitTracker();
            
            // Update route buttons if this is the current circuit
            if (currentCircuit === circuitId) {
                updateRouteButtons(circuitId);
            }
            
            close();
        } catch(e) {
            console.error(e);
            showNotification('Reitin merkkaus epäonnistui', 'error');
        }
    });
}

// ----- Tabs Accessibility & Keyboard Navigation -----
function initTabsAccessibility() {
    const tabContainer = document.querySelector('.tab-container');
    if (!tabContainer) return;
    tabContainer.setAttribute('role', 'tablist');
    const tabButtons = tabContainer.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-content');

    // Ensure each button has id and ARIA mapping
    tabButtons.forEach(btn => {
        const tabId = btn.getAttribute('data-tab');
        if (!btn.id) btn.id = `tab-btn-${tabId}`;
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-controls', `${tabId}Tab`);
        // Initial aria-selected state
        const panel = document.getElementById(`${tabId}Tab`);
        if (panel) panel.setAttribute('role', 'tabpanel');
    });

    // Initialize selected/hidden state based on existing .active classes
    const activePanel = document.querySelector('.tab-content.active');
    tabPanels.forEach(panel => {
        const isActive = panel === activePanel;
        panel.hidden = !isActive;
        const relatedBtn = document.querySelector(`.tab-button[data-tab="${panel.id.replace('Tab','')}"]`);
        if (relatedBtn) {
            relatedBtn.classList.toggle('active', isActive);
            relatedBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            relatedBtn.tabIndex = isActive ? 0 : -1;
            panel.setAttribute('aria-labelledby', relatedBtn.id);
        }
    });

    function activateTab(btn) {
        const tabId = btn.getAttribute('data-tab');
        tabButtons.forEach(b => {
            const isActive = b === btn;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            b.tabIndex = isActive ? 0 : -1;
        });
        tabPanels.forEach(panel => {
            const matches = panel.id === `${tabId}Tab`;
            panel.classList.toggle('active', matches);
            panel.hidden = !matches;
            panel.setAttribute('aria-labelledby', `tab-btn-${tabId}`);
        });
        btn.focus();
    }

    // Click activation
    tabButtons.forEach(btn => btn.addEventListener('click', () => activateTab(btn)));

    // Keyboard navigation
    tabContainer.addEventListener('keydown', e => {
        const activeIndex = Array.from(tabButtons).findIndex(b => b.classList.contains('active'));
        if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) e.preventDefault();
        let targetIndex = activeIndex;
        if (e.key === 'ArrowRight') targetIndex = (activeIndex + 1) % tabButtons.length;
        if (e.key === 'ArrowLeft') targetIndex = (activeIndex - 1 + tabButtons.length) % tabButtons.length;
        if (e.key === 'Home') targetIndex = 0;
        if (e.key === 'End') targetIndex = tabButtons.length - 1;
        if (targetIndex !== activeIndex) activateTab(tabButtons[targetIndex]);
    });
}

// ----- Jump To Next Undelivered -----
function initJumpNextUndelivered() {
    let btn = document.getElementById('jumpNextBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'jumpNextBtn';
        btn.className = 'jump-next-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Siirry seuraavaan jakamattomaan');
        btn.textContent = '➡';
        document.body.appendChild(btn);
    }
    btn.addEventListener('click', scrollToNextUndelivered);
    updateJumpNextVisibility();

    // Observe subscriber list changes to keep visibility in sync
    const list = document.getElementById('subscriberList');
    if (list && !list._jumpObserver) {
        const obs = new MutationObserver(() => updateJumpNextVisibility());
        obs.observe(list, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        list._jumpObserver = obs;
    }
}

function updateJumpNextVisibility() {
    const remaining = document.querySelectorAll('#subscriberList .subscriber-card:not(.delivered)');
    const btn = document.getElementById('jumpNextBtn');
    if (!btn) return;
    btn.style.display = remaining.length > 0 ? 'flex' : 'none';
}

function scrollToNextUndelivered() {
    const cards = Array.from(document.querySelectorAll('#subscriberList .subscriber-card:not(.delivered)'));
    if (!cards.length) { showNotification('Kaikki jakelut tehty', 'success'); updateJumpNextVisibility(); return; }
    // Find first card below current scroll
    const viewportTop = window.scrollY;
    const target = cards.find(c => c.getBoundingClientRect().top + window.scrollY > viewportTop + 80) || cards[0];
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('flash-highlight');
    // Ensure animation class reset for repeat usage
    setTimeout(() => target.classList.remove('flash-highlight'), 1400);
}

// Hook delivery updates to refresh jump button if global function exists
const originalUpdateDelivery = window.updateDeliveryStatus;
if (typeof originalUpdateDelivery === 'function') {
    window.updateDeliveryStatus = async function(...args) {
        const result = await originalUpdateDelivery.apply(this, args);
        updateJumpNextVisibility();
        return result;
    };
}

// ----- Skeleton Loaders -----
function showSubscriberSkeletons(count = 8) {
    const list = document.getElementById('subscriberList');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skel = document.createElement('div');
        skel.className = 'subscriber-card skeleton-card';
        skel.innerHTML = '<div class="skeleton-line w40"></div><div class="skeleton-line w60"></div><div class="skeleton-line w30"></div>';
        list.appendChild(skel);
    }
}

function hideSubscriberSkeletons() {
    document.querySelectorAll('.skeleton-card').forEach(el => el.remove());
}

// Patch loadCircuit to use skeletons (assumption: function exists)
if (typeof window.loadCircuit === 'function') {
    const originalLoadCircuit = window.loadCircuit;
    window.loadCircuit = async function(...args) {
        showSubscriberSkeletons();
        const result = await originalLoadCircuit.apply(this, args);
        hideSubscriberSkeletons();
        updateJumpNextVisibility();
        return result;
    };
}

// ----- Debounced Circuit Search with Highlight -----
function initCircuitSearchEnhancements() {
    const input = document.getElementById('circuitSearch');
    const optionsContainer = document.getElementById('circuitOptions');
    if (!input || !optionsContainer) return;
    let timeout;
    input.addEventListener('input', () => {
        clearTimeout(timeout);
        const query = input.value.trim().toLowerCase();
        timeout = setTimeout(() => {
            const options = optionsContainer.querySelectorAll('.circuit-option');
            options.forEach(opt => {
                const text = opt.dataset.circuitId || opt.textContent.trim();
                if (!query) {
                    opt.style.display = '';
                    opt.innerHTML = `<span>${text}</span>`;
                    return;
                }
                if (text.toLowerCase().includes(query)) {
                    const highlighted = text.replace(new RegExp(query, 'i'), m => `<mark>${m}</mark>`);
                    opt.style.display = '';
                    opt.innerHTML = `<span>${highlighted}</span>`;
                } else {
                    opt.style.display = 'none';
                }
            });
        }, 250);
    });
}

// ----- Service Worker Registration -----
let deferredPWAPrompt = null;

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js?v=79')
            .then(registration => {
                console.log('[SW] Registered successfully');
                
                // Check for updates periodically
                setInterval(() => {
                    registration.update();
                }, 60 * 60 * 1000); // Check every hour
                
                // Listen for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available, show update prompt
                            showUpdateNotification(registration);
                        }
                    });
                });

                // If there's already a waiting service worker (e.g., on reload), prompt immediately
                if (registration.waiting) {
                    showUpdateNotification(registration);
                }
            })
            .catch(err => console.warn('[SW] Registration failed', err));
    }
}

function showUpdateNotification(registration) {
    const updateMsg = document.createElement('div');
    updateMsg.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: #007bff;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10001;
        font-weight: 500;
    `;
    updateMsg.innerHTML = `
        Uusi versio saatavilla! 
        <button style="margin-left: 10px; padding: 4px 12px; background: white; color: #007bff; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
            Päivitä nyt
        </button>
    `;
    
    const reloadOnControllerChange = () => {
        const onControllerChange = () => {
            navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
            // Give the new SW a tick to take over, then reload
            setTimeout(() => window.location.reload(), 50);
        };
        navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    };

    updateMsg.querySelector('button').addEventListener('click', () => {
        try {
            if (registration && registration.waiting) {
                // Ask the waiting SW to activate immediately
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                reloadOnControllerChange();
            } else {
                // Fallback: force a reload
                window.location.reload();
            }
        } catch (_) {
            window.location.reload();
        }
    });
    
    document.body.appendChild(updateMsg);
}

// PWA Install Prompt
function initPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPWAPrompt = e;
        
        // Show install button if user is authenticated
        if (isAuthenticated) {
            showPWAInstallButton();
        }
    });
    
    // Track successful installs
    window.addEventListener('appinstalled', () => {
        console.log('[PWA] App installed successfully');
        deferredPWAPrompt = null;
        hidePWAInstallButton();
    });
}

function showPWAInstallButton() {
    // Check if button already exists
    if (document.getElementById('pwaInstallBtn')) return;
    
    const installBtn = document.createElement('button');
    installBtn.id = 'pwaInstallBtn';
    installBtn.innerHTML = '📲 Asenna sovellus';
    installBtn.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        box-shadow: 0 4px 12px rgba(0,123,255,0.3);
        z-index: 1000;
        transition: all 0.3s ease;
    `;
    
    installBtn.addEventListener('click', async () => {
        if (!deferredPWAPrompt) return;
        
        deferredPWAPrompt.prompt();
        const { outcome } = await deferredPWAPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);
        
        deferredPWAPrompt = null;
        hidePWAInstallButton();
    });
    
    installBtn.addEventListener('mouseenter', () => {
        installBtn.style.transform = 'scale(1.05)';
        installBtn.style.boxShadow = '0 6px 16px rgba(0,123,255,0.4)';
    });
    
    installBtn.addEventListener('mouseleave', () => {
        installBtn.style.transform = 'scale(1)';
        installBtn.style.boxShadow = '0 4px 12px rgba(0,123,255,0.3)';
    });
    
    document.body.appendChild(installBtn);
}

function hidePWAInstallButton() {
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) {
        btn.style.opacity = '0';
        setTimeout(() => btn.remove(), 300);
    }
}

// Run enhancements after DOMContentLoaded (choose last listener for consolidation)
document.addEventListener('DOMContentLoaded', () => {
    initTabsAccessibility();
    initJumpNextUndelivered();
    initCircuitSearchEnhancements();
    registerServiceWorker();
    initPWAInstallPrompt();
});

function showLoginScreen() {
    console.log('showLoginScreen called');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const loginError = document.getElementById('loginError');
    
    console.log('loginScreen element:', loginScreen);
    console.log('mainApp element:', mainApp);
    
    // Clear login error text immediately
    if (loginError) {
        loginError.textContent = '';
        loginError.style.display = 'none';
    }
    
    if (loginScreen && mainApp) {
        loginScreen.style.display = 'flex';
        loginScreen.style.visibility = 'visible';
        loginScreen.style.opacity = '1';
        mainApp.style.display = 'none';
        
        // Reset login button state
        const loginButton = document.querySelector('.phone-login-button');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Kirjaudu sisään';
        }
        
        // Verify the styles were applied
        setTimeout(() => {
            const loginScreenComputed = window.getComputedStyle(loginScreen).display;
            const mainAppComputed = window.getComputedStyle(mainApp).display;
            const loginScreenVisibility = window.getComputedStyle(loginScreen).visibility;
            const loginScreenOpacity = window.getComputedStyle(loginScreen).opacity;
            console.log('After setting - loginScreen computed display:', loginScreenComputed);
            console.log('After setting - loginScreen visibility:', loginScreenVisibility);
            console.log('After setting - loginScreen opacity:', loginScreenOpacity);
            console.log('After setting - mainApp computed display:', mainAppComputed);
        }, 100);
        
        console.log('Login screen should now be visible');
    } else {
        console.error('Login screen or main app element not found!');
    }
}

async function handleLogout() {
    console.log('handleLogout called');
    try {
        await window.mailiaAPI.logout();
        console.log('API logout completed');
        
        // Clear local state
        isAuthenticated = false;
        userRole = null;
        currentCircuit = null;
        allData = {};
        
        // Clear user role and current circuit from storage
        sessionStorage.removeItem('mailiaUserRole');
        localStorage.removeItem('currentCircuit');
        
        // Show login screen
        showLoginScreen();
        
        // Reset form
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('loginError');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (loginError) loginError.style.display = 'none';
        
        // Reset login button state
        const loginButton = document.querySelector('.phone-login-button');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Kirjaudu sisään';
        }
        
        // Remove zoom-transition class if it exists
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.classList.remove('zoom-transition');
        }
        
        console.log('Logged out successfully');
    } catch (error) {
        console.error('Logout error:', error);
        // Force show login screen even if logout fails
        showLoginScreen();
        
        // Reset login button state in case of error
        const loginButton = document.querySelector('.phone-login-button');
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Kirjaudu sisään';
        }
        
        // Remove zoom-transition class if it exists
        const loginScreen = document.getElementById('loginScreen');
        if (loginScreen) {
            loginScreen.classList.remove('zoom-transition');
        }
    }
}

// Animation constants
const ANIMATION_DURATION_MS = 500; // Must match CSS transition duration

// Custom confirm dialog to match app theme
function customConfirm(message, clickEvent = null) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customConfirmDialog');
        const messageEl = document.getElementById('customConfirmMessage');
        const okBtn = document.getElementById('customConfirmOk');
        const cancelBtn = document.getElementById('customConfirmCancel');
        
        messageEl.textContent = message;
        dialog.style.display = 'flex';
        
        // Always use fixed positioning for dialogs to keep them visible on screen
        const dialogContent = dialog.querySelector('.custom-dialog-content');
        dialogContent.style.position = 'fixed';
        
        // Position dialog near the click location if provided
        if (clickEvent && clickEvent.target) {
            const circuitItem = clickEvent.target.closest('.circuit-item');
            if (circuitItem) {
                const rect = circuitItem.getBoundingClientRect();
                
                // Position dialog in the center of the viewport vertically, but keep it visible
                // Use fixed positioning so it stays in view even when scrolling
                const viewportHeight = window.innerHeight;
                const dialogHeight = 200; // Approximate dialog height
                
                // Try to position near the circuit item, but ensure it's visible
                let top = rect.top + rect.height / 2;
                
                // Adjust if too close to top or bottom of viewport
                if (top < dialogHeight / 2) {
                    top = dialogHeight / 2 + 20;
                } else if (top > viewportHeight - dialogHeight / 2) {
                    top = viewportHeight - dialogHeight / 2 - 20;
                }
                
                dialogContent.style.top = `${top}px`;
                dialogContent.style.left = '50%';
                dialogContent.style.transform = 'translate(-50%, -50%)';
            } else {
                // Fallback to center if circuit-item not found
                dialogContent.style.top = '50%';
                dialogContent.style.left = '50%';
                dialogContent.style.transform = 'translate(-50%, -50%)';
            }
        } else {
            // Center positioning for non-positioned dialogs
            dialogContent.style.top = '50%';
            dialogContent.style.left = '50%';
            dialogContent.style.transform = 'translate(-50%, -50%)';
        }
        
        const handleOk = () => {
            dialog.style.display = 'none';
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };
        
        const handleCancel = () => {
            dialog.style.display = 'none';
            okBtn.removeEventListener('click', handleOk);
            cancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };
        
        okBtn.addEventListener('click', handleOk);
        cancelBtn.addEventListener('click', handleCancel);
    });
}

// Circuit file mapping for lazy loading
const circuitFiles = {
    'KP2': 'KP2 DATA.csv',
    'KP3': 'KP3 DATA.csv',
    'KP4': 'KP4 DATA.csv',
    'KP7': 'KP7 DATA.csv',
    'KP9': 'KP9 DATA.csv',
    'KP10': 'KP10 DATA.csv',
    'KP11': 'KP11 DATA.csv',
    'KP12': 'KP12 DATA.csv',
    'KP13': 'kp13.csv',
    'KP15': 'KP15 DATA.csv',
    'KP16': 'KP16 DATA.csv',
    'KP16B': 'KP16B DATA.csv',
    'KP18': 'KP18 DATA.csv',
    'KP19': 'KP19 DATA.csv',
    'KP21B': 'KP21B DATA.csv',
    'KP22': 'KP22 DATA.csv',
    'KP24': 'KP24 DATA.csv',
    'KP25': 'KP25 DATA.csv',
    'KP26': 'KP26 DATA.csv',
    'KP27': 'KP27 DATA.csv',
    'KP28': 'K28 DATA.csv',
    'KP31': 'KP31 DATA.csv',
    'KP32A': 'KP32A DATA.csv',
    'KP32B': 'KP32B DATA.csv',
    'KP33': 'KP33 DATA.csv',
    'KP34': 'KP34 DATA.csv',
    'KP36': 'KP36 DATA.csv',
    'KP37': 'KP37 DATA.csv',
    'KP38': 'KP38 DATA.csv',
    'KP39': 'KP39 DATA.csv',
    'KP40': 'KP40 DATA.csv',
    'KP41': 'KP41 DATA.csv',
    'KP42': 'KP42 DATA.csv',
    'KP43B': 'KP43B DATA.csv',
    'KP44': 'kp44.csv',
    'KP46': 'KP46 DATA.csv',
    'KP47': 'KP47 DATA.csv',
    'KP48': 'KP48 DATA.csv',
    'KP49': 'KP49 DATA.csv',
    'KP51': 'KP51 DATA.csv',
    'KP53': 'KP53 DATA.csv',
    'KP54': 'KP54 DATA.csv',
    'KP55A': 'KP55A DATA.csv',
    'KP55B': 'KP55B DATA.csv',
    'KPR1': 'kp r1.csv',
    'KPR2': 'KP R2 DATA.csv',
    'KPR3': 'KP R3 DATA.csv',
    'KPR4': 'KP R4 DATA.csv',
    'KPR5': 'kpr5.csv',
    'KPR6': 'kpr6.csv'
};

// Circuit names mapping
const circuitNames = {
    'KP2': 'KP2',
    'KP3': 'KP3',
    'KP4': 'KP4',
    'KP7': 'KP7',
    'KP9': 'KP9',
    'KP10': 'KP10',
    'KP11': 'KP11',
    'KP12': 'KP12',
    'KP13': 'KP13',
    'KP15': 'KP15',
    'KP16': 'KP16',
    'KP16B': 'KP16B',
    'KP18': 'KP18',
    'KP19': 'KP19',
    'KP21B': 'KP21B',
    'KP22': 'KP22',
    'KP24': 'KP24',
    'KP25': 'KP25',
    'KP26': 'KP26',
    'KP27': 'KP27',
    'KP28': 'KP28',
    'KP31': 'KP31',
    'KP32A': 'KP32A',
    'KP32B': 'KP32B',
    'KP33': 'KP33',
    'KP34': 'KP34',
    'KP36': 'KP36',
    'KP37': 'KP37',
    'KP38': 'KP38',
    'KP39': 'KP39',
    'KP40': 'KP40',
    'KP41': 'KP41',
    'KP42': 'KP42',
    'KP43B': 'KP43B',
    'KP44': 'KP44',
    'KP46': 'KP46',
    'KP47': 'KP47',
    'KP48': 'KP48',
    'KP49': 'KP49',
    'KP51': 'KP51',
    'KP53': 'KP53',
    'KP54': 'KP54',
    'KP55A': 'KP55A',
    'KP55B': 'KP55B',
    'KPR1': 'KPR1',
    'KPR2': 'KPR2',
    'KPR3': 'KPR3',
    'KPR4': 'KPR4',
    'KPR5': 'KPR5',
    'KPR6': 'KPR6'
};

// Initialize the app
// Weather widget functionality
async function initializeWeatherWidget() {
    const weatherWidget = document.getElementById('weatherWidget');
    if (!weatherWidget) return;
    
    // iOS-style weather icon SVGs
    const weatherIcons = {
        sunny: `<circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`,
        partlyCloudy: `<circle cx="12" cy="12" r="4"></circle>
                       <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3"></path>
                       <path d="M20 17H8.5a3.5 3.5 0 1 1 0-7c.96 0 1.82.41 2.42 1.06"></path>`,
        cloudy: `<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>`,
        rainy: `<line x1="16" y1="13" x2="16" y2="21"></line>
                <line x1="8" y1="13" x2="8" y2="21"></line>
                <line x1="12" y1="15" x2="12" y2="23"></line>
                <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path>`,
        snow: `<path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"></path>
               <line x1="8" y1="16" x2="8" y2="16"></line>
               <line x1="8" y1="20" x2="8" y2="20"></line>
               <line x1="12" y1="18" x2="12" y2="18"></line>
               <line x1="12" y1="22" x2="12" y2="22"></line>
               <line x1="16" y1="16" x2="16" y2="16"></line>
               <line x1="16" y1="20" x2="16" y2="20"></line>`
    };
    
    const iconSvg = weatherWidget.querySelector('.weather-icon');
    const tempSpan = weatherWidget.querySelector('.weather-temp');
    
    // Function to update weather display
    function updateWeatherDisplay(temp, condition) {
        if (iconSvg && tempSpan) {
            let iconKey = 'sunny';
            
            // Map weather conditions to icon types
            if (condition.includes('clear') || condition.includes('sunny')) {
                iconKey = 'sunny';
            } else if (condition.includes('cloud') && (condition.includes('partly') || condition.includes('few'))) {
                iconKey = 'partlyCloudy';
            } else if (condition.includes('cloud') || condition.includes('overcast')) {
                iconKey = 'cloudy';
            } else if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
                iconKey = 'rainy';
            } else if (condition.includes('snow') || condition.includes('sleet')) {
                iconKey = 'snow';
            }
            
            iconSvg.innerHTML = weatherIcons[iconKey];
            tempSpan.textContent = `${Math.round(temp)}°C`;
        }
    }
    
    // Try to get user's location and fetch weather
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                try {
                    // Using Open-Meteo API (free, no API key required)
                    const response = await fetch(
                        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`
                    );
                    
                    if (response.ok) {
                        const data = await response.json();
                        const temp = data.current.temperature_2m;
                        const weatherCode = data.current.weather_code;
                        
                        // Map WMO weather codes to conditions
                        let condition = 'clear';
                        if (weatherCode === 0) condition = 'clear';
                        else if ([1, 2].includes(weatherCode)) condition = 'partly cloudy';
                        else if (weatherCode === 3) condition = 'overcast';
                        else if ([45, 48].includes(weatherCode)) condition = 'fog';
                        else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) condition = 'rain';
                        else if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) condition = 'snow';
                        else if ([95, 96, 99].includes(weatherCode)) condition = 'thunderstorm';
                        
                        updateWeatherDisplay(temp, condition);
                    } else {
                        throw new Error('Weather API response not ok');
                    }
                } catch (error) {
                    console.warn('Failed to fetch weather data:', error);
                    // Fall back to time-based simulation
                    useFallbackWeather();
                }
            },
            (error) => {
                console.warn('Geolocation error:', error);
                // Fall back to time-based simulation
                useFallbackWeather();
            },
            {
                timeout: 5000,
                maximumAge: 300000 // Cache position for 5 minutes
            }
        );
    } else {
        // Geolocation not supported, use fallback
        useFallbackWeather();
    }
    
    // Fallback weather based on time of day
    function useFallbackWeather() {
        const hour = new Date().getHours();
        let temp = 20;
        let condition = 'clear';
        
        if (hour >= 6 && hour < 12) {
            temp = 22;
            condition = 'clear';
        } else if (hour >= 12 && hour < 18) {
            temp = 18;
            condition = 'partly cloudy';
        } else if (hour >= 18 && hour < 21) {
            temp = 15;
            condition = 'cloudy';
        } else {
            temp = 12;
            condition = 'rain';
        }
        
        updateWeatherDisplay(temp, condition);
    }
}

// Phone theme toggle functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Load checkbox visibility preference
    loadCheckboxVisibility();
    
    // Setup password toggle
    initializePasswordToggle();
    
    // Initialize swipe-up gesture for login form
    initializeSwipeUpLogin();
    
    // Initialize dark mode (works on login screen too)
    initializeDarkMode();
    
    // Initialize phone status bar with real-time updates
    initializePhoneStatusBar();
    
    // Update notification time to show current device time
    updateNotificationTime();
    
    // Initialize weather widget on phone screen
    initializeWeatherWidget();
    
    // Initialize stamp animation
    initializeLogoAnimation();
    initAdminDuplicatesUI();
});

// Logo Animation - Simple fade in (no stamp animation needed)
function initializeLogoAnimation() {
    // Logo fades in automatically via CSS animation
    // No JavaScript needed for the logo
}

// Authentication - now handled by backend via API
function checkAuthentication() {
    // Backend authentication is handled in the DOMContentLoaded event at the top of the file
    // This function is kept for compatibility but does nothing
}

// Password visibility toggle - keep this for UX
function initializePasswordToggle() {
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');
    
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type');
            const svg = passwordToggle.querySelector('svg');
            if (type === 'password') {
                passwordInput.setAttribute('type', 'text');
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
                passwordToggle.setAttribute('aria-label', 'Hide password');
            } else {
                passwordInput.setAttribute('type', 'password');
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
                passwordToggle.setAttribute('aria-label', 'Show password');
            }
        });
    }
}

// No swipe/tap login needed - phone UI is always visible
function initializeSwipeUpLogin() {
    // Phone-based login is always visible, no initialization needed
}

// Initialize Phone Status Bar with Real-Time Updates
function initializePhoneStatusBar() {
    updateStatusTime();
    updateBatteryStatus();
    
    // Update time every second
    setInterval(updateStatusTime, 1000);
    
    // Update battery every minute
    setInterval(updateBatteryStatus, 60000);
}

function updateStatusTime() {
    const timeElement = document.getElementById('statusTime');
    if (!timeElement) return;
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    timeElement.textContent = `${hours}:${minutes}`;
}

function updateBatteryStatus() {
    const batteryPercent = document.getElementById('batteryPercent');
    const batteryIcon = document.querySelector('.battery-icon');
    if (!batteryPercent || !batteryIcon) return;
    
    // Check if Battery Status API is available
    if ('getBattery' in navigator) {
        navigator.getBattery().then(battery => {
            const level = Math.round(battery.level * 100);
            const charging = battery.charging;
            
            batteryPercent.textContent = `${level}%`;
            
            // Change icon stroke color based on battery level and charging state
            if (charging) {
                batteryIcon.style.stroke = '#4A90E2'; // Blue when charging
            } else if (level <= 20) {
                batteryIcon.style.stroke = '#E07856'; // Red when low
            } else {
                batteryIcon.style.stroke = 'currentColor'; // Default
            }
        });
    } else {
        batteryPercent.textContent = '100%';
    }
}

// Checkbox visibility functions
function loadCheckboxVisibility() {
    const saved = localStorage.getItem('mailiaShowCheckboxes');
    showCheckboxes = saved === 'true';
}

function saveCheckboxVisibility(visible) {
    showCheckboxes = visible;
    localStorage.setItem('mailiaShowCheckboxes', visible.toString());
}

function toggleCheckboxVisibility(visible) {
    saveCheckboxVisibility(visible);
    updateCheckboxVisibility();
}

function updateCheckboxVisibility() {
    const cards = document.querySelectorAll('.subscriber-card');
    cards.forEach(card => {
        if (showCheckboxes) {
            card.classList.add('show-checkboxes');
        } else {
            card.classList.remove('show-checkboxes');
        }
    });
}


async function showMainApp() {
    try {
        // Update UI with user info
        const user = window.mailiaAPI.getCurrentUser();
        if (user) {
            console.log('Logged in as:', user.username, 'Role:', user.role);
            userRole = user.role;
            isAuthenticated = true;
        // Save user role to sessionStorage for access in other functions
        sessionStorage.setItem('mailiaUserRole', user.role);
    }

    if (window.mailiaAPI) {
        window.mailiaAPI.connectWebSocket();
    }
    initializeWebSocketListeners();
    
    // Start the phone rise up transition animation
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    // Add rise up transition class
    loginScreen.classList.add('zoom-transition');
    
    // Show main app and start slide-up animation from bottom
    setTimeout(() => {
        mainApp.style.display = 'block';
        mainApp.classList.add('zoom-in');
    }, 300);
    
    // Hide login screen completely after animation
    setTimeout(() => {
        loginScreen.style.display = 'none';
    }, 1500);
    
    // Initialize dark mode toggle now that main app is visible
    initializeDarkMode();
    
    // Initialize logout button
    initializeLogout();
    
    // Initialize settings dropdown
    initializeSettings();
    
    // Initialize the main application
    initializeTabs();
    initializeRefreshButtons();
    initializeMidnightReset();
    await loadData();
    await populateCircuitSelector(); // Wait for circuits to load from backend
    
    // Restore previously selected circuit after page refresh
    const savedCircuit = localStorage.getItem('currentCircuit');
    if (savedCircuit) {
        console.log('Restoring circuit after page refresh:', savedCircuit);
        try {
            // Update the circuit selector display
            const display = document.getElementById('circuitSelectDisplay');
            const displayText = display?.querySelector('.circuit-display-text');
            if (displayText) {
                displayText.textContent = circuitNames[savedCircuit] || savedCircuit;
            }
            // Load the circuit data
            await loadCircuit(savedCircuit);
        } catch (error) {
            console.error('Failed to restore circuit:', error);
            // Clear invalid circuit from storage
            localStorage.removeItem('currentCircuit');
        }
    }
    
    initializeCircuitTracker();
    initializeEventListeners();
    loadFavorites();
    checkMidnightReset();
    scheduleMidnightReset();
    
    // Initialize geolocation for weather
    getLocationWeather();
    
    // Initialize offline mode for background sync and conflict resolution
    await initializeOfflineMode();
    
    // Set initial view based on user role
    const role = getEffectiveUserRole();
    const circuitSelectorContainer = document.querySelector('.circuit-selector-container');
    
    // Initialize dashboard if user is admin or manager
    if (role === 'admin' || role === 'manager') {
        initializeDashboard();
        // Reveal admin duplicates button
        const btn = document.getElementById('adminDuplicatesBtn');
        if (btn) btn.hidden = false;
        // Check overlaps and toggle alert if needed
        refreshAdminOverlapIndicator();
    }
    
    // Show/hide admin-only tabs based on role
    const adminTabs = document.querySelectorAll('.tab-button.admin-only');
    if (role === 'admin' || role === 'manager') {
        // Show all admin tabs
        adminTabs.forEach(tab => {
            tab.style.display = '';
        });
    } else {
        // Hide admin tabs for regular users
        adminTabs.forEach(tab => {
            tab.style.display = 'none';
        });
    }
    
    if (role === 'admin' || role === 'manager') {
        // Admin/Manager: Show tracker tab by default
        const deliveryTab = document.getElementById('deliveryTab');
        const trackerTab = document.getElementById('trackerTab');
        const deliveryButton = document.querySelector('[data-tab="delivery"]');
        const trackerButton = document.querySelector('[data-tab="tracker"]');
        
        // Switch from delivery to tracker
        if (deliveryTab) deliveryTab.classList.remove('active');
        if (trackerTab) trackerTab.classList.add('active');
        if (deliveryButton) deliveryButton.classList.remove('active');
        if (trackerButton) trackerButton.classList.add('active');
        
        // Hide circuit selector for tracker view
        if (circuitSelectorContainer) circuitSelectorContainer.style.display = 'none';
        
        // Render tracker
        renderCircuitTracker();
    } else {
        // Regular driver: Show delivery tab (already active by default)
        if (circuitSelectorContainer) circuitSelectorContainer.style.display = 'block';
    }
    } catch (error) {
        console.error('Error in showMainApp:', error);
        // If showMainApp fails, show login screen
        showLoginScreen();
        throw error; // Re-throw to let caller know it failed
    }
}

// Dark Mode
function initializeDarkMode() {
    // Default to dark mode if no preference is set
    // Theme system - supports light, dark, high-contrast, and sepia
    const savedTheme = localStorage.getItem('theme');
    const defaultTheme = 'dark';
    const currentTheme = savedTheme || defaultTheme;
    
    // Apply theme to body
    applyTheme(currentTheme);
    
    // Save the default if not set
    if (!savedTheme) {
        localStorage.setItem('theme', defaultTheme);
    }

    // Only setup theme selector if user is authenticated
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector && isAuthenticated) {
        // Set initial value
        themeSelector.value = currentTheme;
        
        // Listen for changes
        themeSelector.addEventListener('change', (e) => {
            const newTheme = e.target.value;
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            triggerHaptic('light');
        });
    }
    
    // Legacy dark mode toggle - now controls theme selector
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle && isAuthenticated) {
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode') ||
                          document.body.classList.contains('high-contrast') ||
                          document.body.classList.contains('sepia');
            const newTheme = isDark ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
            if (themeSelector) themeSelector.value = newTheme;
            triggerHaptic('light');
        });
    }
}

/**
 * Apply theme to body element
 * @param {string} theme - Theme name: 'light', 'dark', 'high-contrast', or 'sepia'
 */
function applyTheme(theme) {
    // Remove all theme classes
    document.body.classList.remove('dark-mode', 'high-contrast', 'sepia');
    
    // Apply new theme class
    switch(theme) {
        case 'dark':
            document.body.classList.add('dark-mode');
            break;
        case 'high-contrast':
            document.body.classList.add('high-contrast');
            break;
        case 'sepia':
            document.body.classList.add('sepia');
            break;
        case 'light':
        default:
            // Light mode = no class
            break;
    }
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        const themeColors = {
            'light': '#FAFAFA',
            'dark': '#1A1D21',
            'high-contrast': '#000000',
            'sepia': '#F4ECD8'
        };
        metaThemeColor.setAttribute('content', themeColors[theme] || themeColors.dark);
    }
}

// Settings
function initializeSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const settingsContainer = document.querySelector('.settings-container');
    const showCheckboxesToggle = document.getElementById('showCheckboxesToggle');
    
    if (settingsBtn && settingsDropdown && settingsContainer) {
        // Toggle dropdown when settings button is clicked
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            settingsDropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!settingsContainer.contains(e.target)) {
                settingsDropdown.classList.remove('show');
            }
        });
        
        // Prevent dropdown from closing when clicking inside it
        settingsDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Initialize checkbox toggle
        if (showCheckboxesToggle) {
            showCheckboxesToggle.checked = showCheckboxes;
            showCheckboxesToggle.addEventListener('change', (e) => {
                toggleCheckboxVisibility(e.target.checked);
            });
        }
    }
}

// Logout
function initializeLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Remove any existing listeners
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        
        // Add the logout handler
        newLogoutBtn.addEventListener('click', async () => {
            await handleLogout();
        });
    }
}

// Tab Navigation
let tabsInitialized = false;

function initializeTabs() {
    if (tabsInitialized) {
        console.log('Tabs already initialized, skipping...');
        return;
    }
    tabsInitialized = true;
    
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Show/hide tabs based on user role
    const jakeluButton = document.querySelector('[data-tab="delivery"]');
    const seurantaButton = document.querySelector('[data-tab="tracker"]');
    const messagesButton = document.querySelector('[data-tab="messages"]');
    const dashboardButton = document.querySelector('[data-tab="dashboard"]');
    
    if (userRole === 'admin' || userRole === 'manager') {
        // Admin/Manager sees all tabs: Jakelu, Seuranta, Reittiviestit, and Raportit
        if (jakeluButton) jakeluButton.style.display = 'inline-block';
        if (seurantaButton) seurantaButton.style.display = 'inline-block';
        if (messagesButton) messagesButton.style.display = 'inline-block';
        if (dashboardButton) dashboardButton.style.display = 'inline-block';
    } else {
        // Driver: Only delivery tab visible
        if (jakeluButton) jakeluButton.style.display = 'inline-block';
        if (seurantaButton) seurantaButton.style.display = 'none';
        if (messagesButton) messagesButton.style.display = 'none';
        if (dashboardButton) dashboardButton.style.display = 'none';
    }

    // Default active tab selection based on role
    if (userRole === 'admin' || userRole === 'manager') {
        if (seurantaButton) seurantaButton.click(); // tracker default
    } else {
        if (jakeluButton) jakeluButton.click(); // delivery default
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            
            // Show/hide circuit selector based on tab
            const circuitSelectorContainer = document.querySelector('.circuit-selector-container');
            if (circuitSelectorContainer) {
                if (targetTab === 'delivery') {
                    circuitSelectorContainer.style.display = 'block';
                } else {
                    circuitSelectorContainer.style.display = 'none';
                }
            }
            
            // Determine which tab content to show
            let tabContent;
            if (targetTab === 'delivery') {
                tabContent = document.getElementById('deliveryTab');
            } else if (targetTab === 'tracker') {
                tabContent = document.getElementById('trackerTab');
                renderCircuitTracker();
            } else if (targetTab === 'messages') {
                tabContent = document.getElementById('messagesTab');
                renderRouteMessages();
            } else if (targetTab === 'dashboard') {
                tabContent = document.getElementById('dashboardTab');
                // Refresh dashboard data when tab is opened
                if (typeof loadTodayDeliveryCount === 'function') {
                    loadTodayDeliveryCount();
                }
                if (typeof loadPeriodDeliveryCount === 'function') {
                    loadPeriodDeliveryCount();
                }
            }
            
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

// Track if refresh buttons have been initialized to prevent duplicate listeners
let refreshButtonsInitialized = false;

// Initialize refresh buttons for Seuranta and Messages tabs
function initializeRefreshButtons() {
    if (refreshButtonsInitialized) {
        console.log('Refresh buttons already initialized, skipping...');
        return;
    }
    refreshButtonsInitialized = true;
    
    // Tracker refresh button - hard refresh while keeping user logged in
    const refreshTrackerBtn = document.getElementById('refreshTrackerBtn');
    if (refreshTrackerBtn) {
        refreshTrackerBtn.addEventListener('click', async () => {
            console.log('Hard refreshing tracker (clearing cache)...');
            refreshTrackerBtn.classList.add('refreshing');
            refreshTrackerBtn.disabled = true;
            
            try {
                // Clear the circuit data cache to force re-fetch from backend
                Object.keys(allData).forEach(key => delete allData[key]);
                
                // Force re-render of tracker with fresh data
                isRenderingTracker = false; // Reset the render lock
                await renderCircuitTracker();
                showNotification('Seuranta päivitetty', 'success');
            } catch (error) {
                console.error('Error refreshing tracker:', error);
                showNotification('Päivitys epäonnistui', 'error');
            } finally {
                setTimeout(() => {
                    refreshTrackerBtn.classList.remove('refreshing');
                    refreshTrackerBtn.disabled = false;
                }, 500);
            }
        });
    }

    // Messages refresh button - hard refresh
    const refreshMessagesBtn = document.getElementById('refreshMessagesBtn');
    if (refreshMessagesBtn) {
        refreshMessagesBtn.addEventListener('click', async () => {
            console.log('Hard refreshing messages (clearing cache)...');
            refreshMessagesBtn.classList.add('refreshing');
            refreshMessagesBtn.disabled = true;
            
            try {
                // Force re-render of messages with fresh data from API
                await renderRouteMessages();
                showNotification('Viestit päivitetty', 'success');
            } catch (error) {
                console.error('Error refreshing messages:', error);
                showNotification('Päivitys epäonnistui', 'error');
            } finally {
                setTimeout(() => {
                    refreshMessagesBtn.classList.remove('refreshing');
                    refreshMessagesBtn.disabled = false;
                }, 500);
            }
        });
    }

    // Clear all messages button
    const clearAllMessagesBtn = document.getElementById('clearAllMessagesBtn');
    if (clearAllMessagesBtn) {
        console.log('Initializing clear all messages button');
        clearAllMessagesBtn.addEventListener('click', async () => {
            console.log('Clear all messages button clicked');
            
            // Prevent multiple clicks
            if (clearAllMessagesBtn.disabled) {
                console.log('Button already disabled, ignoring click');
                return;
            }
            
            try {
                setLoading(clearAllMessagesBtn, true);
                
                const messages = await window.mailiaAPI.getTodayMessages();
                const storedLocalMessages = loadRouteMessages();
                const totalMessages = messages.length + storedLocalMessages.length;

                if (totalMessages === 0) {
                    showNotification('Ei viestejä tyhjennettävänä', 'info');
                    setLoading(clearAllMessagesBtn, false);
                    return;
                }

                // Re-enable button before showing modal
                setLoading(clearAllMessagesBtn, false);

                // Use custom modal instead of confirm
                createModal({
                    title: 'Tyhjennä kaikki viestit',
                    bodyHTML: `<p style="margin: 0;">Haluatko varmasti tyhjentää kaikki ${totalMessages} viestiä?</p>`,
                    ariaLabel: 'Vahvista viestien tyhjennys',
                    actions: [
                        {
                            label: 'Peruuta',
                            variant: 'secondary',
                            handler: ({ close }) => close()
                        },
                        {
                            label: 'Tyhjennä',
                            variant: 'primary',
                            handler: async ({ close }) => {
                                console.log('Clearing messages...');
                                const confirmBtn = document.querySelector('#clearAllMessagesBtn');
                                
                                try {
                                    // Delete all backend messages
                                    if (messages.length > 0) {
                                        const deletePromises = messages.map(msg => 
                                            window.mailiaAPI.deleteMessage(msg.id)
                                        );
                                        const results = await Promise.allSettled(deletePromises);
                                        
                                        // Check if any deletions failed
                                        const failures = results.filter(r => r.status === 'rejected');
                                        if (failures.length > 0) {
                                            console.error('Some message deletions failed:', failures);
                                        }
                                    }

                                    // Clear offline messages
                                    localStorage.removeItem('mailiaRouteMessages');
                                    // Also clear in-memory cache
                                    routeMessages = [];

                                    // Clear the UI immediately before refreshing
                                    const messagesContainer = document.getElementById('routeMessages');
                                    if (messagesContainer) {
                                        messagesContainer.innerHTML = '';
                                    }

                                    showNotification(`${totalMessages} viestiä tyhjennetty`, 'success');
                                    
                                    // Wait a moment for backend to process deletions, then refresh
                                    await new Promise(resolve => setTimeout(resolve, 300));
                                    await renderRouteMessages();
                                    close();
                                } catch (error) {
                                    console.error('Error clearing messages:', error);
                                    showNotification('Viestien tyhjennys epäonnistui', 'error');
                                }
                            }
                        }
                    ]
                });
            } catch (error) {
                console.error('Error loading messages for clear:', error);
                showNotification('Virhe ladattaessa viestejä', 'error');
                setLoading(clearAllMessagesBtn, false);
            }
        });
    } else {
        console.error('clearAllMessagesBtn not found in DOM');
    }

    // Auto-refresh tracker every 30 seconds if tab is active
    setInterval(() => {
        const trackerTab = document.getElementById('trackerTab');
        if (trackerTab && trackerTab.classList.contains('active')) {
            console.log('Auto-refreshing tracker...');
            renderCircuitTracker();
        }
    }, 30000);

    // Auto-refresh messages every 30 seconds if tab is active
    setInterval(() => {
        const messagesTab = document.getElementById('messagesTab');
        if (messagesTab && messagesTab.classList.contains('active')) {
            console.log('Auto-refreshing messages...');
            renderRouteMessages();
        }
    }, 30000);
}

// Midnight reset for messages
let midnightResetInitialized = false;
let midnightCheckInterval = null;

function initializeMidnightReset() {
    if (midnightResetInitialized) {
        console.log('Midnight reset already initialized, skipping...');
        return;
    }
    midnightResetInitialized = true;
    
    const checkMidnight = () => {
        const now = new Date();
        const lastCheck = localStorage.getItem('mailiaLastMidnightCheck');
        const today = now.toDateString();
        
        if (lastCheck !== today) {
            console.log('Midnight passed - clearing messages');
            
            // Clear offline messages
            localStorage.removeItem('mailiaRouteMessages');
            
            // Re-render messages (will be empty or fetch new day's messages)
            if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
                renderRouteMessages();
            }
            
            // Update last check
            localStorage.setItem('mailiaLastMidnightCheck', today);
        }
    };
    
    // Check on initialization
    checkMidnight();
    
    // Check every minute
    midnightCheckInterval = setInterval(checkMidnight, 60000);
}

// Data Loading and Parsing
// No longer needed - circuits are loaded on demand
// Keeping function stub for compatibility
async function loadData() {
    // Data is now loaded lazily when circuit is selected
    // This improves initial page load time significantly
    allData = {};
    console.log('Using lazy loading - circuits will load on demand');
}

function extractCircuitId(filename) {
    // Extract circuit ID from filename
    // Handle special cases:
    // "KP3 DATA.csv" -> "KP3"
    // "KP R2 DATA.csv" -> "KPR2"
    // "K28 DATA.csv" -> "KP28"
    // "kp13.csv" -> "KP13"
    // "kp r1.csv" -> "KPR1"
    // "kpr5.csv" -> "KPR5"
    
    const lower = filename.toLowerCase();
    
    // New format: kp13.csv, kp44.csv, kpr5.csv, kpr6.csv, kp r1.csv
    if (lower.match(/^kp\s*r?\s*\d+[ab]?\.csv$/i)) {
        const match = lower.match(/^kp\s*(r)?\s*(\d+[ab]?)\.csv$/i);
        if (match) {
            const r = match[1] ? 'R' : '';
            const number = match[2].toUpperCase();
            return 'KP' + r + number;
        }
    }
    
    // Old format: "KP3 DATA.csv", "KP R2 DATA.csv", "K28 DATA.csv"
    const match = filename.match(/^(K|KP)\s*(R\s*)?(\d+[AB]?)\s*DATA\.csv$/i);
    if (match) {
        const prefix = match[1] === 'K' ? 'KP' : 'KP';
        const r = match[2] ? 'R' : '';
        const number = match[3];
        return prefix + r + number;
    }
    
    return filename.replace(' DATA.csv', '').replace('.csv', '').replace(/\s+/g, '').toUpperCase();
}

function splitCsvRows(text) {
    const rows = [];
    let insideQuotes = false;
    let current = '';
    const sanitized = text.replace(/\ufeff/g, '');

    for (let i = 0; i < sanitized.length; i++) {
        const char = sanitized[i];
        const nextChar = sanitized[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
                current += char;
            }
        } else if ((char === '\n' || char === '\r') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            if (current.length > 0) {
                rows.push(current.replace(/\r/g, ''));
                current = '';
            }
        } else {
            current += char;
        }
    }

    if (current.length > 0) {
        rows.push(current.replace(/\r/g, ''));
    }

    return rows.filter(row => row.trim().length > 0);
}

function normalizeSubscriberKeyPiece(value) {
    let normalized = String(value || '').replace(/\s+/g, ' ').trim();
    if (typeof normalized.normalize === 'function') {
        normalized = normalized
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }
    return normalized.toUpperCase();
}

function collapseDuplicateSubscribers(subscribers, keyFn) {
    const seen = new Map();
    const order = [];
    const buildKey = typeof keyFn === 'function'
        ? keyFn
        : (sub) => `${normalizeSubscriberKeyPiece(sub.address)}|${normalizeSubscriberKeyPiece(sub.name)}`;

    subscribers.forEach((subscriber, index) => {
        const keyCandidate = buildKey(subscriber, index);
        const key = keyCandidate ? keyCandidate : `__idx-${index}`;

        if (!seen.has(key)) {
            const clone = {
                ...subscriber,
                products: Array.isArray(subscriber.products) ? [...subscriber.products] : []
            };
            if (clone.orderIndex === undefined || clone.orderIndex === null) {
                clone.orderIndex = index;
            }
            seen.set(key, clone);
            order.push(key);
        } else {
            const existing = seen.get(key);
            const mergedProducts = new Set([
                ...(existing.products || []),
                ...(Array.isArray(subscriber.products) ? subscriber.products : [])
            ]);
            existing.products = Array.from(mergedProducts);

            if (subscriber.orderIndex !== undefined && subscriber.orderIndex !== null) {
                if (existing.orderIndex === undefined || existing.orderIndex === null) {
                    existing.orderIndex = subscriber.orderIndex;
                } else {
                    existing.orderIndex = Math.min(existing.orderIndex, subscriber.orderIndex);
                }
            }

            if (!existing.id && subscriber.id) {
                existing.id = subscriber.id;
            }

            if (!existing.buildingAddress && subscriber.buildingAddress) {
                existing.buildingAddress = subscriber.buildingAddress;
            }

            if (!existing.name && subscriber.name) {
                existing.name = subscriber.name;
            }
        }
    });

    return order.map(key => seen.get(key));
}

function tokenizeCsvFields(line, delimiter) {
    const fields = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }

    fields.push(currentField);
    return fields.map(field => field.replace(/\r/g, ''));
}

function parseCircuitCSV(text, filename) {
    const rows = splitCsvRows(text);
    if (!rows.length) {
        return [];
    }

    const subscribers = [];
    const headerRaw = rows[0];
    const header = headerRaw.toLowerCase();
    const isNewFormat = header.includes('katu') && header.includes('osoitenumero');
    const detectedDelimiter = headerRaw.includes(';') && !headerRaw.includes(',') ? ';' : ',';

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.trim()) continue;
        const subscriber = isNewFormat
            ? parseNewFormatCSVLine(row, detectedDelimiter)
            : parseOldFormatCSVLine(row, detectedDelimiter);
        if (subscriber) {
            subscriber.orderIndex = i;
            subscribers.push(subscriber);
        }
    }

    return dedupeParsedSubscribers(subscribers);
}

// Helper function to clean up angle bracket markings from text
function cleanAngleBrackets(text) {
    if (!text) return text;
    // Remove any text within angle brackets (including nested ones)
    // This handles cases like "<2 Ilm>", "<suikkanen Tapio>", "<ovi <pudota >>"
    return text.replace(/<[^>]*>/g, '').trim();
}

function parseOldFormatCSVLine(line, delimiter = ',') {
    const effectiveDelimiter = delimiter || (line.includes(';') ? ';' : ',');
    const fields = tokenizeCsvFields(line, effectiveDelimiter);

    // Handle different CSV formats
    let streetName, houseNumber, name, productsStr;
    
    let address;
    
    if (fields.length >= 5 && fields[0].includes('Sivu')) {
        // Format: "Sivu","Katu","Osoite","Nimi","Merkinnät" (KP2 format)
        // In this format, fields[1] is "Katu" (street name) and fields[2] is "Osoite" (address)
        // Some CSVs have full address in "Osoite", others just have the number
        streetName = fields[1].trim();
        houseNumber = fields[2].trim();
        
        // Check if "Osoite" already contains the street name (like in KP44)
        if (houseNumber.toUpperCase().startsWith(streetName.toUpperCase())) {
            // "Osoite" contains full address, use it as-is
            address = houseNumber;
        } else {
            // "Osoite" is just the number/details, combine with street name
            address = `${streetName} ${houseNumber}`.trim();
        }
        
        name = fields[3].trim();
        productsStr = fields[4].trim();
    } else if (fields.length >= 6) {
        // Format: Katu,Numero,Huom,Asunto,Nimi,Tilaukset (standard format)
        streetName = fields[0].trim();
        houseNumber = fields[1].trim();
        const apartment = fields[3].trim();
        name = fields[4].trim();
        productsStr = fields[5].trim();
        
        // Combine house number with apartment if present
        if (apartment) {
            houseNumber += ' ' + apartment;
        }
        
        // Build full address
        address = `${streetName} ${houseNumber}`.trim();
    } else {
        return null;
    }
    
    // Clean up angle bracket markings from name (e.g., "<2 Ilm> Sihvonen Timo" -> "Sihvonen Timo")
    name = cleanAngleBrackets(name);
    
    // Skip if no address
    if (!address) return null;

    // Fix repeated address artifacts like "SALAMAKUJA 5 SALAMAKUJA 5"
    address = fixRepeatedAddress(address);
    
    // Parse products - handle semicolons, commas, spaces, and UVES
    // First, replace UVES with "UV ES" to split it
    productsStr = productsStr.replace(/UVES/g, 'UV ES');
    
    // Split by semicolons, commas, newlines, and filter
    const rawProducts = productsStr.split(/[;\n,]+/).map(p => p.trim()).filter(p => p);
    
    // Then expand space-separated products (like "ES HSPS" or "UV ES")
    const today = new Date().getDay();
    const products = [];
    rawProducts.forEach(productGroup => {
        // If product contains space, it's a combined product like "ES HSPS" or "UV ES"
        if (productGroup.includes(' ')) {
            // Split by space and add each product
            const spaceSeparated = productGroup.split(/\s+/).map(p => p.trim()).filter(p => p);
            products.push(...spaceSeparated);
        } else {
            // Single product, add as-is
            products.push(productGroup);
        }
    });
    
    return {
        address,
        products,
        name,
        buildingAddress: extractBuildingAddress(address)
    };
}

function parseNewFormatCSVLine(line, delimiter = ',') {
    const fields = tokenizeCsvFields(line, delimiter).map(f => f.trim());

    if (fields.length >= 6) {
        const street = fields[0].trim();
        const number = fields[1].trim();
        const stairwell = fields[2].trim();
        const apartment = fields[3].trim();
        const name = fields[4].trim();
        const productsStr = fields[5].trim();
        
        // Skip if no street or number
        if (!street || !number) return null;

        let address = `${street} ${number}`;
        if (stairwell) address += ` ${stairwell}`;
        if (apartment) address += ` ${apartment}`;

        address = fixRepeatedAddress(address);
        
        // Parse products - extract product codes from brackets
        // Also handle space-separated products like "ES HSPS"
        const productMatches = productsStr.matchAll(/([A-Z]+\d*)/g);
        const rawProducts = Array.from(productMatches, m => m[1]);
        
        // Check if original string had spaces indicating combined products
        const today = new Date().getDay();
        let products = [];
        
        if (productsStr.includes(' ') && rawProducts.length > 1) {
            // This is a combined product string, expand based on day
            const expanded = expandCombinedProducts(productsStr, today);
            products = expanded;
        } else {
            // Regular products, use as-is
            products = rawProducts.length > 0 ? rawProducts : [productsStr.trim()];
        }
        
        return {
            address,
            products,
            name,
            buildingAddress: extractBuildingAddress(address)
        };
    }
    
    return null;
}

function normalizeAddressForDedup(address) {
    if (!address) return '';
    return fixRepeatedAddress(address).toUpperCase().replace(/\s+/g, ' ').trim();
}

function appendDistinctName(list, name) {
    if (!name) return;
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    const exists = list.some(existing => existing.trim().toLowerCase() === normalized);
    if (!exists) {
        list.push(name.trim());
    }
}

function mergeProductLists(target, source) {
    const seen = new Set(target.map(p => p.toUpperCase()));
    source.forEach(product => {
        const normalized = product.toUpperCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            target.push(product);
        }
    });
}

function dedupeParsedSubscribers(subscribers) {
    if (!subscribers.length) return subscribers;

    const byAddress = new Map();
    const order = [];

    subscribers.forEach((subscriber, index) => {
        const key = normalizeAddressForDedup(subscriber.address) || `__NO_ADDRESS__${index}`;

        if (!byAddress.has(key)) {
            const copy = { ...subscriber, products: [...subscriber.products] };
            copy.orderIndex = subscriber.orderIndex ?? index;
            copy._names = [];
            appendDistinctName(copy._names, subscriber.name);
            order.push(key);
            byAddress.set(key, copy);
        } else {
            const existing = byAddress.get(key);
            mergeProductLists(existing.products, subscriber.products || []);
            existing.orderIndex = Math.min(existing.orderIndex, subscriber.orderIndex ?? index);
            appendDistinctName(existing._names, subscriber.name);
        }
    });

    const deduped = order
        .map(key => byAddress.get(key))
        .map(entry => {
            if (entry._names && entry._names.length) {
                entry.name = entry._names.join(' / ');
            }
            delete entry._names;
            return entry;
        })
        .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    return deduped;
}

function extractBuildingAddress(address) {
    // Extract only street name and building number (no staircase/apartment)
    // Examples: "ENSONTIE 33 lii 1" -> "ENSONTIE 33"
    //           "ENSONTIE 45 A 4" -> "ENSONTIE 45"
    //           "PIHATIE 3 C 15" -> "PIHATIE 3"
    const parts = address.split(' ');
    let building = '';
    let foundNumber = false;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Add street name (anything that doesn't start with a digit)
        if (!foundNumber && !/^\d/.test(part)) {
            building += (building ? ' ' : '') + part;
        }
        // Add the first number we encounter (house number) and stop
        else if (!foundNumber && /^\d+$/.test(part)) {
            building += ' ' + part;
            foundNumber = true;
            break; // Stop after house number - don't include staircase or apartment
        }
    }
    
    return building || address;
}

function extractApartmentSpecification(fullAddress, buildingAddress) {
    // Extract the staircase + apartment specification by removing the building part
    // Examples: 
    //   "PIHATIE 3 C 15", "PIHATIE 3" -> "C15"
    //   "KOULUTIE 5 C 20", "KOULUTIE 5" -> "C20"
    //   "PAJUPOLKU 6", "PAJUPOLKU 6" -> "" (no apartment)
    //   "ASEMATIE 14 as 2", "ASEMATIE 14" -> "as 2"
    
    if (!buildingAddress || fullAddress === buildingAddress) {
        return ''; // No apartment specification
    }
    
    // Remove the building address from the full address to get the apartment spec
    let spec = fullAddress.replace(buildingAddress, '').trim();
    
    // Concatenate the parts without spaces for cleaner display (e.g., "C 15" -> "C15")
    // But preserve multi-character codes like "as 2", "lii 1"
    const parts = spec.split(' ');
    if (parts.length === 2) {
        const first = parts[0];
        const second = parts[1];
        // If first part is a single letter, concatenate with number
        if (/^[A-Za-z]$/.test(first) && /^\d+$/.test(second)) {
            spec = first.toUpperCase() + second;
        }
    }
    
    return spec;
}

// Collapse accidental repeated address like "SALAMAKUJA 5 SALAMAKUJA 5"
function fixRepeatedAddress(address) {
    if (!address) return address;
    const a = address.trim().replace(/\s+/g, ' ');
    const words = a.split(' ');
    // Only attempt if there are at least 4 tokens and an even count
    if (words.length >= 4 && words.length % 2 === 0) {
        const half = words.length / 2;
        const first = words.slice(0, half).join(' ');
        const second = words.slice(half).join(' ');
        if (first.toUpperCase() === second.toUpperCase()) {
            return first;
        }
    }
    // Also collapse duplicated street token at start e.g. "PILVIKUJA PILVIKUJA 5 B 6" -> "PILVIKUJA 5 B 6"
    const streetDupMatch = a.match(/^([A-ZÅÄÖ]+)\s+\1\s+(.*)$/i);
    if (streetDupMatch) {
        return `${streetDupMatch[1]} ${streetDupMatch[2]}`.trim();
    }
    return a;
}

// Circuit Selector
let circuitSearchMemory = '';
let favoriteCircuits = [];

async function populateCircuitSelector() {
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('favoriteCircuits');
    if (savedFavorites) {
        favoriteCircuits = JSON.parse(savedFavorites);
    }
    
    const customSelect = document.getElementById('customCircuitSelect');
    const display = document.getElementById('circuitSelectDisplay');
    const dropdown = document.getElementById('circuitSelectDropdown');
    const search = document.getElementById('circuitSearch');
    const optionsContainer = document.getElementById('circuitOptions');
    
    if (!customSelect || !display || !dropdown || !search || !optionsContainer) {
        console.error('Circuit selector elements not found');
        return;
    }
    
    // Fetch circuits from backend
    let circuits;
    try {
        const response = await window.mailiaAPI.getCircuits();
        // Backend returns an array directly, not wrapped in {circuits: [...]}
        const circuitList = Array.isArray(response) ? response : response.circuits || [];
        circuits = circuitList.map(c => c.circuit_id).sort(sortCircuits);
        console.log(`Loaded ${circuits.length} circuits from backend`);
    } catch (err) {
        console.error('Failed to load circuits from backend:', err);
        // Fallback to CSV-based circuit list
        circuits = Object.keys(circuitFiles).sort(sortCircuits);
        console.log(`Using fallback circuit list (${circuits.length} circuits)`);
    }
    
    // Render circuit options
    function renderCircuitOptions(filterText = '') {
        optionsContainer.innerHTML = '';
        
        // Filter circuits based on search
        const filtered = circuits.filter(circuit => {
            const circuitName = (circuitNames[circuit] || circuit).toLowerCase();
            return circuitName.includes(filterText.toLowerCase());
        });
        
        // Show empty state if no results
        if (filtered.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';
            emptyDiv.style.padding = '2rem 1rem';
            emptyDiv.innerHTML = `
                <p style="color: var(--medium-gray); font-size: 0.9rem; margin: 0;">
                    Ei tuloksia "${filterText}"
                </p>
            `;
            optionsContainer.appendChild(emptyDiv);
            return;
        }
        
        // Sort: favorites first, then regular circuits
        const sortedFiltered = filtered.sort((a, b) => {
            const aFav = favoriteCircuits.includes(a);
            const bFav = favoriteCircuits.includes(b);
            
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            
            return sortCircuits(a, b);
        });
        
        sortedFiltered.forEach(circuit => {
            const option = document.createElement('div');
            option.className = 'circuit-option';
            if (favoriteCircuits.includes(circuit)) {
                option.classList.add('favorited');
            }
            option.dataset.value = circuit;
            
            const circuitLabel = document.createElement('span');
            circuitLabel.textContent = circuitNames[circuit] || circuit;
            option.appendChild(circuitLabel);
            
            const star = document.createElement('span');
            star.className = 'favorite-star';
            star.classList.add(favoriteCircuits.includes(circuit) ? 'active' : 'inactive');
            star.textContent = '★';
            star.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleFavorite(circuit);
            });
            option.appendChild(star);
            
            option.addEventListener('click', () => {
                selectCircuit(circuit);
            });
            
            optionsContainer.appendChild(option);
        });
    }
    
    function toggleFavorite(circuit) {
        const index = favoriteCircuits.indexOf(circuit);
        if (index > -1) {
            favoriteCircuits.splice(index, 1);
        } else {
            favoriteCircuits.push(circuit);
        }
        localStorage.setItem('favoriteCircuits', JSON.stringify(favoriteCircuits));
        renderCircuitOptions(search.value);
    }
    
    async function selectCircuit(circuit) {
        // Prevent concurrent circuit loads
        if (isLoadingCircuit) {
            console.log('Circuit load already in progress, ignoring click');
            return;
        }
        
        isLoadingCircuit = true;
        const displayText = display.querySelector('.circuit-display-text');
        
        // Add loading spinner
        const originalText = circuitNames[circuit] || circuit;
        displayText.innerHTML = `<span class="spinner"></span> <span style="margin-left: 8px;">${originalText}</span>`;
        dropdown.style.display = 'none';
        customSelect.classList.remove('open');
        
        try {
            await loadCircuit(circuit);
            displayText.textContent = originalText;
            search.value = '';
            circuitSearchMemory = '';
        } catch (error) {
            console.error('Error loading circuit:', error);
            // Reset display on error
            displayText.textContent = 'Valitse piiri';
            showNotification('Piirin lataus epäonnistui', 'error');
        } finally {
            isLoadingCircuit = false;
        }
    }
    
    // Toggle dropdown
    display.addEventListener('click', () => {
        const isOpen = dropdown.style.display === 'block';
        if (isOpen) {
            dropdown.style.display = 'none';
            customSelect.classList.remove('open');
        } else {
            dropdown.style.display = 'block';
            customSelect.classList.add('open');
            renderCircuitOptions(circuitSearchMemory);
            search.value = circuitSearchMemory;
            search.focus();
        }
    });
    
    // Search with memory
    search.addEventListener('input', (e) => {
        circuitSearchMemory = e.target.value;
        renderCircuitOptions(circuitSearchMemory);
    });
    
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!customSelect.contains(e.target)) {
            dropdown.style.display = 'none';
            customSelect.classList.remove('open');
        }
    });
    
    // Initial render
    renderCircuitOptions();
}

function sortCircuits(a, b) {
    // KPR circuits go at the end
    const aIsKPR = a.startsWith('KPR');
    const bIsKPR = b.startsWith('KPR');
    
    if (aIsKPR && !bIsKPR) return 1;
    if (!aIsKPR && bIsKPR) return -1;
    
    // Extract numbers for numeric sorting
    const aNum = parseInt(a.match(/\d+/)?.[0] || 0);
    const bNum = parseInt(b.match(/\d+/)?.[0] || 0);
    
    if (aNum !== bNum) return aNum - bNum;
    
    // If numbers are equal, sort alphabetically (for variants like KP16B)
    return a.localeCompare(b);
}

// Load Circuit
// Load circuit data on demand (lazy loading with caching)
async function loadCircuitData(circuitId) {
    // Check if already loaded in cache
    if (allData[circuitId]) {
        return allData[circuitId];
    }
    
    try {
        // Fetch circuit data from backend API (includes subscribers)
        const response = await window.mailiaAPI.getCircuit(circuitId);
        
        // Transform backend data to match existing app format
        const subscribers = response.subscribers.map(sub => {
            // Filter out null products from the aggregation
            const products = sub.products
                .filter(p => p && p.product_code)
                .map(p => p.product_code);
            
            return {
                address: fixRepeatedAddress(sub.address),
                name: sub.name,
                products: products,
                buildingAddress: sub.building_address,
                orderIndex: sub.order_index,
                id: sub.id, // Keep backend ID for updates
                key_info: sub.key_info || null // Include key information
            };
        });

        const beforeCount = subscribers.length;
        const deduped = collapseDuplicateSubscribers(subscribers);
        if (deduped.length !== beforeCount) {
            console.log(`[dedupe] Circuit ${circuitId}: ${beforeCount} -> ${deduped.length} after collapsing backend duplicates`);
        }
        
        
        // Cache the loaded data
        allData[circuitId] = deduped;
        console.log(`Loaded circuit ${circuitId} from backend (${deduped.length} subscribers)`);
        
        return deduped;
    } catch (err) {
        console.error(`Error loading circuit ${circuitId} from backend:`, err);
        
        // Fallback to CSV loading if backend fails
        console.warn('Falling back to CSV loading...');
        return await loadCircuitDataFromCSV(circuitId);
    }
}

// Fallback CSV loading (renamed from original loadCircuitData)
async function loadCircuitDataFromCSV(circuitId) {
    // Get filename for this circuit
    const filename = circuitFiles[circuitId];
    if (!filename) {
        console.warn(`No file mapping found for circuit: ${circuitId}`);
        return [];
    }
    
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            console.warn(`Could not load ${filename}`);
            return [];
        }
        const text = await response.text();
        let data = parseCircuitCSV(text, filename).map(sub => ({
            ...sub,
            address: fixRepeatedAddress(sub.address)
        }));
        const beforeCount = data.length;
        data = collapseDuplicateSubscribers(data, (subscriber) => normalizeSubscriberKeyPiece(subscriber.address));
        const afterCount = data.length;
        if (afterCount !== beforeCount) {
            console.log(`[dedupe] Circuit ${circuitId}: ${beforeCount} -> ${afterCount} after collapsing duplicates`);
        }
        
        // Cache the loaded data
        allData[circuitId] = data;
        console.log(`Loaded circuit ${circuitId} from CSV (${data.length} subscribers)`);
        
        return data;
    } catch (err) {
        console.warn(`Error loading ${filename}:`, err);
        return [];
    }
}

async function loadCircuit(circuitId) {
    currentCircuit = circuitId;
    
    // Save selected circuit to localStorage for persistence across page refreshes
    localStorage.setItem('currentCircuit', circuitId);
    
    try {
        // Show skeleton loading for subscriber list
        const subscriberList = document.getElementById('subscriberList');
        if (subscriberList) {
            subscriberList.innerHTML = '';
            showSkeletonLoader(subscriberList, 'subscriber', 5);
        }
        
        // Load circuit data on demand
        let subscribers = await loadCircuitData(circuitId);
        
        // Hide skeleton loader
        if (subscriberList) {
            hideSkeletonLoader(subscriberList);
        }
        
        // Apply saved route order if available
        subscribers = applySavedRouteOrder(circuitId, subscribers);
        allData[circuitId] = subscribers; // Update cache with ordered data
        
        const deliveryContent = document.getElementById('deliveryContent');
        if (!deliveryContent) {
            console.error('deliveryContent element not found');
            return;
        }
        
        deliveryContent.style.display = 'block';
        
        renderCoverSheet(circuitId, subscribers);
    renderSubscriberList(circuitId, subscribers);
    // After rendering, check for local duplicates for admin alert icon
    try { maybeFlagAdminOverlapIcon(subscribers); } catch(e){ console.warn('duplicate check failed', e); }
        updateRouteButtons(circuitId);
        updateQuickOptimizeButton(circuitId);
        
        // OPTIMIZATION: Pre-load Leaflet library in background for faster map loading
        if (typeof L === 'undefined') {
            loadLeafletLibrary().catch(err => console.warn('Failed to preload Leaflet:', err));
        }
        
        // Hide subscriber list initially - it will be shown when route starts
        const subscriberList = document.getElementById('subscriberList');
        if (!subscriberList) {
            console.error('subscriberList element not found');
            return;
        }
        
        const startKey = `route_start_${circuitId}`;
        const routeStarted = localStorage.getItem(startKey);
        
        if (!routeStarted) {
            // Route not started yet - hide the list
            subscriberList.style.display = 'none';
        } else {
            // Route already started - show the list
            subscriberList.style.display = 'block';
        }
        
        // Restore filter states
        const hideStf = localStorage.getItem('hideStf') === 'true';
        const hideDelivered = localStorage.getItem('hideDelivered') === 'true';
        const hideStfFilter = document.getElementById('hideStfFilter');
        const hideDeliveredFilter = document.getElementById('hideDeliveredFilter');
        
        if (hideStfFilter) hideStfFilter.checked = hideStf;
        if (hideDeliveredFilter) hideDeliveredFilter.checked = hideDelivered;
        
        applyFilters();
    } catch (error) {
        console.error('Error in loadCircuit:', error);
        throw error; // Re-throw to be caught by selectCircuit
    }
}

// Toggle admin duplicates button alert state based on backend overlaps or local duplicates
async function refreshAdminOverlapIndicator() {
    const role = getEffectiveUserRole();
    if (!(role === 'admin' || role === 'manager')) return;
    const btn = document.getElementById('adminDuplicatesBtn');
    if (!btn) return;
    try {
        const data = await fetchAdminDuplicates();
        const count = (data?.overlaps?.buildings?.length || 0) + (data?.overlaps?.units?.length || 0);
        if (count > 0) {
            btn.classList.add('alert');
            btn.setAttribute('title', 'Päällekkäisiä osoitteita havaittu');
        } else {
            btn.classList.remove('alert');
            btn.removeAttribute('title');
        }
    } catch(e) {
        // ignore
    }
}

// If the currently loaded circuit itself has exact duplicate unit addresses, flag the admin icon
function maybeFlagAdminOverlapIcon(subscribers) {
    const role = getEffectiveUserRole();
    if (!(role === 'admin' || role === 'manager')) return;
    const btn = document.getElementById('adminDuplicatesBtn');
    if (!btn) return;
    const norm = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
    const counts = new Map();
    for (const sub of subscribers) {
        const key = norm(sub.address);
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    const hasLocalDup = Array.from(counts.values()).some(v => v > 1);
    if (hasLocalDup) {
        btn.classList.add('alert');
        btn.setAttribute('title', 'Piirissä päällekkäisiä osoitteita');
        showNotification('Piirissä havaittiin päällekkäisiä osoitteita (katso Admin ▶ Ristikkäiset osoitteet)', 'info');
    } else {
        // Do not remove here; backend overlaps may still exist. Let refreshAdminOverlapIndicator decide.
    }
}

// Cover Sheet
function renderCoverSheet(circuitId, subscribers) {
    const dateDisplay = document.getElementById('dateDisplay');
    const productCounts = document.getElementById('productCounts');
    
    // Display current date in Finnish format
    const now = new Date();
    const weekdays = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
    const weekday = weekdays[now.getDay()];
    const dateStr = `${now.getDate()}.${now.getMonth() + 1}.${now.getFullYear()}`;
    dateDisplay.textContent = `${weekday} ${dateStr}`;
    
    const today = now.getDay();
    
    // Aggregate products - only count products valid for today
    const products = {};
    subscribers.forEach(sub => {
        sub.products.forEach(product => {
            const normalized = normalizeProduct(product);
            
            // Split space-separated products (e.g., "UV HS" → ["UV", "HS"])
            const individualProducts = normalized.split(/\s+/);
            
            individualProducts.forEach(individualProduct => {
                // Only count if product is valid for today
                if (isProductValidForDay(individualProduct, today)) {
                    // Simplify product name (e.g., HSPE → HS, ESP → ES)
                    const simplified = simplifyProductName(individualProduct, today);
                    products[simplified] = (products[simplified] || 0) + 1;
                }
            });
        });
    });
    
    // Display product counts
    productCounts.innerHTML = '';
    
    // Add map view button first
    const mapButton = document.createElement('button');
    mapButton.className = 'map-view-btn';
    mapButton.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 0.5rem;">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
        </svg>
        Näytä kartalla
    `;
    mapButton.style.cssText = `
        width: 100%;
        background: linear-gradient(135deg, #17a2b8 0%, #138496 100%);
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 50px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        margin-bottom: 1rem;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(23, 162, 184, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
    `;
    mapButton.onclick = (e) => {
        e.stopPropagation();
        showCircuitMap(circuitId);
    };
    
    // Add hover effect
    mapButton.addEventListener('mouseenter', () => {
        mapButton.style.transform = 'translateY(-2px)';
        mapButton.style.boxShadow = '0 4px 12px rgba(23, 162, 184, 0.4)';
    });
    mapButton.addEventListener('mouseleave', () => {
        mapButton.style.transform = 'translateY(0)';
        mapButton.style.boxShadow = '0 2px 8px rgba(23, 162, 184, 0.3)';
    });
    
    productCounts.appendChild(mapButton);
    
    // Add product badges
    Object.entries(products).sort().forEach(([product, count]) => {
        const badge = document.createElement('div');
        const colorClass = getProductColorClass(product);
        badge.className = `product-badge product-${colorClass}`;
        badge.innerHTML = `${product} <span class="count">${count}</span>`;
        productCounts.appendChild(badge);
    });
}

function normalizeProduct(product) {
    // First split concatenated multi-products (e.g., "UVES" -> "UV ES", "HSES" -> "HS ES")
    const multiProductPatterns = [
        { pattern: /^UVES$/i, replacement: 'UV ES' },
        { pattern: /^HSES$/i, replacement: 'HS ES' },
        { pattern: /^UVHS$/i, replacement: 'UV HS' },
        { pattern: /^UVHSLS$/i, replacement: 'UV HSLS' },
        { pattern: /^ESHSPS$/i, replacement: 'ES HSPS' },
        { pattern: /^ESHSP$/i, replacement: 'ES HSP' },
        { pattern: /^UVESHS$/i, replacement: 'UV ES HS' },
        { pattern: /^UVSTF$/i, replacement: 'UV STF' },
        { pattern: /^ESSTF$/i, replacement: 'ES STF' }
    ];
    
    for (const {pattern, replacement} of multiProductPatterns) {
        if (pattern.test(product)) {
            return replacement;
        }
    }
    
    // Normalize products: UV2→UV, HS2→HS, ES4→ES, STF2→STF, etc.
    return product.replace(/\d+$/, '').trim();
}

function getProductColorClass(product) {
    // Map alternative products to base colors
    // All HS variants → HS (green)
    // All ES variants → ES (cyan)
    // All ISA variants → ISA (yellow)
    // UV, JO, STF, LU keep their own colors
    const colorMap = {
        // Helsingin Sanomat variants
        'SH': 'HS',        // Sunnuntai Hesari
        'HSPS': 'HS',      // Hesari perjantai-sunnuntai
        'HSPE': 'HS',      // Hesari perjantai
        'HSLS': 'HS',      // Hesari lauantai-sunnuntai
        'HSP': 'HS',       // Hesari maanantai-perjantai
        'HSTS': 'HS',      // Hesari torstai-sunnuntai
        'HSTO': 'HS',      // Hesari torstai-sunnuntai
        'MALA': 'HS',      // Hesari maanantai-lauantai
        // Etelä-Saimaa variants
        'ESPS': 'ES',      // Etelä-Saimaa perjantai-sunnuntai
        'ESLS': 'ES',      // Etelä-Saimaa lauantai-sunnuntai
        'ESP': 'ES',       // Etelä-Saimaa maanantai-perjantai
        'ESMP': 'ES',      // Etelä-Saimaa ma-pe
        'ETSA': 'ES',      // Etelä-Saimaa ma-la
        // Itä-Savo variants
        'ISAP': 'ISA',     // Itä-Savo ma-pe
        'ISALASU': 'ISA',  // Itä-Savo la-su
        'ISAPESU': 'ISA',  // Itä-Savo pe-su
        'ISASU': 'ISA'     // Itä-Savo sunnuntai
    };
    return colorMap[product] || product;
}

// Day constants for better readability
const SUNDAY = 0, MONDAY = 1, TUESDAY = 2, WEDNESDAY = 3, THURSDAY = 4, FRIDAY = 5, SATURDAY = 6;

/**
 * Check if a product should be delivered on a specific day of the week
 * IMPORTANT: Sundays have no deliveries. Sunday papers are delivered on Monday.
 * IMPORTANT: UV (Uutisvuoksi) is delivered only on Monday, Wednesday, and Friday.
 * 
 * @param {string} product - The product code (e.g., 'ESLS', 'HSP', 'UV')
 * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {boolean} True if the product should be delivered on the given day
 * 
 * @example
 * isProductValidForDay('ESLS', SUNDAY) // returns false (no deliveries on Sunday)
 * isProductValidForDay('SH', MONDAY) // returns true (Sunday papers delivered on Monday)
 * isProductValidForDay('UV', MONDAY) // returns true (UV delivered Mon/Wed/Fri)
 * isProductValidForDay('UV', TUESDAY) // returns false (UV not delivered on Tuesday)
 */
function isProductValidForDay(product, dayOfWeek) {
    // NO DELIVERIES ON SUNDAY - return false for all products
    if (dayOfWeek === SUNDAY) {
        return false;
    }
    
    const productSchedule = {
        // Special products with specific delivery days
        'UV': [MONDAY, WEDNESDAY, FRIDAY],           // Uutisvuoksi - Monday, Wednesday, Friday only
        // Helsingin Sanomat variants
        'SH': [MONDAY],                              // Sunnuntai Hesari - delivered on Monday
        'HSPS': [FRIDAY, SATURDAY, MONDAY],          // Hesari perjantai-sunnuntai (Sunday edition on Monday)
        'HSPE': [FRIDAY],                            // Hesari perjantai - Friday only
        'HSLS': [SATURDAY, MONDAY],                  // Hesari lauantai-sunnuntai (Sunday edition on Monday)
        'HSP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],  // Hesari maanantai-perjantai
        'HSTS': [THURSDAY, FRIDAY, SATURDAY, MONDAY],           // Hesari torstai-sunnuntai (Sunday edition on Monday)
        'HSTO': [THURSDAY, FRIDAY, SATURDAY, MONDAY], // Hesari torstai-sunnuntai (Sunday edition on Monday)
        'MALA': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY],  // Hesari maanantai-lauantai
        // Etelä-Saimaa variants
        // Note: plain ES is a daily product (delivered every day except Sunday)
        'ESPS': [FRIDAY, SATURDAY, MONDAY],          // Etelä-Saimaa perjantai-sunnuntai (Sunday edition on Monday)
        'ESLS': [SATURDAY, MONDAY],                  // Etelä-Saimaa lauantai-sunnuntai (Sunday edition on Monday)
        'ESP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],   // Etelä-Saimaa maanantai-perjantai
        'ESMP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],  // Etelä-Saimaa ma-pe (sama kuin ESP)
        'ETSA': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY], // Etelä-Saimaa ma-la
        // Itä-Savo variants
        'ISAP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],  // Itä-Savo ma-pe
        'ISALASU': [SATURDAY, MONDAY],               // Itä-Savo la-su (Sunday edition on Monday)
        'ISAPESU': [FRIDAY, SATURDAY, MONDAY],       // Itä-Savo pe-su (Sunday edition on Monday)
        'ISASU': [MONDAY],                           // Itä-Savo sunnuntai - delivered on Monday
        // Other products
        'PASA': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY], // Parikkalan Sanomat ma-la
        'YHTS': [THURSDAY, FRIDAY, SATURDAY, MONDAY] // Yhteishyvä to-su (Sunday edition on Monday)
    };
    
    // If the product has a specific schedule, check if today is valid
    if (productSchedule[product]) {
        return productSchedule[product].includes(dayOfWeek);
    }
    
    // All other products (UV, HS, ES, JO, STF, LU, ISA, Muu, RL, PL, etc.) are valid Mon-Sat (not Sunday)
    return dayOfWeek !== SUNDAY;
}

/**
 * Expands combined products (like "ES HSPS") into separate product codes based on the day
 * This handles cases where a customer orders multiple products with different schedules
 * E.g., "ES HSPS" means ES (Mon-Sat) + HS (Fri-Sun), so on Friday both ES and HS are delivered
 * 
 * @param {string} productString - Space-separated product codes (e.g., "ES HSPS", "UV ES HS")
 * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {Array<string>} Array of individual products valid for the given day
 */
function expandCombinedProducts(productString, dayOfWeek) {
    const products = productString.trim().split(/\s+/);
    const expandedProducts = [];
    
    products.forEach(product => {
        const normalized = normalizeProduct(product);
        
        // Check if this product is valid for today
        if (isProductValidForDay(normalized, dayOfWeek)) {
            expandedProducts.push(product);
        }
    });
    
    return expandedProducts;
}

/**
 * Simplifies product display names based on delivery days
 * IMPORTANT: Sunday papers (SH, ISASU, etc.) are delivered on Monday
 * E.g., ESP (mon-fri) displays as "ES" on those days
 * E.g., HSPE (friday) displays as "HS" on friday
 * E.g., SH (sunday) displays as "HS" on Monday (when it's actually delivered)
 */
function simplifyProductName(product, dayOfWeek) {
    const normalized = normalizeProduct(product);
    
    // Etelä-Saimaa variants -> ES
    if (normalized === 'ESP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    if (normalized === 'ESMP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    // ESPS includes Sunday edition, which is delivered on Monday
    if (normalized === 'ESPS' && [FRIDAY, SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    // ESLS includes Sunday edition, which is delivered on Monday
    if (normalized === 'ESLS' && [SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    if (normalized === 'ETSA' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    
    // Helsingin Sanomat variants -> HS
    if (normalized === 'HSP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // HSPS includes Sunday edition, which is delivered on Monday
    if (normalized === 'HSPS' && [FRIDAY, SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    if (normalized === 'HSPE' && dayOfWeek === FRIDAY) {
        return 'HS';
    }
    // HSLS includes Sunday edition, which is delivered on Monday
    if (normalized === 'HSLS' && [SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // HSTS/HSTO include Sunday edition, which is delivered on Monday
    if (normalized === 'HSTS' && [THURSDAY, FRIDAY, SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    if (normalized === 'HSTO' && [THURSDAY, FRIDAY, SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    if (normalized === 'MALA' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // SH (Sunday Hesari) is delivered on Monday
    if (normalized === 'SH' && dayOfWeek === MONDAY) {
        return 'HS';
    }
    
    // Itä-Savo variants -> ISA
    if (normalized === 'ISAP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'ISA';
    }
    // ISALASU includes Sunday edition, which is delivered on Monday
    if (normalized === 'ISALASU' && [SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'ISA';
    }
    // ISAPESU includes Sunday edition, which is delivered on Monday
    if (normalized === 'ISAPESU' && [FRIDAY, SATURDAY, MONDAY].includes(dayOfWeek)) {
        return 'ISA';
    }
    // ISASU (Sunday ISA) is delivered on Monday
    if (normalized === 'ISASU' && dayOfWeek === MONDAY) {
        return 'ISA';
    }
    
    // Return original for all other cases (UV, STF, JO, LU, PASA, YHTS, etc.)
    return product;
}

// Subscriber List
function renderSubscriberList(circuitId, subscribers) {
    const listContainer = document.getElementById('subscriberList');
    listContainer.innerHTML = '';
    // Reset admin numbering counter for this render
    const counterStore = typeof window !== 'undefined' ? window : globalThis;
    counterStore.__deliveryCounter = 1;
    
    // Get current day of week
    const today = new Date().getDay();
    
    // Filter subscribers to only include those with at least one valid product for today
    const validSubscribers = subscribers.map(sub => {
        // Filter products to only those valid for today, splitting combined products
        const validProducts = [];
        sub.products.forEach(product => {
            const normalized = normalizeProduct(product);
            const individualProducts = normalized.split(/\s+/);
            individualProducts.forEach(individualProduct => {
                if (isProductValidForDay(individualProduct, today)) {
                    validProducts.push(individualProduct);
                }
            });
        });
        
        // If no valid products, don't include this subscriber
        if (validProducts.length === 0) {
            return null;
        }
        
        // Return subscriber with filtered products
        return {
            ...sub,
            products: validProducts
        };
    }).filter(sub => sub !== null);
    
    // Group by building address while preserving order
    const buildings = [];
    const buildingMap = {};
    
    validSubscribers.forEach(sub => {
        const building = sub.buildingAddress;
        if (!buildingMap[building]) {
            buildingMap[building] = {
                name: building,
                subscribers: [],
                firstIndex: sub.orderIndex
            };
            buildings.push(buildingMap[building]);
        }
        buildingMap[building].subscribers.push(sub);
    });
    
    // Render each building group in original CSV order
    buildings.forEach((buildingObj, buildingIndex) => {
        const buildingGroup = document.createElement('div');
        buildingGroup.className = 'building-group';
        
        const deliveryCount = buildingObj.subscribers.length;
        const hasMultipleDeliveries = deliveryCount > 1;
        
        // Only show building header if there are multiple deliveries to the same building
        if (hasMultipleDeliveries) {
            const header = document.createElement('div');
            header.className = 'building-header';
            
            // Create building name span
            const buildingName = document.createElement('span');
            buildingName.className = 'building-name';
            buildingName.textContent = buildingObj.name;
            header.appendChild(buildingName);
            
            // Add delivery count badge
            const countBadge = document.createElement('span');
            countBadge.className = 'building-delivery-count';
            countBadge.textContent = `${deliveryCount} jakelua`;
            header.appendChild(countBadge);
            
            buildingGroup.appendChild(header);
        }
        
        const buildingSubscribers = buildingObj.subscribers;
        let previousStaircase = null;
        
        // Only show one + button per building group: at end, not between each card
        buildingSubscribers.forEach((sub, subIndex) => {
            // Extract the staircase letter from the apartment specification
            const apartmentSpec = extractApartmentSpecification(sub.address, sub.buildingAddress);
            const currentStaircase = apartmentSpec ? apartmentSpec.charAt(0).toUpperCase() : null;
            
            // Check if this is a new staircase (and not the first card)
            const isNewStaircase = hasMultipleDeliveries && subIndex > 0 && 
                                   currentStaircase && previousStaircase && 
                                   currentStaircase !== previousStaircase;
            
            // Removed per-card + button insertion to avoid duplicates
            
            const card = createSubscriberCard(circuitId, sub, buildingIndex, subIndex, 
                buildingIndex === buildings.length - 1 && subIndex === buildingSubscribers.length - 1,
                buildings, buildingIndex, subIndex, hasMultipleDeliveries, isNewStaircase);
            buildingGroup.appendChild(card);
            
            previousStaircase = currentStaircase;
        });
        
        // No per-group + button; only a single global + is rendered after the full list
        
        listContainer.appendChild(buildingGroup);
    });

    // Add a single global + button at the end (admin/manager only)
    const role = getEffectiveUserRole();
    if (role === 'admin' || role === 'manager') {
        // Default order index: append after the last visible subscriber
        const lastVisible = validSubscribers[validSubscribers.length - 1];
        const defaultOrderIndex = lastVisible ? (lastVisible.orderIndex + 1) : 1;
        const addButton = createAddSubscriberButton(circuitId, defaultOrderIndex);
        listContainer.appendChild(addButton);
    }
}

// Create add subscriber button between cards
function createAddSubscriberButton(circuitId, orderIndex) {
    const button = document.createElement('button');
    button.className = 'add-subscriber-between-btn';
    button.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    button.setAttribute('aria-label', 'Lisää tilaaja tähän');
    button.addEventListener('click', () => {
        openAddSubscriberModal(circuitId, orderIndex);
    });
    return button;
}

function createSubscriberCard(circuitId, subscriber, buildingIndex, subIndex, isLast, buildings, currentBuildingIndex, currentSubIndex, hasMultipleDeliveries, isNewStaircase) {
    const card = document.createElement('div');
    card.className = 'subscriber-card';
    card.dataset.products = subscriber.products.join(',');
    
    // Delivery numbering badge for ALL users (top-left corner)
    const counterHolder = typeof window !== 'undefined' ? window : globalThis;
    if (typeof counterHolder.__deliveryCounter !== 'number') {
        counterHolder.__deliveryCounter = 1;
    }
    const numberBadge = document.createElement('span');
    numberBadge.className = 'delivery-order-number';
    numberBadge.textContent = String(counterHolder.__deliveryCounter++);
    card.appendChild(numberBadge);
    
    // Add spacing class for new staircase
    if (isNewStaircase) {
        card.classList.add('new-staircase');
    }
    
    // Apply checkbox visibility class based on user preference
    if (showCheckboxes) {
        card.classList.add('show-checkboxes');
    }
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = getCheckboxState(circuitId, subscriber.address);
    checkbox.className = 'delivery-checkbox'; // Add class for styling
    
    // Add subscriber ID to checkbox for real-time sync
    if (subscriber.id) {
        checkbox.dataset.subscriberId = subscriber.id;
    }
    
    checkbox.addEventListener('change', async (e) => {
        // Haptic feedback on mobile devices
        if ('vibrate' in navigator && e.target.checked) {
            navigator.vibrate(50); // Short vibration on check
        }
        // Subtle scale animation for card on toggle
        const parentCard = e.target.closest('.subscriber-card');
        if (parentCard) {
            parentCard.style.transition = 'transform .35s cubic-bezier(0.4,0,0.2,1)';
            parentCard.style.transform = 'scale(0.97)';
            setTimeout(() => { parentCard.style.transform = 'scale(1)'; }, 220);
        }
        
        // Haptic feedback on checkbox toggle
        triggerHaptic(e.target.checked ? 'success' : 'light');
        
        await saveCheckboxState(circuitId, subscriber.address, e.target.checked, subscriber.id);
        applyFilters(); // Re-apply filters to hide/show delivered addresses
        
        // Update progress after manual toggle
        if (typeof recalcAndRenderProgress === 'function') {
            recalcAndRenderProgress();
        }
    });
    card.appendChild(checkbox);
    
    // Add swipe functionality
    initializeSwipeToMark(card, checkbox, circuitId, subscriber.address, subscriber.id);
    
    // Subscriber info
    const info = document.createElement('div');
    info.className = 'subscriber-info';
    
    // If this is a single-subscriber building, show full address
    // If multiple subscribers share the building, show only apartment specification
    if (hasMultipleDeliveries) {
        const apartmentSpec = extractApartmentSpecification(subscriber.address, subscriber.buildingAddress);
        if (apartmentSpec) {
            const apartment = document.createElement('div');
            apartment.className = 'subscriber-apartment';
            apartment.textContent = apartmentSpec;
            info.appendChild(apartment);
        }
    } else {
        // Show full address for single-subscriber buildings
        const address = document.createElement('div');
        address.className = 'subscriber-address';
        address.textContent = subscriber.address;
        info.appendChild(address);
    }
    
    const name = document.createElement('div');
    name.className = 'subscriber-name';
    name.textContent = subscriber.name;
    info.appendChild(name);
    
    const products = document.createElement('div');
    products.className = 'subscriber-products';
    const today = new Date().getDay();
    
    // Group products by base name and count quantities
    const productCounts = {};
    subscriber.products.forEach(product => {
        const trimmed = product.trim();
        const simplifiedProduct = simplifyProductName(trimmed, today);
        
        // Extract quantity if present (e.g., UV2 -> UV with quantity 2)
        const match = trimmed.match(/^([A-Z]+)(\d+)$/);
        if (match) {
            const baseName = match[1];
            const quantity = parseInt(match[2]);
            const simpleBase = simplifyProductName(baseName, today);
            productCounts[simpleBase] = (productCounts[simpleBase] || 0) + quantity;
        } else {
            // Products are already normalized and split from filter phase
            productCounts[simplifiedProduct] = (productCounts[simplifiedProduct] || 0) + 1;
        }
    });
    
    // Display products with text labels and colored backgrounds
    Object.entries(productCounts).forEach(([product, count]) => {
        const tag = document.createElement('span');
        const colorClass = getProductColorClass(product);
        tag.className = `product-tag product-${colorClass}`;
        tag.title = `${product}${count > 1 ? ` ×${count}` : ''}`;
        tag.setAttribute('aria-label', `${product}${count > 1 ? ` ${count} kpl` : ''}`);
        
        // Show product code
        tag.textContent = product;

        if (count > 1) {
            const badge = document.createElement('span');
            badge.className = 'quantity-badge';
            badge.textContent = count;
            tag.appendChild(badge);
        }

        products.appendChild(tag);
    });
    info.appendChild(products);
    
    // Key information display (visible to all users)
    if (subscriber.key_info) {
        const keyInfo = document.createElement('div');
        keyInfo.className = 'key-info';
        keyInfo.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;margin-right:4px;">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
            <span>${subscriber.key_info}</span>
        `;
        info.appendChild(keyInfo);
    }
    
    card.appendChild(info);
    
    // Admin-only: Add key info button
    const currentRole = getEffectiveUserRole();
    if (currentRole === 'admin' || currentRole === 'manager') {
        const keyInfoBtn = document.createElement('button');
        keyInfoBtn.className = 'key-info-button admin-only';
        keyInfoBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path>
            </svg>
        `;
        keyInfoBtn.title = subscriber.key_info ? 'Muokkaa avaintietoja' : 'Lisää avaintiedot';
        keyInfoBtn.addEventListener('click', () => {
            openKeyInfoDialog(subscriber, circuitId);
        });
        card.appendChild(keyInfoBtn);
    }
    
    // Report undelivered button
    const reportBtn = document.createElement('button');
    reportBtn.className = 'report-button';
    reportBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
    `;
    reportBtn.title = 'Ilmoita ongelmasta';
    reportBtn.addEventListener('click', () => {
        // Use new modal-based delivery issue dialog
        openDeliveryIssueDialog(subscriber, circuitId);
    });
    card.appendChild(reportBtn);
    
    // Removed per-address navigation link (Navigate To)
    
    return card;
}

// Removed helper getNextAddress since Navigate To was removed

// Swipe to Mark as Delivered Functionality
function initializeSwipeToMark(card, checkbox, circuitId, address, subscriberId = null) {
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;
    const swipeThreshold = 100; // Minimum pixels to trigger swipe
    const velocityThreshold = 0.3; // Minimum velocity for quick swipes
    
    // Touch events
    card.addEventListener('touchstart', (e) => {
        // Don't interfere with checkbox clicks or other button clicks
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
            return;
        }
        
        startX = e.touches[0].clientX;
        currentX = startX;
        startTime = Date.now();
        isDragging = false;
        card.style.transition = 'none';
    }, { passive: true });
    
    card.addEventListener('touchmove', (e) => {
        if (startX === 0) return;
        
        currentX = e.touches[0].clientX;
        const deltaX = currentX - startX;
        
        // Only allow right swipe
        if (deltaX > 0) {
            isDragging = true;
            const translateX = Math.min(deltaX, 200); // Cap at 200px
            card.style.transform = `translateX(${translateX}px)`;
            card.style.opacity = 1 - (translateX / 300); // Fade out as it swipes
        }
    }, { passive: true });
    
    card.addEventListener('touchend', (e) => {
        if (startX === 0) return;
        
        const deltaX = currentX - startX;
        const deltaTime = Date.now() - startTime;
        const velocity = deltaX / deltaTime; // pixels per ms
        
        // Check if swipe is valid (either distance or velocity threshold met)
        const isValidSwipe = (deltaX > swipeThreshold) || (velocity > velocityThreshold && deltaX > 50);
        
        if (isDragging && isValidSwipe && deltaX > 0) {
            // Mark as delivered with animation
            card.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = 'translateX(100%)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                checkbox.checked = true;
                saveCheckboxState(circuitId, address, true, subscriberId);
                applyFilters();
                
                // Reset card position (will be hidden by filters if enabled)
                card.style.transition = '';
                card.style.transform = '';
                card.style.opacity = '';
                if (typeof recalcAndRenderProgress === 'function') {
                    recalcAndRenderProgress();
                }
            }, 250);
        } else {
            // Reset card position with animation
            card.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = '';
            card.style.opacity = '';
        }
        
        // Reset tracking variables
        startX = 0;
        currentX = 0;
        isDragging = false;
    });
    
    // Mouse events for desktop testing (optional)
    let isMouseDown = false;
    
    card.addEventListener('mousedown', (e) => {
        if (e.target.type === 'checkbox' || e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
            return;
        }
        
        isMouseDown = true;
        startX = e.clientX;
        currentX = startX;
        startTime = Date.now();
        isDragging = false;
        card.style.transition = 'none';
        e.preventDefault();
    });
    
    card.addEventListener('mousemove', (e) => {
        if (!isMouseDown || startX === 0) return;
        
        currentX = e.clientX;
        const deltaX = currentX - startX;
        
        if (deltaX > 0) {
            isDragging = true;
            const translateX = Math.min(deltaX, 200);
            card.style.transform = `translateX(${translateX}px)`;
            card.style.opacity = 1 - (translateX / 300);
        }
    });
    
    card.addEventListener('mouseup', (e) => {
        if (!isMouseDown) return;
        
        const deltaX = currentX - startX;
        const deltaTime = Date.now() - startTime;
        const velocity = deltaX / deltaTime;
        
        const isValidSwipe = (deltaX > swipeThreshold) || (velocity > velocityThreshold && deltaX > 50);
        
        if (isDragging && isValidSwipe && deltaX > 0) {
            card.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = 'translateX(100%)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                checkbox.checked = true;
                saveCheckboxState(circuitId, address, true);
                applyFilters();
                
                card.style.transition = '';
                card.style.transform = '';
                card.style.opacity = '';
                if (typeof recalcAndRenderProgress === 'function') {
                    recalcAndRenderProgress();
                }
            }, 250);
        } else {
            card.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.transform = '';
            card.style.opacity = '';
        }
        
        isMouseDown = false;
        startX = 0;
        currentX = 0;
        isDragging = false;
    });
    
    // Handle mouse leaving card while dragging
    card.addEventListener('mouseleave', () => {
        if (isMouseDown) {
            card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
            card.style.transform = '';
            card.style.opacity = '';
            isMouseDown = false;
            startX = 0;
            currentX = 0;
            isDragging = false;
        }
    });
}

// Report Undelivered Functionality
// legacy reportUndelivered removed; replaced by openDeliveryIssueDialog

async function saveRouteMessage(message, photoFile = null) {
    // Check if we're online first
    if (!navigator.onLine) {
        console.log('Offline: saving message locally');
        const messages = loadRouteMessages();
        
        // Convert photo to base64 if present
        if (photoFile) {
            try {
                message.photoData = await fileToBase64(photoFile);
            } catch (err) {
                console.error('Failed to convert photo:', err);
            }
        }
        
        messages.push(message);
        localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
        showNotificationEnhanced('Viesti tallennettu offline-tilassa', 'info');
        return;
    }
    
    // Get current route ID
    let routeId = localStorage.getItem(`route_id_${message.circuit}`);
    
    // If no route exists, create one automatically
    if (!routeId) {
        console.log('No route ID found, creating route for circuit:', message.circuit);
        
        // Create route via API
        if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
            window.mailiaAPI.startRoute(message.circuit)
                .then(route => {
                    console.log('Route created successfully:', route);
                    // Persist start state locally for UI consistency
                    localStorage.setItem(`route_id_${message.circuit}`, route.id);
                    localStorage.setItem(`route_start_${message.circuit}`, new Date(route.start_time || Date.now()).toISOString());
                    updateRouteButtons(message.circuit);
                    // Now send the message with photo
                    return sendMessageWithPhoto(route.id, message, photoFile);
                })
                .then(() => {
                    console.log('Message sent successfully');
                    announceToScreenReader('Viesti lähetetty');
                    // Refresh messages view if active
                    const messagesTab = document.querySelector('.tab-content.active#messagesTab');
                    if (messagesTab) { renderRouteMessages(); }
                })
                .catch(error => {
                    console.error('Failed to create route or save message:', error);
                    
                    // Check if it's a network error
                    if (error.message === 'Failed to fetch' || error.message === 'NetworkError') {
                        showNotificationEnhanced('Verkkovirhe: Viesti tallennettu paikallisesti', 'warning');
                    } else {
                        showNotificationEnhanced(`Virhe: ${error.message || 'Tuntematon virhe'}`, 'error');
                    }
                    
                    // Fallback to localStorage with photo as base64
                    const messages = loadRouteMessages();
                    if (photoFile) {
                        fileToBase64(photoFile).then(base64 => {
                            message.photoData = base64;
                            messages.push(message);
                            localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
                        });
                    } else {
                        messages.push(message);
                        localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
                    }
                });
            return;
        } else {
            // Fallback to localStorage if API not available
            const messages = loadRouteMessages();
            if (photoFile) {
                message.photoData = await fileToBase64(photoFile);
            }
            messages.push(message);
            localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
            showNotificationEnhanced('Viesti tallennettu paikallisesti', 'info');
            return;
        }
    }
    
    // Send message to backend API with photo
    if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
        sendMessageWithPhoto(parseInt(routeId), message, photoFile).then(() => {
            console.log('Message sent successfully to route:', routeId);
            announceToScreenReader('Viesti lähetetty');
            // Refresh messages view if active (no notification here)
            const messagesTab = document.querySelector('.tab-content.active#messagesTab');
            if (messagesTab) { renderRouteMessages(); }
        }).catch(error => {
            console.error('Failed to save message:', error);
            
            // Check if it's a network error
            if (error.message === 'Failed to fetch' || error.message === 'NetworkError') {
                showNotificationEnhanced('Verkkovirhe: Viesti tallennettu paikallisesti', 'warning');
            } else {
                showNotificationEnhanced(`Virhe: ${error.message || 'Tuntematon virhe'}`, 'error');
            }
            
            // Fallback to localStorage
            const messages = loadRouteMessages();
            messages.push(message);
            localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
        });
    } else {
        // Fallback to localStorage if API not available
        const messages = loadRouteMessages();
        messages.push(message);
        localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
        showNotificationEnhanced('Viesti tallennettu paikallisesti', 'info');
    }
}

function loadRouteMessages() {
    const stored = localStorage.getItem('mailiaRouteMessages');
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Failed to load route messages', e);
            return [];
        }
    }
    return [];
}

// Photo handling helpers
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function sendMessageWithPhoto(routeId, message, photoFile) {
    const messageText = `${message.reason} - ${message.address}`;
    
    if (!photoFile) {
        // No photo, send regular message
        return window.mailiaAPI.sendMessage(routeId, 'issue', messageText);
    }
    
    // Send message with photo using FormData
    const formData = new FormData();
    formData.append('message_type', 'issue');
    formData.append('message_content', messageText);
    formData.append('photo', photoFile);
    
    // Use sessionStorage for auth token (matches api.js implementation)
    const token = sessionStorage.getItem('mailiaAuthToken');
    
    if (!token) {
        throw new Error('No authentication token available');
    }
    
    // Use proper API URL with environment detection
    const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const API_BASE_URL = IS_PRODUCTION ? '/api' : 'http://localhost:3000/api';
    
    const response = await fetch(`${API_BASE_URL}/messages/${routeId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
        console.error('Photo upload failed:', response.status, errorMsg, errorData);
        throw new Error(`Failed to send message with photo: ${errorMsg}`);
    }
    
    return response.json();
}

// Filters and Event Listeners
function initializeEventListeners() {
    // STF Filter
    document.getElementById('hideStfFilter').addEventListener('change', (e) => {
        localStorage.setItem('hideStf', e.target.checked);
        applyFilters();
    });
    
    // Hide Delivered Filter
    document.getElementById('hideDeliveredFilter').addEventListener('change', (e) => {
        localStorage.setItem('hideDelivered', e.target.checked);
        applyFilters();
    });
    
    document.getElementById('startRouteBtn').addEventListener('click', () => {
        startRoute(currentCircuit);
    });
    
    document.getElementById('completeRouteBtn').addEventListener('click', () => {
        completeRoute(currentCircuit);
    });
    
    // Quick optimize button (non-map version)
    const quickOptimizeBtn = document.getElementById('quickOptimizeBtn');
    if (quickOptimizeBtn) {
        quickOptimizeBtn.addEventListener('click', () => {
            quickOptimizeRoute();
        });
    }
    
    // Initialize message swipe functionality
    initializeMessageSwipe();
    
    // Initialize Floating Action Button
    initializeFAB();
    
    // Initialize Pull-to-Refresh
    initializePullToRefresh();
}

// ========================================
// PULL-TO-REFRESH
// ========================================
function initializePullToRefresh() {
    let startY = 0;
    let currentY = 0;
    let pulling = false;
    const threshold = 80;
    
    const subscriberList = document.getElementById('subscriberList');
    const deliveryTab = document.getElementById('deliveryTab');
    
    if (!subscriberList || !deliveryTab) return;
    
    // Create pull-to-refresh indicator
    const pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-to-refresh';
    pullIndicator.innerHTML = `
        <svg class="pull-to-refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span class="pull-to-refresh-text">Vedä päivittääksesi</span>
    `;
    deliveryTab.insertBefore(pullIndicator, subscriberList);
    
    function handleTouchStart(e) {
        // Only activate if scrolled to top
        if (subscriberList.scrollTop === 0 && currentCircuit) {
            startY = e.touches[0].clientY;
            pulling = false;
        }
    }
    
    function handleTouchMove(e) {
        if (!startY || subscriberList.scrollTop > 0) return;
        
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        
        if (diff > 0 && diff < threshold * 2) {
            e.preventDefault();
            pulling = true;
            const scale = Math.min(diff / threshold, 1);
            pullIndicator.style.transform = `translateY(${diff}px)`;
            pullIndicator.style.opacity = scale;
            
            if (diff >= threshold) {
                pullIndicator.classList.add('pulling');
                pullIndicator.querySelector('.pull-to-refresh-text').textContent = 'Vapauta päivittääksesi';
            } else {
                pullIndicator.classList.remove('pulling');
                pullIndicator.querySelector('.pull-to-refresh-text').textContent = 'Vedä päivittääksesi';
            }
        }
    }
    
    async function handleTouchEnd() {
        if (!pulling) {
            startY = 0;
            return;
        }
        
        const diff = currentY - startY;
        
        if (diff >= threshold) {
            // Trigger refresh
            pullIndicator.classList.remove('pulling');
            pullIndicator.classList.add('refreshing');
            pullIndicator.querySelector('.pull-to-refresh-text').textContent = 'Päivitetään...';
            triggerHaptic('light');
            
            try {
                await loadCircuit(currentCircuit);
                showNotificationEnhanced('Piiri päivitetty', 'success');
                triggerHaptic('success');
            } catch (error) {
                showNotificationEnhanced('Päivitys epäonnistui', 'error');
                triggerHaptic('error');
            }
            
            setTimeout(() => {
                pullIndicator.classList.remove('refreshing');
                pullIndicator.style.transform = '';
                pullIndicator.style.opacity = '';
            }, 500);
        } else {
            pullIndicator.style.transform = '';
            pullIndicator.style.opacity = '';
            pullIndicator.classList.remove('pulling');
        }
        
        startY = 0;
        currentY = 0;
        pulling = false;
    }
    
    subscriberList.addEventListener('touchstart', handleTouchStart, { passive: false });
    subscriberList.addEventListener('touchmove', handleTouchMove, { passive: false });
    subscriberList.addEventListener('touchend', handleTouchEnd);
}

// ========================================
// FLOATING ACTION BUTTON (FAB)
// ========================================
function initializeFAB() {
    const fab = document.getElementById('fab');
    const fabButton = document.getElementById('fabButton');
    const fabActions = document.getElementById('fabActions');
    const fabStartRoute = document.getElementById('fabStartRoute');
    const fabCompleteRoute = document.getElementById('fabCompleteRoute');
    const fabReport = document.getElementById('fabReport');
    
    if (!fab || !fabButton) return;
    
    let isOpen = false;
    
    // Toggle FAB menu
    fabButton.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        
        if (isOpen) {
            fabButton.classList.add('active');
            fabActions.classList.remove('hidden');
            setTimeout(() => fabActions.classList.add('show'), 10);
            triggerHaptic('light');
        } else {
            closeFAB();
        }
    });
    
    // Close FAB when clicking outside
    document.addEventListener('click', (e) => {
        if (isOpen && !fab.contains(e.target)) {
            closeFAB();
        }
    });
    
    function closeFAB() {
        isOpen = false;
        fabButton.classList.remove('active');
        fabActions.classList.remove('show');
        setTimeout(() => fabActions.classList.add('hidden'), 300);
    }
    
    // FAB Actions
    if (fabStartRoute) {
        fabStartRoute.addEventListener('click', () => {
            triggerHaptic('medium');
            if (currentCircuit) {
                startRoute(currentCircuit);
                closeFAB();
            } else {
                showNotificationEnhanced('Valitse ensin piiri', 'error');
            }
        });
    }
    
    if (fabCompleteRoute) {
        fabCompleteRoute.addEventListener('click', () => {
            triggerHaptic('medium');
            if (currentCircuit) {
                completeRoute(currentCircuit);
                closeFAB();
            } else {
                showNotificationEnhanced('Valitse ensin piiri', 'error');
            }
        });
    }
    
    if (fabReport) {
        fabReport.addEventListener('click', () => {
            triggerHaptic('light');
            const reportBtn = document.getElementById('reportBtn');
            if (reportBtn) {
                reportBtn.click();
                closeFAB();
            }
        });
    }
    
    // Show/hide FAB based on current tab and mobile view
    updateFABVisibility();
}

function updateFABVisibility() {
    const fab = document.getElementById('fab');
    if (!fab) return;
    
    const deliveryTab = document.getElementById('deliveryTab');
    const isDeliveryTabActive = deliveryTab && deliveryTab.classList.contains('active');
    const isMobile = window.innerWidth <= 768;
    const hasCircuit = !!currentCircuit;
    
    if (isMobile && isDeliveryTabActive && hasCircuit) {
        fab.classList.remove('hidden');
    } else {
        fab.classList.add('hidden');
    }
}

// Call updateFABVisibility when needed
if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateFABVisibility);
}

// Quick route optimization without map
async function quickOptimizeRoute() {
    if (!currentCircuit || !allData[currentCircuit]) {
        showNotification('Valitse ensin piiri', 'error');
        return;
    }
    
    showNotification('Optimoidaan reittiä...', 'info');
    
    try {
        const circuitData = allData[currentCircuit];
        
        // Get geocoded locations for optimization
        const cache = await initGeocodingCache();
        const locations = [];
        
        for (const sub of circuitData) {
            const fullAddress = `${sub.address}, Imatra, Finland`;
            const cached = await getGeocodingCache(cache, fullAddress);
            
            if (cached) {
                locations.push({
                    lat: cached.lat,
                    lon: cached.lon,
                    address: sub.address,
                    name: sub.name,
                    products: sub.products,
                    originalIndex: sub.orderIndex
                });
            }
        }
        
        if (locations.length < circuitData.length * 0.8) {
            // Less than 80% cached - suggest using map first
            showNotification('Avaa kartta optimoidaksesi reitin ensimmäisen kerran', 'warning');
            return;
        }
        
        // Optimize route
        const optimizedRoute = optimizeCarDeliveryRoute(locations);
        
        // Reorder cards
        reorderSubscriberCards(optimizedRoute);
        
        showNotification('Reitti optimoitu! Kortit järjestetty.', 'success');
        
    } catch (error) {
        console.error('Quick optimize failed:', error);
        showNotification('Optimointi epäonnistui', 'error');
    }
}

// Update quick optimize button visibility
function updateQuickOptimizeButton(circuitId) {
    const quickOptimizeBtn = document.getElementById('quickOptimizeBtn');
    if (!quickOptimizeBtn) return;
    
    // Show button if there's a saved route OR if geocoding cache exists
    const hasSavedRoute = loadOptimizedRoute(circuitId) !== null;
    
    if (hasSavedRoute) {
        quickOptimizeBtn.style.display = 'block';
        quickOptimizeBtn.title = 'Käytä tallennettua optimoitua reittiä';
    } else {
        // Check if enough addresses are geocoded
        initGeocodingCache().then(async cache => {
            if (!allData[circuitId]) return;
            
            let cachedCount = 0;
            for (const sub of allData[circuitId]) {
                const fullAddress = `${sub.address}, Imatra, Finland`;
                const cached = await getGeocodingCache(cache, fullAddress);
                if (cached) cachedCount++;
            }
            
            if (cachedCount >= allData[circuitId].length * 0.8) {
                quickOptimizeBtn.style.display = 'block';
                quickOptimizeBtn.title = 'Optimoi reitti automaattisesti';
            } else {
                quickOptimizeBtn.style.display = 'none';
            }
        });
    }
}

// Message Swipe and Read Functionality
function initializeMessageSwipe() {
    // This will be called when messages are rendered
    // We'll add swipe handlers to message cards dynamically
}

function addSwipeToMessageCard(messageCard, messageId, isOffline) {
    if (!messageId) {
        return;
    }

    let startX = 0;
    let currentX = 0;
    let isSwiping = false;
    
    const handleStart = (e) => {
        // Don't interfere with button clicks or text selection
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
            return;
        }
        
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        currentX = startX;
        isSwiping = true;
        messageCard.style.transition = 'none';
    };
    
    const handleMove = (e) => {
        if (!isSwiping) return;
        
        currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const diff = currentX - startX;
        
        // Only allow swiping right (positive diff)
        if (diff > 0) {
            const translateX = Math.min(diff, 200); // Cap at 200px
            messageCard.style.transform = `translateX(${translateX}px)`;
            messageCard.style.opacity = 1 - (translateX / 300);
        }
    };
    
    const handleEnd = async () => {
        if (!isSwiping) return;
        
        const diff = currentX - startX;
        isSwiping = false;
        
        messageCard.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        
        // If swiped more than 100px, dismiss message
        if (diff > 100) {
            if (isOffline) {
                await dismissOfflineMessage(messageCard, messageId);
            } else {
                await markMessageAsRead(messageCard, messageId);
            }
        } else {
            // Snap back
            messageCard.style.transform = '';
            messageCard.style.opacity = '';
        }
    };
    
    // Add event listeners
    messageCard.addEventListener('mousedown', handleStart);
    messageCard.addEventListener('touchstart', handleStart, {passive: true});
    
    messageCard.addEventListener('mousemove', handleMove);
    messageCard.addEventListener('touchmove', handleMove, {passive: true});
    
    messageCard.addEventListener('mouseup', handleEnd);
    messageCard.addEventListener('touchend', handleEnd);
    messageCard.addEventListener('mouseleave', handleEnd);
    
    messageCard.style.cursor = 'grab';
    messageCard.style.userSelect = 'none';
}

async function dismissOfflineMessage(messageCard, messageId) {
    // Animate card off screen
    messageCard.style.transform = 'translateX(100%)';
    messageCard.style.opacity = '0';
    
    setTimeout(() => {
        // Remove the offline message from localStorage
        const messages = loadRouteMessages();
        const index = parseInt(messageId.replace('offline-', ''));
        if (index >= 0 && index < messages.length) {
            messages.splice(index, 1);
            localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
        }
        renderRouteMessages();
    }, 300);
}

async function markMessageAsRead(messageCard, messageId) {
    // Animate card off screen
    messageCard.style.transform = 'translateX(100%)';
    messageCard.style.opacity = '0';
    
    // Show checkmark animation
    const checkmark = document.createElement('div');
    checkmark.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 10000;
        font-size: 80px;
        animation: checkmarkPopIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;
    
    checkmark.innerHTML = `
        <div style="width: 80px; height: 80px;">
            <svg viewBox="0 0 52 52" xmlns="http://www.w3.org/2000/svg">
                <circle cx="26" cy="26" r="25" fill="#28a745" style="animation: circlePulse 0.3s ease-out;"/>
                <path class="checkmark" d="M14 27 L22 35 L38 17" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" style="stroke-dasharray: 50; stroke-dashoffset: 50; animation: checkmarkDraw 0.3s ease-out 0.2s forwards;"/>
            </svg>
        </div>
    `;
    
    document.body.appendChild(checkmark);
    
    try {
        // Mark message as read via backend API
        await window.mailiaAPI.markMessageAsRead(messageId);
        
        // Remove checkmark and re-render messages after a delay
        setTimeout(() => {
            document.body.removeChild(checkmark);
            renderRouteMessages();
        }, 800);
    } catch (error) {
        console.error('Error marking message as read:', error);
        // Show error and reset card position
        setTimeout(() => {
            document.body.removeChild(checkmark);
            messageCard.style.transform = '';
            messageCard.style.opacity = '';
            showNotification('Virhe viestin merkitsemisessä', 'error');
        }, 500);
    }
}

function saveRouteMessages(messages) {
    localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
}

function applyFilters() {
    const hideStf = document.getElementById('hideStfFilter').checked;
    const hideDelivered = document.getElementById('hideDeliveredFilter').checked;
    const cards = document.querySelectorAll('.subscriber-card');
    
    cards.forEach(card => {
        const products = card.dataset.products.toUpperCase();
        const hasStf = products.includes('STF');
        const checkbox = card.querySelector('input[type="checkbox"]');
        const isDelivered = checkbox && checkbox.checked;
        
        let shouldHide = false;
        
        if (hideStf && hasStf) {
            shouldHide = true;
        }
        
        if (hideDelivered && isDelivered) {
            shouldHide = true;
        }
        
        if (shouldHide) {
            // Add hiding class for animation
            card.classList.add('hiding');
            // After animation completes, hide with display: none
            setTimeout(() => {
                if (card.classList.contains('hiding')) {
                    card.style.display = 'none';
                }
            }, ANIMATION_DURATION_MS);
        } else {
            // Show the card
            card.style.display = '';
            // Remove hiding class to trigger show animation
            setTimeout(() => {
                card.classList.remove('hiding');
            }, 10);
        }
    });
    
    // Re-number visible cards and hide empty building groups
    setTimeout(() => {
        const buildingGroups = document.querySelectorAll('.building-group');
        let visibleCounter = 1;
        
        buildingGroups.forEach(group => {
            const visibleCards = Array.from(group.querySelectorAll('.subscriber-card'))
                .filter(card => card.style.display !== 'none');
            
            if (visibleCards.length > 0) {
                group.style.display = '';
                
                // Re-number visible cards in this group
                visibleCards.forEach(card => {
                    const numberBadge = card.querySelector('.delivery-order-number');
                    if (numberBadge) {
                        numberBadge.textContent = String(visibleCounter++);
                    }
                });
                
                // Update delivery count badge to reflect visible deliveries only
                const countBadge = group.querySelector('.building-delivery-count');
                if (countBadge) {
                    countBadge.textContent = `${visibleCards.length} jakelua`;
                }
            } else {
                group.style.display = 'none';
            }
        });
    }, ANIMATION_DURATION_MS);
}

// Checkbox State Management
function getCheckboxState(circuitId, address) {
    const key = `checkbox_${circuitId}_${address}`;
    return localStorage.getItem(key) === 'true';
}

async function saveCheckboxState(circuitId, address, checked, subscriberId = null) {
    const key = `checkbox_${circuitId}_${address}`;
    localStorage.setItem(key, checked);
    
    // Save to backend if online and route is active
    const routeId = localStorage.getItem(`route_id_${circuitId}`);
    if (routeId && window.mailiaAPI) {
        try {
            // Use provided subscriberId or find it from cached data
            let subId = subscriberId;
            if (!subId) {
                const subscribers = allData[circuitId] || [];
                const subscriber = subscribers.find(s => s.address === address);
                subId = subscriber?.id;
            }
            
            if (subId) {
                await window.mailiaAPI.updateDelivery(routeId, subId, checked);
                console.log(`Delivery ${checked ? 'marked' : 'unmarked'} for ${address}`);
            }
        } catch (error) {
            console.error('Failed to sync delivery to backend:', error);
            
            // Add to offline queue if offline and offlineDB is available
            if (!navigator.onLine && offlineDB && subscriberId) {
                try {
                    await offlineDB.addToSyncQueue({
                        entity_type: 'delivery',
                        action: 'update',
                        data: {
                            routeId: routeId,
                            subscriberId: subscriberId,
                            isDelivered: checked,
                            circuitId: circuitId,
                            address: address
                        }
                    });
                    console.log('📥 Added delivery to offline sync queue');
                } catch (offlineError) {
                    console.error('Failed to add to offline queue:', offlineError);
                }
            }
        }
    }
}

// Route Timing
async function startRoute(circuitId) {
    const now = new Date();
    const startKey = `route_start_${circuitId}`;
    const endKey = `route_end_${circuitId}`;
    const completeKey = `route_complete_${circuitId}`;
    
    // Check if route was previously completed
    const wasCompleted = localStorage.getItem(endKey) !== null;
    
    // Clear any existing completion data when restarting route
    localStorage.removeItem(completeKey);
    localStorage.removeItem(endKey);  // Also clear end time to fully reset route
    
    // Set new start time
    localStorage.setItem(startKey, now.toISOString());
    
    // Start route in backend
    if (window.mailiaAPI) {
        try {
            const route = await window.mailiaAPI.startRoute(circuitId);
            localStorage.setItem(`route_id_${circuitId}`, route.id);
            console.log(`Route started in backend: ${route.id}`);
            
            // Join the route room for real-time updates
            window.mailiaAPI.joinRoute(route.id);
            
            // Emit route update to WebSocket
            window.mailiaAPI.emitRouteUpdate({
                circuitId: circuitId,
                routeId: route.id,
                status: 'started',
                startTime: now.toISOString()
            });
        } catch (error) {
            console.error('Failed to start route in backend:', error);
            // Continue with localStorage-only mode
        }
    }
    
    // If route was previously completed, reload the circuit to restore subscriber cards
    if (wasCompleted) {
        console.log('Reloading circuit after completing and restarting route...');
        // Clear cache to force reload
        delete allData[circuitId];
        await loadCircuit(circuitId);
    }
    
    // Show the subscriber list with cascading animation
    showSubscriberListWithAnimation();
    
    // Update UI to reflect in-progress state
    updateRouteButtons(circuitId);
    
    // If route was previously completed, ensure complete button is visible
    if (wasCompleted) {
        const completeBtn = document.getElementById('completeRouteBtn');
        const endTimeDisplay = document.getElementById('routeEndTime');
        if (completeBtn) completeBtn.style.display = 'block';
        if (endTimeDisplay) endTimeDisplay.style.display = 'none';
    }
}

function showSubscriberListWithAnimation() {
    const subscriberList = document.getElementById('subscriberList');
    
    // Make the list visible
    subscriberList.style.display = 'block';
    
    // Get all subscriber cards
    const cards = subscriberList.querySelectorAll('.subscriber-card');
    
    // Add cascading animation to each card
    cards.forEach((card, index) => {
        // Initially hide cards
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        // Animate in with staggered delay
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 40); // 40ms delay between each card for faster reveal
    });
}

async function completeRoute(circuitId) {
    const now = new Date();
    const key = `route_end_${circuitId}`;
    
    // Haptic feedback for route completion
    triggerHaptic('success');
    
    // Complete route in backend
    const routeId = localStorage.getItem(`route_id_${circuitId}`);
    if (routeId && window.mailiaAPI) {
        try {
            await window.mailiaAPI.completeRoute(routeId);
            console.log(`Route completed in backend: ${routeId}`);
            
            // Emit route update to WebSocket
            window.mailiaAPI.emitRouteUpdate({
                circuitId: circuitId,
                routeId: parseInt(routeId),
                status: 'completed',
                endTime: now.toISOString()
            });
        } catch (error) {
            console.error('Failed to complete route in backend:', error);
            // Continue with localStorage-only mode
        }
    }
    
    // Show success animation immediately - centered on viewport
    const loader = document.getElementById('routeCompleteLoader');
    if (loader) {
        loader.style.display = 'flex';
        // Ensure it's on top and centered regardless of scroll position
        loader.style.position = 'fixed';
        loader.style.top = '0';
        loader.style.left = '0';
        loader.style.width = '100%';
        loader.style.height = '100%';
    }
    
    // Save completion time
    localStorage.setItem(key, now.toISOString());
    
    // Hide subscriber cards with cascading animation
    hideSubscriberListWithAnimation();
    
    // Calculate total animation time for hiding cards
    const subscriberList = document.getElementById('subscriberList');
    const cards = subscriberList.querySelectorAll('.subscriber-card');
    const totalAnimationTime = cards.length * 40 + 400; // Match hideSubscriberListWithAnimation timing
    
    // Keep success animation visible for 1.5 seconds total, then fade out
    const displayDuration = Math.max(1500, totalAnimationTime);
    
    setTimeout(() => {
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.4s ease-out';
            setTimeout(() => {
                loader.style.display = 'none';
                loader.style.opacity = '';
                loader.style.transition = '';
                loader.style.position = '';
                loader.style.top = '';
                loader.style.left = '';
                loader.style.width = '';
                loader.style.height = '';
            }, 400);
        }
    }, displayDuration);
    
    updateRouteButtons(circuitId);
    // Hide progress bar when route is finished and refresh circuit cards
    if (typeof recalcAndRenderProgress === 'function') {
        recalcAndRenderProgress();
    }
    // Refresh circuit selector to update progress bars on all circuit cards
    if (typeof populateCircuitSelector === 'function') {
        await populateCircuitSelector();
    }
}

function hideSubscriberListWithAnimation() {
    const subscriberList = document.getElementById('subscriberList');
    const cards = subscriberList.querySelectorAll('.subscriber-card');
    
    // Reverse cascade - animate cards out from last to first
    const totalCards = cards.length;
    cards.forEach((card, index) => {
        // Calculate reverse index for bottom-to-top animation
        const reverseIndex = totalCards - index - 1;
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
        }, reverseIndex * 40); // 40ms delay between each card for faster hiding
    });
    
    // Hide the subscriber list after all animations complete
    setTimeout(() => {
        subscriberList.style.display = 'none';
        // Reset card styles for next time
        cards.forEach(card => {
            card.style.opacity = '';
            card.style.transform = '';
            card.style.transition = '';
        });
    }, totalCards * 40 + 400); // Wait for all animations plus transition duration
}

function updateRouteButtons(circuitId) {
    const startKey = `route_start_${circuitId}`;
    const endKey = `route_end_${circuitId}`;
    const startTime = localStorage.getItem(startKey);
    const endTime = localStorage.getItem(endKey);
    
    const startBtn = document.getElementById('startRouteBtn');
    const startTimeDisplay = document.getElementById('routeStartTime');
    const completeContainer = document.querySelector('.route-complete-container');
    const completeBtn = document.getElementById('completeRouteBtn');
    const endTimeDisplay = document.getElementById('routeEndTime');
    
    if (!startTime) {
        startBtn.style.display = 'block';
        startTimeDisplay.style.display = 'none';
        completeContainer.style.display = 'none';
    } else if (!endTime) {
        startBtn.style.display = 'none';
        startTimeDisplay.style.display = 'block';
        startTimeDisplay.textContent = `Aloitettu: ${formatTime(new Date(startTime))}`;
        completeContainer.style.display = 'block';
        completeBtn.style.display = 'block';
        endTimeDisplay.style.display = 'none';
    } else {
        // Route is completed - show "Aloita reitti" button again to allow viewing the list
        startBtn.style.display = 'block';
        startTimeDisplay.style.display = 'none'; // Hide start time when route is completed
        completeContainer.style.display = 'block';
        completeBtn.style.display = 'none';
        endTimeDisplay.style.display = 'block';
        
        const duration = calculateDuration(new Date(startTime), new Date(endTime));
        endTimeDisplay.textContent = `Valmis: ${formatTime(new Date(endTime))} (${duration})`;
    }
}

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function calculateDuration(start, end) {
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}min`;
    } else {
        return `${minutes}min`;
    }
}

// Route Messages (Admin Panel)
async function renderRouteMessages() {
    const messagesContainer = document.getElementById('routeMessages');
    if (!messagesContainer) {
        return;
    }
    
    // Show skeleton loading
    messagesContainer.innerHTML = '';
    showSkeletonLoader(messagesContainer, 'message', 4);

    const appendMessageCard = (message) => {
        const messageCard = document.createElement('div');
        messageCard.className = 'message-card';
        if (message.is_read) {
            messageCard.classList.add('message-read');
        }
        if (message.is_offline) {
            messageCard.classList.add('message-offline');
        }

        const timestampValue = message.created_at || message.timestamp || new Date().toISOString();
        const timestamp = new Date(timestampValue);
        const formattedDate = timestamp.toLocaleString('fi-FI');

        // Create elements safely to prevent XSS
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';

        const circuitSpan = document.createElement('span');
        circuitSpan.className = 'message-circuit';
        circuitSpan.textContent = message.circuit_id || message.circuit_name || 'N/A';

        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'message-timestamp';
        timestampSpan.textContent = formattedDate;

        const metaWrap = document.createElement('div');
        metaWrap.className = 'message-meta';
        metaWrap.appendChild(timestampSpan);

        if (message.is_offline) {
            const offlineBadge = document.createElement('span');
            offlineBadge.className = 'message-badge offline';
            offlineBadge.textContent = 'Offline-viesti';
            metaWrap.appendChild(offlineBadge);
        } else if (message.is_read) {
            const readBadge = document.createElement('span');
            readBadge.className = 'message-badge read';
            readBadge.textContent = 'Luettu';
            metaWrap.appendChild(readBadge);
        }

        messageHeader.appendChild(circuitSpan);
        messageHeader.appendChild(metaWrap);

        const messageBody = document.createElement('div');
        messageBody.className = 'message-body';

        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = message.message || 'Ei viestiä';

        const messageUser = document.createElement('div');
        messageUser.className = 'message-user';
        messageUser.innerHTML = '<strong>Lähettäjä:</strong> ';
        messageUser.appendChild(document.createTextNode(message.username || 'Tuntematon'));

        messageBody.appendChild(messageText);
        messageBody.appendChild(messageUser);

        // Add photo if available
        if (message.photo_url) {
            const photoContainer = document.createElement('div');
            photoContainer.className = 'message-photo-container';
            
            // Construct proper photo URL based on environment
            const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
            const baseUrl = IS_PRODUCTION ? '' : 'http://localhost:3000';
            const photoUrl = message.photo_url.startsWith('http') ? message.photo_url : `${baseUrl}${message.photo_url}`;
            
            const photoLink = document.createElement('a');
            photoLink.href = photoUrl;
            photoLink.target = '_blank';
            photoLink.rel = 'noopener noreferrer';
            
            const photoImg = document.createElement('img');
            photoImg.src = photoUrl;
            photoImg.alt = 'Liitetty kuva';
            photoImg.className = 'message-photo';
            photoImg.loading = 'lazy';
            
            // Handle image load error
            photoImg.onerror = () => {
                photoImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EKuva ei saatavilla%3C/text%3E%3C/svg%3E';
                photoImg.alt = 'Kuva ei saatavilla';
            };
            
            photoLink.appendChild(photoImg);
            photoContainer.appendChild(photoLink);
            messageBody.appendChild(photoContainer);
        }

        messageCard.appendChild(messageHeader);
        messageCard.appendChild(messageBody);

        // Add click-to-mark-as-read functionality
        if (!message.is_read && !message.is_offline) {
            messageCard.style.cursor = 'pointer';
            messageCard.addEventListener('click', async (e) => {
                // Don't interfere with button/link/image clicks
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'IMG') {
                    return;
                }
                
                try {
                    await window.mailiaAPI.markMessageAsRead(message.id);
                    messageCard.classList.add('message-read');
                    
                    // Update badge
                    const existingBadge = messageCard.querySelector('.message-badge');
                    if (existingBadge) {
                        existingBadge.className = 'message-badge read';
                        existingBadge.textContent = 'Luettu';
                    } else {
                        const readBadge = document.createElement('span');
                        readBadge.className = 'message-badge read';
                        readBadge.textContent = 'Luettu';
                        metaWrap.appendChild(readBadge);
                    }
                    
                    messageCard.style.cursor = 'default';
                    showNotificationEnhanced('Viesti merkitty luetuksi', 'success');
                } catch (error) {
                    console.error('Error marking message as read:', error);
                    showNotificationEnhanced('Virhe viestin merkitsemisessä', 'error');
                }
            });
        }

        messagesContainer.appendChild(messageCard);
    };
    
    try {
        // Fetch messages from backend API
        const messages = await window.mailiaAPI.getTodayMessages();
        
        // Hide skeleton loader
        hideSkeletonLoader(messagesContainer);
        
        // Clear container for real content
        messagesContainer.innerHTML = '';

        // Merge in any locally stored offline reports that haven't synced yet
        const storedLocalMessages = loadRouteMessages();
        let remainingLocal = storedLocalMessages;

        if (Array.isArray(messages) && messages.length > 0 && storedLocalMessages.length > 0) {
            remainingLocal = storedLocalMessages.filter(entry => {
                const composed = `${entry.reason || ''} - ${entry.address || ''}`.trim();
                return !messages.some(apiMessage => (apiMessage.message || '').trim() === composed);
            });

            if (remainingLocal.length !== storedLocalMessages.length) {
                localStorage.setItem('mailiaRouteMessages', JSON.stringify(remainingLocal));
            }
        }

        const offlineMessages = remainingLocal.map((entry, index) => ({
            id: `offline-${index}`,
            circuit_id: entry.circuit,
            circuit_name: circuitNames[entry.circuit] || entry.circuit || 'N/A',
            message: `${entry.reason || ''}${entry.reason ? ' - ' : ''}${entry.address || ''}`.trim(),
            username: entry.name || 'Tuntematon',
            created_at: entry.timestamp || new Date().toISOString(),
            is_offline: true
        }));

        const combinedMessages = [...(Array.isArray(messages) ? messages : []), ...offlineMessages];
        const sortedMessages = combinedMessages.sort((a, b) => {
            const aDate = new Date(a.created_at || a.timestamp || 0).getTime();
            const bDate = new Date(b.created_at || b.timestamp || 0).getTime();
            return bDate - aDate;
        });
        
        if (!sortedMessages || sortedMessages.length === 0) {
            showEmptyState(messagesContainer, {
                icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
                title: 'Ei viestejä',
                message: 'Tänään ei ole vielä raportoitu toimitusongelmi a. Viestit näkyvät täällä kun niitä lähetetään.'
            });
            return;
        }
        
        messagesContainer.innerHTML = '';
        sortedMessages.forEach(appendMessageCard);
    } catch (error) {
        console.error('Error fetching messages:', error);
        const offlineOnly = loadRouteMessages();
        if (offlineOnly.length > 0) {
            messagesContainer.innerHTML = '';
            offlineOnly
                .map((entry, index) => ({
                    id: `offline-${index}`,
                    circuit_id: entry.circuit,
                    circuit_name: circuitNames[entry.circuit] || entry.circuit || 'N/A',
                    message: `${entry.reason || ''}${entry.reason ? ' - ' : ''}${entry.address || ''}`.trim(),
                    username: entry.name || 'Tuntematon',
                    created_at: entry.timestamp || new Date().toISOString(),
                    is_offline: true
                }))
                .forEach(appendMessageCard);
        } else {
            messagesContainer.innerHTML = '<p class="no-messages">Virhe viestien lataamisessa</p>';
        }
    }
}

// Circuit Tracker
function initializeCircuitTracker() {
    renderCircuitTracker();
}

async function renderCircuitTracker() {
    // Prevent concurrent renders
    if (isRenderingTracker) {
        console.log('Circuit tracker render already in progress, ignoring request');
        return;
    }
    
    isRenderingTracker = true;
    
    try {
        const tracker = document.getElementById('circuitTracker');
        if (!tracker) {
            console.error('circuitTracker element not found');
            return;
        }
        
        tracker.innerHTML = '<div class="loading">Ladataan...</div>';
        
        // Fetch today's routes from backend
        let routesData = {};
        try {
            const response = await window.mailiaAPI.getTodayRoutes();
            console.log('Today routes from API:', response);
            
            // Create a map of circuit_id string (e.g., "KP3") -> route data
            if (response && Array.isArray(response)) {
                response.forEach(route => {
                    // Use the circuit_id string from the joined circuits table
                    const circuitIdString = route.circuit_id; // This is the "KP3" string from JOIN
                    if (circuitIdString && !routesData[circuitIdString]) {
                        routesData[circuitIdString] = route;
                    }
                });
            }
            console.log('Routes data map:', routesData);
        } catch (error) {
            console.error('Error fetching today routes:', error);
            // Fall back to localStorage if API fails
        }
        
        tracker.innerHTML = '';
        
        // Use circuitNames instead of allData since we're lazy loading
        const circuits = Object.keys(circuitNames).sort(sortCircuits);
        
        if (circuits.length === 0) {
            showEmptyState(tracker, {
                icon: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
                title: 'Ei piirejä',
                message: 'Jakelupiirejä ei ole vielä määritetty. Ota yhteyttä järjestelmänvalvojaan.'
            });
            return;
        }
        
        for (const circuitId of circuits) {
            const item = await createCircuitItem(circuitId, routesData[circuitId]);
            tracker.appendChild(item);
        }
    } catch (error) {
        console.error('Error rendering circuit tracker:', error);
    } finally {
        isRenderingTracker = false;
    }
}

async function createCircuitItem(circuitId, routeData) {
    const item = document.createElement('div');
    item.className = 'circuit-item';
    
    const status = getCircuitStatus(circuitId, routeData);
    
    // Add status class for gradient background
    item.classList.add(`${status}-item`);
    
    // Status bar on the left
    const statusBar = document.createElement('div');
    statusBar.className = `circuit-status-bar ${status}`;
    item.appendChild(statusBar);
    
    // Content container
    const content = document.createElement('div');
    content.className = 'circuit-content';
    
    const header = document.createElement('div');
    header.className = 'circuit-header';
    
    const name = document.createElement('div');
    name.className = 'circuit-name';
    name.textContent = circuitNames[circuitId] || circuitId;
    header.appendChild(name);
    
    // Add 3-dot menu button for admin users (always visible)
    const role = getEffectiveUserRole();
    if (role === 'admin' || role === 'manager') {
        const menuBtn = document.createElement('button');
        menuBtn.className = 'circuit-menu-btn';
        menuBtn.innerHTML = '⋮';
        menuBtn.title = 'Hallinta';
        menuBtn.onclick = async (e) => {
            e.stopPropagation();
            showCircuitManagementMenu(circuitId, routeData, status);
        };
        header.appendChild(menuBtn);
    }
    
    content.appendChild(header);
    
    const statusText = document.createElement('div');
    statusText.className = 'circuit-status';
    statusText.textContent = getCircuitStatusText(circuitId, status, routeData);
    content.appendChild(statusText);
    
    // Add progress bar for in-progress circuits
    if (status === 'in-progress') {
        const progressBar = await createCircuitProgressBar(circuitId, routeData);
        if (progressBar) {
            content.appendChild(progressBar);
        }
    }
    
    item.appendChild(content);
    
    return item;
}

async function createCircuitProgressBar(circuitId, routeData = null) {
    let deliveredCount = 0;
    let totalSubscribers = 0;
    
    // If we have route data from API, use the delivery counts from backend
    if (routeData && routeData.total_deliveries !== undefined) {
        totalSubscribers = routeData.total_deliveries || 0;
        deliveredCount = routeData.completed_deliveries || 0;
    } else {
        // Fallback to localStorage-based calculation
        const data = await loadCircuitData(circuitId);
        if (!data || data.length === 0) return null;
        
        // Filter out subscribers with only STF products
        const today = new Date().getDay();
        const subscribersWithoutOnlySTF = data.filter(sub => {
            // Check if subscriber has any non-STF products
            const hasNonSTF = sub.products.some(product => {
                const simplifiedProduct = simplifyProductName(product.trim(), today);
                return simplifiedProduct !== 'STF';
            });
            return hasNonSTF;
        });
        
        totalSubscribers = subscribersWithoutOnlySTF.length;
        if (totalSubscribers === 0) return null;
        
        // Count delivered by checking localStorage checkbox state (excluding STF-only)
        deliveredCount = subscribersWithoutOnlySTF.filter(sub => getCheckboxState(circuitId, sub.address)).length;
    }
    
    if (totalSubscribers === 0) return null;
    const percentage = Math.round((deliveredCount / totalSubscribers) * 100);
    
    const container = document.createElement('div');
    container.className = 'circuit-progress-bar';
    
    const progressWrapper = document.createElement('div');
    progressWrapper.style.cssText = 'background: rgba(0,0,0,0.1); border-radius: 10px; height: 8px; overflow: hidden; margin-bottom: 0.25rem;';
    
    const progressFill = document.createElement('div');
    progressFill.style.cssText = `background: #FFA726; height: 100%; width: ${percentage}%; transition: width 0.3s;`;
    progressWrapper.appendChild(progressFill);
    
    const progressText = document.createElement('div');
    progressText.style.cssText = 'font-size: 0.85rem; color: var(--medium-gray); text-align: right;';
    progressText.textContent = `${deliveredCount}/${totalSubscribers} (${percentage}%)`;
    
    container.appendChild(progressWrapper);
    container.appendChild(progressText);
    
    return container;
}

function getCircuitStatus(circuitId, routeData) {
    // If route data from API is available, use it
    if (routeData) {
        // Check for completed status
        if (routeData.status === 'completed' || routeData.end_time) {
            return 'completed';
        }
        // Check for in-progress status (database uses 'in-progress' status when started)
        if (routeData.status === 'in-progress' || routeData.start_time) {
            return 'in-progress';
        }
        // If status is explicitly 'not-started' with no times, return not-started
        if (routeData.status === 'not-started' || (!routeData.start_time && !routeData.end_time)) {
            return 'not-started';
        }
    }
    
    // Fall back to localStorage
    const startKey = `route_start_${circuitId}`;
    const endKey = `route_end_${circuitId}`;
    const startTime = localStorage.getItem(startKey);
    const endTime = localStorage.getItem(endKey);
    
    if (!startTime) return 'not-started';
    if (!endTime) return 'in-progress';
    return 'completed';
}

function getCircuitStatusText(circuitId, status, routeData) {
    if (status === 'not-started') {
        return 'Ei aloitettu';
    } else if (status === 'in-progress') {
        let startTime;
        
        // Use route data from API if available
        if (routeData && routeData.start_time) {
            startTime = new Date(routeData.start_time);
        } else {
            // Fall back to localStorage
            const startKey = `route_start_${circuitId}`;
            const startTimeStr = localStorage.getItem(startKey);
            if (startTimeStr) {
                startTime = new Date(startTimeStr);
            }
        }
        
        if (startTime) {
            return `Aloitettu: ${formatTime(startTime)}`;
        }
        return 'Käynnissä';
    } else {
        // Completed - show completion time
        let endTime;
        
        // Use route data from API if available
        if (routeData && routeData.end_time) {
            endTime = new Date(routeData.end_time);
        } else {
            // Fall back to localStorage
            const endKey = `route_end_${circuitId}`;
            const endTimeStr = localStorage.getItem(endKey);
            if (endTimeStr) {
                endTime = new Date(endTimeStr);
            }
        }
        
        if (endTime) {
            return `Valmis: ${formatTime(endTime)}`;
        }
        return 'Valmis';
    }
}

function startCircuitFromTracker(circuitId) {
    startRoute(circuitId);
    renderCircuitTracker();
}

function completeCircuitFromTracker(circuitId) {
    completeRoute(circuitId);
    renderCircuitTracker();
}

// Midnight Reset
function checkMidnightReset() {
    const lastResetDate = localStorage.getItem('lastResetDate');
    const today = new Date().toDateString();
    
    if (lastResetDate !== today) {
        performMidnightReset();
        localStorage.setItem('lastResetDate', today);
    }
}

function performMidnightReset() {
    // Clear all route times and checkboxes
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('route_start_') || key.startsWith('route_end_') || key.startsWith('checkbox_')) {
            localStorage.removeItem(key);
        }
    });
}

function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
        performMidnightReset();
        localStorage.setItem('lastResetDate', new Date().toDateString());
        
        // Refresh the display if user is on a delivery tab
        if (currentCircuit) {
            loadCircuit(currentCircuit);
        }
        
        // Refresh tracker if visible
        if (document.getElementById('trackerTab').classList.contains('active')) {
            renderCircuitTracker();
        }
        
        // Schedule next midnight reset
        scheduleMidnightReset();
    }, timeUntilMidnight);
}

// Update notification time to show current device time
function updateNotificationTime() {
    const timeElement = document.getElementById('notificationTime');
    if (timeElement) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeElement.textContent = `${hours}:${minutes}`;
    }
}

// ============= Dashboard Functions =============

let dashboardData = {
    routeTimes: [],
    selectedCircuits: [], // Store selected circuits for filtering
    dailyCount: 0,
    periodCount: 0,
    monthlyReport: []
};

let allCircuits = []; // Store all available circuits

// Load today's delivery count
async function loadTodayDeliveryCount() {
    try {
        console.log('Loading today delivery count...');
        const data = await window.mailiaAPI.getTodayDeliveryCount();
        console.log('Today delivery count data:', data);
        dashboardData.dailyCount = data.total_papers || 0;
        const countElement = document.getElementById('todayDeliveryCount');
        if (countElement) {
            countElement.textContent = dashboardData.dailyCount.toLocaleString('fi-FI');
        }
    } catch (error) {
        console.error('Error loading today delivery count:', error);
        showNotification('Virhe ladattaessa päivän tilastoja: ' + (error.message || 'Tuntematon virhe'), 'error');
    }
}

// Load period delivery count (monthly or yearly)
async function loadPeriodDeliveryCount() {
    try {
        const year = document.getElementById('yearSelector')?.value;
        const isMonthly = document.getElementById('toggleMonthly')?.checked;
        const month = isMonthly ? document.getElementById('monthSelector')?.value : null;
        
        console.log('Loading period delivery count:', { year, month, isMonthly });
        
        if (!year) {
            console.error('Year selector not found or no value');
            return;
        }
        
        const data = await window.mailiaAPI.getPeriodDeliveryCount(year, month);
        console.log('Period delivery count data:', data);
        dashboardData.periodCount = data.total_papers || 0;
        
        const countElement = document.getElementById('periodDeliveryCount');
        if (countElement) {
            countElement.textContent = dashboardData.periodCount.toLocaleString('fi-FI');
        }
        
        // Update label
        const label = isMonthly ? 'lehteä toimitettu tässä kuussa' : 'lehteä toimitettu tänä vuonna';
        const labelElement = document.getElementById('periodLabel');
        if (labelElement) {
            labelElement.textContent = label;
        }
    } catch (error) {
        console.error('Error loading period delivery count:', error);
        showNotification('Virhe ladattaessa tilastoja: ' + (error.message || 'Tuntematon virhe'), 'error');
    }
}

// Export monthly delivery report
async function exportMonthlyDeliveryReport() {
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        
        const data = await window.mailiaAPI.getMonthlyDeliveryReport(year, month);
        
        if (!data || data.length === 0) {
            showNotification('Ei tietoja vietäväksi', 'error');
            return;
        }
        
        // Format data for export
        const exportData = data.map(row => ({
            'Päivämäärä': new Date(row.route_date).toLocaleDateString('fi-FI'),
            'Toimitukset': row.total_deliveries,
            'Lehtiä yhteensä': row.total_papers
        }));
        
        exportToExcel(exportData, `toimitukset-${year}-${month.toString().padStart(2, '0')}`);
    } catch (error) {
        console.error('Error exporting monthly report:', error);
        showNotification('Virhe vietäessä raporttia', 'error');
    }
}

// Show circuit selection modal
async function showCircuitSelectionModal() {
    // Fetch all circuits if not already loaded
    if (allCircuits.length === 0) {
        try {
            allCircuits = await window.mailiaAPI.getCircuits();
        } catch (error) {
            console.error('Error loading circuits:', error);
            showNotification('Virhe ladattaessa piirejä', 'error');
            return;
        }
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'custom-dialog-overlay';
    modal.innerHTML = `
        <div class="custom-dialog circuit-selection-dialog">
            <h3>Valitse piirit</h3>
            <div class="circuit-checkbox-list">
                <label class="circuit-checkbox-item">
                    <input type="checkbox" id="selectAllCircuits" ${dashboardData.selectedCircuits.length === 0 ? 'checked' : ''}>
                    <span>Kaikki piirit</span>
                </label>
                ${allCircuits.map(circuit => `
                    <label class="circuit-checkbox-item">
                        <input type="checkbox" class="circuit-checkbox" value="${circuit.circuit_id}" 
                            ${dashboardData.selectedCircuits.includes(circuit.circuit_id) ? 'checked' : ''}>
                        <span>${circuit.circuit_name || circuit.circuit_id}</span>
                    </label>
                `).join('')}
            </div>
            <div class="custom-dialog-buttons">
                <button class="custom-dialog-btn cancel-btn">Peruuta</button>
                <button class="custom-dialog-btn confirm-btn">Vahvista</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle select all checkbox
    const selectAllCheckbox = modal.querySelector('#selectAllCircuits');
    const circuitCheckboxes = modal.querySelectorAll('.circuit-checkbox');
    
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        circuitCheckboxes.forEach(cb => cb.checked = !isChecked);
    });
    
    circuitCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const anyChecked = Array.from(circuitCheckboxes).some(checkbox => checkbox.checked);
            selectAllCheckbox.checked = !anyChecked;
        });
    });
    
    // Handle confirm
    modal.querySelector('.confirm-btn').addEventListener('click', () => {
        if (selectAllCheckbox.checked) {
            dashboardData.selectedCircuits = [];
            document.getElementById('selectedCircuitsDisplay').textContent = 'Kaikki piirit';
        } else {
            dashboardData.selectedCircuits = Array.from(circuitCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            
            if (dashboardData.selectedCircuits.length === 0) {
                document.getElementById('selectedCircuitsDisplay').textContent = 'Kaikki piirit';
            } else {
                document.getElementById('selectedCircuitsDisplay').textContent = 
                    `${dashboardData.selectedCircuits.length} piiriä valittu`;
            }
        }
        document.body.removeChild(modal);
    });
    
    // Handle cancel
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Handle overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
}

// Load route times with circuit filtering
async function loadRouteTimes() {
    const startDate = document.getElementById('routeTimesStartDate').value;
    const endDate = document.getElementById('routeTimesEndDate').value;
    
    console.log('Loading route times:', { startDate, endDate, selectedCircuits: dashboardData.selectedCircuits });
    
    if (!startDate || !endDate) {
        showNotification('Valitse päivämääräväli', 'error');
        return;
    }
    
    try {
        let data = await window.mailiaAPI.getDashboardRouteTimes(startDate, endDate);
        console.log('Route times data received:', data);
        
        // Filter by selected circuits
        if (dashboardData.selectedCircuits.length > 0) {
            data = data.filter(row => dashboardData.selectedCircuits.includes(row.circuit_id));
            console.log('Filtered data:', data);
        }
        
        dashboardData.routeTimes = data;
        renderRouteTimesTable(data);
        showNotification(`${data.length} reittiä ladattu`, 'success');
    } catch (error) {
        console.error('Error loading route times:', error);
        showNotification('Virhe ladattaessa reittiaikoja: ' + (error.message || 'Tuntematon virhe'), 'error');
    }
}

function renderRouteTimesTable(data) {
    const container = document.getElementById('routeTimesTable');
    
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="no-data">Ei tietoja valitulta ajalta</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'dashboard-table';
    
    table.innerHTML = `
        <thead>
            <tr>
                <th>Päivämäärä</th>
                <th>Piiri</th>
                <th>Käyttäjä</th>
                <th>Aloitus</th>
                <th>Lopetus</th>
                <th>Tunnit</th>
                <th>Toimitukset</th>
                <th>Tila</th>
            </tr>
        </thead>
        <tbody>
            ${data.map(row => `
                <tr>
                    <td>${new Date(row.route_date).toLocaleDateString('fi-FI')}</td>
                    <td>${row.circuit_name || row.circuit_id}</td>
                    <td>${row.username}</td>
                    <td>${row.start_time ? new Date(row.start_time).toLocaleTimeString('fi-FI') : '-'}</td>
                    <td>${row.end_time ? new Date(row.end_time).toLocaleTimeString('fi-FI') : '-'}</td>
                    <td>${row.total_hours ? parseFloat(row.total_hours).toFixed(2) : '-'}</td>
                    <td>${row.completed_deliveries || 0}/${row.total_deliveries || 0}</td>
                    <td><span class="status-badge status-${row.status}">${getStatusText(row.status)}</span></td>
                </tr>
            `).join('')}
        </tbody>
    `;
    
    container.innerHTML = '';
    container.appendChild(table);
}

function getStatusText(status) {
    const statusMap = {
        'not-started': 'Ei aloitettu',
        'in-progress': 'Kesken',
        'completed': 'Valmis'
    };
    return statusMap[status] || status;
}

function exportToExcel(data, filename) {
    if (!data || data.length === 0) {
        showNotification('Ei tietoja vietäväksi', 'error');
        return;
    }
    
    // Convert data to CSV format
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(header => {
                const value = row[header];
                // Handle dates and times
                if (value instanceof Date) {
                    return value.toISOString();
                }
                // Escape commas and quotes
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            }).join(',')
        )
    ].join('\n');
    
    // Add BOM for UTF-8 Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showNotification('Tiedosto ladattu', 'success');
    }
}

let dashboardInitialized = false;
let dashboardRefreshInterval = null;

function initializeDashboard() {
    if (dashboardInitialized) {
        console.log('Dashboard already initialized, skipping...');
        return;
    }
    dashboardInitialized = true;
    
    console.log('Initializing dashboard...');
    
    // Set default dates to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const formatDate = (date) => date.toISOString().split('T')[0];
    
    // Route times dates
    const routeTimesStartDate = document.getElementById('routeTimesStartDate');
    const routeTimesEndDate = document.getElementById('routeTimesEndDate');
    if (routeTimesStartDate) routeTimesStartDate.value = formatDate(firstDay);
    if (routeTimesEndDate) routeTimesEndDate.value = formatDate(lastDay);
    
    // Period selectors - set to current month/year
    const yearSelector = document.getElementById('yearSelector');
    const monthSelector = document.getElementById('monthSelector');
    if (yearSelector) yearSelector.value = today.getFullYear();
    if (monthSelector) monthSelector.value = today.getMonth() + 1;
    
    // Load initial data
    loadTodayDeliveryCount();
    loadPeriodDeliveryCount();
    
    // Set up auto-refresh for daily count every 5 minutes
    dashboardRefreshInterval = setInterval(loadTodayDeliveryCount, 5 * 60 * 1000);
    
    // Add event listeners with error checking
    const refreshDailyBtn = document.getElementById('refreshDailyCountBtn');
    const exportDailyBtn = document.getElementById('exportDailyCountBtn');
    const loadPeriodBtn = document.getElementById('loadPeriodCountBtn');
    const toggleMonthly = document.getElementById('toggleMonthly');
    const toggleYearly = document.getElementById('toggleYearly');
    const selectCircuitsBtn = document.getElementById('selectCircuitsBtn');
    const loadRouteTimesBtn = document.getElementById('loadRouteTimesBtn');
    const exportRouteTimesBtn = document.getElementById('exportRouteTimesBtn');
    const monthSelectorLabel = document.getElementById('monthSelectorLabel');
    
    if (refreshDailyBtn) {
        refreshDailyBtn.addEventListener('click', () => {
            console.log('Refresh daily count clicked');
            loadTodayDeliveryCount();
        });
    }
    
    if (exportDailyBtn) {
        exportDailyBtn.addEventListener('click', () => {
            console.log('Export daily count clicked');
            exportMonthlyDeliveryReport();
        });
    }
    
    if (loadPeriodBtn) {
        loadPeriodBtn.addEventListener('click', () => {
            console.log('Load period count clicked');
            loadPeriodDeliveryCount();
        });
    }
    
    // Toggle between monthly/yearly
    if (toggleMonthly) {
        toggleMonthly.addEventListener('change', () => {
            console.log('Toggle monthly selected');
            if (monthSelectorLabel) monthSelectorLabel.style.display = 'flex';
            const periodLabel = document.getElementById('periodLabel');
            if (periodLabel) periodLabel.textContent = 'lehteä toimitettu tässä kuussa';
            loadPeriodDeliveryCount();
        });
    }
    
    if (toggleYearly) {
        toggleYearly.addEventListener('change', () => {
            console.log('Toggle yearly selected');
            if (monthSelectorLabel) monthSelectorLabel.style.display = 'none';
            const periodLabel = document.getElementById('periodLabel');
            if (periodLabel) periodLabel.textContent = 'lehteä toimitettu tänä vuonna';
            loadPeriodDeliveryCount();
        });
    }
    
    // Year and month selector changes
    if (yearSelector) {
        yearSelector.addEventListener('change', () => {
            console.log('Year changed:', yearSelector.value);
            loadPeriodDeliveryCount();
        });
    }
    
    if (monthSelector) {
        monthSelector.addEventListener('change', () => {
            console.log('Month changed:', monthSelector.value);
            loadPeriodDeliveryCount();
        });
    }
    
    // Circuit selection
    if (selectCircuitsBtn) {
        selectCircuitsBtn.addEventListener('click', () => {
            console.log('Select circuits clicked');
            showCircuitSelectionModal();
        });
    }
    
    // Route times
    if (loadRouteTimesBtn) {
        loadRouteTimesBtn.addEventListener('click', () => {
            console.log('Load route times clicked');
            loadRouteTimes();
        });
    }
    
    if (exportRouteTimesBtn) {
        exportRouteTimesBtn.addEventListener('click', () => {
            console.log('Export route times clicked');
            if (!dashboardData.routeTimes || dashboardData.routeTimes.length === 0) {
                showNotification('Lataa tiedot ensin', 'error');
                return;
            }
            
            // Format data for export with Finnish headers
            const exportData = dashboardData.routeTimes.map(row => ({
                'Päivämäärä': new Date(row.route_date).toLocaleDateString('fi-FI'),
                'Piiri': row.circuit_name || row.circuit_id,
                'Käyttäjä': row.username,
                'Aloitus': row.start_time ? new Date(row.start_time).toLocaleTimeString('fi-FI') : '-',
                'Lopetus': row.end_time ? new Date(row.end_time).toLocaleTimeString('fi-FI') : '-',
                'Tunnit': row.total_hours ? parseFloat(row.total_hours).toFixed(2) : '-',
                'Toimitukset': `${row.completed_deliveries || 0}/${row.total_deliveries || 0}`,
                'Tila': getStatusText(row.status)
            }));
            
            exportToExcel(exportData, `reittiajat-${Date.now()}`);
        });
    }
    
    console.log('Dashboard initialized successfully');
}

// ===========================
// MANUAL SUBSCRIBER MANAGEMENT (ADMIN ONLY)
// ===========================

// Initialize add subscriber functionality
function initializeAddSubscriberModal() {
    const addBtn = document.getElementById('addSubscriberBtn');
    const modal = document.getElementById('addSubscriberModal');
    const form = document.getElementById('addSubscriberForm');

    // Hide the settings button (now using + buttons between cards)
    if (addBtn) {
        addBtn.style.display = 'none';
    }

    // Form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAddSubscriber();
        });
    }
}

// Open modal with optional pre-filled circuit and order index
function openAddSubscriberModal(circuitId = null, orderIndex = null) {
    const modal = document.getElementById('addSubscriberModal');
    const circuitSelect = document.getElementById('subscriberCircuit');
    const orderIndexInput = document.getElementById('subscriberOrderIndex');
    
    populateCircuitOptions();
    populateProductCheckboxes();
    
    // Pre-fill circuit if provided
    if (circuitId && circuitSelect) {
        circuitSelect.value = circuitId;
    }
    
    // Pre-fill order index if provided
    if (orderIndex !== null && orderIndexInput) {
        orderIndexInput.value = orderIndex;
    }
    
    modal.style.display = 'block';
}

// Populate circuit dropdown
function populateCircuitOptions() {
    const circuitSelect = document.getElementById('subscriberCircuit');
    if (!circuitSelect) {
        console.warn('[populateCircuitOptions] subscriberCircuit select not found');
        return;
    }

    // Try to read from existing circuit selector if present; fallback to known circuitFiles keys
    const circuitSelectorEl = document.getElementById('circuitSelector');
    let currentCircuits = [];
    if (circuitSelectorEl && circuitSelectorEl.options) {
        currentCircuits = Array.from(circuitSelectorEl.options)
            .filter(opt => opt.value !== '')
            .map(opt => ({ id: opt.value, name: opt.text }));
    } else {
        // Fallback: use circuitFiles map if delivery selector not mounted (e.g. tracker view)
        currentCircuits = Object.keys(circuitFiles).map(id => ({ id, name: id }));
        console.log('[populateCircuitOptions] fallback using circuitFiles map');
    }

    circuitSelect.innerHTML = '<option value="">Valitse piiri...</option>';
    currentCircuits.forEach(circuit => {
        const option = document.createElement('option');
        option.value = circuit.id;
        option.textContent = circuit.name;
        circuitSelect.appendChild(option);
    });
}

// Populate product checkboxes with all available products
function populateProductCheckboxes() {
    // Target only the Add Subscriber modal's container
    const container = document.getElementById('addSubscriberProductCheckboxes');
    const products = [
        'UV', 'HS', 'ES', 'ISA', 'STF', 'JO', 'LU', 'PASA', 'YHTS', 'MST',
        'HSP', 'HSPE', 'HSPS', 'HSLS', 'HSTS', 'HSTO', 'MALA', 'SH',
        'ESP', 'ESMP', 'ESPS', 'ESLS', 'ETSA',
        'ISAP', 'ISALASU', 'ISAPESU', 'ISASU',
        'RL', 'PL', 'Muu', 'LUUM'
    ];

    container.innerHTML = '';
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-checkbox-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `product_${product}`;
        checkbox.value = product;
        
        const label = document.createElement('label');
        label.htmlFor = `product_${product}`;
        label.textContent = product;
        
        div.appendChild(checkbox);
        div.appendChild(label);
        container.appendChild(div);
    });
}

// Handle subscriber addition
async function handleAddSubscriber() {
    const circuitId = document.getElementById('subscriberCircuit').value;
    const street = document.getElementById('subscriberStreet').value.trim();
    const number = document.getElementById('subscriberNumber').value.trim();
    const building = document.getElementById('subscriberBuilding').value.trim();
    const apartment = document.getElementById('subscriberApartment').value.trim();
    const name = document.getElementById('subscriberName').value.trim();
    const orderIndexInput = document.getElementById('subscriberOrderIndex').value.trim();
    const orderIndex = orderIndexInput ? parseInt(orderIndexInput) : null;

    // Get selected products (scoped to Add Subscriber modal)
    const modal = document.getElementById('addSubscriberModal');
    const productsContainer = modal.querySelector('#addSubscriberProductCheckboxes');
    const selectedProducts = getCheckedProducts(productsContainer);

    if (!circuitId) {
        showNotification('Valitse piiri', 'error');
        return;
    }

    if (!street) {
        showNotification('Syötä katu', 'error');
        return;
    }

    if (selectedProducts.length === 0) {
        showNotification('Valitse vähintään yksi tuote', 'error');
        return;
    }

    try {
        // Use sessionStorage for auth token (matches api.js implementation)
        const token = sessionStorage.getItem('mailiaAuthToken');
        
        if (!token) {
            throw new Error('No authentication token available');
        }
        
        // Use proper API URL with environment detection
        const IS_PRODUCTION = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        const API_BASE_URL = IS_PRODUCTION ? '/api' : 'http://localhost:3000/api';
        
        const response = await fetch(`${API_BASE_URL}/subscriptions/subscriber`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                circuitId,
                street,
                number,
                building,
                apartment,
                name,
                products: selectedProducts,
                orderIndex
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            const errorMsg = error.error || error.message || `HTTP ${response.status}`;
            console.error('Add subscriber failed:', response.status, errorMsg, error);
            throw new Error(errorMsg);
        }

        const result = await response.json();
        
        showNotification(
            result.action === 'created' 
                ? 'Tilaaja lisätty onnistuneesti!' 
                : 'Tilaaja päivitetty onnistuneesti!',
            'success'
        );

        closeAddSubscriberModal();

        // Broadcast update via WebSocket
        if (window.mailiaAPI && window.mailiaAPI.socket && window.mailiaAPI.socket.connected) {
            window.mailiaAPI.socket.emit('subscriber_updated', {
                circuitId,
                action: result.action
            });
        }

        // Refresh current circuit if it matches
        if (currentCircuit === circuitId) {
            await loadCircuit(circuitId);
        }
    } catch (error) {
        console.error('Add subscriber error:', error);
        showNotification(error.message || 'Tilaajan lisäys epäonnistui', 'error');
    }
}

// Close modal
function closeAddSubscriberModal() {
    const modal = document.getElementById('addSubscriberModal');
    const form = document.getElementById('addSubscriberForm');
    
    modal.style.display = 'none';
    form.reset();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize add subscriber modal if admin or manager (deferred until role known)
    const role = getEffectiveUserRole();
    console.log('[DOMContentLoaded] role at init:', role);
    if (role === 'admin' || role === 'manager') {
        initializeAddSubscriberModal();
    }
    
    // Initialize UI/UX enhancements
    initializeEnhancements();
});

/* ========================================
   UI/UX ENHANCEMENTS
   ======================================== */

// Global state for undo functionality
let lastDeliveryAction = null;

function initializeEnhancements() {
    setupOfflineDetection();
    setupKeyboardShortcuts();
    improveErrorMessages();
    announceToScreenReader('Sovellus ladattu');
}

// Offline Detection
function setupOfflineDetection() {
    const banner = document.getElementById('offlineBanner');
    
    function updateOnlineStatus() {
        if (navigator.onLine) {
            banner.classList.remove('show');
            announceToScreenReader('Yhteys palautettu');
        } else {
            banner.classList.add('show');
            announceToScreenReader('Ei yhteyttä internetiin');
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K: Focus circuit search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            const searchInput = document.getElementById('circuitSearch');
            if (searchInput) {
                document.getElementById('customCircuitSelect')?.click();
                setTimeout(() => searchInput.focus(), 100);
                announceToScreenReader('Piirihaku avattu');
            }
        }
        
        // /: Focus search (if circuit selector is open)
        if (e.key === '/' && !e.target.matches('input, textarea')) {
            e.preventDefault();
            const searchInput = document.getElementById('circuitSearch');
            const dropdown = document.getElementById('circuitSelectDropdown');
            if (dropdown?.style.display !== 'none') {
                searchInput?.focus();
            }
        }
        
        // Esc: Close modals and dropdowns
        if (e.key === 'Escape') {
            const dropdown = document.getElementById('circuitSelectDropdown');
            if (dropdown?.style.display !== 'none') {
                dropdown.style.display = 'none';
            }
        }
    });
}

// Enhanced showNotification with undo support
const originalShowNotification = showNotification;
function showNotificationEnhanced(message, type = 'info', options = {}) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} enter`;
    toast.setAttribute('role', 'status');

    const icons = {
        success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
        error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
        info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
    };

    const content = `
        <div class="toast-content">
            <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icons[type] || icons.info}
            </svg>
            <span class="toast-message">${message}</span>
        </div>
        ${options.action ? `
            <div class="toast-actions">
                <button class="toast-action-btn" data-action="true">${options.action.label}</button>
            </div>
        ` : ''}
        <button class="toast-dismiss" aria-label="Sulje ilmoitus">×</button>
    `;

    toast.innerHTML = content;

    const dismissBtn = toast.querySelector('.toast-dismiss');
    const actionBtn = toast.querySelector('[data-action="true"]');
    
    function remove() {
        toast.classList.remove('enter');
        toast.classList.add('exit');
        setTimeout(() => toast.remove(), 250);
    }

    dismissBtn.addEventListener('click', remove);
    
    if (actionBtn && options.action) {
        actionBtn.addEventListener('click', () => {
            options.action.handler();
            remove();
        });
    }

    container.appendChild(toast);
    
    setTimeout(remove, options.duration || 4000);
    
    announceToScreenReader(message);
}

// Helper function to announce to screen readers
function announceToScreenReader(message) {
    const liveRegion = document.getElementById('statusUpdates');
    if (liveRegion) {
        liveRegion.textContent = message;
        setTimeout(() => { liveRegion.textContent = ''; }, 1000);
    }
}

// Loading state management
function setLoading(element, isLoading) {
    if (!element) return;
    
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
        element.setAttribute('aria-busy', 'true');
    } else {
        element.classList.remove('loading');
        element.disabled = false;
        element.removeAttribute('aria-busy');
    }
}

// Show skeleton loader
function showSkeletonLoader(container, count = 3) {
    if (!container) return;
    
    container.innerHTML = Array.from({ length: count }, () => `
        <div class="skeleton skeleton-card"></div>
    `).join('');
}

// Empty state component
function showEmptyState(container, config = {}) {
    const {
        icon = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
        title = 'Ei tuloksia',
        message = 'Ei näytettävää sisältöä'
    } = config;
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${icon}
            </svg>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

// Enhanced error messages
function improveErrorMessages() {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        try {
            const response = await originalFetch.apply(this, args);
            if (!response.ok && !navigator.onLine) {
                throw new Error('OFFLINE');
            }
            return response;
        } catch (error) {
            if (error.message === 'OFFLINE' || error.message === 'Failed to fetch') {
                showNotificationEnhanced('Verkkovirhe: Tarkista internetyhteys ja yritä uudelleen', 'error');
            }
            throw error;
        }
    };
}

// Route progress indicator (per product unit)
function updateRouteProgress(delivered, total) {
    const existingProgress = document.querySelector('.route-progress');

    // Determine if progress should be hidden (route completed or nothing to show)
    let shouldHide = false;
    try {
        if (currentCircuit) {
            const endKey = `route_end_${currentCircuit}`;
            if (localStorage.getItem(endKey)) {
                shouldHide = true;
            }
        }
    } catch (_) {}
    if (total === 0) {
        shouldHide = true;
    }

    if (shouldHide) {
        if (existingProgress) {
            // Animate fade-out before removal
            existingProgress.classList.add('fade-out');
            setTimeout(() => existingProgress.remove(), 300);
        }
        return;
    }

    // Normal update path: replace with new markup
    if (existingProgress) existingProgress.remove();

    const percentage = Math.round((delivered / total) * 100);
    const progressHTML = `
        <div class="route-progress">
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-text">
                <span><strong>${delivered}</strong> / ${total} tuotetta</span>
                <span>${percentage}%</span>
            </div>
        </div>`;

    const coverSheet = document.querySelector('.cover-sheet');
    if (coverSheet) coverSheet.insertAdjacentHTML('afterend', progressHTML);
}

// Calculate delivery progress (per product unit)
function calculateDeliveryProgress() {
    const cards = document.querySelectorAll('.subscriber-card');
    let total = 0;
    let delivered = 0;
    cards.forEach(card => {
        const raw = card.dataset.products || '';
        const products = raw.split(',').map(s => s.trim()).filter(Boolean);
        if (!products.length) return;
        
        // Filter out STF products from progress calculation
        const nonStfProducts = products.filter(p => !p.toUpperCase().startsWith('STF'));
        const units = nonStfProducts.length;
        
        if (units === 0) return; // Skip cards with only STF products
        
        total += units;
        const checkbox = card.querySelector('.delivery-checkbox');
        if (checkbox && checkbox.checked) delivered += units;
    });
    return { total, delivered };
}

// Mark cards as delivered visually
function updateDeliveredCardStyles() {
    document.querySelectorAll('.subscriber-card').forEach(card => {
        const checkbox = card.querySelector('.delivery-checkbox');
        if (checkbox?.checked) {
            card.classList.add('delivered');
        } else {
            card.classList.remove('delivered');
        }
    });
}

// Enhanced delivery checkbox handler with undo
function enhanceDeliveryCheckboxes() {
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('delivery-checkbox')) {
            const card = e.target.closest('.subscriber-card');
            const isChecked = e.target.checked;
            
            // Store for undo
            lastDeliveryAction = {
                checkbox: e.target,
                wasChecked: !isChecked,
                timestamp: Date.now()
            };
            
            // Update visual state
            updateDeliveredCardStyles();
            
            // Update progress
            const progress = calculateDeliveryProgress();
            updateRouteProgress(progress.delivered, progress.total);
            
            // Show notification with undo option
            if (window.mailiaAPI?.isAuthenticated()) {
                showNotificationEnhanced(
                    isChecked ? 'Merkitty toimitetuksi' : 'Merkintä poistettu',
                    'success',
                    {
                        duration: 5000,
                        action: {
                            label: 'Peru',
                            handler: () => undoDeliveryAction()
                        }
                    }
                );
            }
        }
    });
}

// Undo last delivery action
function undoDeliveryAction() {
    if (!lastDeliveryAction) return;
    
    const { checkbox, wasChecked } = lastDeliveryAction;
    if (checkbox && document.body.contains(checkbox)) {
        checkbox.checked = wasChecked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        lastDeliveryAction = null;
        announceToScreenReader('Toimitus peruttu');
    }
}

// Initialize enhanced checkboxes
enhanceDeliveryCheckboxes();

// Recalculate progress after circuit load (wrapper already exists)
function recalcAndRenderProgress() {
    updateDeliveredCardStyles();
    const progress = calculateDeliveryProgress();
    updateRouteProgress(progress.delivered, progress.total);
}

if (typeof window.loadCircuit === 'function') {
    const _origLCProgressWrap = window.loadCircuit;
    window.loadCircuit = async function(...args) {
        const result = await _origLCProgressWrap.apply(this, args);
        recalcAndRenderProgress();
        return result;
    };
}

// ========================================
// CIRCUIT MAP VIEW WITH GEOCODING (Leaflet + OpenStreetMap)
// ========================================

// Viewport zoom control helpers
function enableZoom() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes');
    }
}

function disableZoom() {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
    }
}

// Unified public API for showing a circuit map with geocoded addresses
async function showCircuitMap(circuitId) {
    try {
        // Enable zoom for map interaction
        enableZoom();
        
        // Load circuit data
        const circuitData = await loadCircuitData(circuitId);
        
        if (!circuitData || circuitData.length === 0) {
            showNotification('Ei osoitteita tälle piirille', 'error');
            disableZoom();
            return;
        }

        // Filter for today's deliveries
        const today = new Date().getDay();
        const filteredData = circuitData.map(subscriber => {
            if (!subscriber.products || subscriber.products.length === 0) {
                return null;
            }
            
            const validProducts = [];
            subscriber.products.forEach(product => {
                const productStr = typeof product === 'object' ? (product.code || product.name || '') : String(product);
                const normalized = normalizeProduct(productStr);
                
                if (normalized.toUpperCase().includes('STF')) {
                    return;
                }
                
                const individualProducts = normalized.split(/\s+/);
                individualProducts.forEach(individualProduct => {
                    if (isProductValidForDay(individualProduct, today)) {
                        validProducts.push(individualProduct);
                    }
                });
            });
            
            if (validProducts.length === 0) {
                return null;
            }
            
            return {
                ...subscriber,
                products: validProducts
            };
        }).filter(sub => sub !== null);

        if (filteredData.length === 0) {
            showNotification('Ei näytettäviä osoitteita tänään', 'info');
            disableZoom();
            return;
        }

        const excludedCount = circuitData.length - filteredData.length;
        const excludedInfo = excludedCount > 0 ? ` (${excludedCount} osoitetta piilotettu)` : '';

        // Create fullscreen map overlay
        const mapOverlay = document.createElement('div');
        mapOverlay.id = 'circuitMapOverlay';

        // Create header
        const mapHeader = document.createElement('div');
        mapHeader.className = 'map-overlay-header';
        mapHeader.innerHTML = `
            <h3 class="map-overlay-title">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                ${circuitNames[circuitId] || circuitId} - Karttanäkymä
            </h3>
            <button id="closeCircuitMapBtn" class="map-overlay-close-btn">✕ Sulje</button>
        `;

        // Create map container
        const mapContainer = document.createElement('div');
        mapContainer.id = 'circuitMapContainer';

        // Create info panel
        const infoPanel = document.createElement('div');
        infoPanel.id = 'mapInfoPanel';
        infoPanel.innerHTML = `
            <p style="margin: 0;">Haetaan sijaintitietoja...</p>
            <p style="margin: 0; font-size: 0.9rem; color: #aaa;">OpenStreetMap + Leaflet</p>
        `;

        mapOverlay.appendChild(mapHeader);
        mapOverlay.appendChild(mapContainer);
        mapOverlay.appendChild(infoPanel);
        document.body.appendChild(mapOverlay);

        // Close button handler
        // Overlay close helpers
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeOverlay();
            }
        };
        const onOverlayClick = (e) => {
            if (e.target === mapOverlay) {
                closeOverlay();
            }
        };
        function closeOverlay() {
            document.removeEventListener('keydown', onKeyDown);
            mapOverlay.removeEventListener('click', onOverlayClick);
            mapOverlay.remove();
            // Disable zoom when map is closed
            disableZoom();
        }

        document.getElementById('closeCircuitMapBtn').addEventListener('click', closeOverlay);
        mapOverlay.addEventListener('click', onOverlayClick);
        document.addEventListener('keydown', onKeyDown);

        // Initialize map with geocoding
        await initializeCircuitMapWithGeocoding(circuitId, filteredData, mapContainer, infoPanel, excludedInfo);
    } catch (error) {
        console.error('Error showing circuit map:', error);
        showNotification('Kartan lataus epäonnistui', 'error');
        // Disable zoom if map fails to load
        disableZoom();
    }
}

// Initialize circuit map with geocoded addresses (OPTIMIZED)
async function initializeCircuitMapWithGeocoding(circuitId, circuitData, mapContainer, infoPanel, excludedInfo) {
    try {
        const locations = [];
        let geocodedCount = 0;
        let cachedCount = 0;

        showNotification('Haetaan osoitteiden sijainteja...', 'info');

        // Initialize geocoding cache
        const cache = await initGeocodingCache();

        // OPTIMIZATION 1: Separate cached and uncached addresses
        const cachedItems = [];
        const uncachedItems = [];
        
        // Check cache for all addresses first (parallel reads)
        const cacheChecks = await Promise.all(circuitData.map(async (subscriber) => {
            const fullAddress = `${subscriber.address}, Imatra, Finland`;
            const cached = await getGeocodingCache(cache, fullAddress);
            return { subscriber, fullAddress, cached };
        }));
        
        // Separate into cached and uncached
        cacheChecks.forEach(({ subscriber, fullAddress, cached }) => {
            if (cached) {
                locations.push({
                    lat: cached.lat,
                    lon: cached.lon,
                    address: subscriber.address,
                    name: subscriber.name,
                    products: subscriber.products
                });
                cachedCount++;
                geocodedCount++;
                cachedItems.push(fullAddress);
            } else {
                uncachedItems.push({ subscriber, fullAddress });
            }
        });

        // Update progress with cached results
        if (cachedCount > 0) {
            infoPanel.innerHTML = `
                <p style="margin: 0;">Ladataan... <strong>${geocodedCount}/${circuitData.length} osoitetta</strong></p>
                <p style="margin: 0; font-size: 0.85rem; color: #4caf50;">${cachedCount} välimuistista ✓</p>
                <p style="margin: 0; font-size: 0.9rem; color: #aaa;">OpenStreetMap + Leaflet</p>
            `;
        }

        // OPTIMIZATION 2: Process uncached items in larger batches (faster when no API delay needed)
        const batchSize = 5; // Increased from 3
        const delayBetweenBatches = 300; // Reduced from 400ms
        
        for (let i = 0; i < uncachedItems.length; i += batchSize) {
            const batch = uncachedItems.slice(i, i + batchSize);
            
            await Promise.all(batch.map(async ({ subscriber, fullAddress }) => {
                try {
                    // Use Nominatim geocoding service
                    const encodedAddress = encodeURIComponent(fullAddress);
                    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`, {
                        headers: {
                            'User-Agent': 'Mailia Delivery App'
                        }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Geocoding failed');
                    }
                    
                    const data = await response.json();
                    
                    if (data && data.length > 0) {
                        const coords = {
                            lat: parseFloat(data[0].lat),
                            lon: parseFloat(data[0].lon)
                        };
                        
                        // Save to cache (don't await - fire and forget for speed)
                        saveGeocodingCache(cache, fullAddress, coords).catch(err => 
                            console.warn('Cache save failed:', err)
                        );
                        
                        locations.push({
                            lat: coords.lat,
                            lon: coords.lon,
                            address: subscriber.address,
                            name: subscriber.name,
                            products: subscriber.products
                        });
                        geocodedCount++;
                    }
                } catch (error) {
                    console.warn(`Could not geocode ${fullAddress}:`, error);
                }
            }));

            // OPTIMIZATION 3: Batch DOM updates (update every 5 items, not every item)
            if ((i % (batchSize * 2) === 0) || (i + batchSize >= uncachedItems.length)) {
                infoPanel.innerHTML = `
                    <p style="margin: 0;">Ladataan... <strong>${geocodedCount}/${circuitData.length} osoitetta</strong></p>
                    <p style="margin: 0; font-size: 0.85rem; color: #4caf50;">${cachedCount} välimuistista</p>
                    <p style="margin: 0; font-size: 0.9rem; color: #aaa;">OpenStreetMap + Leaflet</p>
                `;
            }
            
            // Respectful delay between batches (only for non-cached items)
            if (i + batchSize < uncachedItems.length) {
                await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
            }
        }

        if (locations.length === 0) {
            showNotification('Osoitteiden sijainteja ei löytynyt', 'error');
            infoPanel.innerHTML = `
                <p style="margin: 0;">Virhe: Ei sijaintitietoja</p>
                <p style="margin: 0; font-size: 0.9rem; color: #aaa;">OpenStreetMap + Leaflet</p>
            `;
            return;
        }

        // OPTIMIZATION 4: Pre-load Leaflet while geocoding (if not already loaded)
        if (typeof L === 'undefined') {
            await loadLeafletLibrary();
        }

        // Calculate center point
        const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
        const avgLon = locations.reduce((sum, loc) => sum + loc.lon, 0) / locations.length;

        // Create interactive map with Leaflet (using OpenStreetMap)
        const mapElement = document.createElement('div');
        mapElement.id = 'leafletMap';
        mapElement.style.cssText = 'width: 100%; height: 100%;';
        mapContainer.appendChild(mapElement);

        // Initialize Leaflet map with simplified attribution (no 'Leaflet' link)
        const map = L.map('leafletMap', {
            attributionControl: true,
            preferCanvas: true,
            updateWhenIdle: true,
            zoomSnap: 0.25,
            zoomDelta: 0.5
        }).setView([avgLat, avgLon], 14);
        if (map.attributionControl && typeof map.attributionControl.setPrefix === 'function') {
            map.attributionControl.setPrefix('');
        }

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            maxNativeZoom: 19,
            subdomains: ['a', 'b', 'c'],
            reuseTiles: true,
            updateWhenIdle: true,
            keepBuffer: 3,
            detectRetina: true,
            crossOrigin: true,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // OPTIMIZATION 5: Add markers in batches to prevent UI freeze
        const markerBatchSize = 20;
        for (let i = 0; i < locations.length; i += markerBatchSize) {
            const batch = locations.slice(i, i + markerBatchSize);
            
            batch.forEach((location, batchIndex) => {
                const index = i + batchIndex;
                const marker = L.marker([location.lat, location.lon]).addTo(map);
                
                const productsHtml = location.products.map(p => `<span class="map-product-badge">${p}</span>`).join('');

                marker.bindPopup(`
                    <div class="map-popup">
                        <strong class="map-popup-title">${index + 1}. ${location.address}</strong><br>
                        ${location.name ? `<em>${location.name}</em><br>` : ''}
                        <div class="map-product-badges">${productsHtml}</div>
                    </div>
                `);
                
                // Add number label
                const icon = L.divIcon({
                    className: 'number-marker',
                    html: `<div>${index + 1}</div>`,
                    iconSize: [30, 30],
                    iconAnchor: [15, 15]
                });
                marker.setIcon(icon);
            });
            
            // Yield to browser to prevent freezing
            if (i + markerBatchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        // Update info panel
        infoPanel.innerHTML = `
            <p style="margin: 0;">Yhteensä: <strong>${locations.length} osoitetta</strong>${excludedInfo}</p>
            <p style="margin: 0; font-size: 0.9rem; color: #aaa;">OpenStreetMap + Leaflet</p>
        `;

        showNotification(`${locations.length} osoitetta näytetään kartalla`, 'success');

        // Add route optimization button
        addRouteOptimizationButton(map, locations, mapContainer, infoPanel, excludedInfo);

    } catch (error) {
        console.error('Error initializing map:', error);
        throw error;
    }
}

// ==================== CAR DELIVERY ROUTE OPTIMIZATION ====================

// Calculate bearing between two points (0-360 degrees, 0=North)
function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
              Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    
    let bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
}

// Calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => deg * Math.PI / 180;
    
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const straightLineDistance = R * c;
    
    // Apply road network multiplier for realistic driving distance
    // Urban areas typically require 1.3-1.4x straight-line distance due to:
    // - Road network layout (city blocks, curves)
    // - One-way streets and traffic rules
    // - Detours around buildings/obstacles
    // Using 1.35 for Imatra urban area
    const ROAD_MULTIPLIER = 1.35;
    
    return straightLineDistance * ROAD_MULTIPLIER;
}

// Extract street name from full address
function extractStreetName(address) {
    // Remove building codes, stairs, apartment numbers
    let street = address.replace(/[A-Z]-?\d+.*$/i, ''); // Remove A1, B-2, etc
    street = street.replace(/\s*,.*$/, ''); // Remove everything after comma
    street = street.replace(/\d+[a-z]?\s*$/i, ''); // Remove trailing number
    return street.trim();
}

// Determine which side of the street an address is on using perpendicular distance
function determineStreetSide(point, streetLine) {
    // streetLine = { start: {lat, lon}, end: {lat, lon} }
    // Returns: 'window' or 'opposite' (window = kuljettajan ikkunan puoli)
    
    const crossProduct = (
        (streetLine.end.lon - streetLine.start.lon) * (point.lat - streetLine.start.lat) -
        (streetLine.end.lat - streetLine.start.lat) * (point.lon - streetLine.start.lon)
    );
    
    // In geographic coordinates (looking along street direction):
    // positive crossProduct = left side of street
    // negative crossProduct = right side of street
    
    // SUOMI-LOGIIKKA:
    // - Auto ajetaan OIKEALLA kaistalla (right lane)
    // - Kuljettaja istuu VASEMMALLA puolella autoa
    // - Postilaatikot ovat VASEMMALLA puolella tietä
    // - Joten: LEFT side of street = kuljettajan ikkuna = JAETAAN ENSIN
    
    return crossProduct > 0 ? 'window' : 'opposite';
}

// Group addresses by street and determine sides
function groupAddressesByStreet(locations) {
    const streetGroups = new Map();
    
    locations.forEach((loc, index) => {
        const streetName = extractStreetName(loc.address);
        
        if (!streetGroups.has(streetName)) {
            streetGroups.set(streetName, {
                name: streetName,
                addresses: [],
                bounds: { minLat: 90, maxLat: -90, minLon: 180, maxLon: -180 }
            });
        }
        
        const group = streetGroups.get(streetName);
        group.addresses.push({ ...loc, originalIndex: index });
        
        // Update bounds
        group.bounds.minLat = Math.min(group.bounds.minLat, loc.lat);
        group.bounds.maxLat = Math.max(group.bounds.maxLat, loc.lat);
        group.bounds.minLon = Math.min(group.bounds.minLon, loc.lon);
        group.bounds.maxLon = Math.max(group.bounds.maxLon, loc.lon);
    });
    
    return Array.from(streetGroups.values());
}

// Calculate street centerline from addresses
function calculateStreetCenterline(streetGroup) {
    const addresses = streetGroup.addresses;
    
    if (addresses.length === 1) {
        // Single address - use bounds to estimate direction
        return {
            start: { lat: streetGroup.bounds.minLat, lon: streetGroup.bounds.minLon },
            end: { lat: streetGroup.bounds.maxLat, lon: streetGroup.bounds.maxLon },
            center: { lat: addresses[0].lat, lon: addresses[0].lon }
        };
    }
    
    // Find two addresses furthest apart (street endpoints)
    let maxDist = 0;
    let start = addresses[0];
    let end = addresses[0];
    
    for (let i = 0; i < addresses.length; i++) {
        for (let j = i + 1; j < addresses.length; j++) {
            const dist = calculateDistance(
                addresses[i].lat, addresses[i].lon,
                addresses[j].lat, addresses[j].lon
            );
            if (dist > maxDist) {
                maxDist = dist;
                start = addresses[i];
                end = addresses[j];
            }
        }
    }
    
    // Calculate center point
    const centerLat = (start.lat + end.lat) / 2;
    const centerLon = (start.lon + end.lon) / 2;
    
    return {
        start: { lat: start.lat, lon: start.lon },
        end: { lat: end.lat, lon: end.lon },
        center: { lat: centerLat, lon: centerLon }
    };
}

// Optimize route using nearest neighbor TSP approximation
function nearestNeighborTSP(points, startIndex = 0) {
    const visited = new Set();
    const route = [];
    let current = startIndex;
    
    route.push(current);
    visited.add(current);
    
    while (visited.size < points.length) {
        let nearest = -1;
        let minDist = Infinity;
        
        for (let i = 0; i < points.length; i++) {
            if (!visited.has(i)) {
                const dist = calculateDistance(
                    points[current].lat, points[current].lon,
                    points[i].lat, points[i].lon
                );
                if (dist < minDist) {
                    minDist = dist;
                    nearest = i;
                }
            }
        }
        
        if (nearest !== -1) {
            route.push(nearest);
            visited.add(nearest);
            current = nearest;
        } else {
            break;
        }
    }
    
    return route;
}

// 2-opt optimization to improve route by eliminating crossings
function twoOptImprove(route, points) {
    let improved = true;
    let bestRoute = [...route];
    
    while (improved) {
        improved = false;
        
        for (let i = 1; i < bestRoute.length - 2; i++) {
            for (let j = i + 1; j < bestRoute.length - 1; j++) {
                // Calculate current distance
                const currentDist = 
                    calculateDistance(
                        points[bestRoute[i]].lat, points[bestRoute[i]].lon,
                        points[bestRoute[i + 1]].lat, points[bestRoute[i + 1]].lon
                    ) +
                    calculateDistance(
                        points[bestRoute[j]].lat, points[bestRoute[j]].lon,
                        points[bestRoute[j + 1]].lat, points[bestRoute[j + 1]].lon
                    );
                
                // Calculate new distance if we swap
                const newDist = 
                    calculateDistance(
                        points[bestRoute[i]].lat, points[bestRoute[i]].lon,
                        points[bestRoute[j]].lat, points[bestRoute[j]].lon
                    ) +
                    calculateDistance(
                        points[bestRoute[i + 1]].lat, points[bestRoute[i + 1]].lon,
                        points[bestRoute[j + 1]].lat, points[bestRoute[j + 1]].lon
                    );
                
                // If swapping improves the route, do it
                if (newDist < currentDist) {
                    // Reverse the segment between i+1 and j
                    const newRoute = [
                        ...bestRoute.slice(0, i + 1),
                        ...bestRoute.slice(i + 1, j + 1).reverse(),
                        ...bestRoute.slice(j + 1)
                    ];
                    bestRoute = newRoute;
                    improved = true;
                }
            }
        }
    }
    
    return bestRoute;
}

// Main car delivery route optimizer
function optimizeCarDeliveryRoute(locations) {
    console.log('Starting car delivery route optimization...');
    
    // Define depot location (Anssinkatu 12, 55100, Imatra)
    const DEPOT = {
        lat: 61.1898,
        lon: 28.7631,
        address: 'Anssinkatu 12, 55100 Imatra',
        name: 'DEPOT - START/END',
        isDepot: true
    };
    
    // Step 1: Group by street
    const streetGroups = groupAddressesByStreet(locations);
    console.log(`Found ${streetGroups.size} streets`);
    
    // Step 2: Calculate centerlines and separate sides
    streetGroups.forEach(group => {
        const centerline = calculateStreetCenterline(group);
        group.centerline = centerline;
        group.windowSide = [];   // VASEN puoli - kuljettajan ikkuna - JAETAAN ENSIN
        group.oppositeSide = []; // OIKEA puoli - matkustajan puoli - jaetaan palatessa
        
        // Determine which side each address is on
        group.addresses.forEach(addr => {
            const side = determineStreetSide(
                { lat: addr.lat, lon: addr.lon },
                { start: centerline.start, end: centerline.end }
            );
            
            // SUOMI: window side = VASEN = kuljettajan ikkuna = JAETAAN ENSIN
            // opposite side = OIKEA = matkustajan puoli = jaetaan palatessa
            if (side === 'window') {
                group.windowSide.push(addr);
            } else {
                group.oppositeSide.push(addr);
            }
        });
        
        // Sort each side by distance along street
        const sortBySide = (a, b) => {
            const distA = calculateDistance(centerline.start.lat, centerline.start.lon, a.lat, a.lon);
            const distB = calculateDistance(centerline.start.lat, centerline.start.lon, b.lat, b.lon);
            return distA - distB;
        };
        
        group.windowSide.sort(sortBySide);
        group.oppositeSide.sort(sortBySide);
    });
    
    // Step 3: Find nearest street to depot to start route
    const streetCenters = streetGroups.map(g => g.centerline.center);
    let nearestStreetIndex = 0;
    let minDistToDepot = Infinity;
    
    streetCenters.forEach((center, idx) => {
        const dist = calculateDistance(DEPOT.lat, DEPOT.lon, center.lat, center.lon);
        if (dist < minDistToDepot) {
            minDistToDepot = dist;
            nearestStreetIndex = idx;
        }
    });
    
    console.log(`Nearest street to depot: index ${nearestStreetIndex}, distance ${minDistToDepot.toFixed(2)}km`);
    
    // Optimize street order using TSP starting from nearest street to depot, with 2-opt improvement
    let streetOrder = nearestNeighborTSP(streetCenters, nearestStreetIndex);
    
    // Apply 2-opt optimization to improve street order (eliminates crossings)
    streetOrder = twoOptImprove(streetOrder, streetCenters);
    console.log('Applied 2-opt optimization for improved route');
    
    // Step 4: Build final route - SUOMI: VASEN puoli (kuljettajan ikkuna) ENSIN, sitten OIKEA puoli
    const optimizedRoute = [];
    
    streetOrder.forEach(streetIndex => {
        const group = streetGroups[streetIndex];
        
        // Jaetaan ENSIN kuljettajan ikkunan puoli (VASEN = window side)
        group.windowSide.forEach(addr => {
            optimizedRoute.push(addr);
        });
        
        // Sitten palataan ja jaetaan matkustajan puoli (OIKEA) käänteisessä järjestyksessä
        group.oppositeSide.reverse().forEach(addr => {
            optimizedRoute.push(addr);
        });
    });
    
    console.log(`Optimized route: ${optimizedRoute.length} addresses (starting and ending at depot: ${DEPOT.address})`);
    return optimizedRoute;
}

// Add route optimization button to map
function addRouteOptimizationButton(map, locations, mapContainer, infoPanel, excludedInfo) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        z-index: 1000;
        display: flex;
        gap: 10px;
    `;
    
    const optimizeBtn = document.createElement('button');
    optimizeBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
        </svg>
        Optimoi autoreitti
    `;
    optimizeBtn.className = 'btn btn-primary';
    optimizeBtn.style.cssText = `
        padding: 8px 16px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
    `;
    
    optimizeBtn.addEventListener('click', () => {
        visualizeOptimizedRoute(map, locations, infoPanel, excludedInfo);
    });
    
    // Add print button
    const printBtn = document.createElement('button');
    printBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Tulosta
    `;
    printBtn.className = 'btn btn-secondary';
    printBtn.style.cssText = `
        padding: 8px 16px;
        background: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
    `;
    
    printBtn.addEventListener('click', () => {
        printOptimizedRoute(currentCircuit, locations);
    });
    
    buttonContainer.appendChild(optimizeBtn);
    buttonContainer.appendChild(printBtn);
    mapContainer.appendChild(buttonContainer);
}

// Reorder subscriber cards to match optimized route
function reorderSubscriberCards(optimizedRoute) {
    if (!currentCircuit || !allData[currentCircuit]) {
        console.warn('No circuit data available for reordering');
        return;
    }
    
    // Get current circuit data
    const circuitData = allData[currentCircuit];
    
    // Create a map of address -> subscriber data for quick lookup
    const addressMap = new Map();
    circuitData.forEach(sub => {
        addressMap.set(sub.address, sub);
    });
    
    // Build new ordered array based on optimized route
    const reorderedData = [];
    optimizedRoute.forEach((location, index) => {
        const subscriber = addressMap.get(location.address);
        if (subscriber) {
            // Update orderIndex to match new position
            reorderedData.push({
                ...subscriber,
                orderIndex: index
            });
        }
    });
    
    // Add any subscribers that weren't in the optimized route (e.g., filtered out)
    circuitData.forEach(sub => {
        if (!reorderedData.find(s => s.address === sub.address)) {
            reorderedData.push({
                ...sub,
                orderIndex: reorderedData.length
            });
        }
    });
    
    // Update global data
    allData[currentCircuit] = reorderedData;
    
    // Save optimized route to localStorage
    saveOptimizedRoute(currentCircuit, reorderedData);
    
    // Re-render the subscriber list with new order
    renderSubscriberList(currentCircuit, reorderedData);
    
    showNotification('Kortit järjestetty optimoidun reitin mukaan', 'success');
}

// Save optimized route to localStorage
function saveOptimizedRoute(circuitId, orderedData) {
    try {
        const routeData = {
            circuitId: circuitId,
            timestamp: new Date().toISOString(),
            version: 1,
            addresses: orderedData.map(sub => ({
                address: sub.address,
                orderIndex: sub.orderIndex
            }))
        };
        
        localStorage.setItem(`optimized_route_${circuitId}`, JSON.stringify(routeData));
        console.log(`Saved optimized route for ${circuitId}`);
    } catch (error) {
        console.error('Failed to save optimized route:', error);
    }
}

// Load optimized route from localStorage
function loadOptimizedRoute(circuitId) {
    try {
        const saved = localStorage.getItem(`optimized_route_${circuitId}`);
        if (!saved) return null;
        
        const routeData = JSON.parse(saved);
        
        // Check if saved route is still valid (within 30 days)
        const savedDate = new Date(routeData.timestamp);
        const daysSince = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSince > 30) {
            console.log(`Optimized route for ${circuitId} expired (${Math.floor(daysSince)} days old)`);
            localStorage.removeItem(`optimized_route_${circuitId}`);
            return null;
        }
        
        console.log(`Loaded optimized route for ${circuitId} (saved ${Math.floor(daysSince)} days ago)`);
        return routeData;
    } catch (error) {
        console.error('Failed to load optimized route:', error);
        return null;
    }
}

// Apply saved route order to circuit data
function applySavedRouteOrder(circuitId, circuitData) {
    const savedRoute = loadOptimizedRoute(circuitId);
    if (!savedRoute) return circuitData;
    
    // Create address -> orderIndex map
    const orderMap = new Map();
    savedRoute.addresses.forEach(addr => {
        orderMap.set(addr.address, addr.orderIndex);
    });
    
    // Apply saved order to circuit data
    const reordered = circuitData.map(sub => {
        const savedOrder = orderMap.get(sub.address);
        if (savedOrder !== undefined) {
            return { ...sub, orderIndex: savedOrder };
        }
        return sub;
    });
    
    // Sort by orderIndex
    reordered.sort((a, b) => a.orderIndex - b.orderIndex);
    
    console.log(`Applied saved route order to ${circuitId}`);
    return reordered;
}

// Clear saved route for circuit
function clearSavedRoute(circuitId) {
    localStorage.removeItem(`optimized_route_${circuitId}`);
    console.log(`Cleared saved route for ${circuitId}`);
}

// Print optimized route for offline use
function printOptimizedRoute(circuitId, locations) {
    // Create print window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showNotification('Salli ponnahdusikkunat tulostaaksesi', 'error');
        return;
    }
    
    // Optimize route if not already optimized
    const optimizedRoute = optimizeCarDeliveryRoute(locations);
    const streetGroups = groupAddressesByStreet(optimizedRoute);
    
    // Calculate total distance
    let totalDistance = 0;
    for (let i = 0; i < optimizedRoute.length - 1; i++) {
        totalDistance += calculateDistance(
            optimizedRoute[i].lat, optimizedRoute[i].lon,
            optimizedRoute[i + 1].lat, optimizedRoute[i + 1].lon
        );
    }
    
    // Generate HTML for print
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Jakolistat - ${circuitId}</title>
    <style>
        @media print {
            @page { margin: 1cm; }
            body { margin: 0; }
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.4;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            border-bottom: 3px solid #007bff;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0 0 10px 0;
            color: #007bff;
            font-size: 24px;
        }
        
        .header .meta {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #666;
        }
        
        .route-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }
        
        .route-info .stat {
            text-align: center;
        }
        
        .route-info .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        
        .route-info .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        
        .legend {
            background: #fff3cd;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        
        .legend strong {
            color: #856404;
        }
        
        .delivery-item {
            display: flex;
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            align-items: flex-start;
            page-break-inside: avoid;
        }
        
        .delivery-item:nth-child(even) {
            background: #f8f9fa;
        }
        
        .item-number {
            font-size: 18px;
            font-weight: bold;
            color: #007bff;
            min-width: 40px;
            flex-shrink: 0;
        }
        
        .item-side {
            min-width: 50px;
            text-align: center;
            flex-shrink: 0;
            font-weight: bold;
            font-size: 14px;
        }
        
        .side-right {
            color: #28a745;
        }
        
        .side-left {
            color: #fd7e14;
        }
        
        .item-details {
            flex: 1;
        }
        
        .item-address {
            font-weight: bold;
            font-size: 15px;
            margin-bottom: 3px;
        }
        
        .item-name {
            color: #666;
            font-size: 13px;
            margin-bottom: 3px;
        }
        
        .item-products {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
            margin-top: 5px;
        }
        
        .product-badge {
            background: #007bff;
            color: white;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: bold;
        }
        
        .item-checkbox {
            width: 30px;
            height: 30px;
            border: 2px solid #007bff;
            border-radius: 4px;
            flex-shrink: 0;
            margin-left: 10px;
        }
        
        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        
        @media print {
            .no-print { display: none; }
        }
        
        .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
        }
        
        .print-button:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <button class="print-button no-print" onclick="window.print()">🖨️ Tulosta</button>
    
    <div class="header">
        <h1>Jakolistat - ${circuitId}</h1>
        <div class="meta">
            <span>Tulostettu: ${new Date().toLocaleDateString('fi-FI')} ${new Date().toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>Automaattisesti optimoitu reitti</span>
        </div>
    </div>
    
    <div class="route-info">
        <div class="stat">
            <div class="stat-value">${optimizedRoute.length}</div>
            <div class="stat-label">Jakokohdetta</div>
        </div>
        <div class="stat">
            <div class="stat-value">${(totalDistance / 1000).toFixed(1)} km</div>
            <div class="stat-label">Arvioitu matka</div>
        </div>
        <div class="stat">
            <div class="stat-value">${streetGroups.length}</div>
            <div class="stat-label">Katua</div>
        </div>
    </div>
    
    <div class="legend">
        <strong>Ohjeet (Suomi - kuljettaja vasemmalla, ajo oikealla):</strong> 
        <span style="color: #28a745;">●</span> Vasen puoli (kuljettajan ikkuna) jaetaan ensin • 
        <span style="color: #fd7e14;">●</span> Oikea puoli (matkustajan puoli) jaetaan palatessa
    </div>
    
    <div class="delivery-list">
        ${optimizedRoute.map((location, index) => {
            const streetName = extractStreetName(location.address);
            const group = streetGroups.find(g => g.name === streetName);
            
            let side = 'V'; // V = vasen (kuljettajan ikkuna)
            let sideClass = 'side-right';
            if (group && group.centerline) {
                const sideResult = determineStreetSide(
                    { lat: location.lat, lon: location.lon },
                    { start: group.centerline.start, end: group.centerline.end }
                );
                // SUOMI: window = vasen = kuljettajan ikkuna (V), opposite = oikea = matkustajan puoli (O)
                if (sideResult === 'opposite') {
                    side = 'O'; // O = oikea (matkustajan puoli)
                    sideClass = 'side-left';
                }
            }
            
            const productsHtml = location.products
                .map(p => `<span class="product-badge">${p}</span>`)
                .join('');
            
            return `
                <div class="delivery-item">
                    <div class="item-number">${index + 1}.</div>
                    <div class="item-side ${sideClass}">${side}</div>
                    <div class="item-details">
                        <div class="item-address">${location.address}</div>
                        ${location.name ? `<div class="item-name">${location.name}</div>` : ''}
                        <div class="item-products">${productsHtml}</div>
                    </div>
                    <div class="item-checkbox"></div>
                </div>
            `;
        }).join('')}
    </div>
    
    <div class="footer">
        Mailia Jakokirja • Optimoitu autoreitti • ${circuitId}
    </div>
</body>
</html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    
    showNotification('Tulostusikkuna avattu', 'success');
}

// Visualize optimized route on map
function visualizeOptimizedRoute(map, originalLocations, infoPanel, excludedInfo) {
    showNotification('Optimoidaan reittiä...', 'info');
    
    // Run optimization
    const optimizedRoute = optimizeCarDeliveryRoute(originalLocations);
    
    // Reorder subscriber cards to match optimized route
    reorderSubscriberCards(optimizedRoute);
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });
    
    // Remove existing polylines
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    
    // Draw route line
    const routeLine = optimizedRoute.map(loc => [loc.lat, loc.lon]);
    L.polyline(routeLine, {
        color: '#007bff',
        weight: 3,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(map);
    
    // Add numbered markers in optimized order
    optimizedRoute.forEach((location, index) => {
        const marker = L.marker([location.lat, location.lon]).addTo(map);
        
        const productsHtml = location.products.map(p => `<span class="map-product-badge">${p}</span>`).join('');
        
        marker.bindPopup(`
            <div class="map-popup">
                <strong class="map-popup-title">${index + 1}. ${location.address}</strong><br>
                ${location.name ? `<em>${location.name}</em><br>` : ''}
                <div class="map-product-badges">${productsHtml}</div>
                <small style="color: #666;">Alkuperäinen: #${location.originalIndex + 1}</small>
            </div>
        `);
        
        // Color code: Green for window side (vasen = kuljettajan ikkuna), Orange for opposite side (oikea = matkustajan puoli)
        const streetName = extractStreetName(location.address);
        const group = groupAddressesByStreet(optimizedRoute).find(g => g.name === streetName);
        
        let color = '#007bff'; // Default blue
        if (group && group.centerline) {
            const side = determineStreetSide(
                { lat: location.lat, lon: location.lon },
                { start: group.centerline.start, end: group.centerline.end }
            );
            // SUOMI: window = vasen = kuljettajan ikkuna (vihreä), opposite = oikea = matkustajan puoli (oranssi)
            color = side === 'window' ? '#28a745' : '#fd7e14';
        }
        
        const icon = L.divIcon({
            className: 'number-marker-optimized',
            html: `<div style="background-color: ${color};">${index + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        marker.setIcon(icon);
    });
    
    // Calculate route statistics
    let totalDistance = 0;
    for (let i = 0; i < optimizedRoute.length - 1; i++) {
        totalDistance += calculateDistance(
            optimizedRoute[i].lat, optimizedRoute[i].lon,
            optimizedRoute[i + 1].lat, optimizedRoute[i + 1].lon
        );
    }
    
    // Update info panel
    infoPanel.innerHTML = `
        <p style="margin: 0;">Optimoitu reitti: <strong>${optimizedRoute.length} osoitetta</strong>${excludedInfo}</p>
        <p style="margin: 0; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;">
                <circle cx="12" cy="12" r="10" fill="#28a745"/>
            </svg>
            <span style="color: #28a745;">Vasen puoli (kuljettajan ikkuna)</span>
            <span style="color: #666; margin: 0 4px;">•</span>
            <svg width="12" height="12" viewBox="0 0 24 24" style="flex-shrink: 0;">
                <circle cx="12" cy="12" r="10" fill="#fd7e14"/>
            </svg>
            <span style="color: #fd7e14;">Oikea puoli (matkustajan puoli)</span>
        </p>
        <p style="margin: 0; font-size: 0.85rem; color: #666;">
            Matka: ~${(totalDistance / 1000).toFixed(1)} km
        </p>
        <p style="margin: 0; font-size: 0.9rem; color: #aaa;">Suomi: Kuljettaja vasemmalla</p>
    `;
    
    showNotification(`Reitti optimoitu! Matka: ${(totalDistance / 1000).toFixed(1)} km`, 'success');
}

// Load Leaflet library dynamically (with caching)
let leafletLoading = null; // Prevent multiple simultaneous loads
async function loadLeafletLibrary() {
    // Return existing promise if already loading
    if (leafletLoading) return leafletLoading;
    
    // Return immediately if already loaded
    if (typeof L !== 'undefined') return Promise.resolve();
    
    leafletLoading = new Promise((resolve, reject) => {
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
        link.crossOrigin = '';
        document.head.appendChild(link);

        // Load JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
        script.crossOrigin = '';
        script.onload = () => {
            leafletLoading = null; // Reset for future loads
            resolve();
        };
        script.onerror = () => {
            leafletLoading = null;
            reject(new Error('Failed to load Leaflet'));
        };
        document.head.appendChild(script);
    });
    
    return leafletLoading;
}

// Geocoding cache functions for faster map loading
async function initGeocodingCache() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('MailiaGeocoding', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('locations')) {
                const store = db.createObjectStore('locations', { keyPath: 'address' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

async function getGeocodingCache(db, address) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['locations'], 'readonly');
        const store = transaction.objectStore('locations');
        const request = store.get(address);
        
        request.onsuccess = () => {
            const result = request.result;
            // Cache valid for 30 days
            if (result && (Date.now() - result.timestamp) < 30 * 24 * 60 * 60 * 1000) {
                resolve({ lat: result.lat, lon: result.lon });
            } else {
                resolve(null);
            }
        };
        request.onerror = () => resolve(null); // Fail gracefully
    });
}

async function saveGeocodingCache(db, address, coords) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['locations'], 'readwrite');
        const store = transaction.objectStore('locations');
        const request = store.put({
            address,
            lat: coords.lat,
            lon: coords.lon,
            timestamp: Date.now()
        });
        
        request.onsuccess = () => resolve();
        request.onerror = () => resolve(); // Fail gracefully
    });
}






