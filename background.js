const BYPASS_LIST = ["kokoromagic.github.io"];
const DEFAULT_PROXY = {
    host: "frp.freefrp.net",
    port: "31701",
    scheme: "SOCKS5",
    username: "",
    password: ""
};

// Biến tạm để lưu thông tin xác thực khi proxy đang chạy
let currentAuth = { username: "", password: "" };

function setProxy(host, port, scheme) {
    const pacScript = `
        function FindProxyForURL(url, host) {
            var bypass = ${JSON.stringify(BYPASS_LIST)};
            for (var i = 0; i < bypass.length; i++) {
                if (dnsDomainIs(host, bypass[i])) return "DIRECT";
            }
            return "${scheme} ${host}:${port}";
        }
    `;
    return new Promise((resolve) => {
        chrome.proxy.settings.set({
            value: { mode: "pac_script", pacScript: { data: pacScript } },
            scope: "regular"
        }, resolve);
    });
}

// Lắng nghe yêu cầu xác thực từ Proxy
chrome.webRequest.onAuthRequired.addListener(
    (details) => {
        if (details.isProxy && currentAuth.username && currentAuth.password) {
            return {
                authCredentials: {
                    username: currentAuth.username,
                    password: currentAuth.password
                }
            };
        }
        return {};
    },
    { urls: ["<all_urls>"] },
    ["blocking"]
);

async function getIP() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
        const data = await res.json();
        return data.ip;
    } catch (e) { return null; }
}

async function connect(proxyData) {
    const proxy = proxyData || DEFAULT_PROXY;
    
    // Cập nhật thông tin auth vào biến tạm
    currentAuth.username = proxy.username || "";
    currentAuth.password = proxy.password || "";
    
    await chrome.storage.local.set({ status: "connecting", connected: false });
    await setProxy(proxy.host, proxy.port, proxy.scheme);

    // Tăng thời gian chờ lên 3 giây nếu có auth để proxy kịp xác thực
    setTimeout(async () => {
        const ip = await getIP();
        if (ip) {
            await chrome.storage.local.set({
                connected: true,
                status: "connected",
                proxy: proxy,
                ip: ip
            });
        } else {
            await chrome.proxy.settings.clear({});
            currentAuth = { username: "", password: "" }; // Xóa auth nếu lỗi
            await chrome.storage.local.set({
                connected: false,
                status: "failed",
                ip: "Connection Error"
            });
        }
    }, 3000);
}

async function disconnect() {
    await chrome.proxy.settings.clear({});
    currentAuth = { username: "", password: "" }; // Xóa auth khi tắt
    await chrome.storage.local.set({
        connected: false,
        status: "disconnected",
        ip: ""
    });
}

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "connect") connect(msg.proxyData);
    if (msg.action === "disconnect") disconnect();
});

chrome.runtime.onStartup.addListener(async () => {
    const data = await chrome.storage.local.get(["connected", "proxy"]);
    if (data.connected && data.proxy) await connect(data.proxy);
});