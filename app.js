// Mailia Delivery Tracking Application

// Animation constants
const ANIMATION_DURATION_MS = 500; // Must match CSS transition duration

// Authentication credentials
// WARNING: This is client-side only implementation for demonstration purposes
// In production, implement proper server-side authentication
const CREDENTIALS = {
    delivery: {
        username: 'imatravj',
        password: 'mailiavj1!'
    },
    admin: {
        username: 'paivystys.imatra',
        password: 'mailia123!'
    }
};

// Global state
let allData = [];
let currentCircuit = null;
let isAuthenticated = false;
let userRole = null; // 'delivery' or 'admin'
let routeMessages = []; // Store route messages for admin panel
let showCheckboxes = false; // Control checkbox visibility (default: OFF - swipe is primary method)

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
document.addEventListener('DOMContentLoaded', async () => {
    // Load saved credentials if available
    loadSavedCredentials();
    
    // Load checkbox visibility preference
    loadCheckboxVisibility();
    
    // Check if already authenticated
    checkAuthentication();
    
    // Setup login form
    initializeLogin();
    
    // Initialize swipe-up gesture for login form
    initializeSwipeUpLogin();
    
    // Initialize dark mode (works on login screen too)
    initializeDarkMode();
});

// Authentication
function checkAuthentication() {
    const sessionAuth = sessionStorage.getItem('mailiaAuth');
    const sessionRole = sessionStorage.getItem('mailiaRole');
    if (sessionAuth === 'authenticated') {
        isAuthenticated = true;
        userRole = sessionRole || 'delivery';
        showMainApp();
    }
}

function loadSavedCredentials() {
    const savedCreds = localStorage.getItem('mailiaSavedCredentials');
    if (savedCreds) {
        try {
            const {username, password} = JSON.parse(savedCreds);
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (usernameInput && passwordInput) {
                usernameInput.value = username;
                passwordInput.value = password;
            }
        } catch (e) {
            console.error('Failed to load saved credentials', e);
        }
    }
}

function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    const passwordInput = document.getElementById('password');
    const loginButton = document.querySelector('.login-button');
    const passwordToggle = document.getElementById('passwordToggle');
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Password visibility toggle
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type');
            if (type === 'password') {
                passwordInput.setAttribute('type', 'text');
                passwordToggle.innerHTML = '👁&#xFE0F;&#x0336;'; // Eye with strikethrough
                passwordToggle.setAttribute('aria-label', 'Hide password');
            } else {
                passwordInput.setAttribute('type', 'password');
                passwordToggle.innerHTML = '👁&#xFE0F;'; // Eye
                passwordToggle.setAttribute('aria-label', 'Show password');
            }
        });
    }
    
    // Add listener to password field to check if correct password is entered
    if (passwordInput && loginButton) {
        passwordInput.addEventListener('input', () => {
            const username = document.getElementById('username').value;
            const password = passwordInput.value;
            
            const isDeliveryUser = username === CREDENTIALS.delivery.username && password === CREDENTIALS.delivery.password;
            const isAdminUser = username === CREDENTIALS.admin.username && password === CREDENTIALS.admin.password;
            
            if (isDeliveryUser || isAdminUser) {
                loginButton.classList.add('correct-password');
            } else {
                loginButton.classList.remove('correct-password');
            }
        });
    }
}

