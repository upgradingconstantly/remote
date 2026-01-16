/* ========================================
   Camila's Remote - JavaScript
   ======================================== */

// State
let currentPlatform = localStorage.getItem('tvPlatform') || null;
let tvIP = null;
let tvName = null;
let isConnected = false;
let recognition = null;
let isListening = false;
let editingDeviceIP = null;
let macroRunning = false;

// Backwards compatibility
let rokuIP = null;
let rokuName = null;

// App name mappings (rename these apps)
const appNameMappings = {
    'Live TV': 'YouTube',
    'Roku Media Player': 'Spotify',
    'Sling TV': 'Playlet'
};

// Platform-specific key mappings
const keyMappings = {
    roku: {
        Up: 'Up', Down: 'Down', Left: 'Left', Right: 'Right',
        Select: 'Select', Back: 'Back', Home: 'Home',
        Play: 'Play', Rev: 'Rev', Fwd: 'Fwd',
        VolumeUp: 'VolumeUp', VolumeDown: 'VolumeDown', VolumeMute: 'VolumeMute',
        Power: 'Power', Info: 'Info', Search: 'Search', InstantReplay: 'InstantReplay'
    },
    samsung: {
        Up: 'KEY_UP', Down: 'KEY_DOWN', Left: 'KEY_LEFT', Right: 'KEY_RIGHT',
        Select: 'KEY_ENTER', Back: 'KEY_RETURN', Home: 'KEY_HOME',
        Play: 'KEY_PLAY', Rev: 'KEY_REWIND', Fwd: 'KEY_FF',
        VolumeUp: 'KEY_VOLUP', VolumeDown: 'KEY_VOLDOWN', VolumeMute: 'KEY_MUTE',
        Power: 'KEY_POWER', Info: 'KEY_INFO', Search: 'KEY_SEARCH', InstantReplay: 'KEY_REWIND'
    },
    google: {
        Up: 'DPAD_UP', Down: 'DPAD_DOWN', Left: 'DPAD_LEFT', Right: 'DPAD_RIGHT',
        Select: 'DPAD_CENTER', Back: 'BACK', Home: 'HOME',
        Play: 'MEDIA_PLAY_PAUSE', Rev: 'MEDIA_REWIND', Fwd: 'MEDIA_FAST_FORWARD',
        VolumeUp: 'VOLUME_UP', VolumeDown: 'VOLUME_DOWN', VolumeMute: 'VOLUME_MUTE',
        Power: 'POWER', Info: 'INFO', Search: 'SEARCH', InstantReplay: 'MEDIA_PREVIOUS'
    }
};

// DOM Elements
const platformSelection = document.getElementById('platformSelection');
const connectionPanel = document.getElementById('connectionPanel');
const connectionTitle = document.getElementById('connectionTitle');
const remoteContainer = document.getElementById('remoteContainer');
const connectionStatus = document.getElementById('connectionStatus');
const ipInput = document.getElementById('ipInput');
const connectBtn = document.getElementById('connectBtn');
const discoverBtn = document.getElementById('discoverBtn');
const discoveredDevices = document.getElementById('discoveredDevices');
const savedDevicesSection = document.getElementById('savedDevicesSection');
const savedDevicesList = document.getElementById('savedDevicesList');
const deviceInfo = document.getElementById('deviceInfo');
const disconnectBtn = document.getElementById('disconnectBtn');
const voiceBtn = document.getElementById('voiceBtn');
const voiceStatus = document.getElementById('voiceStatus');
const keyboardToggle = document.getElementById('keyboardToggle');
const keyboardPanel = document.getElementById('keyboardPanel');
const textInput = document.getElementById('textInput');
const sendTextBtn = document.getElementById('sendTextBtn');
const appsGrid = document.getElementById('appsGrid');
const refreshAppsBtn = document.getElementById('refreshAppsBtn');
const editModal = document.getElementById('editModal');
const editNameInput = document.getElementById('editNameInput');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const saveEditBtn = document.getElementById('saveEditBtn');

