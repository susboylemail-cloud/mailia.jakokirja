// Mailia Delivery Tracking Application

// Authentication credentials
const CREDENTIALS = {
    username: 'imatravj',
    password: 'mailiavj1!'
};

// Global state
let allData = [];
let currentCircuit = null;
let isAuthenticated = false;

// Circuit names mapping
const circuitNames = {
    'KP3': 'KP3 Puntala-Immola',
    'KP4': 'KP4 Imatrankoski',
    'KP7': 'KP7 Vuoksenniska',
    'KP9': 'KP9 Rajapatsas',
    'KP10': 'KP10 Ritikankylä',
    'KP11': 'KP11 Tainionkoski',
    'KP12': 'KP12 Imatrankoski',
    'KP15': 'KP15 Tainionkoski',
    'KP16': 'KP16 Tainionkoski',
    'KP16B': 'KP16B Tainionkoski',
    'KP18': 'KP18 Karelankuja',
    'KP19': 'KP19 Teppanala',
    'KP21B': 'KP21B Mansikkala',
    'KP22': 'KP22 Mansikkala',
    'KP24': 'KP24 Karhumäki-Korvenkanta',
    'KP25': 'KP25 Karhumäki',
    'KP26': 'KP26 Kaukopää',
    'KP27': 'KP27 Vuoksenniska',
    'KP28': 'KP28 Vuoksenniska',
    'KP31': 'KP31 Imatrankoski',
    'KP32A': 'KP32A Imatrankoski',
    'KP32B': 'KP32B Imatrankoski',
    'KP33': 'KP33 Rajapatsas',
    'KP34': 'KP34 Imatrankoski',
    'KP36': 'KP36 Mansikkala',
    'KP37': 'KP37 Teppanala',
    'KP38': 'KP38 Mansikkala',
    'KP39': 'KP39 Mansikkala',
    'KP40': 'KP40 Imatrankoski',
    'KP41': 'KP41 Vuoksenniska',
    'KP42': 'KP42 Mansikkala',
    'KP43B': 'KP43B Imatrankoski',
    'KP46': 'KP46 Korvenkanta',
    'KP47': 'KP47 Korvenkanta',
    'KP48': 'KP48 Korvenkanta',
    'KP49': 'KP49 Korvenkanta',
    'KP51': 'KP51 Mansikkala',
    'KP53': 'KP53 Teppanala',
    'KP54': 'KP54 Mansikkala',
    'KP55A': 'KP55A Vuoksenniska',
    'KP55B': 'KP55B Vuoksenniska',
    'KPR2': 'KPR2 Reservi',
    'KPR3': 'KPR3 Reservi',
    'KPR4': 'KPR4 Reservi'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    // Check if already authenticated
    checkAuthentication();
    
    // Setup login form
    initializeLogin();
    
    // Initialize dark mode (works on login screen too)
    initializeDarkMode();
});

// Authentication
function checkAuthentication() {
    const sessionAuth = sessionStorage.getItem('mailiaAuth');
    if (sessionAuth === 'authenticated') {
        isAuthenticated = true;
        showMainApp();
    }
}

function initializeLogin() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
    if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
        // Successful login
        sessionStorage.setItem('mailiaAuth', 'authenticated');
        isAuthenticated = true;
        errorDiv.style.display = 'none';
        showMainApp();
    } else {
        // Failed login
        errorDiv.textContent = 'Virheellinen käyttäjätunnus tai salasana';
        errorDiv.style.display = 'block';
        document.getElementById('password').value = '';
    }
}

async function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Initialize dark mode toggle now that main app is visible
    initializeDarkMode();
    
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
        updateDarkModeIcon(darkMode);
        darkModeToggle.addEventListener('click', () => {
            const isDark = document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', isDark);
            updateDarkModeIcon(isDark);
        });
    }
}

