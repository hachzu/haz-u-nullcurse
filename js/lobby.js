/*
 * Lobby Maker panel logic
 * --------------------------
 * Fourth sliding panel, following the same toggle-button + overlay +
 * mutual-exclusion pattern as Upgrades.js / DeathTracker.js /
 * Altars.js. Generates a random two-word lobby name (with an
 * optional numeric suffix) from a small fixed word list - no server,
 * no game data, just a fun throwaway name generator for starting a
 * run.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound, playPurifySound (button feedback sounds only -
 * the generator logic itself has no other dependency).
 */


const LOBBY_ADJECTIVES = [
    "Cursed", "Shattered", "Hollow", "Forsaken", "Twilight", "Withering",
    "Silent", "Ashen", "Nullbound", "Ghostly", "Fractured", "Sunken"
];

const LOBBY_NOUNS = [
    "Sanctuary", "Abyss", "Ruins", "Wasteland", "Asylum", "Bastion",
    "Threshold", "Requiem", "Nullscape", "Catacombs", "Rift", "Grove"
];

const LOBBY_HISTORY_LIMIT = 5;
const LOBBY_STORAGE_KEY = "nullscapeLobbyState";

const lobbyState = {

    addNumber: true,

    // Recent generations for this visit only - deliberately not
    // persisted to localStorage, since a lobby name is a one-time-
    // use throwaway, not something worth remembering across reloads.
    history: []

};

function saveLobbyState() {

    try {

        localStorage.setItem(LOBBY_STORAGE_KEY, JSON.stringify({ addNumber: lobbyState.addNumber }));

    } catch (error) {

        console.warn("couldn't save lobby state:", error);

    }

}