// Macro elements
const macroPlaylet = document.getElementById('macroPlaylet');
const macroSpotify = document.getElementById('macroSpotify');
const macroYouTube = document.getElementById('macroYouTube');

// ========================================
// Platform Selection
// ========================================

function selectPlatform(platform) {
    currentPlatform = platform;
    localStorage.setItem('tvPlatform', platform);

    // Update UI
    platformSelection.style.display = 'none';
    connectionPanel.style.display = 'block';

    // Update connection title based on platform
    const platformNames = {
        roku: 'Roku',
        samsung: 'Samsung TV',
        google: 'Google TV'
    };
    connectionTitle.textContent = `Connect to ${platformNames[platform]}`;

    // Update IP placeholder
    ipInput.placeholder = `Enter ${platformNames[platform]} IP (e.g., 192.168.1.100)`;

    loadSavedDevices();
    showNotification(`Selected ${platformNames[platform]}`, 'success');
}

function changePlatform() {
    currentPlatform = null;
    localStorage.removeItem('tvPlatform');
    platformSelection.style.display = 'flex';
    connectionPanel.style.display = 'none';
    remoteContainer.style.display = 'none';
}

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if platform already selected
    if (currentPlatform) {
        selectPlatform(currentPlatform);
    }

    initEventListeners();
    initVoiceRecognition();
    initMacros();
    addPopEffects();
});

function initEventListeners() {
    // Connection
    connectBtn.addEventListener('click', connect);
    discoverBtn.addEventListener('click', discoverDevices);
    ipInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') connect();
    });

    // Disconnect
    disconnectBtn.addEventListener('click', disconnect);

    // Remote buttons
    document.querySelectorAll('[data-key]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const key = btn.dataset.key;
            console.log('Button clicked:', key);
            sendKeypress(key);
        });

        btn.addEventListener('mousedown', () => btn.classList.add('pressing'));
        btn.addEventListener('mouseup', () => btn.classList.remove('pressing'));
        btn.addEventListener('mouseleave', () => btn.classList.remove('pressing'));
    });

    // Voice search
    voiceBtn.addEventListener('click', toggleVoiceSearch);

    // Keyboard
    keyboardToggle.addEventListener('click', toggleKeyboard);
    sendTextBtn.addEventListener('click', sendText);
    textInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendText();
    });

    // Keyboard shortcuts
    document.querySelectorAll('.btn-shortcut').forEach(btn => {
        btn.addEventListener('click', () => sendKeypress(btn.dataset.key));
    });

    // Refresh apps
    refreshAppsBtn.addEventListener('click', loadApps);

    // Edit modal
    cancelEditBtn.addEventListener('click', closeEditModal);
    saveEditBtn.addEventListener('click', saveDeviceName);
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });

    // Keyboard shortcuts for remote control
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ========================================
// Pop Effect for Apps and Macros
// ========================================

function addPopEffects() {
    // Add bubbly pop effect to apps and macros
    document.querySelectorAll('.app-item, .macro-item').forEach(item => {
        item.addEventListener('mousedown', () => {
            item.classList.add('popped');
        });

        item.addEventListener('mouseup', () => {
            setTimeout(() => item.classList.remove('popped'), 150);
        });

        item.addEventListener('mouseleave', () => {
            item.classList.remove('popped');
        });
    });
}

// ========================================
// Macros
// ========================================

function initMacros() {
    // Macro 1: Playlet - Opens Playlet, waits 7s, Left, wait 2s, Up, wait 3s, Right
    macroPlaylet.addEventListener('click', () => runMacroPlaylet());

    // Macro 2: Spotify - Opens Spotify, clicks OK
    macroSpotify.addEventListener('click', () => runMacroSpotify());

    // Macro 3: YouTube - Opens YouTube, waits 7s, clicks OK
    macroYouTube.addEventListener('click', () => runMacroYouTube());
}

