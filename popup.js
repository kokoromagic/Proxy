const dot = document.getElementById("dot");
const statusText = document.getElementById("statusText");
const proxyInfo = document.getElementById("proxyInfo");
const ipInfo = document.getElementById("ipInfo");
const manualFields = document.getElementById("manualFields");

document.getElementsByName("mode").forEach(radio => {
    radio.onchange = (e) => {
        manualFields.style.display = e.target.value === "manual" ? "flex" : "none";
    };
});

async function updateUI() {
    const data = await chrome.storage.local.get(["connected", "proxy", "ip"]);

    if (data.connected && data.proxy) {
        dot.className = "dot connected";
        statusText.innerText = "Connected";
        proxyInfo.innerText = `${data.proxy.scheme || 'PROXY'} ${data.proxy.host}:${data.proxy.port}`;
        ipInfo.innerText = `IP: ${data.ip || "..."}`;
    } else {
        dot.className = "dot disconnected";
        statusText.innerText = "Disconnected";
        proxyInfo.innerText = "";
        ipInfo.innerText = "";
    }
}

document.getElementById("connect").onclick = () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    let config = { action: "connect", mode: mode };

    if (mode === "manual") {
        config.manualData = {
            scheme: document.getElementById("manualScheme").value,
            host: document.getElementById("manualHost").value,
            port: document.getElementById("manualPort").value
        };
    }

    chrome.runtime.sendMessage(config);
    statusText.innerText = "Connecting...";
};

document.getElementById("disconnect").onclick = () => {
    chrome.runtime.sendMessage({ action: "disconnect" });
};

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") updateUI();
});

updateUI();