// Swipe-up gesture for login form reveal
function initializeSwipeUpLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const landingContent = document.querySelector('.landing-content');
    const loginFormContainer = document.getElementById('loginFormContainer');
    
    if (!loginScreen || !landingContent || !loginFormContainer) return;
    
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let isFormVisible = false;
    
    // Swipe gesture thresholds - more sensitive for pronounced effect
    const SWIPE_REVEAL_DISTANCE = 150; // Reduced for easier activation
    const SWIPE_TRIGGER_THRESHOLD = 80; // Lower threshold for easier triggering
    const FORM_TRANSLATE_OFFSET = 150; // Increased for more dramatic slide
    
    // Helper function to validate touch events
    function isValidTouch(e) {
        return e.touches && e.touches.length > 0;
    }
    
    // Touch events
    loginScreen.addEventListener('touchstart', (e) => {
        if (isFormVisible) return; // Only allow swipe when form is hidden
        
        if (isValidTouch(e)) {
            startY = e.touches[0].clientY;
            currentY = startY;
            isDragging = false;
        }
    }, { passive: true });
    
    loginScreen.addEventListener('touchmove', (e) => {
        if (isFormVisible) return;
        
        if (isValidTouch(e)) {
            currentY = e.touches[0].clientY;
            const deltaY = startY - currentY; // Positive when swiping up
            
            // Only allow upward swipe
            if (deltaY > 0) {
                isDragging = true;
                e.preventDefault();
                
                // Show partial login form as user swipes with more pronounced effect
                const progress = Math.min(deltaY / SWIPE_REVEAL_DISTANCE, 1);
                
                // Sliding animation for form
                loginFormContainer.style.transform = `translateX(-50%) translateY(${100 - (progress * FORM_TRANSLATE_OFFSET)}%)`;
                
                // Fade out landing content
                landingContent.style.opacity = 1 - progress;
                
                // Fade and blur background video progressively
                loginScreen.style.setProperty('--bg-fade-progress', progress);
                const bgVideo = loginScreen.querySelector('.login-bg-video');
                if (bgVideo) {
                    bgVideo.style.opacity = 1 - (progress * 0.7);
                    bgVideo.style.filter = `blur(${progress * 8}px)`;
                }
            }
        }
    }, { passive: false });
    
    loginScreen.addEventListener('touchend', (e) => {
        if (isFormVisible) return;
        
        const deltaY = startY - currentY;
        
        if (isDragging && deltaY > SWIPE_TRIGGER_THRESHOLD) {
            // Show the login form
            showLoginForm();
        } else {
            // Reset to original position
            hideLoginForm();
        }
        
        isDragging = false;
        startY = 0;
        currentY = 0;
    });
    
    // Also allow click on swipe indicator
    const swipeIndicator = document.querySelector('.swipe-indicator');
    if (swipeIndicator) {
        swipeIndicator.addEventListener('click', () => {
            if (!isFormVisible) {
                showLoginForm();
            }
        });
        swipeIndicator.style.cursor = 'pointer';
    }
    
    function showLoginForm() {
        isFormVisible = true;
        loginFormContainer.classList.add('show');
        landingContent.classList.add('hide');
        loginScreen.classList.add('form-active');
        
        // Focus on username field after animation
        setTimeout(() => {
            document.getElementById('username')?.focus();
        }, 500);
    }
    
    function hideLoginForm() {
        isFormVisible = false;
        loginFormContainer.classList.remove('show');
        landingContent.classList.remove('hide');
        loginScreen.classList.remove('form-active');
        loginFormContainer.style.transform = '';
        landingContent.style.opacity = '';
        
        // Reset background video
        const bgVideo = loginScreen.querySelector('.login-bg-video');
        if (bgVideo) {
            bgVideo.style.opacity = '';
            bgVideo.style.filter = '';
        }
    }
}

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    let authenticated = false;
    let role = null;
    
    // Check delivery user credentials
    if (username === CREDENTIALS.delivery.username && password === CREDENTIALS.delivery.password) {
        authenticated = true;
        role = 'delivery';
    }
    // Check admin credentials
    else if (username === CREDENTIALS.admin.username && password === CREDENTIALS.admin.password) {
        authenticated = true;
        role = 'admin';
    }
    
    if (authenticated) {
        // Successful login
        sessionStorage.setItem('mailiaAuth', 'authenticated');
        sessionStorage.setItem('mailiaRole', role);
        isAuthenticated = true;
        userRole = role;
        errorDiv.style.display = 'none';
        
        // Prompt to save login info
        promptSaveLoginInfo(username, password);
        
        showMainApp();
    } else {
        // Failed login
        errorDiv.textContent = 'Virheellinen käyttäjätunnus tai salasana';
        errorDiv.style.display = 'block';
        document.getElementById('password').value = '';
    }
}