async function runMacroPlaylet() {
    if (macroRunning || !isConnected) {
        if (!isConnected) showNotification('Connect to Roku first', 'error');
        return;
    }

    macroRunning = true;
    macroPlaylet.classList.add('running');
    showNotification('Running Playlet macro...', 'success');

    try {
        // Launch Playlet (using app ID lookup or search)
        await launchAppByName('Playlet');

        // Wait 7 seconds
        await sleep(7000);

        // Go Left
        await sendKeypress('Left');

        // Wait 2 seconds
        await sleep(2000);

        // Go Up
        await sendKeypress('Up');

        // Wait 3 seconds
        await sleep(3000);

        // Go Right
        await sendKeypress('Right');

        showNotification('Playlet macro complete!', 'success');
    } catch (error) {
        console.error('Macro error:', error);
        showNotification('Macro failed', 'error');
    }

    macroRunning = false;
    macroPlaylet.classList.remove('running');
}

async function runMacroSpotify() {
    if (macroRunning || !isConnected) {
        if (!isConnected) showNotification('Connect to Roku first', 'error');
        return;
    }

    macroRunning = true;
    macroSpotify.classList.add('running');
    showNotification('Running Spotify macro...', 'success');

    try {
        // Launch Spotify
        await launchAppByName('Spotify');

        // Wait a moment for app to load
        await sleep(3000);

        // Click OK
        await sendKeypress('Select');

        showNotification('Spotify macro complete!', 'success');
    } catch (error) {
        console.error('Macro error:', error);
        showNotification('Macro failed', 'error');
    }

    macroRunning = false;
    macroSpotify.classList.remove('running');
}

async function runMacroYouTube() {
    if (macroRunning || !isConnected) {
        if (!isConnected) showNotification('Connect to Roku first', 'error');
        return;
    }

    macroRunning = true;
    macroYouTube.classList.add('running');
    showNotification('Running YouTube macro...', 'success');

    try {
        // Launch YouTube
        await launchAppByName('YouTube');

        // Wait 10 seconds for app to load
        await sleep(10000);

        // Click OK (first time)
        await sendKeypress('Select');

        // Wait 2 seconds
        await sleep(2000);

        // Click OK again
        await sendKeypress('Select');

        showNotification('YouTube macro complete!', 'success');
    } catch (error) {
        console.error('Macro error:', error);
        showNotification('Macro failed', 'error');
    }

    macroRunning = false;
    macroYouTube.classList.remove('running');
}

