const express = require('express');
const fetch = require('node-fetch');
const { Client } = require('node-ssdp');
const xml2js = require('xml2js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Path to saved devices file
const DEVICES_FILE = path.join(__dirname, 'saved_devices.json');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load saved devices
function loadSavedDevices() {
    try {
        if (fs.existsSync(DEVICES_FILE)) {
            return JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Error loading saved devices:', err.message);
    }
    return [];
}

// Save devices to file
function saveSavedDevices(devices) {
    try {
        fs.writeFileSync(DEVICES_FILE, JSON.stringify(devices, null, 2));
    } catch (err) {
        console.error('Error saving devices:', err.message);
    }
}

// Get saved devices
app.get('/api/saved-devices', (req, res) => {
    const devices = loadSavedDevices();
    res.json({ devices });
});

// Add or update a saved device
app.post('/api/saved-devices', (req, res) => {
    const { ip, name, model } = req.body;
    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    const devices = loadSavedDevices();
    const existingIndex = devices.findIndex(d => d.ip === ip);

    const device = {
        ip,
        name: name || 'Roku Device',
        model: model || 'Unknown',
        lastUsed: new Date().toISOString()
    };

    if (existingIndex >= 0) {
        devices[existingIndex] = device;
    } else {
        devices.push(device);
    }

    saveSavedDevices(devices);
    res.json({ success: true, device });
});

// Update device name
app.put('/api/saved-devices/:ip', (req, res) => {
    const { ip } = req.params;
    const { name } = req.body;

    const devices = loadSavedDevices();
    const device = devices.find(d => d.ip === ip);

    if (!device) {
        return res.status(404).json({ error: 'Device not found' });
    }

    device.name = name;
    device.lastUsed = new Date().toISOString();
    saveSavedDevices(devices);
    res.json({ success: true, device });
});

// Delete a saved device
app.delete('/api/saved-devices/:ip', (req, res) => {
    const { ip } = req.params;
    let devices = loadSavedDevices();
    devices = devices.filter(d => d.ip !== ip);
    saveSavedDevices(devices);
    res.json({ success: true });
});

// Store discovered Roku devices
let discoveredDevices = [];

// SSDP Discovery for Roku devices
app.get('/api/discover', async (req, res) => {
    discoveredDevices = [];
    const client = new Client();

    client.on('response', async (headers, statusCode, rinfo) => {
        if (headers.ST && headers.ST.includes('roku')) {
            const location = headers.LOCATION;
            try {
                const response = await fetch(location);
                const xml = await response.text();
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(xml);

                const device = {
                    ip: rinfo.address,
                    name: result.root?.device?.[0]?.friendlyName?.[0] || 'Roku Device',
                    model: result.root?.device?.[0]?.modelName?.[0] || 'Unknown',
                    serial: result.root?.device?.[0]?.serialNumber?.[0] || 'Unknown'
                };

                // Avoid duplicates
                if (!discoveredDevices.find(d => d.ip === device.ip)) {
                    discoveredDevices.push(device);
                }
            } catch (err) {
                console.error('Error parsing device info:', err.message);
            }
        }
    });

    // Search for Roku devices
    client.search('roku:ecp');

    // Wait 3 seconds for responses
    setTimeout(() => {
        client.stop();
        res.json({ devices: discoveredDevices });
    }, 3000);
});

// Get device info
app.get('/api/device-info', async (req, res) => {
    const { ip } = req.query;
    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        const response = await fetch(`http://${ip}:8060/query/device-info`);
        const xml = await response.text();
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xml);
        res.json(result['device-info'] || result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get device info', message: err.message });
    }
});

// Get installed apps
app.get('/api/apps', async (req, res) => {
    const { ip } = req.query;
    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        const response = await fetch(`http://${ip}:8060/query/apps`);
        const xml = await response.text();
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(xml);

        let apps = result.apps?.app || [];
        if (!Array.isArray(apps)) apps = [apps];

        const appList = apps.map(app => ({
            id: app.$.id,
            name: app._,
            type: app.$.type,
            version: app.$.version
        }));

        res.json({ apps: appList });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get apps', message: err.message });
    }
});

// Get app icon
app.get('/api/app-icon/:appId', async (req, res) => {
    const { ip } = req.query;
    const { appId } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        const response = await fetch(`http://${ip}:8060/query/icon/${appId}`);
        const buffer = await response.buffer();
        res.set('Content-Type', response.headers.get('content-type') || 'image/png');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get app icon', message: err.message });
    }
});

// Send keypress - the main remote control endpoint
app.post('/api/keypress/:key', async (req, res) => {
    const { ip } = req.query;
    let { key } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    // Log the keypress for debugging
    console.log(`Sending keypress: ${key} to ${ip}`);

    try {
        const response = await fetch(`http://${ip}:8060/keypress/${key}`, {
            method: 'POST',
            headers: {
                'Content-Length': '0'
            }
        });

        if (!response.ok) {
            console.error(`Keypress failed with status: ${response.status}`);
        }

        res.json({ success: true, key });
    } catch (err) {
        console.error(`Keypress error: ${err.message}`);
        res.status(500).json({ error: 'Failed to send keypress', message: err.message });
    }
});

// Send keydown (for holding keys)
app.post('/api/keydown/:key', async (req, res) => {
    const { ip } = req.query;
    const { key } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        await fetch(`http://${ip}:8060/keydown/${key}`, {
            method: 'POST',
            headers: { 'Content-Length': '0' }
        });
        res.json({ success: true, key });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send keydown', message: err.message });
    }
});

