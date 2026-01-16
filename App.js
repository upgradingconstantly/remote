import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Alert,
    Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

// TV Remote App - Works locally on user's device for true discovery!
export default function App() {
    const [platform, setPlatform] = useState(null);
    const [tvIP, setTvIP] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [devices, setDevices] = useState([]);
    const [discovering, setDiscovering] = useState(false);

    // Platform selection screen
    if (!platform) {
        return (
            <View style={styles.container}>
                <StatusBar style="dark" />
                <Text style={styles.logo}>❤️</Text>
                <Text style={styles.title}>Camila's Remote</Text>
                <Text style={styles.subtitle}>Choose Your TV</Text>

                <TouchableOpacity style={[styles.platformCard, styles.roku]} onPress={() => setPlatform('roku')}>
                    <Text style={styles.platformIcon}>📺</Text>
                    <View>
                        <Text style={styles.platformName}>Roku TV</Text>
                        <Text style={styles.platformDesc}>Roku devices & Roku TVs</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.platformCard, styles.samsung]} onPress={() => setPlatform('samsung')}>
                    <Text style={styles.platformIcon}>📱</Text>
                    <View>
                        <Text style={styles.platformName}>Samsung TV</Text>
                        <Text style={styles.platformDesc}>Samsung Smart TVs (2016+)</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.platformCard, styles.google]} onPress={() => setPlatform('google')}>
                    <Text style={styles.platformIcon}>🎬</Text>
                    <View>
                        <Text style={styles.platformName}>Google TV</Text>
                        <Text style={styles.platformDesc}>Android TV, Chromecast</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    // Send keypress to TV
    const sendKey = async (key) => {
        if (!tvIP) {
            Alert.alert('Not Connected', 'Please connect to a TV first');
            return;
        }

        try {
            if (platform === 'roku') {
                await fetch(`http://${tvIP}:8060/keypress/${key}`, {
                    method: 'POST',
                    headers: { 'Content-Length': '0' }
                });
            } else if (platform === 'samsung') {
                // Samsung WebSocket (simplified)
                Alert.alert('Samsung', `Would send ${key} to Samsung TV`);
            }
        } catch (error) {
            console.error('Key error:', error);
        }
    };

    // Discover Roku devices on local network
    const discoverDevices = async () => {
        setDiscovering(true);
        setDevices([]);

        // For Roku, we try common IPs (real app would use SSDP)
        const foundDevices = [];
        const baseIP = tvIP.split('.').slice(0, 3).join('.') || '192.168.0';

        // Quick scan common IPs
        for (let i = 1; i <= 10; i++) {
            const ip = `${baseIP}.${i}`;
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 1000);

                const response = await fetch(`http://${ip}:8060/query/device-info`, {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (response.ok) {
                    foundDevices.push({ ip, name: `Roku at ${ip}` });
                }
            } catch (e) {
                // Device not found at this IP
            }
        }

        setDevices(foundDevices);
        setDiscovering(false);

        if (foundDevices.length === 0) {
            Alert.alert('No Devices', 'No Roku devices found. Enter IP manually.');
        }
    };

    // Remote control screen
    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setPlatform(null)} style={styles.backBtn}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {platform === 'roku' ? 'Roku' : platform === 'samsung' ? 'Samsung' : 'Google'} Remote
                </Text>
            </View>

            {/* Connection */}
            {!isConnected ? (
                <View style={styles.connectionCard}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter TV IP (e.g. 192.168.1.100)"
                        value={tvIP}
                        onChangeText={setTvIP}
                        keyboardType="numeric"
                    />
                    <TouchableOpacity
                        style={styles.connectBtn}
                        onPress={() => setIsConnected(true)}
                    >
                        <Text style={styles.connectBtnText}>Connect</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.discoverBtn}
                        onPress={discoverDevices}
                        disabled={discovering}
                    >
                        <Text style={styles.discoverBtnText}>
                            {discovering ? 'Searching...' : 'Discover Devices'}
                        </Text>
                    </TouchableOpacity>

                    {devices.map((device, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.deviceItem}
                            onPress={() => { setTvIP(device.ip); setIsConnected(true); }}
                        >
                            <Text style={styles.deviceName}>{device.name}</Text>
                            <Text style={styles.deviceIP}>{device.ip}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : (
                <View style={styles.remote}>
                    {/* D-Pad */}
                    <View style={styles.dpadContainer}>
                        <TouchableOpacity style={[styles.dpadBtn, styles.dpadUp]} onPress={() => sendKey('Up')}>
                            <Text style={styles.dpadText}>▲</Text>
                        </TouchableOpacity>
                        <View style={styles.dpadRow}>
                            <TouchableOpacity style={[styles.dpadBtn, styles.dpadLeft]} onPress={() => sendKey('Left')}>
                                <Text style={styles.dpadText}>◀</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dpadBtn, styles.dpadOk]} onPress={() => sendKey('Select')}>
                                <Text style={styles.okText}>OK</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.dpadBtn, styles.dpadRight]} onPress={() => sendKey('Right')}>
                                <Text style={styles.dpadText}>▶</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={[styles.dpadBtn, styles.dpadDown]} onPress={() => sendKey('Down')}>
                            <Text style={styles.dpadText}>▼</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Nav buttons */}
                    <View style={styles.navRow}>
                        <TouchableOpacity style={styles.navBtn} onPress={() => sendKey('Back')}>
                            <Text style={styles.navText}>← Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.navBtn} onPress={() => sendKey('Home')}>
                            <Text style={styles.navText}>🏠 Home</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Volume */}
                    <View style={styles.volumeRow}>
                        <TouchableOpacity style={styles.volumeBtn} onPress={() => sendKey('VolumeDown')}>
                            <Text style={styles.volumeText}>🔉</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.muteBtn} onPress={() => sendKey('VolumeMute')}>
                            <Text style={styles.volumeText}>🔇</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.volumeBtn} onPress={() => sendKey('VolumeUp')}>
                            <Text style={styles.volumeText}>🔊</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Disconnect */}
                    <TouchableOpacity style={styles.disconnectBtn} onPress={() => setIsConnected(false)}>
                        <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8fa',
    },
    scrollContent: {
        padding: 20,
        paddingTop: 60,
    },
    logo: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: 10,
    },
    title: {
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        fontSize: 28,
        fontWeight: '700',
        color: '#d4af37',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#777',
        textAlign: 'center',
        marginBottom: 30,
    },
    platformCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    roku: { borderLeftColor: '#662d91' },
    samsung: { borderLeftColor: '#1428a0' },
    google: { borderLeftColor: '#4285f4' },
    platformIcon: {
        fontSize: 32,
        marginRight: 16,
    },
    platformName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1f1f1f',
    },
    platformDesc: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtn: {
        width: 40,
        height: 40,
        backgroundColor: '#e8e8e8',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 20,
        color: '#1f1f1f',
    },
    headerTitle: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        marginRight: 40,
    },
    connectionCard: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    input: {
        backgroundColor: '#f5f5f5',
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        marginBottom: 16,
    },
    connectBtn: {
        backgroundColor: '#dc2626',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    connectBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    discoverBtn: {
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#d8d8d8',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 12,
    },
    discoverBtnText: {
        color: '#1f1f1f',
        fontSize: 16,
    },
    deviceItem: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '500',
    },
    deviceIP: {
        fontSize: 13,
        color: '#777',
        marginTop: 2,
    },
    remote: {
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    dpadContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    dpadRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dpadBtn: {
        width: 70,
        height: 70,
        backgroundColor: '#dc2626',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        margin: 4,
    },
    dpadOk: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#b91c1c',
    },
    dpadUp: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    dpadDown: { borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
    dpadLeft: { borderTopLeftRadius: 24, borderBottomLeftRadius: 24 },
    dpadRight: { borderTopRightRadius: 24, borderBottomRightRadius: 24 },
    dpadText: {
        color: 'white',
        fontSize: 24,
    },
    okText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    navRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    navBtn: {
        backgroundColor: '#6b7280',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    navText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '500',
    },
    volumeRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 24,
    },
    volumeBtn: {
        backgroundColor: '#dc2626',
        width: 70,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    muteBtn: {
        backgroundColor: '#d8d8d8',
        width: 60,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    volumeText: {
        fontSize: 24,
    },
    disconnectBtn: {
        borderWidth: 1,
        borderColor: '#777',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    disconnectText: {
        color: '#777',
        fontSize: 14,
    },
});