async function launchAppByName(appName) {
    // Get app list and find the app ID
    const response = await fetch(`/api/apps?ip=${rokuIP}`);
    const data = await response.json();

    if (data.apps) {
        const app = data.apps.find(a =>
            a.name.toLowerCase().includes(appName.toLowerCase())
        );

        if (app) {
            await fetch(`/api/launch/${app.id}?ip=${rokuIP}`, { method: 'POST' });
            return;
        }
    }

    throw new Error(`App "${appName}" not found`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// Saved Devices
// ========================================

async function loadSavedDevices() {
    try {
        const response = await fetch('/api/saved-devices');
        const data = await response.json();

        if (data.devices && data.devices.length > 0) {
            renderSavedDevices(data.devices);
            savedDevicesSection.style.display = 'block';
        } else {
            savedDevicesSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load saved devices:', error);
    }
}

function renderSavedDevices(devices) {
    savedDevicesList.innerHTML = devices.map(device => `
        <div class="saved-device-item">
            <div class="saved-device-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                    <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9V8zm4 0h2v8h-2V8z"/>
                </svg>
            </div>
            <div class="saved-device-info" onclick="selectSavedDevice('${device.ip}')">
                <h4>${device.name}</h4>
                <p>${device.ip}</p>
            </div>
            <div class="saved-device-actions">
                <button class="btn-icon" onclick="event.stopPropagation(); openEditModal('${device.ip}', '${device.name}')" title="Edit name">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                    </svg>
                </button>
                <button class="btn-icon delete" onclick="event.stopPropagation(); deleteSavedDevice('${device.ip}')" title="Remove">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
}

function selectSavedDevice(ip) {
    ipInput.value = ip;
    connect();
}

async function saveDeviceToFile(ip, name, model) {
    try {
        await fetch('/api/saved-devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, name, model })
        });
        loadSavedDevices();
    } catch (error) {
        console.error('Failed to save device:', error);
    }
}

async function deleteSavedDevice(ip) {
    if (!confirm('Remove this TV from saved devices?')) return;

    try {
        await fetch(`/api/saved-devices/${ip}`, { method: 'DELETE' });
        loadSavedDevices();
        showNotification('Device removed', 'success');
    } catch (error) {
        console.error('Failed to delete device:', error);
    }
}

function openEditModal(ip, currentName) {
    editingDeviceIP = ip;
    editNameInput.value = currentName;
    editModal.style.display = 'flex';
    editNameInput.focus();
}

function closeEditModal() {
    editModal.style.display = 'none';
    editingDeviceIP = null;
}

async function saveDeviceName() {
    const newName = editNameInput.value.trim();
    if (!newName) return;

    try {
        await fetch(`/api/saved-devices/${editingDeviceIP}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
        closeEditModal();
        loadSavedDevices();
        showNotification('Name updated', 'success');
    } catch (error) {
        console.error('Failed to update name:', error);
    }
}

// ========================================
// Connection
// ========================================

async function connect() {
    const ip = ipInput.value.trim();
    if (!ip) {
        showNotification('Please enter a valid IP address', 'error');
        return;
    }

    updateConnectionStatus('connecting');

    try {
        const response = await fetch(`/api/device-info?ip=${ip}`);
        if (!response.ok) throw new Error('Failed to connect');

        const data = await response.json();

        rokuIP = ip;
        rokuName = data['friendly-device-name'] || data['model-name'] || 'Roku Device';
        isConnected = true;

        updateConnectionStatus('connected');
        showRemote(data);
        loadApps();

        // Save device to file
        saveDeviceToFile(ip, rokuName, data['model-name'] || 'Unknown');

        showNotification(`Connected to ${rokuName}`, 'success');
    } catch (error) {
        console.error('Connection error:', error);
        updateConnectionStatus('disconnected');
        showNotification('Failed to connect. Check IP and try again.', 'error');
    }
}

function disconnect() {
    rokuIP = null;
    rokuName = null;
    isConnected = false;

    updateConnectionStatus('disconnected');
    connectionPanel.style.display = 'block';
    remoteContainer.style.display = 'none';

    loadSavedDevices();
    showNotification('Disconnected', 'success');
}

async function discoverDevices() {
    discoverBtn.disabled = true;
    discoverBtn.innerHTML = `
        <svg class="spin" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        Searching...
    `;

    // Check if we're on a hosted site (not localhost)
    const isHosted = !window.location.hostname.includes('localhost') &&
        !window.location.hostname.includes('127.0.0.1') &&
        !window.location.hostname.match(/^192\.168\./);

    try {
        const response = await fetch('/api/discover');
        const data = await response.json();

        if (data.devices && data.devices.length > 0) {
            renderDiscoveredDevices(data.devices);
            showNotification(`Found ${data.devices.length} device(s)`, 'success');
        } else {
            // Show helpful message based on environment
            if (isHosted) {
                discoveredDevices.innerHTML = `
                    <div style="color: var(--text-muted); text-align: center; padding: 16px; font-size: 0.9rem;">
                        <p style="margin-bottom: 12px;"><strong>Discovery only works locally</strong></p>
                        <p style="margin-bottom: 8px;">To discover TVs, run the server on your home network:</p>
                        <code style="background: var(--bg-secondary); padding: 8px 12px; border-radius: 8px; display: block; margin: 8px 0;">npm start</code>
                        <p style="margin-top: 12px;">Or enter your TV's IP address manually above.<br>
                        <small>(Find it in TV Settings → Network → About)</small></p>
                    </div>
                `;
            } else {
                discoveredDevices.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 16px;">No devices found. Make sure your TV is on and connected to the same Wi-Fi.</p>';
            }
        }
    } catch (error) {
        console.error('Discovery error:', error);
        if (isHosted) {
            discoveredDevices.innerHTML = `
                <div style="color: var(--text-muted); text-align: center; padding: 16px; font-size: 0.9rem;">
                    <p><strong>Enter your TV's IP address manually</strong></p>
                    <p style="margin-top: 8px;">(Find it in TV Settings → Network)</p>
                </div>
            `;
        } else {
            showNotification('Discovery failed. Enter IP manually.', 'error');
        }
    }

    discoverBtn.disabled = false;
    discoverBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
        </svg>
        Discover Devices
    `;
}

function renderDiscoveredDevices(devices) {
    discoveredDevices.innerHTML = devices.map(device => `
        <div class="device-item" onclick="selectDevice('${device.ip}')">
            <div class="device-item-info">
                <h4>${device.name}</h4>
                <p>${device.model} • ${device.ip}</p>
            </div>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="var(--text-muted)">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
        </div>
    `).join('');
}

function selectDevice(ip) {
    ipInput.value = ip;
    connect();
}

function updateConnectionStatus(status) {
    const dot = connectionStatus.querySelector('.status-dot');
    const text = connectionStatus.querySelector('.status-text');

    dot.className = 'status-dot ' + status;

    switch (status) {
        case 'connected':
            text.textContent = 'Connected';
            break;
        case 'connecting':
            text.textContent = 'Connecting...';
            break;
        default:
            text.textContent = 'Disconnected';
    }
}

function showRemote(data) {
    connectionPanel.style.display = 'none';
    remoteContainer.style.display = 'block';

    const deviceInfoText = deviceInfo.querySelector('.device-info-text');
    deviceInfoText.innerHTML = `
        <h3>${data['friendly-device-name'] || data['model-name'] || 'Roku Device'}</h3>
        <p>${data['model-name'] || ''} • ${rokuIP}</p>
    `;

    // Re-add pop effects for dynamically loaded content
    setTimeout(addPopEffects, 500);
}

// ========================================
// Remote Control
// ========================================

async function sendKeypress(key) {
    if (!isConnected || !rokuIP) {
        showNotification('Not connected to Roku', 'error');
        return;
    }

    console.log(`Sending keypress: ${key} to ${rokuIP}`);

    try {
        const response = await fetch(`/api/keypress/${key}?ip=${rokuIP}`, { method: 'POST' });
        const data = await response.json();

        if (!data.success) {
            console.error('Keypress failed:', data);
        }
    } catch (error) {
        console.error('Keypress error:', error);
        showNotification('Failed to send command', 'error');
    }
}

function handleKeyboardShortcuts(e) {
    if (!isConnected) return;
    if (document.activeElement === textInput || document.activeElement === ipInput || document.activeElement === editNameInput) return;

    const keyMap = {
        'ArrowUp': 'Up',
        'ArrowDown': 'Down',
        'ArrowLeft': 'Left',
        'ArrowRight': 'Right',
        'Enter': 'Select',
        'Backspace': 'Back',
        'Escape': 'Home',
        ' ': 'Play',
        'p': 'Play',
        'm': 'VolumeMute',
        '+': 'VolumeUp',
        '=': 'VolumeUp',
        '-': 'VolumeDown',
        'r': 'InstantReplay',
        's': 'Search',
        'i': 'Info'
    };

    if (keyMap[e.key]) {
        e.preventDefault();
        sendKeypress(keyMap[e.key]);
    }
}

// ========================================
// Voice Search
// ========================================

function initVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        voiceBtn.style.display = 'none';
        voiceStatus.textContent = 'Voice search not supported';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        voiceStatus.textContent = 'Listening...';
    };

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(result => result[0].transcript)
            .join('');

        voiceStatus.textContent = `"${transcript}"`;

        if (event.results[0].isFinal) {
            performVoiceSearch(transcript);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopVoiceSearch();

        if (event.error === 'not-allowed') {
            voiceStatus.textContent = 'Microphone access denied';
        } else {
            voiceStatus.textContent = 'Voice error. Try again.';
        }
    };

    recognition.onend = () => {
        stopVoiceSearch();
    };
}

function toggleVoiceSearch() {
    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }
}

function stopVoiceSearch() {
    isListening = false;
    voiceBtn.classList.remove('listening');
    setTimeout(() => {
        if (!isListening) {
            voiceStatus.textContent = 'Click to speak';
        }
    }, 3000);
}

async function performVoiceSearch(query) {
    if (!isConnected || !rokuIP) {
        showNotification('Not connected to Roku', 'error');
        return;
    }

    voiceStatus.textContent = `Searching: "${query}"`;

    try {
        await fetch(`/api/search?ip=${rokuIP}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: query })
        });

        showNotification(`Searching for "${query}"`, 'success');
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Search failed', 'error');
    }
}