// Send keyup
app.post('/api/keyup/:key', async (req, res) => {
    const { ip } = req.query;
    const { key } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        await fetch(`http://${ip}:8060/keyup/${key}`, {
            method: 'POST',
            headers: { 'Content-Length': '0' }
        });
        res.json({ success: true, key });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send keyup', message: err.message });
    }
});

// Launch app
app.post('/api/launch/:appId', async (req, res) => {
    const { ip } = req.query;
    const { appId } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        await fetch(`http://${ip}:8060/launch/${appId}`, {
            method: 'POST',
            headers: { 'Content-Length': '0' }
        });
        res.json({ success: true, appId });
    } catch (err) {
        res.status(500).json({ error: 'Failed to launch app', message: err.message });
    }
});

// Search
app.post('/api/search', async (req, res) => {
    const { ip } = req.query;
    const { keyword } = req.body;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        const encodedKeyword = encodeURIComponent(keyword);
        await fetch(`http://${ip}:8060/search/browse?keyword=${encodedKeyword}`, {
            method: 'POST',
            headers: { 'Content-Length': '0' }
        });
        res.json({ success: true, keyword });
    } catch (err) {
        res.status(500).json({ error: 'Failed to search', message: err.message });
    }
});

// Send text input (for keyboard)
app.post('/api/input', async (req, res) => {
    const { ip } = req.query;
    const { text } = req.body;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        // Send each character as a Lit_ keypress
        for (const char of text) {
            const encodedChar = encodeURIComponent(char);
            await fetch(`http://${ip}:8060/keypress/Lit_${encodedChar}`, {
                method: 'POST',
                headers: { 'Content-Length': '0' }
            });
            // Small delay between characters
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        res.json({ success: true, text });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send input', message: err.message });
    }
});

// ========================================
// Samsung TV API Endpoints
// ========================================

// Samsung TV uses WebSocket on port 8001
// Connection URL: ws://{IP}:8001/api/v2/channels/samsung.remote.control

// Samsung keypress - sends command via HTTP request to our WebSocket handler
app.post('/api/samsung/keypress/:key', async (req, res) => {
    const { ip } = req.query;
    const { key } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    console.log(`Samsung keypress: ${key} to ${ip}`);

    try {
        // For Samsung TVs, we need to establish a WebSocket connection
        // This is a simplified implementation - full implementation would need ws library
        const WebSocket = require('ws');
        const token = req.query.token || '';

        const wsUrl = `ws://${ip}:8001/api/v2/channels/samsung.remote.control`;

        const ws = new WebSocket(wsUrl, {
            rejectUnauthorized: false
        });

        ws.on('open', () => {
            const payload = {
                method: 'ms.remote.control',
                params: {
                    Cmd: 'Click',
                    DataOfCmd: key,
                    Option: 'false',
                    TypeOfRemote: 'SendRemoteKey'
                }
            };

            ws.send(JSON.stringify(payload));

            setTimeout(() => {
                ws.close();
                res.json({ success: true, key, platform: 'samsung' });
            }, 100);
        });

        ws.on('error', (err) => {
            console.error('Samsung WebSocket error:', err.message);
            res.status(500).json({
                error: 'Failed to connect to Samsung TV',
                message: err.message,
                hint: 'Make sure your Samsung TV is on and "Remote Access" is enabled in Settings → General → Network'
            });
        });

    } catch (err) {
        res.status(500).json({
            error: 'Failed to send Samsung keypress',
            message: err.message
        });
    }
});

// Samsung device info
app.get('/api/samsung/device-info', async (req, res) => {
    const { ip } = req.query;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    try {
        const response = await fetch(`http://${ip}:8001/api/v2/`);
        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Failed to get Samsung device info', message: err.message });
    }
});

// ========================================
// Google TV / Android TV API Endpoints
// ========================================

// Google TV uses a proprietary protocol on ports 6466/6467
// This requires mDNS discovery and SSL certificate pairing

// Google TV keypress (placeholder - requires androidtv-remote library)
app.post('/api/google/keypress/:key', async (req, res) => {
    const { ip } = req.query;
    const { key } = req.params;

    if (!ip) {
        return res.status(400).json({ error: 'IP address required' });
    }

    console.log(`Google TV keypress: ${key} to ${ip}`);

    // Google TV requires a more complex pairing process
    // This is a placeholder - full implementation would need androidtv-remote package
    res.status(501).json({
        error: 'Google TV support coming soon',
        message: 'Google TV requires SSL certificate pairing which is being implemented.',
        hint: 'For now, use the official Google TV app on your phone'
    });
});

// Google TV device discovery
app.get('/api/google/discover', async (req, res) => {
    // Would use mDNS to discover _androidtvremote._tcp services
    res.status(501).json({
        error: 'Google TV discovery coming soon',
        message: 'mDNS discovery for Android TVs is being implemented.'
    });
});


// Start server - bind to 0.0.0.0 to allow access from other devices on the network
const HOST = '0.0.0.0';

// Get local IP address for display
const os = require('os');
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

app.listen(PORT, HOST, () => {
    const localIP = getLocalIP();
    console.log(`\n🎮 Camila's Remote Server is running!\n`);
    console.log(`📱 Access from your PHONE at: http://${localIP}:${PORT}`);
    console.log(`💻 Access from this PC at: http://localhost:${PORT}\n`);
    console.log('Make sure your phone is on the SAME Wi-Fi network!');
    console.log('You may need to enable "Control by mobile apps" in your Roku settings.');
    console.log('  Settings → System → Advanced system settings → Control by mobile apps → Enabled\n');
});