function loadLobbyState() {

    try {

        const raw = localStorage.getItem(LOBBY_STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = JSON.parse(raw);

        lobbyState.addNumber = saved.addNumber !== false;

    } catch (error) {

        console.warn("couldn't load saved lobby state, starting fresh:", error);

    }

}

function pickRandom(list) {

    return list[Math.floor(Math.random() * list.length)];

}

function generateLobbyName() {

    let name = `${pickRandom(LOBBY_ADJECTIVES)} ${pickRandom(LOBBY_NOUNS)}`;

    if (lobbyState.addNumber) {

        const suffix = Math.floor(10 + Math.random() * 90);

        name += ` #${suffix}`;

    }

    return name;

}

function renderLobbyHistory() {

    const listEl = document.getElementById("lobbyHistoryList");

    if (!listEl) {

        return;

    }

    listEl.innerHTML = "";

    if (!lobbyState.history.length) {

        const empty = document.createElement("div");

        empty.className = "lobby-empty-row";
        empty.textContent = "no names generated yet this visit";

        listEl.appendChild(empty);

        return;

    }

    lobbyState.history.forEach(name => {

        const row = document.createElement("div");

        row.className = "lobby-history-entry";
        row.textContent = name;

        listEl.appendChild(row);

    });

}

function updateLobbyNumberToggleUI() {

    const toggle = document.getElementById("lobbyNumberToggle");

    if (!toggle) {

        return;

    }

    toggle.classList.toggle("active", lobbyState.addNumber);
    toggle.setAttribute("aria-checked", lobbyState.addNumber ? "true" : "false");

    const label = toggle.querySelector(".lobby-switch-label");

    if (label) {

        label.textContent = lobbyState.addNumber ? "ON" : "OFF";

    }

}

function setLobbyNumberSuffix(enabled) {

    lobbyState.addNumber = Boolean(enabled);

    saveLobbyState();
    updateLobbyNumberToggleUI();

}

function generateAndShowLobbyName() {

    const name = generateLobbyName();

    const resultEl = document.getElementById("lobbyResultValue");

    if (resultEl) {

        resultEl.textContent = name;
        resultEl.classList.remove("lobby-result-value--placeholder");
        resultEl.classList.add("lobby-result-value--filled");

    }

    lobbyState.history.unshift(name);

    if (lobbyState.history.length > LOBBY_HISTORY_LIMIT) {

        lobbyState.history.length = LOBBY_HISTORY_LIMIT;

    }

    renderLobbyHistory();

}

/*
 * Same click-to-copy pattern as the Discord tag on the landing page
 * (see index.html) - swaps the button label to a quick "Copied!"
 * confirmation, then reverts a moment later.
 */
function copyLobbyName() {

    const resultEl = document.getElementById("lobbyResultValue");
    const copyButton = document.getElementById("lobbyCopyButton");
    const copyButtonText = document.getElementById("lobbyCopyButtonText");

    if (!resultEl || !copyButton || !copyButtonText) {

        return;

    }

    if (resultEl.classList.contains("lobby-result-value--placeholder")) {

        return;

    }

    const text = resultEl.textContent.trim();

    if (!text) {

        return;

    }

    const finish = () => {

        copyButtonText.textContent = "Copied!";
        copyButton.classList.add("lobby-copy-button--copied");

        setTimeout(() => {

            copyButtonText.textContent = "Copy";
            copyButton.classList.remove("lobby-copy-button--copied");

        }, 1400);

    };

    if (navigator.clipboard && navigator.clipboard.writeText) {

        navigator.clipboard.writeText(text).then(finish).catch(finish);

    } else {

        finish();

    }

}

const lobbyGenerateButton = document.getElementById("lobbyGenerateButton");

if (lobbyGenerateButton) {

    attachClickAction(
        lobbyGenerateButton,
        generateAndShowLobbyName,
        typeof playPurifySound === "function" ? playPurifySound : undefined
    );

}

const lobbyCopyButton = document.getElementById("lobbyCopyButton");

if (lobbyCopyButton) {

    lobbyCopyButton.addEventListener("click", copyLobbyName);

}

const lobbyNumberToggle = document.getElementById("lobbyNumberToggle");

if (lobbyNumberToggle) {

    attachClickAction(
        lobbyNumberToggle,
        () => setLobbyNumberSuffix(!lobbyState.addNumber),
        typeof playUtilitySound === "function" ? playUtilitySound : undefined
    );

}


const lobbyToggleButton = document.getElementById("lobbyToggleButton");
const lobbyPanel = document.getElementById("lobbyPanel");

function setLobbyPanelOpen(isOpen) {

    if (!lobbyPanel || !lobbyToggleButton) {

        return;

    }

    // Mutually exclusive with the other three panels - opening this
    // one closes all of them instead of letting panels overlay each
    // other. Each of those panels' own open functions has a matching
    // guarded call back to this one, so it works regardless of which
    // panel the person opens first.
    if (isOpen) {

        if (typeof setUpgradePanelOpen === "function") {

            setUpgradePanelOpen(false);

        }

        if (typeof setDeathPanelOpen === "function") {

            setDeathPanelOpen(false);

        }

        if (typeof setAltarsPanelOpen === "function") {

            setAltarsPanelOpen(false);

        }

    }

    lobbyPanel.classList.toggle("open", isOpen);
    lobbyToggleButton.classList.toggle("active", isOpen);
    lobbyToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

}

if (lobbyToggleButton && lobbyPanel) {

    attachClickAction(lobbyToggleButton, () => {

        setLobbyPanelOpen(!lobbyPanel.classList.contains("open"));

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {

        if (!event.key || event.key.toLowerCase() !== "l") {

            return;

        }

        if (event.metaKey || event.ctrlKey || event.altKey) {

            return;

        }

        const active = document.activeElement;
        const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

        if (isTyping) {

            return;

        }

        setLobbyPanelOpen(!lobbyPanel.classList.contains("open"));

    });

}


/*
 * Left panel accent sync, scoped just to this panel's own
 * .left-panel--lobby class - same self-contained approach Altars.js
 * uses (its own small observer) rather than touching script.js's
 * shared one.
 */
const leftPanelElForLobby = document.querySelector(".left-panel");

function updateLobbyLeftPanelAccent() {

    if (!leftPanelElForLobby || !lobbyPanel) {

        return;

    }

    const lobbyOpen = lobbyPanel.classList.contains("open");

    leftPanelElForLobby.classList.toggle("left-panel--lobby", lobbyOpen);

}

if (lobbyPanel) {

    const lobbyAccentObserver = new MutationObserver(updateLobbyLeftPanelAccent);

    lobbyAccentObserver.observe(lobbyPanel, { attributes: true, attributeFilter: ["class"] });

}

updateLobbyLeftPanelAccent();

loadLobbyState();
updateLobbyNumberToggleUI();
renderLobbyHistory();