function promptSaveLoginInfo(username, password) {
    // Check if credentials are already saved
    const savedCreds = localStorage.getItem('mailiaSavedCredentials');
    if (savedCreds) return; // Already saved
    
    // WARNING: Storing passwords in localStorage is insecure
    // This is for convenience in a client-side-only demo application
    // In production, use secure token-based authentication
    setTimeout(() => {
        if (confirm('Haluatko tallentaa kirjautumistiedot?')) {
            localStorage.setItem('mailiaSavedCredentials', JSON.stringify({
                username: username,
                password: password  // Stored in plain text - NOT SECURE
            }));
        }
    }, 500);
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
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Initialize dark mode toggle now that main app is visible
    initializeDarkMode();
    
    // Initialize logout button
    initializeLogout();
    
    // Initialize settings dropdown
    initializeSettings();
    
    // Initialize the main application
    initializeTabs();
    await loadData();
    populateCircuitSelector();
    initializeCircuitTracker();
    initializeEventListeners();
    checkMidnightReset();
    scheduleMidnightReset();
}

// Dark Mode
function initializeDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
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
    if (logoutBtn && isAuthenticated) {
        logoutBtn.addEventListener('click', () => {
            handleLogout();
        });
    }
}

function handleLogout() {
    // Clear authentication
    sessionStorage.removeItem('mailiaAuth');
    isAuthenticated = false;
    
    // Hide main app and show login screen
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    
    // Reset form
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('loginError').style.display = 'none';
}

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Show/hide tabs based on user role
    const jakeluButton = document.querySelector('[data-tab="delivery"]');
    const seurantaButton = document.querySelector('[data-tab="tracker"]');
    const messagesButton = document.querySelector('[data-tab="messages"]');
    
    if (userRole === 'admin') {
        // Admin sees all tabs: Jakelu, Seuranta, and Reittiviestit
        if (jakeluButton) jakeluButton.style.display = 'inline-block';
        if (seurantaButton) seurantaButton.style.display = 'inline-block';
        if (messagesButton) messagesButton.style.display = 'inline-block';
    } else {
        // Delivery user sees no tabs (direct access to circuit selector)
        if (jakeluButton) jakeluButton.style.display = 'none';
        if (seurantaButton) seurantaButton.style.display = 'none';
        if (messagesButton) messagesButton.style.display = 'none';
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            
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
            }
            
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

// Data Loading and Parsing
async function loadData() {
    try {
        // List of all circuit CSV files
        const circuitFiles = [
            'K28 DATA.csv', 'KP R2 DATA.csv', 'KP R3 DATA.csv', 'KP R4 DATA.csv',
            'KP3 DATA.csv', 'KP4 DATA.csv', 'KP7 DATA.csv', 'KP9 DATA.csv',
            'KP10 DATA.csv', 'KP11 DATA.csv', 'KP12 DATA.csv', 'kp13.csv', 'KP15 DATA.csv',
            'KP16 DATA.csv', 'KP16B DATA.csv', 'KP18 DATA.csv', 'KP19 DATA.csv',
            'KP21B DATA.csv', 'KP22 DATA.csv', 'KP24 DATA.csv', 'KP25 DATA.csv',
            'KP26 DATA.csv', 'KP27 DATA.csv', 'KP31 DATA.csv', 'KP32A DATA.csv',
            'KP32B DATA.csv', 'KP33 DATA.csv', 'KP34 DATA.csv', 'KP36 DATA.csv',
            'KP37 DATA.csv', 'KP38 DATA.csv', 'KP39 DATA.csv', 'KP40 DATA.csv',
            'KP41 DATA.csv', 'KP42 DATA.csv', 'KP43B DATA.csv', 'kp44.csv', 'KP46 DATA.csv',
            'KP47 DATA.csv', 'KP48 DATA.csv', 'KP49 DATA.csv', 'KP51 DATA.csv',
            'KP53 DATA.csv', 'KP54 DATA.csv', 'KP55A DATA.csv', 'KP55B DATA.csv',
            'kp r1.csv', 'kpr5.csv', 'kpr6.csv', 'kp2.csv'
        ];
        
        allData = {};
        
        // Load each circuit's CSV file
        for (const filename of circuitFiles) {
            try {
                const response = await fetch(filename);
                if (!response.ok) continue;
                const text = await response.text();
                const circuitId = extractCircuitId(filename);
                allData[circuitId] = parseCircuitCSV(text, filename);
            } catch (err) {
                console.warn(`Could not load ${filename}:`, err);
            }
        }
        
        console.log(`Loaded ${Object.keys(allData).length} circuits`);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Virhe tietojen lataamisessa. Varmista, että CSV-tiedostot ovat saatavilla.');
    }
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

function parseOldFormatCSVLine(line) {
    // Parse CSV line with proper quote handling
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
        } else if (char === ',' && !insideQuotes) {
            // Field separator
            fields.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    fields.push(currentField);
    
    // Expected format: "Sivu","Katu","Osoite","Nimi","Merkinnät"
    if (fields.length >= 5) {
        const address = fields[2].trim();
        const name = fields[3].trim();
        const productsStr = fields[4].trim();
        
        // Skip if no address
        if (!address) return null;
        
        // Parse products - handle multiline and comma-separated
        const products = productsStr.split(/[\n,]+/).map(p => p.trim()).filter(p => p);
        
        return {
            address,
            products,
            name,
            buildingAddress: extractBuildingAddress(address)
        };
    }
    
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
        const productMatches = productsStr.matchAll(/([A-Z]+\d*)/g);
        const products = Array.from(productMatches, m => m[1]);
        
        return {
            address,
            products: products.length > 0 ? products : [productsStr.trim()],
            name,
            buildingAddress: extractBuildingAddress(address)
        };
    }
    
    return null;
}