function updateDarkModeIcon(isDark) {
    const icon = document.querySelector('#darkModeToggle .icon');
    if (icon) {
        icon.textContent = isDark ? '☀️' : '🌙';
    }
}

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(targetTab === 'delivery' ? 'deliveryTab' : 'trackerTab').classList.add('active');

            if (targetTab === 'tracker') {
                renderCircuitTracker();
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
            'KP10 DATA.csv', 'KP11 DATA.csv', 'KP12 DATA.csv', 'KP15 DATA.csv',
            'KP16 DATA.csv', 'KP16B DATA.csv', 'KP18 DATA.csv', 'KP19 DATA.csv',
            'KP21B DATA.csv', 'KP22 DATA.csv', 'KP24 DATA.csv', 'KP25 DATA.csv',
            'KP26 DATA.csv', 'KP27 DATA.csv', 'KP31 DATA.csv', 'KP32A DATA.csv',
            'KP32B DATA.csv', 'KP33 DATA.csv', 'KP34 DATA.csv', 'KP36 DATA.csv',
            'KP37 DATA.csv', 'KP38 DATA.csv', 'KP39 DATA.csv', 'KP40 DATA.csv',
            'KP41 DATA.csv', 'KP42 DATA.csv', 'KP43B DATA.csv', 'KP46 DATA.csv',
            'KP47 DATA.csv', 'KP48 DATA.csv', 'KP49 DATA.csv', 'KP51 DATA.csv',
            'KP53 DATA.csv', 'KP54 DATA.csv', 'KP55A DATA.csv', 'KP55B DATA.csv'
        ];
        
        allData = {};
        
        // Load each circuit's CSV file
        for (const filename of circuitFiles) {
            try {
                const response = await fetch(filename);
                if (!response.ok) continue;
                const text = await response.text();
                const circuitId = extractCircuitId(filename);
                allData[circuitId] = parseCircuitCSV(text);
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
    // Extract circuit ID from filename like "KP3 DATA.csv" -> "KP3"
    // Handle special cases like "KP R2 DATA.csv" -> "KPR2", "K28 DATA.csv" -> "KP28"
    const match = filename.match(/^(K|KP)\s*(R\s*)?(\d+[AB]?)\s*DATA\.csv$/i);
    if (match) {
        const prefix = match[1] === 'K' ? 'KP' : 'KP';
        const r = match[2] ? 'R' : '';
        const number = match[3];
        return prefix + r + number;
    }
    return filename.replace(' DATA.csv', '').replace(/\s+/g, '').toUpperCase();
}

function parseCircuitCSV(text) {
    const lines = text.trim().split('\n');
    const subscribers = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
        const subscriber = parseCSVLine(lines[i]);
        if (subscriber) {
            // Add original order index to maintain CSV order
            subscriber.orderIndex = i;
            subscribers.push(subscriber);
        }
    }
    
    return subscribers;
}

function parseCSVLine(line) {
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
    
    // Restore STF filter state
    const hideStf = localStorage.getItem('hideStf') === 'true';
    document.getElementById('hideStfFilter').checked = hideStf;
    applyStfFilter();
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
    
    // Aggregate products
    const products = {};
    subscribers.forEach(sub => {
        sub.products.forEach(product => {
            const normalized = normalizeProduct(product);
            products[normalized] = (products[normalized] || 0) + 1;
        });
    });
    
    // Display product counts
    productCounts.innerHTML = '';
    Object.entries(products).sort().forEach(([product, count]) => {
        const badge = document.createElement('div');
        badge.className = `product-badge product-${product}`;
        badge.innerHTML = `${product} <span class="count">${count}</span>`;
        productCounts.appendChild(badge);
    });
}

function normalizeProduct(product) {
    // Normalize products: UV2→UV, HS2→HS, ES4→ES, STF2→STF, etc.
    return product.replace(/\d+$/, '').trim();
}

