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

// Small helper: get current role from memory or storage
function getEffectiveUserRole() {
    try {
        return userRole || localStorage.getItem('mailiaUserRole') || null;
    } catch (_) {
        return userRole || null;
    }
}

// ============= Backend Integration =============
// Check if user is already logged in
window.addEventListener('DOMContentLoaded', async () => {
    if (window.mailiaAPI && window.mailiaAPI.isAuthenticated()) {
        // Verify the token is still valid by trying to fetch user data
        try {
            await window.mailiaAPI.makeRequest('/auth/me');
            // Token is valid, show main app
            showMainApp();
            initializeApp();
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
            try { localStorage.setItem('mailiaUserRole', currentUser.role); } catch(_) {}
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

function initializeApp() {
    // Initialize all app functionality after successful login
    initializeTabs();
    initializeRefreshButtons();
    initializeLogout();
    initializeSwipeGestures();
    initializeCircuitTracker();
    loadFavorites();
    
    // Initialize geolocation for weather
    getLocationWeather();
    
    // Initialize WebSocket event listeners for real-time updates
    initializeWebSocketListeners();
    
    // Initialize dashboard if user is admin or manager
    const role = getEffectiveUserRole();
    console.log('[initializeApp] effective role:', role);
    if (role === 'admin' || role === 'manager') {
        initializeDashboard();
    }
}

// WebSocket real-time event listeners
function initializeWebSocketListeners() {
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
            
            // Show notification
            showNotification(`Reitin tila päivitetty käyttäjältä: ${data.updatedBy}`, 'info');
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
            await loadCircuit(currentCircuit);
            showNotification(
                data.action === 'created' 
                    ? 'Uusi tilaaja lisätty piirille' 
                    : 'Tilaaja päivitetty',
                'success'
            );
        }
    });
    
    // Listen for route messages
    window.addEventListener('messageReceived', (event) => {
        const data = event.detail;
        console.log('Message received event:', data);
        
        // Show notification
        const messageText = data.message || 'Uusi viesti';
        const username = data.username || 'Tuntematon';
        showNotification(`${username}: ${messageText}`, 'info');
        
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
    
    // Listen for delivery updates
    window.addEventListener('deliveryUpdated', (event) => {
        const data = event.detail;
        console.log('Delivery updated event received:', data);
        console.log('Looking for checkbox with subscriber ID:', data.subscriberId);
        
        // Update checkbox state if viewing the same route
        const checkbox = document.querySelector(`input[data-subscriber-id="${data.subscriberId}"]`);
        console.log('Found checkbox:', checkbox);
        if (checkbox) {
            console.log('Updating checkbox to:', data.isDelivered);
            checkbox.checked = data.isDelivered;
            
            // Update visual state
            const card = checkbox.closest('.subscriber-card');
            if (card) {
                if (data.isDelivered) {
                    card.classList.add('delivered');
                } else {
                    card.classList.remove('delivered');
                }
            }
            
            // Show notification
            showNotification(`Jakelu päivitetty: ${data.isDelivered ? 'toimitettu' : 'ei toimitettu'}`, 'info');
        } else {
            console.log('Checkbox not found, subscriber might not be visible');
        }
        
        // Refresh tracker to update progress bars
        console.log('Triggering tracker refresh after delivery update');
        if (typeof renderCircuitTracker === 'function') {
            renderCircuitTracker();
        }
        
        // Also refresh dashboard if it's active (deliveries affect counts)
        const dashboardTab = document.querySelector('.tab-content.active#dashboardTab');
        if (dashboardTab && typeof loadTodayDeliveryCount === 'function') {
            console.log('Delivery updated - refreshing dashboard delivery count...');
            loadTodayDeliveryCount();
        }
    });
}

// Show notification helper
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    // Define colors based on type
    const backgroundColor = type === 'success' ? '#28a745' : 
                           type === 'error' ? '#dc3545' : 
                           '#007bff'; // info/default
    
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${backgroundColor};
        color: white;
        padding: 1rem 2rem;
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        border: 2px solid rgba(255,255,255,0.3);
        z-index: 9999;
        max-width: 90%;
        text-align: center;
        font-weight: 600;
        font-size: 1rem;
        animation: slideInDown 0.3s ease-out;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutUp 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showCircuitManagementMenu(circuitId, routeData, status) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'circuit-management-modal';
    modal.style.cssText = `
        background: #2c2c2c;
        border-radius: 12px;
        padding: 1.5rem;
        max-width: 90%;
        width: 320px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        border: 1px solid #444;
    `;

    // Build menu options based on route status
    let menuOptions = '';
    
    if (!routeData || status === 'not-started') {
        // Route hasn't been started - show start and finish options
        menuOptions = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button class="modal-btn map-btn" style="
                    background: #17a2b8;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Näytä kartalla
                </button>
                <button class="modal-btn start-btn" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Aloita reitti
                </button>
                <button class="modal-btn complete-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Merkitse valmiiksi
                </button>
            </div>
        `;
    } else {
        // Route has been started - show management options
        menuOptions = `
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button class="modal-btn map-btn" style="
                    background: #17a2b8;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    Näytä kartalla
                </button>
                <button class="modal-btn reset-btn" style="
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                    </svg>
                    Nollaa reitti
                </button>
                ${status !== 'completed' ? `
                <button class="modal-btn complete-btn" style="
                    background: #28a745;
                    color: white;
                    border: none;
                    padding: 0.75rem;
                    border-radius: 8px;
                    font-size: 1rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                ">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Merkitse valmiiksi
                </button>
                ` : ''}
            </div>
        `;
    }

    modal.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #f0f0f0; font-size: 1.1rem; font-weight: 600;">Hallitse reittiä ${circuitId}</h3>
        ${menuOptions}
        <button class="modal-btn cancel-btn" style="
            background: #495057;
            color: white;
            border: none;
            padding: 0.75rem;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            margin-top: ${!routeData || status === 'not-started' ? '1rem' : '0.75rem'};
            width: 100%;
        ">
            Sulje
        </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add hover effects
    const buttons = modal.querySelectorAll('.modal-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '0.9';
            btn.style.transform = 'scale(1.02)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1)';
        });
    });

    // Handle map view button
    const mapBtn = modal.querySelector('.map-btn');
    if (mapBtn) {
        mapBtn.addEventListener('click', () => {
            overlay.remove();
            showCircuitMap(circuitId);
        });
    }

    // Handle reset to not-started (if route exists)
    const resetBtn = modal.querySelector('.reset-btn');
    if (resetBtn && routeData) {
        resetBtn.addEventListener('click', async () => {
            try {
                await window.mailiaAPI.resetRoute(routeData.id, 'not-started');
                showNotification('Jakelustatus nollattu', 'success');
                renderCircuitTracker();
                overlay.remove();
            } catch (error) {
                console.error('Failed to reset route:', error);
                showNotification('Reitin nollaus epäonnistui', 'error');
            }
        });
    }

    // Handle start route (if button exists and no route)
    const startBtn = modal.querySelector('.start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            try {
                const route = await window.mailiaAPI.startRoute(circuitId);
                localStorage.setItem(`route_id_${circuitId}`, route.id);
                showNotification(`Reitti ${circuitId} aloitettu`, 'success');
                renderCircuitTracker();
                overlay.remove();
            } catch (error) {
                console.error('Failed to start route:', error);
                showNotification('Reitin aloitus epäonnistui', 'error');
            }
        });
    }

    // Handle mark as completed (if button exists)
    const completeBtn = modal.querySelector('.complete-btn');
    if (completeBtn) {
        completeBtn.addEventListener('click', async () => {
            // If no route exists, create one first then mark as completed
            if (!routeData) {
                try {
                    const route = await window.mailiaAPI.startRoute(circuitId);
                    localStorage.setItem(`route_id_${circuitId}`, route.id);
                    await window.mailiaAPI.resetRoute(route.id, 'completed');
                    showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
                    renderCircuitTracker();
                    overlay.remove();
                } catch (error) {
                    console.error('Failed to create and complete route:', error);
                    showNotification('Reitin merkkaus epäonnistui', 'error');
                }
            } else {
                try {
                    await window.mailiaAPI.resetRoute(routeData.id, 'completed');
                    showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
                    renderCircuitTracker();
                    overlay.remove();
                } catch (error) {
                    console.error('Failed to complete route:', error);
                    showNotification('Reitin merkkaus epäonnistui', 'error');
                }
            }
        });
    }

    // Handle cancel/close
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

function showRouteStatusModal(circuitId, routeData) {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.className = 'route-status-modal';
    modal.style.cssText = `
        background: #2c2c2c;
        border-radius: 12px;
        padding: 1.5rem;
        max-width: 90%;
        width: 320px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        border: 1px solid #444;
    `;

    modal.innerHTML = `
        <h3 style="margin: 0 0 1rem 0; color: #f0f0f0; font-size: 1.1rem; font-weight: 600;">Muuta reitin ${circuitId} tilaa</h3>
        <p style="margin: 0 0 1.5rem 0; color: #b0b0b0; font-size: 0.9rem;">Valitse uusi tila:</p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="modal-btn reset-btn" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">
                🔴 Merkitse aloittamattomaksi
            </button>
            <button class="modal-btn complete-btn" style="
                background: #28a745;
                color: white;
                border: none;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">
                🟢 Merkitse valmiiksi
            </button>
            <button class="modal-btn cancel-btn" style="
                background: #495057;
                color: white;
                border: none;
                padding: 0.75rem;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            ">
                Peruuta
            </button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Add hover effects
    const buttons = modal.querySelectorAll('.modal-btn');
    buttons.forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.opacity = '0.9';
            btn.style.transform = 'scale(1.02)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'scale(1)';
        });
    });

    // Handle reset to not-started
    modal.querySelector('.reset-btn').addEventListener('click', async () => {
        try {
            await window.mailiaAPI.resetRoute(routeData.id, 'not-started');
            showNotification('Jakelustatus nollattu', 'success');
            renderCircuitTracker();
            overlay.remove();
        } catch (error) {
            console.error('Failed to reset route:', error);
            showNotification('Reitin nollaus epäonnistui', 'error');
        }
    });

    // Handle mark as completed
    modal.querySelector('.complete-btn').addEventListener('click', async () => {
        try {
            await window.mailiaAPI.resetRoute(routeData.id, 'completed');
            showNotification(`Reitti ${circuitId} merkitty valmiiksi`, 'success');
            renderCircuitTracker();
            overlay.remove();
        } catch (error) {
            console.error('Failed to complete route:', error);
            showNotification('Reitin merkkaus epäonnistui', 'error');
        }
    });

    // Handle cancel
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

