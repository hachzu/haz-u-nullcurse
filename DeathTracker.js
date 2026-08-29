const DEATH_STORAGE_KEY = "nullscapeDeathState";
const MAX_DEATHS_PER_LEVEL = 3;

const deathState = {
    startLevel: 1,
    currentLevel: 1,
    players: [],
    log: [],
    unlimitedDeaths: false
};

function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveDeathState() {
    try {
        localStorage.setItem(DEATH_STORAGE_KEY, JSON.stringify(deathState));
    } catch (error) {
        console.warn("couldn't save death state:", error);
    }
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
        deathState.log = Array.isArray(saved.log) ? saved.log : [];
        deathState.unlimitedDeaths = Boolean(saved.unlimitedDeaths);

    } catch (error) {
        console.warn("couldn't load saved death state:", error);
    }
}

function getPlayerLevelDeaths(player, level) {
    return (player.levelDeaths && player.levelDeaths[level]) || 0;
}

function getPlayerName(playerId, fallback) {
    const player = deathState.players.find(p => p.id === playerId);
    if (player) return player.name || "Unnamed";
    return fallback || "Unknown player";
}

/*
 * Death log entries render as flat text lines - "Name died on
 * level X" - newest first, inside their own internally-scrolling
 * list (see .death-log-list / .death-panel-log-side in
 * DeathTracker.css). No per-level grouping or headings anymore.
 */
function renderDeathLog() {
    const listEl = document.getElementById("deathLogList");
    if (!listEl) return;

    listEl.innerHTML = "";

    if (!deathState.log.length) {
        const empty = document.createElement("div");
        empty.className = "death-empty-row";
        empty.textContent = "no deaths recorded yet";
        listEl.appendChild(empty);
        return;
    }

    const ordered = [...deathState.log].sort((a, b) => b.timestamp - a.timestamp);

    ordered.forEach(entry => {
        const name = getPlayerName(entry.playerId, entry.playerName);

        const line = document.createElement("div");
        line.className = "death-log-entry";
        line.textContent = `${name} died on level ${entry.level}`;

        listEl.appendChild(line);
    });
}

function updateDeathHint() {
    const hintEl = document.getElementById("deathPlayerHint");
    if (!hintEl) return;

    hintEl.innerHTML = deathState.unlimitedDeaths
        ? `Add a player, type their name, then use <strong>+</strong> when they die. No death cap right now.`
        : `Add a player, type their name, then use <strong>+</strong> when they die. Max ${MAX_DEATHS_PER_LEVEL} deaths per player per level.`;
}

function updateDeathUnlimitedToggleUI() {
    const toggle = document.getElementById("deathUnlimitedToggle");
    if (!toggle) return;

    toggle.classList.toggle("active", deathState.unlimitedDeaths);
    toggle.setAttribute("aria-checked", deathState.unlimitedDeaths ? "true" : "false");

    const label = toggle.querySelector(".death-switch-label");
    if (label) label.textContent = deathState.unlimitedDeaths ? "ON" : "OFF";
}

function renderDeathTracker() {
    const totalEl = document.getElementById("deathTotalValue");
    const currentLevelEl = document.getElementById("deathCurrentLevelValue");
    const listEl = document.getElementById("deathPlayerList");
    const startEl = document.getElementById("deathStartLevelInput");
    const countEl = document.getElementById("deathPlayerCountInput");
    const nextButton = document.getElementById("deathNextLevelButton");

    if (totalEl) tweenNumberText(totalEl, deathState.players.reduce((sum, p) => sum + p.deaths, 0));
    if (currentLevelEl) tweenNumberText(currentLevelEl, deathState.currentLevel);
    if (startEl && Number(startEl.value) !== deathState.startLevel) startEl.value = deathState.startLevel;
    if (countEl && Number(countEl.value) !== deathState.players.length) countEl.value = deathState.players.length;
    if (nextButton) nextButton.textContent = `NEXT LEVEL \u2192 Lv${deathState.currentLevel + 1}`;

    updateDeathUnlimitedToggleUI();
    updateDeathHint();

    if (listEl) {

        listEl.innerHTML = "";

        if (!deathState.players.length) {

            const empty = document.createElement("div");
            empty.className = "death-empty-row";
            empty.textContent = "add players to begin tracking";
            listEl.appendChild(empty);

        } else {

            deathState.players.forEach(player => {

                const row = document.createElement("div");
                row.className = "death-player-row";

                const main = document.createElement("div");
                main.className = "death-player-row-main";

                const name = document.createElement("input");
                name.type = "text";
                name.className = "death-player-name-input";
                name.placeholder = "player name";
                name.value = player.name || "";
                name.classList.toggle("death-player-name-input--filled", name.value.trim().length > 0);
                name.addEventListener("input", () => {
                    player.name = name.value;
                    name.classList.toggle("death-player-name-input--filled", name.value.trim().length > 0);
                    saveDeathState();
                });

                const controls = document.createElement("div");
                controls.className = "death-player-death-controls";

                const minus = document.createElement("button");
                minus.type = "button";
                minus.className = "death-count-button death-count-button--minus";
                minus.textContent = "\u2212";
                minus.disabled = player.deaths <= 0;
                minus.setAttribute("aria-label", `Undo last death for ${player.name || "this player"}`);
                minus.addEventListener("click", () => undoLastDeath(player.id));

                const count = document.createElement("span");
                count.className = "death-player-death-count";
                count.textContent = player.deaths;

                const plus = document.createElement("button");
                plus.type = "button";
                plus.className = "death-count-button";
                plus.textContent = "+";

                // Deaths are normally capped at MAX_DEATHS_PER_LEVEL
                // per player per level - once a player hits that cap
                // on the currently-recording level, the + button
                // disables until the run advances to the next level.
                // The Unlimited Deaths toggle skips this entirely.
                const atLevelCap = !deathState.unlimitedDeaths
                    && getPlayerLevelDeaths(player, deathState.currentLevel) >= MAX_DEATHS_PER_LEVEL;

                plus.disabled = atLevelCap;
                plus.title = atLevelCap
                    ? `Max ${MAX_DEATHS_PER_LEVEL} deaths already logged for level ${deathState.currentLevel}`
                    : "Log a death";
                plus.setAttribute("aria-label", `Record a death for ${player.name || "this player"}`);
                plus.addEventListener("click", () => recordDeath(player.id));

                controls.append(minus, count, plus);
                main.append(name, controls);
                row.appendChild(main);

                listEl.appendChild(row);

            });

        }

    }

    renderDeathLog();
}