// Subscriber List
function renderSubscriberList(circuitId, subscribers) {
    const listContainer = document.getElementById('subscriberList');
    listContainer.innerHTML = '';
    
    // Group by building address while preserving order
    const buildings = [];
    const buildingMap = {};
    
    subscribers.forEach(sub => {
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
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = getCheckboxState(circuitId, subscriber.address);
    checkbox.addEventListener('change', (e) => {
        saveCheckboxState(circuitId, subscriber.address, e.target.checked);
    });
    card.appendChild(checkbox);
    
    // Subscriber info
    const info = document.createElement('div');
    info.className = 'subscriber-info';
    
    const name = document.createElement('div');
    name.className = 'subscriber-name';
    name.textContent = subscriber.name;
    info.appendChild(name);
    
    const products = document.createElement('div');
    products.className = 'subscriber-products';
    subscriber.products.forEach(product => {
        const tag = document.createElement('span');
        tag.className = `product-tag product-${product.trim()}`;
        tag.textContent = product;
        products.appendChild(tag);
    });
    info.appendChild(products);
    
    card.appendChild(info);
    
    // Navigation link (if not last)
    if (!isLast) {
        const nextAddress = getNextAddress(buildings, currentBuildingIndex, currentSubIndex);
        if (nextAddress) {
            const link = document.createElement('a');
            link.className = 'nav-link';
            link.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextAddress + ', Imatra, Finland')}`;
            link.target = '_blank';
            link.title = `Navigate to ${nextAddress}`;
            link.textContent = '→';
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

// STF Filter
function initializeEventListeners() {
    document.getElementById('hideStfFilter').addEventListener('change', (e) => {
        localStorage.setItem('hideStf', e.target.checked);
        applyStfFilter();
    });
    
    document.getElementById('startRouteBtn').addEventListener('click', () => {
        startRoute(currentCircuit);
    });
    
    document.getElementById('completeRouteBtn').addEventListener('click', () => {
        completeRoute(currentCircuit);
    });
}

function applyStfFilter() {
    const hideStf = document.getElementById('hideStfFilter').checked;
    const cards = document.querySelectorAll('.subscriber-card');
    
    cards.forEach(card => {
        const products = card.dataset.products.toUpperCase();
        const hasStf = products.includes('STF');
        
        if (hideStf && hasStf) {
            card.style.display = 'none';
        } else {
            card.style.display = '';
        }
    });
    
    // Hide empty building groups
    const buildingGroups = document.querySelectorAll('.building-group');
    buildingGroups.forEach(group => {
        const visibleCards = Array.from(group.querySelectorAll('.subscriber-card'))
            .filter(card => card.style.display !== 'none');
        group.style.display = visibleCards.length > 0 ? '' : 'none';
    });
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
    
    const header = document.createElement('div');
    header.className = 'circuit-header';
    
    const indicator = document.createElement('div');
    indicator.className = 'status-indicator';
    indicator.textContent = status === 'not-started' ? '🔴' : status === 'in-progress' ? '🟠' : '🟢';
    header.appendChild(indicator);
    
    const name = document.createElement('div');
    name.className = 'circuit-name';
    name.textContent = circuitNames[circuitId] || circuitId;
    header.appendChild(name);
    
    item.appendChild(header);
    
    const statusText = document.createElement('div');
    statusText.className = 'circuit-status';
    statusText.textContent = getCircuitStatusText(circuitId, status);
    item.appendChild(statusText);
    
    const controls = document.createElement('div');
    controls.className = 'circuit-controls';
    
    const startBtn = document.createElement('button');
    startBtn.className = 'circuit-btn start';
    startBtn.textContent = 'Aloita';
    startBtn.disabled = status !== 'not-started';
    startBtn.addEventListener('click', () => {
        startCircuitFromTracker(circuitId);
    });
    controls.appendChild(startBtn);
    
    const completeBtn = document.createElement('button');
    completeBtn.className = 'circuit-btn complete';
    completeBtn.textContent = 'Valmis';
    completeBtn.disabled = status !== 'in-progress';
    completeBtn.addEventListener('click', () => {
        completeCircuitFromTracker(circuitId);
    });
    controls.appendChild(completeBtn);
    
    item.appendChild(controls);
    
    return item;
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
        const startKey = `route_start_${circuitId}`;
        const endKey = `route_end_${circuitId}`;
        const startTime = localStorage.getItem(startKey);
        const endTime = localStorage.getItem(endKey);
        return `${formatTime(new Date(startTime))} - ${formatTime(new Date(endTime))}`;
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
