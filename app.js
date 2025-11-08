// Mailia Delivery Tracking Application

// Animation constants
const ANIMATION_DURATION_MS = 500; // Must match CSS transition duration

// Custom confirm dialog to match app theme
function customConfirm(message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customConfirmDialog');
        const messageEl = document.getElementById('customConfirmMessage');
        const okBtn = document.getElementById('customConfirmOk');
        const cancelBtn = document.getElementById('customConfirmCancel');
        
        messageEl.textContent = message;
        dialog.style.display = 'flex';
        
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
let allData = {};  // Changed to object for easier circuit lookup
let currentCircuit = null;
let isAuthenticated = false;
let userRole = null; // 'delivery' or 'admin'
let routeMessages = []; // Store route messages for admin panel
let showCheckboxes = false; // Control checkbox visibility (default: OFF - swipe is primary method)

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
    
    // Initialize phone status bar with real-time updates
    initializePhoneStatusBar();
    
    // Update notification time to show current device time
    updateNotificationTime();
    
    // Initialize weather widget on phone screen
    initializeWeatherWidget();
    
    // Initialize stamp animation
    initializeStampAnimation();
});

// Stamp Animation
function initializeStampAnimation() {
    const stamp = document.getElementById('mailiaStamp');
    if (!stamp) return;
    
    // Trigger stamp animation after 1 second
    setTimeout(() => {
        performStamp();
    }, 1000);
}

function performStamp() {
    const stamp = document.getElementById('mailiaStamp');
    if (!stamp) return;
    
    // Start stamping animation
    stamp.classList.add('stamping');
    
    // Add impact effect when stamp hits (at 450ms)
    setTimeout(() => {
        const impact = document.createElement('div');
        impact.className = 'impact-effect';
        stamp.appendChild(impact);
        
        // Add subtle phone shake
        const phoneDevice = document.querySelector('.phone-device');
        if (phoneDevice) {
            phoneDevice.style.animation = 'phoneShake 0.2s';
            setTimeout(() => {
                phoneDevice.style.animation = '';
            }, 200);
        }
        
        // Remove impact effect after animation
        setTimeout(() => {
            impact.remove();
        }, 500);
    }, 450);
    
    // Mark as stamped after animation completes
    setTimeout(() => {
        stamp.classList.add('stamped');
    }, 700);
}

// Phone shake animation for stamp impact
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
    @keyframes phoneShake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-1.5px); }
        75% { transform: translateX(1.5px); }
    }
`;
document.head.appendChild(shakeStyle);

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
    const usernameInput = document.getElementById('username');
    const loginButton = document.querySelector('.login-button');
    const passwordToggle = document.getElementById('passwordToggle');
    const rememberMeCheckbox = document.getElementById('rememberMe');
    
    // Load saved credentials if remember me was checked
    loadSavedCredentials();
    
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Password visibility toggle
    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type');
            const svg = passwordToggle.querySelector('svg');
            if (type === 'password') {
                passwordInput.setAttribute('type', 'text');
                // Add strikethrough line to eye icon
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                `;
                passwordToggle.setAttribute('aria-label', 'Hide password');
            } else {
                passwordInput.setAttribute('type', 'password');
                // Eye icon without strikethrough
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
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

function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe')?.checked || false;
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
        // Handle remember me
        if (rememberMe) {
            saveCredentials(username, password);
        } else {
            clearSavedCredentials();
        }
        
        // Successful login
        sessionStorage.setItem('mailiaAuth', 'authenticated');
        sessionStorage.setItem('mailiaRole', role);
        isAuthenticated = true;
        userRole = role;
        errorDiv.style.display = 'none';
        
        showMainApp();
    } else {
        // Failed login - trigger wiggle animation
        const phoneDevice = document.querySelector('.phone-device');
        phoneDevice.classList.add('wiggle');
        
        // Remove wiggle class after animation completes
        setTimeout(() => {
            phoneDevice.classList.remove('wiggle');
        }, 500);
        
        errorDiv.textContent = 'Virheellinen käyttäjätunnus tai salasana';
        errorDiv.style.display = 'block';
        document.getElementById('password').value = '';
    }
}