function extractBuildingAddress(address) {
    // Extract street name, number, and apartment letter
    // Examples: "ENSONTIE 33 lii 1" -> "ENSONTIE 33 LII"
    //           "ENSONTIE 45 A 4" -> "ENSONTIE 45 A"
    const parts = address.split(' ');
    let building = '';
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Add street name
        if (i === 0 || !/^\d/.test(part)) {
            building += (building ? ' ' : '') + part;
        }
        // Add number
        else if (/^\d+$/.test(part)) {
            building += ' ' + part;
        }
        // Add apartment letter (single letter or letters like "lii", "as")
        else if (/^[A-Za-z]{1,3}$/.test(part)) {
            building += ' ' + part.toUpperCase();
            break;
        }
    }
    
    return building || address;
}

// Circuit Selector
function populateCircuitSelector() {
    const select = document.getElementById('circuitSelect');
    const circuits = Object.keys(allData).sort(sortCircuits);

    circuits.forEach(circuit => {
        const option = document.createElement('option');
        option.value = circuit;
        option.textContent = circuitNames[circuit] || circuit;
        select.appendChild(option);
    });

    select.addEventListener('change', (e) => {
        if (e.target.value) {
            loadCircuit(e.target.value);
        } else {
            document.getElementById('deliveryContent').style.display = 'none';
        }
    });
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
function loadCircuit(circuitId) {
    currentCircuit = circuitId;
    const subscribers = allData[circuitId] || [];
    
    document.getElementById('deliveryContent').style.display = 'block';
    
    renderCoverSheet(circuitId, subscribers);
    renderSubscriberList(circuitId, subscribers);
    updateRouteButtons(circuitId);
    
    // Restore filter states
    const hideStf = localStorage.getItem('hideStf') === 'true';
    const hideDelivered = localStorage.getItem('hideDelivered') === 'true';
    document.getElementById('hideStfFilter').checked = hideStf;
    document.getElementById('hideDeliveredFilter').checked = hideDelivered;
    applyFilters();
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
            // Only count if product is valid for today
            if (isProductValidForDay(normalized, today)) {
                products[normalized] = (products[normalized] || 0) + 1;
            }
        });
    });
    
    // Display product counts
    productCounts.innerHTML = '';
    Object.entries(products).sort().forEach(([product, count]) => {
        const badge = document.createElement('div');
        const colorClass = getProductColorClass(product);
        badge.className = `product-badge product-${colorClass}`;
        badge.innerHTML = `${product} <span class="count">${count}</span>`;
        productCounts.appendChild(badge);
    });
}

function normalizeProduct(product) {
    // Normalize products: UV2→UV, HS2→HS, ES4→ES, STF2→STF, etc.
    return product.replace(/\d+$/, '').trim();
}

