// Load and manage profiles lists
async function loadProfiles(selectedId = "") {
    const data = await chrome.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};
    const select = document.getElementById("profileSelect");
    
    // Clear dynamic options, keep the manual first option
    select.innerHTML = '<option value="">-- Manual Input --</option>';
    
    Object.keys(profiles).forEach(id => {
        const opt = document.createElement("option");
        opt.value = id;
        opt.innerText = profiles[id].name || profiles[id].host;
        if (id === selectedId) opt.selected = true;
        select.appendChild(opt);
    });
}

async function updateUI() {
    const data = await chrome.storage.local.get(["connected", "proxy", "ip", "status"]);
    const dot = document.getElementById("dot");
    const statusText = document.getElementById("statusText");
    const ipInfo = document.getElementById("ipInfo");
    const ipContainer = document.getElementById("ipContainer");
    const btnConnect = document.getElementById("connect");
    const btnDisconnect = document.getElementById("disconnect");

    dot.className = "dot";

    if (data.status === "connecting") {
        dot.classList.add("connecting");
        statusText.innerText = "Connecting...";
        ipContainer.style.display = "block";
        ipInfo.innerText = "Verifying...";
        btnConnect.disabled = true;
        btnDisconnect.style.display = "none";
    } else if (data.connected) {
        dot.classList.add("connected");
        statusText.innerText = "Connected";
        ipContainer.style.display = "block";
        ipInfo.innerText = data.ip || "Unknown IP";
        
        btnConnect.style.display = "none";
        btnConnect.disabled = false;
        btnDisconnect.style.display = "flex";

        if (data.proxy) {
            document.getElementById("scheme").value = data.proxy.scheme;
            document.getElementById("host").value = data.proxy.host;
            document.getElementById("port").value = data.proxy.port;
            document.getElementById("username").value = data.proxy.username || "";
            document.getElementById("password").value = data.proxy.password || "";
        }
    } else {
        dot.classList.add("disconnected");
        statusText.innerText = data.status === "failed" ? "Failed" : "Disconnected";
        
        if (data.status === "failed") {
            ipContainer.style.display = "block";
            ipInfo.innerText = "Unreachable";
        } else {
            ipContainer.style.display = "none";
        }

        btnConnect.style.display = "flex";
        btnConnect.disabled = false;
        btnDisconnect.style.display = "none";
    }
}

// Get raw details object from input fields
function getFormProxyData() {
    return {
        scheme: document.getElementById("scheme").value,
        host: document.getElementById("host").value.trim(),
        port: document.getElementById("port").value.trim(),
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value
    };
}

// Event: Profile Selection changed
document.getElementById("profileSelect").onchange = async (e) => {
    const id = e.target.value;
    if (!id) return; // Manual selection item

    const data = await chrome.storage.local.get(["profiles"]);
    const targetProxy = (data.profiles || {})[id];
    
    if (targetProxy) {
        document.getElementById("scheme").value = targetProxy.scheme;
        document.getElementById("host").value = targetProxy.host;
        document.getElementById("port").value = targetProxy.port;
        document.getElementById("username").value = targetProxy.username || "";
        document.getElementById("password").value = targetProxy.password || "";
    }
};

// Event: Save Profile
document.getElementById("saveProfile").onclick = async () => {
    const proxyData = getFormProxyData();
    if (!proxyData.host || !proxyData.port) {
        alert("Fill Server Address and Port first!");
        return;
    }

    const data = await chrome.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};
    
    // Unique ID combining host and port
    const id = `${proxyData.host}:${proxyData.port}`;
    
    // Fallback name to host if not existing or already set
    const existingName = profiles[id] ? profiles[id].name : proxyData.host + ":" + proxyData.port;
    
    profiles[id] = {
        ...proxyData,
        name: existingName
    };

    await chrome.storage.local.set({ profiles });
    await loadProfiles(id);
};

// Event: Rename Active Selection Profile
document.getElementById("renameProfile").onclick = async () => {
    const select = document.getElementById("profileSelect");
    const id = select.value;
    if (!id) {
        alert("Please select a saved profile to rename!");
        return;
    }

    const data = await chrome.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};
    
    if (!profiles[id]) return;

    const currentName = profiles[id].name || profiles[id].host;
    const newName = prompt("Enter new profile name:", currentName);
    
    if (newName && newName.trim() !== "") {
        profiles[id].name = newName.trim();
        await chrome.storage.local.set({ profiles });
        await loadProfiles(id);
    }
};

// Event: Delete Selection Profile
document.getElementById("deleteProfile").onclick = async () => {
    const select = document.getElementById("profileSelect");
    const id = select.value;
    if (!id) {
        alert("Select a valid profile to delete!");
        return;
    }

    if (!confirm("Are you sure you want to delete this profile?")) return;

    const data = await chrome.storage.local.get(["profiles"]);
    const profiles = data.profiles || {};
    
    delete profiles[id];
    await chrome.storage.local.set({ profiles });
    await loadProfiles("");
};

document.getElementById("connect").onclick = () => {
    const proxyData = getFormProxyData();
    if (!proxyData.host || !proxyData.port) {
        alert("Please enter both Server Address and Port!");
        return;
    }
    chrome.runtime.sendMessage({ action: "connect", proxyData });
};

document.getElementById("disconnect").onclick = () => {
    chrome.runtime.sendMessage({ action: "disconnect" });
};

chrome.storage.onChanged.addListener(updateUI);

// Initialization lifecycle
loadProfiles();
updateUI();