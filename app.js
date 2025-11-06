// Mailia Delivery Tracking Application

// Global state
let allData = [];
let currentCircuit = null;

// Circuit names mapping
const circuitNames = {
    'KP2': 'KP2 Mansikkala',
    'KP3': 'KP3 Puntala-Immola',
    'KP4': 'KP4 Imatrankoski',
    'KP7': 'KP7 Vuoksenniska',
    'KP9': 'KP9 Rajapatsas',
    'KP10': 'KP10 Ritikankylä',
    'KP11': 'KP11 Tainionkoski',
    'KP12': 'KP12 Imatrankoski',
    'KP13': 'KP13 Imatrankoski',
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
    'KP33': 'KP33 Rajapatsas',
    'KP37': 'KP37 Teppanala',
    'KP38': 'KP38 Mansikkala',
    'KP40': 'KP40 Imatrankoski',
    'KP41': 'KP41 Vuoksenniska',
    'KP42': 'KP42 Mansikkala',
    'KP43B': 'KP43B Imatrankoski',
    'KP49': 'KP49 Korvenkanta',
    'KPR1': 'KPR1 Reservi',
    'KPR2': 'KPR2 Reservi',
    'KPR3': 'KPR3 Reservi',
    'KPR4': 'KPR4 Reservi',
    'KPR5': 'KPR5 Reservi',
    'KPR6': 'KPR6 Reservi'
};

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    initializeDarkMode();
    initializeTabs();
    await loadData();
    populateCircuitSelector();
    initializeCircuitTracker();
    initializeEventListeners();
    checkMidnightReset();
    scheduleMidnightReset();
});

// Dark Mode
function initializeDarkMode() {
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
        document.body.classList.add('dark-mode');
        updateDarkModeIcon(true);
    }

    document.getElementById('darkModeToggle').addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        updateDarkModeIcon(isDark);
    });
}

function updateDarkModeIcon(isDark) {
    const icon = document.querySelector('.dark-mode-toggle .icon');
    icon.textContent = isDark ? '☀️' : '🌙';
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
        const response = await fetch('combined.data.csv');
        const text = await response.text();
        allData = parseCSV(text);
    } catch (error) {
        console.error('Error loading data:', error);
        alert('Virhe tietojen lataamisessa. Varmista että combined.data.csv tiedosto on saatavilla.');
    }
}

function parseCSV(text) {
    const lines = text.split('\n');
    const circuits = {};
    let currentCircuitId = null;

    for (const line of lines) {
        if (line.startsWith('###')) {
            // Extract circuit ID from header like "### Corrected File: kp49 (2).txt"
            const match = line.match(/###\s+Corrected File:\s+(kp\w+)/i);
            if (match) {
                currentCircuitId = match[1].toUpperCase().replace(/\s+\(\d+\)/, '');
                if (!circuits[currentCircuitId]) {
                    circuits[currentCircuitId] = [];
                }
            }
        } else if (line.trim() && currentCircuitId) {
            // Parse subscriber line
            const subscriber = parseSubscriberLine(line);
            if (subscriber) {
                circuits[currentCircuitId].push(subscriber);
            }
        }
    }

    return circuits;
}

function parseSubscriberLine(line) {
    // Remove quotes and parse the line
    const cleanLine = line.replace(/^"|"$/g, '');
    
    // Match pattern: - **Address:** ADDRESS, **Products:** PRODUCTS, **Name:** NAME
    const pattern = /\*\*Address:\*\*\s*([^,]+),\s*\*\*Products:\*\*\s*([^,]+),\s*\*\*Name:\*\*\s*(.+)/;
    const match = cleanLine.match(pattern);
    
    if (match) {
        const address = match[1].trim();
        const products = match[2].trim().split(',').map(p => p.trim());
        const name = match[3].trim();
        
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
        badge.className = 'product-badge';
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
    
    // Group by building address
    const buildings = {};
    subscribers.forEach(sub => {
        const building = sub.buildingAddress;
        if (!buildings[building]) {
            buildings[building] = [];
        }
        buildings[building].push(sub);
    });
    
    // Render each building group
    const buildingKeys = Object.keys(buildings).sort();
    buildingKeys.forEach((building, buildingIndex) => {
        const buildingGroup = document.createElement('div');
        buildingGroup.className = 'building-group';
        
        const header = document.createElement('div');
        header.className = 'building-header';
        header.textContent = building;
        buildingGroup.appendChild(header);
        
        const buildingSubscribers = buildings[building];
        buildingSubscribers.forEach((sub, subIndex) => {
            const card = createSubscriberCard(circuitId, sub, buildingIndex, subIndex, 
                buildingIndex === buildingKeys.length - 1 && subIndex === buildingSubscribers.length - 1,
                buildingKeys, buildings, buildingIndex, subIndex);
            buildingGroup.appendChild(card);
        });
        
        listContainer.appendChild(buildingGroup);
    });
}

function createSubscriberCard(circuitId, subscriber, buildingIndex, subIndex, isLast, buildingKeys, buildings, currentBuildingIndex, currentSubIndex) {
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
    
    const address = document.createElement('div');
    address.className = 'subscriber-address';
    address.textContent = subscriber.address;
    info.appendChild(address);
    
    const name = document.createElement('div');
    name.className = 'subscriber-name';
    name.textContent = subscriber.name;
    info.appendChild(name);
    
    const products = document.createElement('div');
    products.className = 'subscriber-products';
    subscriber.products.forEach(product => {
        const tag = document.createElement('span');
        tag.className = 'product-tag';
        tag.textContent = product;
        products.appendChild(tag);
    });
    info.appendChild(products);
    
    card.appendChild(info);
    
    // Navigation link (if not last)
    if (!isLast) {
        const nextAddress = getNextAddress(buildingKeys, buildings, currentBuildingIndex, currentSubIndex);
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

function getNextAddress(buildingKeys, buildings, currentBuildingIndex, currentSubIndex) {
    const currentBuilding = buildingKeys[currentBuildingIndex];
    const currentBuildingSubscribers = buildings[currentBuilding];
    
    // Try next subscriber in same building
    if (currentSubIndex < currentBuildingSubscribers.length - 1) {
        return currentBuildingSubscribers[currentSubIndex + 1].address;
    }
    
    // Try first subscriber in next building
    if (currentBuildingIndex < buildingKeys.length - 1) {
        const nextBuilding = buildingKeys[currentBuildingIndex + 1];
        return buildings[nextBuilding][0].address;
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
        
        // Reload the page to reflect the reset
        window.location.reload();
    }, timeUntilMidnight);
}
