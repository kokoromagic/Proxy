const PROXY_URL = "https://kokoromagic.github.io/Proxy/pinggy_tunnel_info.json";
const BYPASS_LIST = ["kokoromagic.github.io"];

/**
 * Fetch proxy information from the external JSON source
 */
async function fetchProxy() {
    const res = await fetch(PROXY_URL);
    return await res.json();
}

/**
 * Configure proxy using a PAC Script
 * This allows per-site rules and a strict Kill Switch
 */
function setProxy(host, port) {
    // PAC Script Logic:
    // 1. If host matches bypass list -> DIRECT (No Proxy)
    // 2. Otherwise -> Use PROXY. 
    // Note: We omit "; DIRECT" at the end to ensure that if the proxy dies, 
    // the connection drops instead of leaking the real IP.
    const pacScript = `
        function FindProxyForURL(url, host) {
            var bypass = ${JSON.stringify(BYPASS_LIST)};
            for (var i = 0; i < bypass.length; i++) {
                if (dnsDomainIs(host, bypass[i])) return "DIRECT";
            }
            return "PROXY ${host}:${port}";
        }
    `;

    return new Promise((resolve) => {
        chrome.proxy.settings.set({
            value: {
                mode: "pac_script",
                pacScript: {
                    data: pacScript
                }
            },
            scope: "regular"
        }, resolve);
    });
}

/**
 * Reset proxy settings to default (Direct connection)
 */
function clearProxy() {
    return new Promise((resolve) => {
        chrome.proxy.settings.clear({}, resolve);
    });
}

/**
 * Get external IP to verify connectivity and proxy status
 */
async function getIP() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        const data = await res.json();
        return data.ip;
    } catch (e) {
        return null; // Return null if connection fails (proxy dead)
    }
}

/**
 * Use to check if proxy is ok
 */
async function checkProxyAlive(timeout = 5000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(
            "http://connectivitycheck.gstatic.com/generate_204",
            {
                method: "GET",
                cache: "no-store",
                signal: controller.signal
            }
        );

        clearTimeout(id);
        return res.status === 204;

    } catch {
        return false;
    }
}

/**
 * Core connection logic
 */
async function connect() {
    try {
        const proxy = await fetchProxy();
        await setProxy(proxy.host, proxy.port);

        // Small delay to let the browser apply proxy settings before checking IP
        setTimeout(async () => {
            const ip = await getIP();
            const ok = await checkProxyAlive();

            if (!ok) {
                console.error("Proxy unreachable on connect. Aborting.");
                await disconnect();
                return;
            }

            await chrome.storage.local.set({
                connected: true,
                proxy: proxy,
                ip: ip,
                extensionControlled: true
            });

            scheduleRefresh(proxy.start_time);
        }, 2000);

    } catch (e) {
        console.error("Connection flow error:", e);
        await disconnect();
    }
}

/**
 * Core disconnection logic
 */
async function disconnect() {
    await clearProxy();
    await chrome.storage.local.set({
        connected: false,
        proxy: null,
        ip: "Disconnected",
        extensionControlled: false
    });
    chrome.alarms.clear("refreshProxy");
}

/**
 * Handle automatic reconnection
 */
async function reconnect() {
    const data = await chrome.storage.local.get(["connected", "extensionControlled"]);
    if (!data.connected || !data.extensionControlled) return;
    
    // Clear first to prevent potential overlaps during handshake
    await clearProxy(); 
    await connect();
}

/**
 * Schedule proxy refresh based on start_time (approx. 58 mins)
 */
function scheduleRefresh(startTime) {
    const now = Math.floor(Date.now() / 1000);
    const delay = Math.max((startTime + 58 * 60 - now), 10);
    chrome.alarms.create("refreshProxy", { delayInMinutes: delay / 60 });
}

// --- Event Listeners ---

// Handle alarms for refreshing the proxy
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "refreshProxy") reconnect();
});

// Handle messages from Popup or Content Scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "connect") connect();
    if (msg.action === "disconnect") disconnect();
});

// Re-establish connection on browser startup
chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.local.get(["connected", "extensionControlled"]);
    if (data.connected && data.extensionControlled) {
        await connect();
    }
});

// Detect if another extension or user manual change overrides the proxy
chrome.proxy.settings.onChange.addListener(async (details) => {
    if (details.levelOfControl !== "controlled_by_this_extension") {
        await chrome.storage.local.set({ connected: false, extensionControlled: false });
    }
});

/**
 * Watchdog: Health check every 2 minutes
 * If the IP cannot be fetched, it assumes the proxy is dead and kills the connection.
 */
setInterval(async () => {
    const data = await chrome.storage.local.get(["connected"]);
    if (!data.connected) return;

    const ok = await checkProxyAlive();
    if (!ok) {
        console.warn("Proxy heartbeat failed. Triggering Kill Switch.");
        await disconnect(); 
    }
}, 2 * 60 * 1000);
