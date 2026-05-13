const BYPASS_LIST = ["kokoromagic.github.io"];
const DEFAULT_PROXY = {
    host: "frp.freefrp.net",
    port: "31701",
    scheme: "SOCKS5"
};

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
    
    // Đặt trạng thái đang kết nối
    await chrome.storage.local.set({ status: "connecting", connected: false });
    
    await setProxy(proxy.host, proxy.port, proxy.scheme);

    // Chờ 2 giây để proxy áp dụng rồi kiểm tra IP
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
            // Nếu không lấy được IP tức là proxy lỗi
            await chrome.proxy.settings.clear({});
            await chrome.storage.local.set({
                connected: false,
                status: "failed",
                ip: "Connection Error"
            });
        }
    }, 2000);
}

async function disconnect() {
    await chrome.proxy.settings.clear({});
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