const PROXY_URL = "https://kokoromagic.github.io/Proxy/pinggy_tunnel_info.json";

// fetch proxy info
async function fetchProxy() {
    const res = await fetch(PROXY_URL);
    return await res.json();
}

// set proxy
function setProxy(host, port) {
    return new Promise((resolve) => {
        chrome.proxy.settings.set({
            value: {
                mode: "fixed_servers",
                rules: {
                    singleProxy: {
                        scheme: "http",
                        host: host,
                        port: port
                    }
                }
            },
            scope: "regular"
        }, resolve);
    });
}

// clear proxy
function clearProxy() {
    return new Promise((resolve) => {
        chrome.proxy.settings.clear({}, resolve);
    });
}

// get external IP
async function getIP() {
    try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        return data.ip;
    } catch {
        return "Unknown";
    }
}

// connect
async function connect() {
    try {
        const proxy = await fetchProxy();

        await setProxy(proxy.host, proxy.port);

        const ip = await getIP();

        await chrome.storage.local.set({
            connected: true,
            proxy: proxy,
            ip: ip,
            extensionControlled: true
        });

        scheduleRefresh(proxy.start_time);

    } catch (e) {
        console.error("Connect error:", e);
    }
}

// disconnect
async function disconnect() {
    await clearProxy();

    await chrome.storage.local.set({
        connected: false,
        proxy: null,
        extensionControlled: false
    });

    chrome.alarms.clear("refreshProxy");
}

// schedule refresh (~58 phút)
function scheduleRefresh(startTime) {
    const now = Math.floor(Date.now() / 1000);
    const delay = Math.max((startTime + 58 * 60 - now), 10);

    chrome.alarms.create("refreshProxy", {
        delayInMinutes: delay / 60
    });
}

// alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "refreshProxy") {
        reconnect();
    }
});

// reconnect logic
async function reconnect() {
    const data = await chrome.storage.local.get(["connected", "extensionControlled"]);

    if (!data.connected || !data.extensionControlled) return;

    await clearProxy();
    await connect();
}

// message handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "connect") connect();
    if (msg.action === "disconnect") disconnect();
});

// browser startup
chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.local.get(["connected", "extensionControlled"]);

    if (data.connected && data.extensionControlled) {
        await clearProxy();
        await connect();
    }
});

// detect external proxy change
chrome.proxy.settings.onChange.addListener(async (details) => {
    if (details.levelOfControl !== "controlled_by_this_extension") {
        await chrome.storage.local.set({
            connected: false,
            extensionControlled: false
        });
    }
});


setInterval(async () => {
    const data = await chrome.storage.local.get(["connected"]);
    if (!data.connected) return;
    const ip = await getIP();
    if (!ip || ip === "Unknown") {
        console.log("Proxy seems dead → reconnecting...");
        await reconnect();
    }
}, 2 * 60 * 1000);