function showLoginScreen() {
    console.log('showLoginScreen called');
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    console.log('loginScreen element:', loginScreen);
    console.log('mainApp element:', mainApp);
    
    if (loginScreen && mainApp) {
        loginScreen.style.display = 'flex';
        loginScreen.style.visibility = 'visible';
        loginScreen.style.opacity = '1';
        mainApp.style.display = 'none';
        
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
        
        // Clear user role from localStorage
        localStorage.removeItem('mailiaUserRole');
        
        // Show login screen
        showLoginScreen();
        
        // Reset form
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginError = document.getElementById('loginError');
        
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (loginError) loginError.style.display = 'none';
        
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
    // Update UI with user info
    const user = window.mailiaAPI.getCurrentUser();
    if (user) {
        console.log('Logged in as:', user.username, 'Role:', user.role);
        userRole = user.role;
        isAuthenticated = true;
        // Save user role to localStorage for access in other functions
        localStorage.setItem('mailiaUserRole', user.role);
    }
    
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
    await loadData();
    await populateCircuitSelector(); // Wait for circuits to load from backend
    initializeCircuitTracker();
    initializeEventListeners();
    checkMidnightReset();
    scheduleMidnightReset();
    
    // Set initial view based on user role
    const role = getEffectiveUserRole();
    const circuitSelectorContainer = document.querySelector('.circuit-selector-container');
    
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
}

// Dark Mode
function initializeDarkMode() {
    // Default to dark mode if no preference is set
    const darkMode = localStorage.getItem('darkMode');
    const isDark = darkMode === null ? true : darkMode === 'true';
    
    // Set or remove dark mode class based on preference
    if (isDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    
    // Save the default if not set
    if (darkMode === null) {
        localStorage.setItem('darkMode', 'true');
    }

    // Only setup toggle if user is authenticated
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle && isAuthenticated) {
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark);
        });
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
function initializeTabs() {
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
        // Delivery user sees no tabs (direct access to circuit selector)
        if (jakeluButton) jakeluButton.style.display = 'none';
        if (seurantaButton) seurantaButton.style.display = 'none';
        if (messagesButton) messagesButton.style.display = 'none';
        if (dashboardButton) dashboardButton.style.display = 'none';
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

// Initialize refresh buttons for Seuranta and Messages tabs
function initializeRefreshButtons() {
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

function parseCircuitCSV(text, filename) {
    const lines = text.trim().split('\n');
    const subscribers = [];
    
    // Detect CSV format by checking the header
    const header = lines[0].toLowerCase();
    const isNewFormat = header.includes('katu') && header.includes('osoitenumero');
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const subscriber = isNewFormat ? parseNewFormatCSVLine(lines[i]) : parseOldFormatCSVLine(lines[i]);
        if (subscriber) {
            // Add original order index to maintain CSV order
            subscriber.orderIndex = i;
            subscribers.push(subscriber);
        }
    }
    
    return subscribers;
}

// Helper function to clean up angle bracket markings from text
function cleanAngleBrackets(text) {
    if (!text) return text;
    // Remove any text within angle brackets (including nested ones)
    // This handles cases like "<2 Ilm>", "<suikkanen Tapio>", "<ovi <pudota >>"
    return text.replace(/<[^>]*>/g, '').trim();
}

function parseOldFormatCSVLine(line) {
    // Parse CSV line with proper quote handling
    // Detect delimiter: semicolon or comma
    const delimiter = line.includes(';') ? ';' : ',';
    
    const fields = [];
    let currentField = '';
    let insideQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                // Escaped quote
                currentField += '"';
                i++;
            } else {
                // Toggle quote state
                insideQuotes = !insideQuotes;
            }
        } else if (char === delimiter && !insideQuotes) {
            // Field separator
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField);
    
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
    
    return null;
}