function recordDeath(playerId) {

    const player = deathState.players.find(p => p.id === playerId);

    if (!player) return;

    const level = deathState.currentLevel;
    const currentLevelDeaths = getPlayerLevelDeaths(player, level);

    if (!deathState.unlimitedDeaths && currentLevelDeaths >= MAX_DEATHS_PER_LEVEL) {

        if (typeof playRemoveSound === "function") playRemoveSound();

        return;

    }

    player.deaths += 1;
    player.levelDeaths[level] = currentLevelDeaths + 1;

    deathState.log.push({
        id: makeId(),
        playerId: player.id,
        playerName: player.name || "Unnamed",
        level,
        timestamp: Date.now()
    });

    saveDeathState();
    renderDeathTracker();

    if (typeof playRemoveSound === "function") playRemoveSound();

}

function undoLastDeath(playerId) {

    const player = deathState.players.find(p => p.id === playerId);

    if (!player || player.deaths <= 0) return;

    const levels = Object.keys(player.levelDeaths || {}).map(Number).sort((a, b) => b - a);
    const level = levels[0];

    if (level !== undefined) {

        player.levelDeaths[level] = Math.max(0, (player.levelDeaths[level] || 0) - 1);

        if (!player.levelDeaths[level]) delete player.levelDeaths[level];

        // Remove the matching most-recent log entry for this
        // player/level so the log and the counts stay in sync.
        for (let i = deathState.log.length - 1; i >= 0; i--) {

            const entry = deathState.log[i];

            if (entry.playerId === playerId && entry.level === level) {

                deathState.log.splice(i, 1);
                break;

            }

        }

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

function setUnlimitedDeaths(enabled) {
    deathState.unlimitedDeaths = Boolean(enabled);
    saveDeathState();
    renderDeathTracker();
}

function resetDeaths() {
    deathState.startLevel = 1;
    deathState.currentLevel = 1;
    deathState.players = [];
    deathState.log = [];
    saveDeathState();
    renderDeathTracker();
    if (typeof playRemoveSound === "function") playRemoveSound();
}

const deathToggleButton = document.getElementById("deathToggleButton");
const deathPanel = document.getElementById("deathPanel");

function setDeathPanelOpen(isOpen) {

    if (!deathPanel || !deathToggleButton) return;

    // Panels are mutually exclusive - opening this one closes the
    // Upgrade panel instead of letting the two overlay each other.
    if (isOpen && typeof setUpgradePanelOpen === "function") {

        setUpgradePanelOpen(false);

    }

    // Same rule against the Altars panel, once Altars.js has loaded.
    if (isOpen && typeof setAltarsPanelOpen === "function") {

        setAltarsPanelOpen(false);

    }

    deathPanel.classList.toggle("open", isOpen);
    deathToggleButton.classList.toggle("active", isOpen);
    deathToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

}

if (deathToggleButton && deathPanel) {
    attachClickAction(deathToggleButton, () => {
        setDeathPanelOpen(!deathPanel.classList.contains("open"));
    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {
        if (event.key?.toLowerCase() !== "x" || event.metaKey || event.ctrlKey || event.altKey) return;
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        setDeathPanelOpen(!deathPanel.classList.contains("open"));
    });
}

const deathResetButton = document.getElementById("deathResetButton");
if (deathResetButton) {
    attachClickAction(deathResetButton, resetDeaths, typeof playRemoveSound === "function" ? playRemoveSound : undefined);
}

const startLevelInput = document.getElementById("deathStartLevelInput");
if (startLevelInput) startLevelInput.addEventListener("change", e => setStartLevel(e.target.value));

const playerCountInput = document.getElementById("deathPlayerCountInput");
if (playerCountInput) playerCountInput.addEventListener("change", e => setPlayerCount(e.target.value));

const playerCountPlus = document.getElementById("deathPlayerCountPlus");
if (playerCountPlus) playerCountPlus.addEventListener("click", () => changePlayerCount(1));

const playerCountMinus = document.getElementById("deathPlayerCountMinus");
if (playerCountMinus) playerCountMinus.addEventListener("click", () => changePlayerCount(-1));

const nextLevelButton = document.getElementById("deathNextLevelButton");
if (nextLevelButton) nextLevelButton.addEventListener("click", nextDeathLevel);

const deathUnlimitedToggle = document.getElementById("deathUnlimitedToggle");
if (deathUnlimitedToggle) {
    attachClickAction(deathUnlimitedToggle, () => {
        setUnlimitedDeaths(!deathState.unlimitedDeaths);
    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);
}

loadDeathState();
renderDeathTracker();