// ========================================
// Keyboard Input
// ========================================

function toggleKeyboard() {
    const isVisible = keyboardPanel.style.display !== 'none';
    keyboardPanel.style.display = isVisible ? 'none' : 'block';
    keyboardToggle.innerHTML = isVisible ? `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
        </svg>
        Open Keyboard
    ` : `
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
        Close Keyboard
    `;

    if (!isVisible) {
        textInput.focus();
    }
}

async function sendText() {
    const text = textInput.value;
    if (!text) return;

    if (!isConnected || !rokuIP) {
        showNotification('Not connected to Roku', 'error');
        return;
    }

    try {
        await fetch(`/api/input?ip=${rokuIP}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        textInput.value = '';
        showNotification('Text sent', 'success');
    } catch (error) {
        console.error('Input error:', error);
        showNotification('Failed to send text', 'error');
    }
}

// ========================================
// Apps
// ========================================

async function loadApps() {
    if (!isConnected || !rokuIP) return;

    appsGrid.innerHTML = '<div class="apps-loading">Loading apps...</div>';

    try {
        const response = await fetch(`/api/apps?ip=${rokuIP}`);
        const data = await response.json();

        if (data.apps && data.apps.length > 0) {
            // Apply name mappings
            const mappedApps = data.apps.map(app => ({
                ...app,
                displayName: appNameMappings[app.name] || app.name
            }));
            renderApps(mappedApps);
        } else {
            appsGrid.innerHTML = '<div class="apps-loading">No apps found</div>';
        }
    } catch (error) {
        console.error('Apps error:', error);
        appsGrid.innerHTML = '<div class="apps-loading">Failed to load apps</div>';
    }
}

function renderApps(apps) {
    // Limit to 9 apps for clean 3x3 grid on mobile (no overflow/invisible apps)
    const maxApps = window.innerWidth <= 480 ? 9 : 12;

    appsGrid.innerHTML = apps.slice(0, maxApps).map(app => `
        <div class="app-item" onclick="launchApp('${app.id}')" title="${app.displayName}">
            <img class="app-icon" src="/api/app-icon/${app.id}?ip=${rokuIP}" alt="${app.displayName}" onerror="this.style.display='none'">
            <span class="app-name">${app.displayName}</span>
        </div>
    `).join('');

    // Re-add pop effects after rendering
    addPopEffects();
}

async function launchApp(appId) {
    if (!isConnected || !rokuIP) return;

    try {
        await fetch(`/api/launch/${appId}?ip=${rokuIP}`, { method: 'POST' });
        showNotification('Launching app...', 'success');
    } catch (error) {
        console.error('Launch error:', error);
        showNotification('Failed to launch app', 'error');
    }
}

// ========================================
// Notifications
// ========================================

function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: ${type === 'error' ? '#dc2626' : type === 'success' ? '#22c55e' : '#6b7280'};
        color: white;
        border-radius: 18px;
        font-size: 0.9rem;
        z-index: 1000;
        animation: slideUp 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes slideDown {
        from { opacity: 1; transform: translateX(-50%) translateY(0); }
        to { opacity: 0; transform: translateX(-50%) translateY(20px); }
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spin { animation: spin 1s linear infinite; }
    .btn-remote.pressing {
        transform: scale(0.95) !important;
        opacity: 0.8;
    }
`;
document.head.appendChild(style);