// Save credentials to localStorage
function saveCredentials(username, password) {
    // WARNING: Storing passwords in localStorage is insecure
    // This is for convenience in a client-side-only demo application
    // In production, use secure token-based authentication
    try {
        localStorage.setItem('mailiaRememberMe', JSON.stringify({
            username: username,
            password: password  // Stored in plain text - NOT SECURE
        }));
    } catch (e) {
        console.error('Failed to save credentials:', e);
    }
}

// Load saved credentials
function loadSavedCredentials() {
    try {
        const saved = localStorage.getItem('mailiaRememberMe');
        if (saved) {
            const creds = JSON.parse(saved);
            const usernameInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            const rememberMeCheckbox = document.getElementById('rememberMe');
            
            if (usernameInput && passwordInput && creds.username && creds.password) {
                usernameInput.value = creds.username;
                passwordInput.value = creds.password;
                if (rememberMeCheckbox) {
                    rememberMeCheckbox.checked = true;
                }
            }
        }
    } catch (e) {
        console.error('Failed to load credentials:', e);
    }
}

// Clear saved credentials
function clearSavedCredentials() {
    try {
        localStorage.removeItem('mailiaRememberMe');
    } catch (e) {
        console.error('Failed to clear credentials:', e);
    }
}

function promptSaveLoginInfo(username, password) {
    // Check if credentials are already saved
    const savedCreds = localStorage.getItem('mailiaSavedCredentials');
    if (savedCreds) return; // Already saved
    
    // WARNING: Storing passwords in localStorage is insecure
    // This is for convenience in a client-side-only demo application
    // In production, use secure token-based authentication
    setTimeout(async () => {
        if (await customConfirm('Haluatko tallentaa kirjautumistiedot?')) {
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
    // Start the page-turn transition animation
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    // Add page-turn transition class
    loginScreen.classList.add('zoom-transition');
    
    // Show main app with simple fade-in after page turn completes
    setTimeout(() => {
        mainApp.style.display = 'block';
        mainApp.classList.add('zoom-in');
    }, 1200);
    
    // Hide login screen completely after animation
    setTimeout(() => {
        loginScreen.style.display = 'none';
    }, 2400);
    
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
    
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    
    // Remove animation classes
    loginScreen.classList.remove('zoom-transition');
    mainApp.classList.remove('zoom-in');
    
    // Hide main app and show login screen
    mainApp.style.display = 'none';
    loginScreen.style.display = 'flex';
    
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

function populateCircuitSelector() {
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
    
    const circuits = Object.keys(circuitFiles).sort(sortCircuits);
    
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
        const displayText = display.querySelector('.circuit-display-text');
        displayText.textContent = circuitNames[circuit] || circuit;
        dropdown.style.display = 'none';
        customSelect.classList.remove('open');
        await loadCircuit(circuit);
        search.value = '';
        circuitSearchMemory = '';
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
        console.log(`Loaded circuit ${circuitId} (${data.length} subscribers)`);
        
        return data;
    } catch (err) {
        console.warn(`Error loading ${filename}:`, err);
        return [];
    }
}

async function loadCircuit(circuitId) {
    currentCircuit = circuitId;
    
    // Load circuit data on demand
    const subscribers = await loadCircuitData(circuitId);
    
    document.getElementById('deliveryContent').style.display = 'block';
    
    renderCoverSheet(circuitId, subscribers);
    renderSubscriberList(circuitId, subscribers);
    updateRouteButtons(circuitId);
    
    // Hide subscriber list initially - it will be shown when route starts
    const subscriberList = document.getElementById('subscriberList');
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
                // Simplify product name (e.g., HSPE → HS, ESP → ES)
                const simplified = simplifyProductName(normalized, today);
                products[simplified] = (products[simplified] || 0) + 1;
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
        // Helsingin Sanomat variants
        'SH': [SUNDAY],                              // Sunnuntai Hesari - Sunday only
        'HSPS': [FRIDAY, SATURDAY, SUNDAY],          // Hesari perjantai-sunnuntai
        'HSPE': [FRIDAY],                            // Hesari perjantai - Friday only
        'HSLS': [SATURDAY, SUNDAY],                  // Hesari lauantai-sunnuntai
        'HSP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY],  // Hesari maanantai-perjantai - Monday to Friday
        'HSTS': [THURSDAY, FRIDAY, SATURDAY, SUNDAY],           // Hesari torstai-sunnuntai
        'MALA': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY],  // Hesari maanantai-lauantai
        // Etelä-Saimaa variants
        // Note: plain ES is a daily product (delivered every day), so it's not listed here
        'ESPS': [FRIDAY, SATURDAY, SUNDAY],          // Etelä-Saimaa perjantai-sunnuntai
        'ESLS': [SATURDAY, SUNDAY],                  // Etelä-Saimaa lauantai-sunnuntai
        'ESP': [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY]   // Etelä-Saimaa maanantai-perjantai
    };
    
    // If the product has a specific schedule, check if today is valid
    if (productSchedule[product]) {
        return productSchedule[product].includes(dayOfWeek);
    }
    
    // All other products (UV, HS, ES, JO, STF, LU, etc.) are always valid (every day)
    return true;
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
            
            const card = createSubscriberCard(circuitId, sub, buildingIndex, subIndex, 
                buildingIndex === buildings.length - 1 && subIndex === buildingSubscribers.length - 1,
                buildings, buildingIndex, subIndex, hasMultipleDeliveries, isNewStaircase);
            buildingGroup.appendChild(card);
            
            previousStaircase = currentStaircase;
        });
        
        listContainer.appendChild(buildingGroup);
    });
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
            card.style.transition = 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
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
        background: var(--background-color);
        padding: 2rem;
        border-radius: 12px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    `;
    
    dialogBox.innerHTML = `
        <h3 style="margin-top: 0; color: var(--text-color); font-size: 1.25rem;">Jakeluhäiriön ilmoitus</h3>
        <select id="deliveryIssueSelect" style="width: 100%; padding: 0.75rem; border: 1.5px solid var(--border-color); border-radius: 8px; font-size: 1rem; margin-bottom: 1rem; background: var(--background-color); color: var(--text-color); -webkit-appearance: none; -moz-appearance: none; appearance: none;">
            <option value="">Valitse syy</option>
            <option value="Ei pääsyä">Ei pääsyä</option>
            <option value="Avaimongelma">Avainongelma</option>
            <option value="Lehtipuute">Lehtipuute</option>
            <option value="Muu">Muu</option>
        </select>
        <div id="customReasonContainer" style="display: none; margin-bottom: 1rem;">
            <label style="display: block; margin-bottom: 0.5rem; color: var(--text-color);">Tarkenna:</label>
            <textarea id="customReasonText" rows="3" style="width: 100%; padding: 0.75rem; border: 1.5px solid var(--border-color); border-radius: 8px; font-size: 1rem; resize: vertical; background: var(--background-color); color: var(--text-color);"></textarea>
        </div>
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 0.75rem 1.5rem; border: 1.5px solid var(--border-color); background: var(--background-color); color: var(--text-color); border-radius: 8px; cursor: pointer; font-size: 1rem;">Peruuta</button>
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
    
    // Show the subscriber list with cascading animation
    showSubscriberListWithAnimation();
    
    // Update UI to reflect in-progress state
    updateRouteButtons(circuitId);
    updateCircuitStatus(circuitId, 'in-progress');
    
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