function getProductColorClass(product) {
    // Map alternative products to base colors
    // All HS variants → HS (green)
    // All ES variants → ES (cyan)
    // UV, JO, STF, LU keep their own colors
    const colorMap = {
        // Helsingin Sanomat variants
        'SH': 'HS',        // Sunnuntai Hesari
        'HSPS': 'HS',      // Hesari perjantai-sunnuntai
        'HSPE': 'HS',      // Hesari perjantai
        'HSLS': 'HS',      // Hesari lauantai-sunnuntai
        'HSP': 'HS',       // Hesari maanantai-perjantai
        'HSTS': 'HS',      // Hesari torstai-sunnuntai
        'MALA': 'HS',      // Hesari maanantai-lauantai
        // Etelä-Saimaa variants
        'ESPS': 'ES',      // Etelä-Saimaa perjantai-sunnuntai
        'ESLS': 'ES',      // Etelä-Saimaa lauantai-sunnuntai
        'ESP': 'ES'        // Etelä-Saimaa maanantai-perjantai
    };
    return colorMap[product] || product;
}

// Day constants for better readability
const SUNDAY = 0, MONDAY = 1, TUESDAY = 2, WEDNESDAY = 3, THURSDAY = 4, FRIDAY = 5, SATURDAY = 6;

/**
 * Check if a product should be delivered on a specific day of the week
 * @param {string} product - The product code (e.g., 'ESLS', 'HSP', 'UV')
 * @param {number} dayOfWeek - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns {boolean} True if the product should be delivered on the given day
 * 
 * @example
 * isProductValidForDay('ESLS', FRIDAY) // returns false (ESLS is weekend-only)
 * isProductValidForDay('ESLS', SATURDAY) // returns true
 * isProductValidForDay('UV', MONDAY) // returns true (UV has no day restrictions)
 */
function isProductValidForDay(product, dayOfWeek) {
    const productSchedule = {
        'SH': [SUNDAY],                              // Sunnuntai Hesari - Sunday only
        'HSPS': [FRIDAY, SATURDAY, SUNDAY],          // Hesari perjantai-sunnuntai
        'HSPE': [FRIDAY],                            // Hesari perjantai - Friday only
        'HSLS': [SATURDAY, SUNDAY],                  // Hesari lauantai-sunnuntai
        'HSP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],  // Hesari maanantai-perjantai - Monday to Friday
        'HSTS': [THURSDAY, FRIDAY, SATURDAY, SUNDAY],           // Hesari torstai-sunnuntai
        'MALA': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY],  // Hesari maanantai-lauantai
        'ESPS': [FRIDAY, SATURDAY, SUNDAY],          // Etelä-Saimaa perjantai-sunnuntai
        'ESLS': [SATURDAY, SUNDAY],                  // Etelä-Saimaa lauantai-sunnuntai
        'ESP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]   // Etelä-Saimaa maanantai-perjantai
    };
    
    // If the product has a specific schedule, check if today is valid
    if (productSchedule[product]) {
        return productSchedule[product].includes(dayOfWeek);
    }
    
    // All other products (UV, HS, ES, JO, STF, LU, etc.) are always valid
    return true;
}

/**
 * Simplifies product display names based on delivery days
 * E.g., ESP (mon-fri) displays as "ES" on those days
 */
