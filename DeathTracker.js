const DEATH_STORAGE_KEY = "nullscapeDeathState";

const deathState = {
    startLevel: 1,
    currentLevel: 1,
    players: []
};

function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveDeathState() {
    try { localStorage.setItem(DEATH_STORAGE_KEY, JSON.stringify(deathState)); }
    catch (error) { console.warn("couldn't save death state:", error); }
}

function loadDeathState() {
    try {
        const raw = localStorage.getItem(DEATH_STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw);
        deathState.startLevel = Number(saved.startLevel) || 1;
        deathState.currentLevel = Number(saved.currentLevel) || deathState.startLevel;
        deathState.players = Array.isArray(saved.players) ? saved.players : [];
        deathState.players.forEach(player => {
            player.deaths = Number(player.deaths) || 0;
            player.levelDeaths = player.levelDeaths || {};
        });
    } catch (error) {
        console.warn("couldn't load saved death state:", error);
    }
}

function renderDeathTracker() {
    const totalEl = document.getElementById("deathTotalValue");
    const listEl = document.getElementById("deathPlayerList");
    const currentEl = document.getElementById("deathCurrentLevel");
    const startEl = document.getElementById("deathStartLevel");
    const countEl = document.getElementById("deathPlayerCount");

    if (totalEl) totalEl.textContent = deathState.players.reduce((sum,p) => sum + p.deaths, 0);
    if (currentEl) currentEl.textContent = deathState.currentLevel;
    if (startEl && Number(startEl.value) !== deathState.startLevel) startEl.value = deathState.startLevel;
    if (countEl && Number(countEl.value) !== deathState.players.length) countEl.value = deathState.players.length;

    if (!listEl) return;
    listEl.innerHTML = "";

    if (!deathState.players.length) {
        const empty = document.createElement("div");
        empty.className = "death-empty-row";
        empty.textContent = "add players to begin tracking";
        listEl.appendChild(empty);
        return;
    }

    deathState.players.forEach(player => {
        const row = document.createElement("div");
        row.className = "death-player-row";

        const name = document.createElement("input");
        name.type = "text";
        name.className = "death-player-name-input";
        name.placeholder = "player name";
        name.value = player.name || "";
        name.addEventListener("input", () => {
            player.name = name.value;
            saveDeathState();
        });

        const controls = document.createElement("div");
        controls.className = "death-player-death-controls";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "death-count-button death-count-button--minus";
        minus.textContent = "−";
        minus.disabled = player.deaths <= 0;
        minus.addEventListener("click", () => undoLastDeath(player.id));

        const count = document.createElement("span");
        count.className = "death-player-death-count";
        count.textContent = player.deaths;

        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "death-count-button";
        plus.textContent = "+";
        plus.addEventListener("click", () => recordDeath(player.id));

        controls.append(minus, count, plus);

        row.append(name, controls);

        const breakdown = document.createElement("div");
        breakdown.className = "death-player-level-breakdown";
        Object.entries(player.levelDeaths || {})
            .sort((a,b) => Number(a[0]) - Number(b[0]))
            .forEach(([level, amount]) => {
                const chip = document.createElement("span");
                chip.className = "death-level-chip";
                chip.textContent = `Lv${level}: ${amount}`;
                breakdown.appendChild(chip);
            });
        if (breakdown.children.length) row.appendChild(breakdown);

        listEl.appendChild(row);
    });
}

function recordDeath(playerId) {
    const player = deathState.players.find(p => p.id === playerId);
    if (!player) return;
    player.deaths += 1;
    player.levelDeaths[deathState.currentLevel] = (player.levelDeaths[deathState.currentLevel] || 0) + 1;
    saveDeathState();
    renderDeathTracker();
    if (typeof playRemoveSound === "function") playRemoveSound();
}

function undoLastDeath(playerId) {
    const player = deathState.players.find(p => p.id === playerId);
    if (!player || player.deaths <= 0) return;

    const levels = Object.keys(player.levelDeaths || {}).map(Number).sort((a,b) => b-a);
    const level = levels[0];
    if (level !== undefined) {
        player.levelDeaths[level] = Math.max(0, (player.levelDeaths[level] || 0) - 1);
        if (!player.levelDeaths[level]) delete player.levelDeaths[level];
    }
    player.deaths -= 1;
    saveDeathState();
    renderDeathTracker();
}

function setPlayerCount(count) {
    count = Math.max(0, Math.min(50, Number(count) || 0));
    while (deathState.players.length < count) {
        deathState.players.push({ id: makeId(), name: "", deaths: 0, levelDeaths: {} });
    }
    while (deathState.players.length > count) deathState.players.pop();
    saveDeathState();
    renderDeathTracker();
}

function changePlayerCount(delta) {
    setPlayerCount(deathState.players.length + delta);
}

function setStartLevel(value) {
    const level = Math.max(1, Number(value) || 1);
    deathState.startLevel = level;
    deathState.currentLevel = level;
    saveDeathState();
    renderDeathTracker();
}

function nextDeathLevel() {
    deathState.currentLevel += 1;
    saveDeathState();
    renderDeathTracker();
}

function resetDeaths() {
    deathState.startLevel = 1;
    deathState.currentLevel = 1;
    deathState.players = [];
    saveDeathState();
    renderDeathTracker();
    if (typeof playRemoveSound === "function") playRemoveSound();
}

const deathToggleButton = document.getElementById("deathToggleButton");
const deathPanel = document.getElementById("deathPanel");

function setDeathPanelOpen(isOpen) {
    if (!deathPanel || !deathToggleButton) return;
    deathPanel.classList.toggle("open", isOpen);
    deathToggleButton.classList.toggle("active", isOpen);
    deathToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
}

if (deathToggleButton && deathPanel) {
    attachClickAction(deathToggleButton, () => {
        setDeathPanelOpen(!deathPanel.classList.contains("open"));
    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {
        if (event.key?.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        setDeathPanelOpen(!deathPanel.classList.contains("open"));
    });
}

const deathResetButton = document.getElementById("deathResetButton");
if (deathResetButton) {
    attachClickAction(deathResetButton, resetDeaths, typeof playRemoveSound === "function" ? playRemoveSound : undefined);
}

const startLevelInput = document.getElementById("deathStartLevel");
if (startLevelInput) startLevelInput.addEventListener("change", e => setStartLevel(e.target.value));

const playerCountInput = document.getElementById("deathPlayerCount");
if (playerCountInput) playerCountInput.addEventListener("change", e => setPlayerCount(e.target.value));

const playerCountPlus = document.getElementById("deathPlayerCountPlus");
if (playerCountPlus) playerCountPlus.addEventListener("click", () => changePlayerCount(1));

const playerCountMinus = document.getElementById("deathPlayerCountMinus");
if (playerCountMinus) playerCountMinus.addEventListener("click", () => changePlayerCount(-1));

const nextLevelButton = document.getElementById("deathNextLevelButton");
if (nextLevelButton) nextLevelButton.addEventListener("click", nextDeathLevel);

loadDeathState();
renderDeathTracker();