function completeRoute(circuitId) {
    const now = new Date();
    const key = `route_end_${circuitId}`;
    
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
    updateCircuitStatus(circuitId, 'completed');
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
        clearBtn.onclick = async () => {
            if (await customConfirm('Haluatko varmasti tyhjentää kaikki viestit?')) {
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

async function renderCircuitTracker() {
    const tracker = document.getElementById('circuitTracker');
    tracker.innerHTML = '';
    
    // Use circuitNames instead of allData since we're lazy loading
    const circuits = Object.keys(circuitNames).sort(sortCircuits);
    
    for (const circuitId of circuits) {
        const item = await createCircuitItem(circuitId);
        tracker.appendChild(item);
    }
}

async function createCircuitItem(circuitId) {
    const item = document.createElement('div');
    item.className = 'circuit-item';
    
    const status = getCircuitStatus(circuitId);
    
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
    
    // Add 3-dot menu for reset functionality
    const menuContainer = document.createElement('div');
    menuContainer.className = 'circuit-menu-container';
    
    const menuButton = document.createElement('button');
    menuButton.className = 'circuit-menu-button';
    menuButton.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"></circle>
            <circle cx="12" cy="5" r="1"></circle>
            <circle cx="12" cy="19" r="1"></circle>
        </svg>
    `;
    menuButton.setAttribute('aria-label', 'Valinnat');
    
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'circuit-menu-dropdown';
    menuDropdown.innerHTML = `
        <div class="circuit-menu-item reset-route" data-circuit="${circuitId}">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 4 1 10 7 10"></polyline>
                <polyline points="23 20 23 14 17 14"></polyline>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            Nollaa reitin tila
        </div>
    `;
    
    menuContainer.appendChild(menuButton);
    menuContainer.appendChild(menuDropdown);
    header.appendChild(menuContainer);
    
    // Toggle menu on button click
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other menus
        document.querySelectorAll('.circuit-menu-dropdown.show').forEach(dropdown => {
            if (dropdown !== menuDropdown) {
                dropdown.classList.remove('show');
            }
        });
        menuDropdown.classList.toggle('show');
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target)) {
            menuDropdown.classList.remove('show');
        }
    });
    
    // Reset route handler
    const resetItem = menuDropdown.querySelector('.reset-route');
    resetItem.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (await customConfirm(`Haluatko varmasti nollata piirin ${circuitNames[circuitId]} tilan?`)) {
            resetRouteStatus(circuitId);
            menuDropdown.classList.remove('show');
        }
    });
    
    content.appendChild(header);
    
    const statusText = document.createElement('div');
    statusText.className = 'circuit-status';
    statusText.textContent = getCircuitStatusText(circuitId, status);
    content.appendChild(statusText);
    
    // Add progress bar for in-progress circuits
    if (status === 'in-progress') {
        const progressBar = await createCircuitProgressBar(circuitId);
        if (progressBar) {
            content.appendChild(progressBar);
        }
    }
    
    item.appendChild(content);
    
    return item;
}

async function createCircuitProgressBar(circuitId) {
    // Load circuit data if not already loaded
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
    
    const totalSubscribers = subscribersWithoutOnlySTF.length;
    if (totalSubscribers === 0) return null;
    
    // Count delivered by checking localStorage checkbox state (excluding STF-only)
    const deliveredCount = subscribersWithoutOnlySTF.filter(sub => getCheckboxState(circuitId, sub.address)).length;
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

// Reset route status manually
function resetRouteStatus(circuitId) {
    const startKey = `route_start_${circuitId}`;
    const endKey = `route_end_${circuitId}`;
    
    // Clear route timing data
    localStorage.removeItem(startKey);
    localStorage.removeItem(endKey);
    
    // Clear all checkbox states for this circuit
    const checkboxKeys = Object.keys(localStorage).filter(key => 
        key.startsWith(`checkbox_${circuitId}_`)
    );
    checkboxKeys.forEach(key => localStorage.removeItem(key));
    
    // Re-render the tracker to show updated status
    renderCircuitTracker();
    
    // If this is the current circuit in delivery tab, update the buttons
    if (currentCircuit === circuitId) {
        updateRouteButtons(circuitId);
        // Re-render the subscriber list to reset checkboxes
        loadCircuit(circuitId);
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