function parseNewFormatCSVLine(line) {
    // Parse new format: Katu,Osoitenumero,Porras/Huom,Asunto,Tilaaja,Tilaukset
    const fields = line.split(',').map(f => f.trim());
    
    if (fields.length >= 6) {
        const street = fields[0].trim();
        const number = fields[1].trim();
        const stairwell = fields[2].trim();
        const apartment = fields[3].trim();
        const name = fields[4].trim();
        const productsStr = fields[5].trim();
        
        // Skip if no street or number
        if (!street || !number) return null;
        
        // Build address
        let address = `${street} ${number}`;
        if (stairwell) address += ` ${stairwell}`;
        if (apartment) address += ` ${apartment}`;
        
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
        displayText.textContent = circuitNames[circuit] || circuit;
        dropdown.style.display = 'none';
        customSelect.classList.remove('open');
        
        try {
            await loadCircuit(circuit);
            search.value = '';
            circuitSearchMemory = '';
        } catch (error) {
            console.error('Error loading circuit:', error);
            // Reset display on error
            displayText.textContent = 'Valitse piiri';
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
                address: sub.address,
                name: sub.name,
                products: products,
                buildingAddress: sub.building_address,
                orderIndex: sub.order_index,
                id: sub.id // Keep backend ID for updates
            };
        });
        
        // Cache the loaded data
        allData[circuitId] = subscribers;
        console.log(`Loaded circuit ${circuitId} from backend (${subscribers.length} subscribers)`);
        
        return subscribers;
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
        const data = parseCircuitCSV(text, filename);
        
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
    
    try {
        // Load circuit data on demand
        const subscribers = await loadCircuitData(circuitId);
        
        const deliveryContent = document.getElementById('deliveryContent');
        if (!deliveryContent) {
            console.error('deliveryContent element not found');
            return;
        }
        
        deliveryContent.style.display = 'block';
        
        renderCoverSheet(circuitId, subscribers);
        renderSubscriberList(circuitId, subscribers);
        updateRouteButtons(circuitId);
        
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
        
        buildingSubscribers.forEach((sub, subIndex) => {
            // Extract the staircase letter from the apartment specification
            const apartmentSpec = extractApartmentSpecification(sub.address, sub.buildingAddress);
            const currentStaircase = apartmentSpec ? apartmentSpec.charAt(0).toUpperCase() : null;
            
            // Check if this is a new staircase (and not the first card)
            const isNewStaircase = hasMultipleDeliveries && subIndex > 0 && 
                                   currentStaircase && previousStaircase && 
                                   currentStaircase !== previousStaircase;
            
            // Add + button before each card (admin and manager only)
            const role = getEffectiveUserRole();
            if (role === 'admin' || role === 'manager') {
                const addButton = createAddSubscriberButton(circuitId, sub.orderIndex);
                buildingGroup.appendChild(addButton);
            }
            
            const card = createSubscriberCard(circuitId, sub, buildingIndex, subIndex, 
                buildingIndex === buildings.length - 1 && subIndex === buildingSubscribers.length - 1,
                buildings, buildingIndex, subIndex, hasMultipleDeliveries, isNewStaircase);
            buildingGroup.appendChild(card);
            
            previousStaircase = currentStaircase;
        });
        
        // Add final + button at the end of each building group (admin and manager only)
        const role = getEffectiveUserRole();
        if ((role === 'admin' || role === 'manager') && buildingSubscribers.length > 0) {
            const lastSub = buildingSubscribers[buildingSubscribers.length - 1];
            const addButton = createAddSubscriberButton(circuitId, lastSub.orderIndex + 1);
            buildingGroup.appendChild(addButton);
        }
        
        listContainer.appendChild(buildingGroup);
    });
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
    
    // Add subscriber ID to checkbox for real-time sync
    if (subscriber.id) {
        checkbox.dataset.subscriberId = subscriber.id;
    }
    
    checkbox.addEventListener('change', async (e) => {
        await saveCheckboxState(circuitId, subscriber.address, e.target.checked, subscriber.id);
        applyFilters(); // Re-apply filters to hide/show delivered addresses
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
    
    // Display products with quantity badges
    Object.entries(productCounts).forEach(([product, count]) => {
        const tag = document.createElement('span');
        const colorClass = getProductColorClass(product);
        tag.className = `product-tag product-${colorClass}`;
        tag.textContent = product;
        
        // Add quantity badge if count > 1
        if (count > 1) {
            const badge = document.createElement('span');
            badge.className = 'quantity-badge';
            badge.textContent = count;
            tag.appendChild(badge);
        }
        
        products.appendChild(tag);
    });
    info.appendChild(products);
    
    card.appendChild(info);
    
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
        reportUndelivered(circuitId, subscriber);
    });
    card.appendChild(reportBtn);
    
    // Navigation link (if not last)
    if (!isLast) {
        const nextAddress = getNextAddress(buildings, currentBuildingIndex, currentSubIndex);
        if (nextAddress) {
            const link = document.createElement('a');
            link.className = 'nav-link';
            // Use the subscriber's actual address from the current card
            const subscriberAddress = subscriber.address;
            link.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(subscriberAddress + ', Imatra, Finland')}`;
            link.target = '_blank';
            link.title = `Navigate to ${subscriberAddress}`;
            link.innerHTML = `
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
            `;
            card.appendChild(link);
        }
    }
    
    return card;
}

function getNextAddress(buildings, currentBuildingIndex, currentSubIndex) {
    const currentBuilding = buildings[currentBuildingIndex];
    const currentBuildingSubscribers = currentBuilding.subscribers;
    
    // Try next subscriber in same building
    if (currentSubIndex < currentBuildingSubscribers.length - 1) {
        return currentBuildingSubscribers[currentSubIndex + 1].address;
    }
    
    // Try first subscriber in next building
    if (currentBuildingIndex < buildings.length - 1) {
        const nextBuilding = buildings[currentBuildingIndex + 1];
        return nextBuilding.subscribers[0].address;
    }
    
    return null;
}

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
function reportUndelivered(circuitId, subscriber) {
    // Create a styled dialog for selecting delivery issue
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = `
        background: var(--card-bg);
        padding: 2rem;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        border: 1px solid var(--border-color);
    `;
    
    // Build product selection checkboxes if multiple products
    let productSelectionHTML = '';
    if (subscriber.products.length > 1) {
        productSelectionHTML = `
            <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; color: var(--text-color); font-weight: 500;">Valitse tuote(et) jotka eivät toimitettu:</label>
                <div id="productCheckboxes" style="display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; background: var(--warm-gray); border-radius: 8px;">
                    ${subscriber.products.map((product, index) => `
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" value="${product}" data-product-index="${index}" style="margin-right: 0.5rem; width: 18px; height: 18px; cursor: pointer;">
                            <span style="color: var(--text-color);">${product}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    dialogBox.innerHTML = `
        <h3 style="margin-top: 0; color: var(--text-color); font-size: 1.25rem; font-weight: 600;">Jakeluhäiriön ilmoitus</h3>
        ${productSelectionHTML}
        <select id="deliveryIssueSelect" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border-color); border-radius: 8px; font-size: 1rem; margin-bottom: 1rem; background: var(--card-bg); color: var(--text-color); -webkit-appearance: none; -moz-appearance: none; appearance: none; cursor: pointer;">
            <option value="">Valitse syy</option>
            <option value="Ei pääsyä">Ei pääsyä</option>
            <option value="Avainongelma">Avainongelma</option>
            <option value="Lehtipuute">Lehtipuute</option>
            <option value="Muu">Muu</option>
        </select>
        <div id="customReasonContainer" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-color); font-weight: 500;">Tarkenna:</label>
            <textarea id="customReasonText" rows="3" style="width: 100%; padding: 0.75rem; border: 2px solid var(--border-color); border-radius: 8px; font-size: 1rem; resize: vertical; background: var(--card-bg); color: var(--text-color); font-family: inherit;"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 0.75rem 1.5rem; border: 2px solid var(--border-color); background: transparent; color: var(--text-color); border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 500;">Peruuta</button>
            <button id="submitBtn" style="padding: 0.75rem 1.5rem; border: none; background: var(--primary-blue); color: white; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600; box-shadow: 0 2px 8px rgba(74, 144, 226, 0.3);">Lähetä</button>
        </div>
    `;
    
    dialog.appendChild(dialogBox);
    document.body.appendChild(dialog);
    
    const select = document.getElementById('deliveryIssueSelect');
    const customContainer = document.getElementById('customReasonContainer');
    const customText = document.getElementById('customReasonText');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    const productCheckboxes = document.getElementById('productCheckboxes');
    
    // Show custom reason field when "Muu" is selected
    select.addEventListener('change', () => {
        if (select.value === 'Muu') {
            customContainer.style.display = 'block';
        } else {
            customContainer.style.display = 'none';
        }
    });
    
    // Cancel button
    cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
    });
    
    // Submit button
    submitBtn.addEventListener('click', () => {
        let reason = select.value;
        
        if (!reason) {
            alert('Valitse syy');
            return;
        }
        
        // If "Muu" selected, append custom text
        if (reason === 'Muu') {
            const customReason = customText.value.trim();
            if (!customReason) {
                alert('Kirjoita tarkennusviesti');
                return;
            }
            reason = `Muu: ${customReason}`;
        }
        
        // Get selected products if multiple products available
        let selectedProducts = subscriber.products;
        if (subscriber.products.length > 1) {
            const checkedBoxes = productCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
            if (checkedBoxes.length === 0) {
                alert('Valitse vähintään yksi tuote');
                return;
            }
            selectedProducts = Array.from(checkedBoxes).map(cb => cb.value);
        }
        
        const report = {
            timestamp: new Date().toISOString(),
            circuit: circuitId,
            address: subscriber.address,
            name: subscriber.name,
            products: selectedProducts.join(', '),
            reason: reason
        };
        
        // Save to localStorage
        saveRouteMessage(report);
        
        // Remove dialog
        document.body.removeChild(dialog);
        
        alert('Raportti tallennettu!');
    });
    
    // Close on background click
    dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
            document.body.removeChild(dialog);
        }
    });
}

function saveRouteMessage(message) {
    // Get current route ID
    let routeId = localStorage.getItem(`route_id_${message.circuit}`);
    
    // If no route exists, create one automatically
    if (!routeId) {
        console.log('No route ID found, creating route for circuit:', message.circuit);
        
        // Create route via API
        if (window.mailiaAPI) {
            window.mailiaAPI.startRoute(message.circuit)
                .then(route => {
                    localStorage.setItem(`route_id_${message.circuit}`, route.id);
                    // Now send the message
                    return window.mailiaAPI.sendMessage(
                        route.id,
                        'issue',
                        `${message.reason} - ${message.address}`
                    );
                })
                .then(() => {
                    console.log('Route created and message saved');
                })
                .catch(error => {
                    console.error('Failed to create route or save message:', error);
                    // Fallback to localStorage
                    const messages = loadRouteMessages();
                    messages.push(message);
                    localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
                });
            return;
        } else {
            // Fallback to localStorage if API not available
            const messages = loadRouteMessages();
            messages.push(message);
            localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
            return;
        }
    }
    
    // Send message to backend API
    if (window.mailiaAPI) {
        window.mailiaAPI.sendMessage(
            parseInt(routeId),
            'issue',  // message type
            `${message.reason} - ${message.address}` // message content
        ).then(() => {
            console.log('Message saved to database and broadcasted');
        }).catch(error => {
            console.error('Failed to save message:', error);
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
    
    // Initialize message swipe functionality
    initializeMessageSwipe();
}

// Message Swipe and Read Functionality
function initializeMessageSwipe() {
    // This will be called when messages are rendered
    // We'll add swipe handlers to message cards dynamically
}

function addSwipeToMessageCard(messageCard, messageId) {
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
        
        // If swiped more than 100px, mark as read
        if (diff > 100) {
            await markMessageAsRead(messageCard, messageId);
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
    
    // Hide empty building groups and update delivery counts
    setTimeout(() => {
        const buildingGroups = document.querySelectorAll('.building-group');
        buildingGroups.forEach(group => {
            const visibleCards = Array.from(group.querySelectorAll('.subscriber-card'))
                .filter(card => card.style.display !== 'none');
            
            if (visibleCards.length > 0) {
                group.style.display = '';
                
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
            // Continue using localStorage as fallback
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
    
    try {
        // Fetch messages from backend API
        const messages = await window.mailiaAPI.getTodayMessages();
        
        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<p class="no-messages">Ei viestejä</p>';
            return;
        }
        
        messagesContainer.innerHTML = '';
        
        // Messages are already sorted by created_at DESC from backend
        messages.forEach((message, index) => {
            const messageCard = document.createElement('div');
            messageCard.className = 'message-card';
            
            const timestamp = new Date(message.created_at);
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
            
            messageHeader.appendChild(circuitSpan);
            messageHeader.appendChild(timestampSpan);
            
            const messageBody = document.createElement('div');
            messageBody.className = 'message-body';
            
            const messageText = document.createElement('div');
            messageText.className = 'message-text';
            messageText.textContent = message.message;
            
            const messageUser = document.createElement('div');
            messageUser.className = 'message-user';
            messageUser.innerHTML = '<strong>Lähettäjä:</strong> ';
            messageUser.appendChild(document.createTextNode(message.username || 'Tuntematon'));
            
            messageBody.appendChild(messageText);
            messageBody.appendChild(messageUser);
            
            messageCard.appendChild(messageHeader);
            messageCard.appendChild(messageBody);
            
            // Add swipe-to-dismiss functionality
            addSwipeToMessageCard(messageCard, message.id);
            
            messagesContainer.appendChild(messageCard);
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        messagesContainer.innerHTML = '<p class="no-messages">Virhe viestien lataamisessa</p>';
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

function initializeDashboard() {
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
    setInterval(loadTodayDeliveryCount, 5 * 60 * 1000);
    
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

// Google Maps Integration
async function showCircuitMap(circuitId) {
    // Check if Google Maps failed to load
    if (window.googleMapsLoadError) {
        showNotification('Google Maps API ei latautunut. Tarkista API-avain ja laskutusasetukset.', 'error');
        return;
    }
    
    // Get circuit data
    const circuitData = allData[circuitId];
    if (!circuitData || circuitData.length === 0) {
        showNotification('Ei osoitteita tälle piirille', 'error');
        return;
    }

    // Create fullscreen map overlay
    const mapOverlay = document.createElement('div');
    mapOverlay.id = 'mapOverlay';
    mapOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #000;
        z-index: 10000;
        display: flex;
        flex-direction: column;
    `;

    // Create header with close button
    const mapHeader = document.createElement('div');
    mapHeader.style.cssText = `
        background: linear-gradient(135deg, #1a2332 0%, #2c3e50 100%);
        padding: 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    mapHeader.innerHTML = `
        <h3 style="margin: 0; color: #fff; font-size: 1.2rem; display: flex; align-items: center; gap: 0.5rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            ${circuitNames[circuitId] || circuitId} - Karttanäkymä
        </h3>
        <button id="closeMapBtn" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
        ">
            ✕ Sulje
        </button>
    `;

    // Create map container
    const mapContainer = document.createElement('div');
    mapContainer.id = 'googleMap';
    mapContainer.style.cssText = `
        flex: 1;
        width: 100%;
    `;

    // Create info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'mapInfoPanel';
    infoPanel.style.cssText = `
        background: #2c2c2c;
        padding: 1rem;
        color: #fff;
        border-top: 2px solid #444;
    `;
    infoPanel.innerHTML = `
        <p style="margin: 0;">Yhteensä: <strong>${circuitData.length} osoitetta</strong></p>
    `;

    mapOverlay.appendChild(mapHeader);
    mapOverlay.appendChild(mapContainer);
    mapOverlay.appendChild(infoPanel);
    document.body.appendChild(mapOverlay);

    // Close button handler
    document.getElementById('closeMapBtn').addEventListener('click', () => {
        mapOverlay.remove();
    });

    // Initialize Google Map
    try {
        await initializeGoogleMap(circuitId, circuitData, mapContainer, infoPanel);
    } catch (error) {
        console.error('Failed to initialize map:', error);
        showNotification('Kartan lataus epäonnistui', 'error');
        mapOverlay.remove();
    }
}

async function initializeGoogleMap(circuitId, circuitData, mapContainer, infoPanel) {
    // Wait for Google Maps to load with timeout
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
        showNotification('Google Maps ladataan...', 'info');
        
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Google Maps lataus aikakatkaistiin')), 10000)
        );
        
        const waitForMaps = new Promise(resolve => {
            const checkGoogleMaps = setInterval(() => {
                if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
                    clearInterval(checkGoogleMaps);
                    resolve();
                }
            }, 100);
        });
        
        try {
            await Promise.race([waitForMaps, timeout]);
        } catch (error) {
            throw new Error('Google Maps API ei latautunut. Tarkista API-avain ja verkkoyhteytesi.');
        }
    }

    // Check if Geocoding is available
    if (!google.maps.Geocoder) {
        throw new Error('Google Maps Geocoding API ei ole käytettävissä. Tarkista että API on otettu käyttöön Google Cloud Console:ssa.');
    }

    // Geocode addresses to coordinates
    const geocoder = new google.maps.Geocoder();
    const locations = [];
    let geocodedCount = 0;

    showNotification(`Haetaan osoitteiden sijainteja...`, 'info');

    for (const subscriber of circuitData) {
        const fullAddress = `${subscriber.address}, Imatra, Finland`;
        
        try {
            const result = await new Promise((resolve, reject) => {
                geocoder.geocode({ address: fullAddress }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        resolve(results[0]);
                    } else {
                        reject(status);
                    }
                });
            });

            locations.push({
                position: result.geometry.location,
                title: subscriber.address,
                name: subscriber.name,
                products: subscriber.products
            });
            geocodedCount++;
        } catch (error) {
            console.warn(`Could not geocode ${fullAddress}:`, error);
            // Check for common API errors
            if (error === 'REQUEST_DENIED') {
                throw new Error('Google Maps Geocoding API pyyntö evätty. Tarkista että Geocoding API on käytössä ja API-avaimella on oikeudet.');
            } else if (error === 'OVER_QUERY_LIMIT') {
                throw new Error('Google Maps API kyselylimiitti ylitetty. Odota hetki ennen uudelleenyritystä.');
            }
        }

        // Update progress
        if (geocodedCount % 5 === 0) {
            infoPanel.innerHTML = `
                <p style="margin: 0;">Ladataan... <strong>${geocodedCount}/${circuitData.length} osoitetta</strong></p>
            `;
        }
    }

    if (locations.length === 0) {
        showNotification('Osoitteiden sijainteja ei löytynyt', 'error');
        return;
    }

    // Calculate center point
    const bounds = new google.maps.LatLngBounds();
    locations.forEach(loc => bounds.extend(loc.position));

    // Create map
    const map = new google.maps.Map(mapContainer, {
        zoom: 14,
        center: bounds.getCenter(),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: [
            {
                featureType: 'all',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#ffffff' }]
            },
            {
                featureType: 'all',
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#000000' }, { lightness: 13 }]
            },
            {
                featureType: 'administrative',
                elementType: 'geometry.fill',
                stylers: [{ color: '#000000' }]
            },
            {
                featureType: 'administrative',
                elementType: 'geometry.stroke',
                stylers: [{ color: '#144b53' }, { lightness: 14 }, { weight: 1.4 }]
            }
        ]
    });

    // Fit map to show all markers
    map.fitBounds(bounds);

    // Create info window
    const infoWindow = new google.maps.InfoWindow();

    // Add markers
    locations.forEach((location, index) => {
        const marker = new google.maps.Marker({
            position: location.position,
            map: map,
            title: location.title,
            label: {
                text: `${index + 1}`,
                color: 'white',
                fontSize: '12px',
                fontWeight: 'bold'
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#FF6B6B',
                fillOpacity: 0.9,
                strokeColor: '#fff',
                strokeWeight: 2
            }
        });

        marker.addListener('click', () => {
            const content = `
                <div style="padding: 10px; min-width: 200px;">
                    <h4 style="margin: 0 0 12px 0; color: #333;">${location.title}</h4>
                    <p style="margin: 0;">
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(location.title + ', Imatra, Finland')}" 
                           target="_blank" 
                           style="color: #007bff; text-decoration: none;">
                            📍 Avaa Google Mapsissa
                        </a>
                    </p>
                </div>
            `;
            infoWindow.setContent(content);
            infoWindow.open(map, marker);
        });
    });

    // Update info panel
    infoPanel.innerHTML = `
        <p style="margin: 0;">
            Näytetään: <strong>${locations.length}/${circuitData.length} osoitetta</strong>
            ${locations.length < circuitData.length ? `<span style="color: #ffc107;"> (${circuitData.length - locations.length} sijaintia ei löytynyt)</span>` : ''}
        </p>
    `;

    showNotification(`Kartta ladattu! ${locations.length} osoitetta näytetään.`, 'success');
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
    const currentCircuits = Array.from(document.getElementById('circuitSelector').options)
        .filter(opt => opt.value !== '')
        .map(opt => ({ id: opt.value, name: opt.text }));

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
    const container = document.getElementById('productCheckboxes');
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

    // Get selected products
    const selectedProducts = Array.from(document.querySelectorAll('#productCheckboxes input[type="checkbox"]:checked'))
        .map(cb => cb.value);

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
        const response = await fetch(`${API_BASE_URL}/api/subscriptions/subscriber`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('mailiaToken')}`
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
            const error = await response.json();
            throw new Error(error.error || 'Tilaajan lisäys epäonnistui');
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
        if (socket && socket.connected) {
            socket.emit('subscriber_updated', {
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
});



