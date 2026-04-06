const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const proxyInfo = document.getElementById("proxyInfo");
const ipInfo = document.getElementById("ipInfo");

async function updateUI() {
    const data = await chrome.storage.local.get([
        "connected",
        "proxy",
        "ip"
    ]);

    if (data.connected && data.proxy) {
        dot.className = "dot connected";
        statusText.innerText = "Connected";

        proxyInfo.innerText = `${data.proxy.host}:${data.proxy.port}`;
        ipInfo.innerText = `IP: ${data.ip || "..."}`;
    } else {
        dot.className = "dot disconnected";
        statusText.innerText = "Disconnected";

        proxyInfo.innerText = "";
        ipInfo.innerText = "";
    }
}

document.getElementById("connect").onclick = () => {
    chrome.runtime.sendMessage({ action: "connect" });
    setTimeout(updateUI, 1000);
};

document.getElementById("disconnect").onclick = () => {
    chrome.runtime.sendMessage({ action: "disconnect" });
    setTimeout(updateUI, 500);
};

updateUI();