function simplifyProductName(product, dayOfWeek) {
    const normalized = normalizeProduct(product);
    
    // ESP -> ES on Monday-Friday
    if (normalized === 'ESP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    // ESPS -> ES on Friday-Sunday
    if (normalized === 'ESPS' && [FRIDAY, SATURDAY, SUNDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    // ESLS -> ES on Saturday-Sunday
    if (normalized === 'ESLS' && [SATURDAY, SUNDAY].includes(dayOfWeek)) {
        return 'ES';
    }
    // HSP -> HS on Monday-Friday
    if (normalized === 'HSP' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // HSPS -> HS on Friday-Sunday
    if (normalized === 'HSPS' && [FRIDAY, SATURDAY, SUNDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // HSPE -> HS on Friday
    if (normalized === 'HSPE' && dayOfWeek === FRIDAY) {
        return 'HS';
    }
    // HSLS -> HS on Saturday-Sunday  
    if (normalized === 'HSLS' && [SATURDAY, SUNDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // HSTS -> HS on Thursday-Sunday
    if (normalized === 'HSTS' && [THURSDAY, FRIDAY, SATURDAY, SUNDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // MALA -> HS on Monday-Saturday
    if (normalized === 'MALA' && [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY].includes(dayOfWeek)) {
        return 'HS';
    }
    // SH -> HS on Sunday
    if (normalized === 'SH' && dayOfWeek === SUNDAY) {
        return 'HS';
    }
    
    // Return original for all other cases
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
        // Filter products to only those valid for today
        const validProducts = sub.products.filter(product => {
            const normalized = normalizeProduct(product);
            return isProductValidForDay(normalized, today);
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
        
        const header = document.createElement('div');
        header.className = 'building-header';
        header.textContent = buildingObj.name;
        buildingGroup.appendChild(header);
        
        const buildingSubscribers = buildingObj.subscribers;
        buildingSubscribers.forEach((sub, subIndex) => {
            const card = createSubscriberCard(circuitId, sub, buildingIndex, subIndex, 
                buildingIndex === buildings.length - 1 && subIndex === buildingSubscribers.length - 1,
                buildings, buildingIndex, subIndex);
            buildingGroup.appendChild(card);
        });
        
        listContainer.appendChild(buildingGroup);
    });
}

function createSubscriberCard(circuitId, subscriber, buildingIndex, subIndex, isLast, buildings, currentBuildingIndex, currentSubIndex) {
    const card = document.createElement('div');
    card.className = 'subscriber-card';
    card.dataset.products = subscriber.products.join(',');
    
    // Apply checkbox visibility class based on user preference
    if (showCheckboxes) {
        card.classList.add('show-checkboxes');
    }
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = getCheckboxState(circuitId, subscriber.address);
    checkbox.addEventListener('change', (e) => {
        saveCheckboxState(circuitId, subscriber.address, e.target.checked);
        applyFilters(); // Re-apply filters to hide/show delivered addresses
    });
    card.appendChild(checkbox);
    
    // Add swipe functionality
    initializeSwipeToMark(card, checkbox, circuitId, subscriber.address);
    
    // Subscriber info
    const info = document.createElement('div');
    info.className = 'subscriber-info';
    
    const name = document.createElement('div');
    name.className = 'subscriber-name';
    name.textContent = subscriber.name;
    info.appendChild(name);
    
    const products = document.createElement('div');
    products.className = 'subscriber-products';
    const today = new Date().getDay();
    subscriber.products.forEach(product => {
        const tag = document.createElement('span');
        const simplifiedProduct = simplifyProductName(product.trim(), today);
        const colorClass = getProductColorClass(simplifiedProduct);
        tag.className = `product-tag product-${colorClass}`;
        tag.textContent = simplifiedProduct;
        products.appendChild(tag);
    });
    info.appendChild(products);
    
    card.appendChild(info);
    
    // Report undelivered button
    const reportBtn = document.createElement('button');
    reportBtn.className = 'report-button';
    reportBtn.textContent = '🚩';
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
            link.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextAddress + ', Imatra, Finland')}`;
            link.target = '_blank';
            link.title = `Navigate to ${nextAddress}`;
            const navImg = document.createElement('img');
            navImg.src = 'navigation icon.png';
            navImg.alt = 'Navigate';
            navImg.className = 'nav-icon-img';
            link.appendChild(navImg);
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
function initializeSwipeToMark(card, checkbox, circuitId, address) {
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
            card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            card.style.transform = 'translateX(100%)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                checkbox.checked = true;
                saveCheckboxState(circuitId, address, true);
                applyFilters();
                
                // Reset card position (will be hidden by filters if enabled)
                card.style.transition = '';
                card.style.transform = '';
                card.style.opacity = '';
            }, 300);
        } else {
            // Reset card position with animation
            card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
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
            card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
            card.style.transform = 'translateX(100%)';
            card.style.opacity = '0';
            
            setTimeout(() => {
                checkbox.checked = true;
                saveCheckboxState(circuitId, address, true);
                applyFilters();
                
                card.style.transition = '';
                card.style.transform = '';
                card.style.opacity = '';
            }, 300);
        } else {
            card.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out';
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
        background: white;
        padding: 2rem;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    `;
    
    dialogBox.innerHTML = `
        <h3 style="margin-top: 0; color: var(--navy); font-size: 1.25rem;">Jakeluhäiriön ilmoitus</h3>
        <p style="margin-bottom: 1.5rem; color: var(--navy);">Valitse syy:</p>
        <select id="deliveryIssueSelect" style="width: 100%; padding: 0.75rem; border: 1.5px solid #D1D5D8; border-radius: 8px; font-size: 1rem; margin-bottom: 1rem;">
            <option value="">-- Valitse syy --</option>
            <option value="Ei pääsyä">Ei pääsyä</option>
            <option value="Avainongelma">Avainongelma</option>
            <option value="Lehtipuute">Lehtipuute</option>
            <option value="Muu">Muu</option>
        </select>
        <div id="customReasonContainer" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--navy);">Tarkenna:</label>
            <textarea id="customReasonText" rows="3" style="width: 100%; padding: 0.75rem; border: 1.5px solid #D1D5D8; border-radius: 8px; font-size: 1rem; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 0.75rem 1.5rem; border: 1.5px solid #D1D5D8; background: white; color: var(--navy); border-radius: 8px; cursor: pointer; font-size: 1rem;">Peruuta</button>
            <button id="submitBtn" style="padding: 0.75rem 1.5rem; border: none; background: var(--primary-blue); color: white; border-radius: 8px; cursor: pointer; font-size: 1rem;">Lähetä</button>
        </div>
    `;
    
    dialog.appendChild(dialogBox);
    document.body.appendChild(dialog);
    
    const select = document.getElementById('deliveryIssueSelect');
    const customContainer = document.getElementById('customReasonContainer');
    const customText = document.getElementById('customReasonText');
    const cancelBtn = document.getElementById('cancelBtn');
    const submitBtn = document.getElementById('submitBtn');
    
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
        
        const report = {
            timestamp: new Date().toISOString(),
            circuit: circuitId,
            address: subscriber.address,
            name: subscriber.name,
            products: subscriber.products.join(', '),
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
    // Load existing messages
    const messages = loadRouteMessages();
    messages.push(message);
    
    // Save back to localStorage
    localStorage.setItem('mailiaRouteMessages', JSON.stringify(messages));
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
    
    // Hide empty building groups
    setTimeout(() => {
        const buildingGroups = document.querySelectorAll('.building-group');
        buildingGroups.forEach(group => {
            const visibleCards = Array.from(group.querySelectorAll('.subscriber-card'))
                .filter(card => card.style.display !== 'none');
            group.style.display = visibleCards.length > 0 ? '' : 'none';
        });
    }, ANIMATION_DURATION_MS);
}

// Checkbox State Management
function getCheckboxState(circuitId, address) {
    const key = `checkbox_${circuitId}_${address}`;
    return localStorage.getItem(key) === 'true';
}

function saveCheckboxState(circuitId, address, checked) {
    const key = `checkbox_${circuitId}_${address}`;
    localStorage.setItem(key, checked);
}

// Route Timing
function startRoute(circuitId) {
    const now = new Date();
    const key = `route_start_${circuitId}`;
    localStorage.setItem(key, now.toISOString());
    
    updateRouteButtons(circuitId);
    updateCircuitStatus(circuitId, 'in-progress');
}

function completeRoute(circuitId) {
    const now = new Date();
    const key = `route_end_${circuitId}`;
    localStorage.setItem(key, now.toISOString());
    
    updateRouteButtons(circuitId);
    updateCircuitStatus(circuitId, 'completed');
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
        startBtn.style.display = 'none';
        startTimeDisplay.style.display = 'block';
        startTimeDisplay.textContent = `Aloitettu: ${formatTime(new Date(startTime))}`;
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
function renderRouteMessages() {
    const messagesContainer = document.getElementById('routeMessages');
    const messages = loadRouteMessages();
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<p class="no-messages">Ei viestejä</p>';
        return;
    }
    
    messagesContainer.innerHTML = '';
    
    // Sort by timestamp descending (newest first)
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    messages.forEach((message, index) => {
        const messageCard = document.createElement('div');
        messageCard.className = 'message-card';
        
        const timestamp = new Date(message.timestamp);
        const formattedDate = timestamp.toLocaleString('fi-FI');
        
        // Create elements safely to prevent XSS
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        
        const circuitSpan = document.createElement('span');
        circuitSpan.className = 'message-circuit';
        circuitSpan.textContent = message.circuit;
        
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'message-timestamp';
        timestampSpan.textContent = formattedDate;
        
        messageHeader.appendChild(circuitSpan);
        messageHeader.appendChild(timestampSpan);
        
        const messageBody = document.createElement('div');
        messageBody.className = 'message-body';
        
        const addressDiv = document.createElement('div');
        addressDiv.className = 'message-address';
        addressDiv.innerHTML = '<strong>Osoite:</strong> ';
        addressDiv.appendChild(document.createTextNode(message.address));
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'message-name';
        nameDiv.innerHTML = '<strong>Asiakas:</strong> ';
        nameDiv.appendChild(document.createTextNode(message.name));
        
        const productsDiv = document.createElement('div');
        productsDiv.className = 'message-products';
        productsDiv.innerHTML = '<strong>Tuotteet:</strong> ';
        productsDiv.appendChild(document.createTextNode(message.products));
        
        const reasonDiv = document.createElement('div');
        reasonDiv.className = 'message-reason';
        reasonDiv.innerHTML = '<strong>Syy:</strong> ';
        reasonDiv.appendChild(document.createTextNode(message.reason));
        
        messageBody.appendChild(addressDiv);
        messageBody.appendChild(nameDiv);
        messageBody.appendChild(productsDiv);
        messageBody.appendChild(reasonDiv);
        
        messageCard.appendChild(messageHeader);
        messageCard.appendChild(messageBody);
        
        messagesContainer.appendChild(messageCard);
    });
    
    // Add clear button handler
    const clearBtn = document.getElementById('clearMessagesBtn');
    if (clearBtn) {
        clearBtn.onclick = () => {
            if (confirm('Haluatko varmasti tyhjentää kaikki viestit?')) {
                localStorage.removeItem('mailiaRouteMessages');
                renderRouteMessages();
            }
        };
    }
}

// Circuit Tracker
function initializeCircuitTracker() {
    renderCircuitTracker();
}

function renderCircuitTracker() {
    const tracker = document.getElementById('circuitTracker');
    tracker.innerHTML = '';
    
    const circuits = Object.keys(allData).sort(sortCircuits);
    
    circuits.forEach(circuitId => {
        const item = createCircuitItem(circuitId);
        tracker.appendChild(item);
    });
}

function createCircuitItem(circuitId) {
    const item = document.createElement('div');
    item.className = 'circuit-item';
    
    const status = getCircuitStatus(circuitId);
    
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
    
    content.appendChild(header);
    
    const statusText = document.createElement('div');
    statusText.className = 'circuit-status';
    statusText.textContent = getCircuitStatusText(circuitId, status);
    content.appendChild(statusText);
    
    // Add progress bar for in-progress circuits
    if (status === 'in-progress') {
        const progressBar = createCircuitProgressBar(circuitId);
        if (progressBar) {
            content.appendChild(progressBar);
        }
    }
    
    item.appendChild(content);
    
    return item;
}

function createCircuitProgressBar(circuitId) {
    const data = allData[circuitId];
    if (!data || data.length === 0) return null;
    
    const totalSubscribers = data.length;
    const deliveredCount = data.filter(sub => sub.delivered).length;
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

function getCircuitStatus(circuitId) {
    const startKey = `route_start_${circuitId}`;
    const endKey = `route_end_${circuitId}`;
    const startTime = localStorage.getItem(startKey);
    const endTime = localStorage.getItem(endKey);
    
    if (!startTime) return 'not-started';
    if (!endTime) return 'in-progress';
    return 'completed';
}

function getCircuitStatusText(circuitId, status) {
    if (status === 'not-started') {
        return 'Ei aloitettu';
    } else if (status === 'in-progress') {
        const startKey = `route_start_${circuitId}`;
        const startTime = localStorage.getItem(startKey);
        return `Aloitettu: ${formatTime(new Date(startTime))}`;
    } else {
        // Completed - show completion time
        const endKey = `route_end_${circuitId}`;
        const endTime = localStorage.getItem(endKey);
        return `Valmis: ${formatTime(new Date(endTime))}`;
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

function updateCircuitStatus(circuitId, status) {
    // Update status and re-render tracker if on tracker tab
    if (document.getElementById('trackerTab').classList.contains('active')) {
        renderCircuitTracker();
    }
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
