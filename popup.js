async function updateUI() {
    const data = await chrome.storage.local.get(["connected", "proxy", "ip", "status"]);
    const dot = document.getElementById("dot");
    const statusText = document.getElementById("statusText");
    const ipInfo = document.getElementById("ipInfo");

    if (data.status === "connecting") {
        dot.className = "dot";
        dot.style.background = "orange";
        statusText.innerText = "Connecting...";
        ipInfo.innerText = "Verifying proxy...";
    } else if (data.connected) {
        dot.className = "dot connected";
        dot.style.background = "#22c55e";
        statusText.innerText = "Connected";
        ipInfo.innerText = `IP: ${data.ip || "..."}`;
        
        if (data.proxy) {
            document.getElementById("scheme").value = data.proxy.scheme;
            document.getElementById("host").value = data.proxy.host;
            document.getElementById("port").value = data.proxy.port;
            document.getElementById("username").value = data.proxy.username || "";
            document.getElementById("password").value = data.proxy.password || "";
        }
    } else {
        dot.className = "dot disconnected";
        dot.style.background = "#ef4444";
        statusText.innerText = data.status === "failed" ? "Connection Failed" : "Disconnected";
        ipInfo.innerText = data.status === "failed" ? "Proxy unreachable" : "";
    }
}

document.getElementById("connect").onclick = () => {
    const proxyData = {
        scheme: document.getElementById("scheme").value,
        host: document.getElementById("host").value,
        port: document.getElementById("port").value,
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value
    };
    chrome.runtime.sendMessage({ action: "connect", proxyData });
};

document.getElementById("disconnect").onclick = () => {
    chrome.runtime.sendMessage({ action: "disconnect" });
};

chrome.storage.onChanged.addListener(updateUI);
updateUI();