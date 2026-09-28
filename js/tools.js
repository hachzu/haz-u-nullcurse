/* Source: run-trackers.js */
/* Source: death-tracker.js */
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
const deathBackButton = document.getElementById("deathBackButton");

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

    // Same rule against the Lobby Maker panel, once Lobby.js has
    // loaded.
    if (isOpen && typeof setLobbyPanelOpen === "function") {

        setLobbyPanelOpen(false);

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

if (deathBackButton) {
    attachClickAction(deathBackButton, () => {
        setDeathPanelOpen(false);
    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);
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

/* Source: altars.js */
/*
 * Altars panel logic
 * --------------------------
 * Third sliding panel, following the same toggle-button + overlay
 * pattern as Upgrades.js / DeathTracker.js. The panel includes
 * Protection and Purification Altar cost calculators, while keeping
 * panel mutually exclusive with the other tool panels.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound.
 * Mutual exclusion with the other two panels is wired both ways:
 * this file closes them when Altars opens, and small hooks added to
 * setUpgradePanelOpen (Upgrades.js) / setDeathPanelOpen
 * (DeathTracker.js) close Altars when either of those opens.
 */


const altarsToggleButton = document.getElementById("altarsToggleButton");
const altarsPanel = document.getElementById("altarsPanel");
const altarsBackButton = document.getElementById("altarsBackButton");
const protectionAltarGiftsInput = document.getElementById("protectionAltarGifts");
const protectionAltarUseBalanceButton = document.getElementById("protectionAltarUseBalance");
const protectionAltarContext = document.getElementById("protectionAltarContext");
const protectionAltarLevels = document.getElementById("protectionAltarLevels");
const protectionAltarFormula = document.getElementById("protectionAltarFormula");
const protectionAltarSummary = document.getElementById("protectionAltarSummary");
const purificationAltarSyncButton = document.getElementById("purificationAltarSync");
const purificationAltarTargets = document.getElementById("purificationAltarTargets");
const purificationAltarContext = document.getElementById("purificationAltarContext");
const purificationAltarFormula = document.getElementById("purificationAltarFormula");
const purificationAltarSummary = document.getElementById("purificationAltarSummary");

let selectedProtectionAltarLevel = null;
let selectedPurificationAltarCurse = null;


function getProtectionAltarMode() {

    return typeof upgradeState !== "undefined" && upgradeState
        ? upgradeState.mode
        : "solo";

}


function getProtectionAltarShopBalance() {

    return typeof upgradeState !== "undefined" && upgradeState
        ? Math.max(0, Number(upgradeState.goldenGifts) || 0)
        : 0;

}


function getProtectionAltarCost(level, goldenGifts, playerCount, mode) {

    const soloOrDuo = mode === "solo" || mode === "duo";
    const percent = soloOrDuo ? 0.05 : 0.1;
    const basePrice = soloOrDuo ? 12.5 : 50;
    const levelMultiplier = Math.max(1, level - 4);
    const playerMultiplier = soloOrDuo
        ? playerCount
        : Math.sqrt(playerCount) / 1.75;

    return Math.floor(
        (goldenGifts * percent)
        + (basePrice * levelMultiplier * playerMultiplier)
    );

}


function formatAltarMode(mode) {

    return ({ solo: "Solo", duo: "Duo", party: "Party", partyplus: "Party+" })[mode] || "Solo";

}


function renderProtectionAltarCalculator() {

    if (!protectionAltarGiftsInput || !protectionAltarLevels || !protectionAltarSummary) {

        return;

    }

    const playerCount = typeof getPlayerCount === "function" ? getPlayerCount() : 1;
    const currentLevel = typeof getLevel === "function" ? getLevel() : 1;
    const mode = getProtectionAltarMode();
    const goldenGifts = Math.max(0, Number(protectionAltarGiftsInput.value) || 0);
    const firstLevel = Math.max(8, currentLevel);

    if (selectedProtectionAltarLevel === null || selectedProtectionAltarLevel < firstLevel) {

        selectedProtectionAltarLevel = firstLevel;

    }

    const soloOrDuo = mode === "solo" || mode === "duo";
    const percent = soloOrDuo ? 5 : 10;
    const playerTerm = soloOrDuo
        ? `${playerCount} player${playerCount === 1 ? "" : "s"}`
        : `√${playerCount} ÷ 1.75`;

    protectionAltarContext.innerHTML = "";

    [
        `Run level ${currentLevel}`,
        `${playerCount} player${playerCount === 1 ? "" : "s"}`,
        formatAltarMode(mode),
        `${percent}% Gifts + ${playerTerm}`
    ].forEach(text => {

        const chip = document.createElement("span");

        chip.className = "altar-context-chip";
        chip.textContent = text;

        protectionAltarContext.appendChild(chip);

    });

    protectionAltarFormula.textContent = soloOrDuo
        ? "5% of Gifts + 12.5 × (level − 4) × players"
        : "10% of Gifts + 50 × (level − 4) × √players ÷ 1.75";

    protectionAltarLevels.innerHTML = "";

    for (let level = firstLevel; level < firstLevel + 5; level++) {

        const cost = getProtectionAltarCost(level, goldenGifts, playerCount, mode);
        const button = document.createElement("button");

        button.type = "button";
        button.className = "altar-level-card";
        button.classList.toggle("selected", level === selectedProtectionAltarLevel);
        button.setAttribute("aria-pressed", level === selectedProtectionAltarLevel ? "true" : "false");
        button.innerHTML = `<span class="altar-level-label">LEVEL ${level}</span><strong>${cost.toLocaleString()} <small>GG</small></strong>`;

        attachClickAction(button, () => {

            selectedProtectionAltarLevel = level;
            renderProtectionAltarCalculator();

        }, typeof playSelectSound === "function" ? playSelectSound : undefined);

        protectionAltarLevels.appendChild(button);

    }

    const selectedCost = getProtectionAltarCost(
        selectedProtectionAltarLevel,
        goldenGifts,
        playerCount,
        mode
    );

    protectionAltarSummary.innerHTML = `<span>Protection Altar · Level ${selectedProtectionAltarLevel}</span><strong>${selectedCost.toLocaleString()} <small>Golden Gifts</small></strong>`;

}


function getPurificationAltarLevelMultiplier(level) {

    return Math.min(12, Math.floor(level / 5) * 2);

}


function getPurificationAltarCost(curseValue, level, playerCount) {

    return Math.floor(
        curseValue
        * getPurificationAltarLevelMultiplier(level)
        * Math.sqrt(playerCount)
    );

}


function getActiveMedalCurses() {

    if (typeof getDisplayedCurseNames !== "function" || typeof findCurseByName !== "function") {

        return [];

    }

    return getDisplayedCurseNames()
        .map(name => findCurseByName(name))
        .filter(curse => curse && curse.medal && typeof curse.value === "number")
        .sort((a, b) => a.name.localeCompare(b.name));

}


function renderPurificationAltarCalculator() {

    if (!purificationAltarTargets || !purificationAltarSummary) {

        return;

    }

    const activeCurses = getActiveMedalCurses();

    if (!activeCurses.some(curse => curse.name === selectedPurificationAltarCurse)) {

        selectedPurificationAltarCurse = activeCurses.length > 0 ? activeCurses[0].name : null;

    }

    const curse = activeCurses.find(item => item.name === selectedPurificationAltarCurse) || null;
    const curseValue = curse && typeof curse.value === "number" ? curse.value : 0;
    const level = typeof getLevel === "function" ? getLevel() : 1;
    const playerCount = typeof getPlayerCount === "function" ? getPlayerCount() : 1;
    const levelMultiplier = getPurificationAltarLevelMultiplier(level);
    const cost = getPurificationAltarCost(curseValue, level, playerCount);

    purificationAltarFormula.textContent = "curse value × level multiplier × √players";

    purificationAltarTargets.innerHTML = "";

    if (activeCurses.length === 0) {

        const empty = document.createElement("p");

        empty.className = "purification-altar-empty";
        empty.textContent = "No active medal curses yet. Pick one from any curse pool, then sync here.";

        purificationAltarTargets.appendChild(empty);

    } else {

        activeCurses.forEach(activeCurse => {

            const target = document.createElement("button");
            const isPayoutCurse = runState.medalCurseValues.has(activeCurse.name);

            target.type = "button";
            target.className = "purification-altar-target";
            target.classList.toggle("selected", activeCurse.name === selectedPurificationAltarCurse);
            target.setAttribute("aria-pressed", activeCurse.name === selectedPurificationAltarCurse ? "true" : "false");
            target.innerHTML = `
                <img src="assets/curses/${slugify(activeCurse.name)}.png" alt="">
                <span class="purification-altar-target-copy"><strong>${activeCurse.name}</strong><small>${activeCurse.value} curse value</small></span>
                <span class="purification-altar-target-source ${isPayoutCurse ? "payout" : "normal"}">${isPayoutCurse ? "PAYOUT" : "NO PAYOUT"}</span>
            `;

            attachClickAction(target, () => {

                selectedPurificationAltarCurse = activeCurse.name;
                renderPurificationAltarCalculator();

            }, typeof playSelectSound === "function" ? playSelectSound : undefined);

            purificationAltarTargets.appendChild(target);

        });

    }

    purificationAltarContext.innerHTML = "";

    [
        `Run level ${level}`,
        `${playerCount} player${playerCount === 1 ? "" : "s"}`,
        `Level multiplier ×${levelMultiplier}`,
        `${curseValue} curse value`
    ].forEach(text => {

        const chip = document.createElement("span");

        chip.className = "altar-context-chip";
        chip.textContent = text;

        purificationAltarContext.appendChild(chip);

    });

    purificationAltarSummary.innerHTML = `<span>${curse ? curse.name : "Curse"} · Purification Altar</span><strong>${cost.toLocaleString()} <small>Golden Gifts</small></strong>`;

}


if (protectionAltarGiftsInput) {

    protectionAltarGiftsInput.value = getProtectionAltarShopBalance();
    protectionAltarGiftsInput.addEventListener("input", renderProtectionAltarCalculator);

}


if (protectionAltarUseBalanceButton) {

    attachClickAction(protectionAltarUseBalanceButton, () => {

        protectionAltarGiftsInput.value = getProtectionAltarShopBalance();
        renderProtectionAltarCalculator();

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

}


if (purificationAltarSyncButton) {

    attachClickAction(purificationAltarSyncButton, renderPurificationAltarCalculator, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

}


function setAltarsPanelOpen(isOpen) {

    if (!altarsPanel || !altarsToggleButton) {

        return;

    }

    // Mutually exclusive with the Upgrade and Death Tracker panels -
    // opening this one closes both of those instead of letting the
    // panels overlay each other.
    if (isOpen) {

        if (typeof setUpgradePanelOpen === "function") {

            setUpgradePanelOpen(false);

        }

        if (typeof setDeathPanelOpen === "function") {

            setDeathPanelOpen(false);

        }

        if (typeof setLobbyPanelOpen === "function") {

            setLobbyPanelOpen(false);

        }

    }

    altarsPanel.classList.toggle("open", isOpen);
    altarsToggleButton.classList.toggle("active", isOpen);
    altarsToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

    if (isOpen) {

        renderProtectionAltarCalculator();
        renderPurificationAltarCalculator();

    }

}


if (altarsToggleButton && altarsPanel) {

    attachClickAction(altarsToggleButton, () => {

        setAltarsPanelOpen(!altarsPanel.classList.contains("open"));

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {

        if (!event.key || event.key.toLowerCase() !== "n") {

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

        setAltarsPanelOpen(!altarsPanel.classList.contains("open"));

    });

}

if (altarsBackButton) {

    attachClickAction(altarsBackButton, () => {

        setAltarsPanelOpen(false);

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

}


/*
 * Left panel accent sync, scoped just to this panel's own
 * .left-panel--altars class. script.js already runs its own
 * MutationObserver on #upgradePanel/#deathPanel that toggles
 * .left-panel--upgrades/--death whenever either panel's "open"
 * class changes - that still fires correctly here, since
 * setUpgradePanelOpen(false)/setDeathPanelOpen(false) above toggle
 * their real "open" class off. This observer only needs to handle
 * the new Altars accent, not duplicate the other two.
 */
const leftPanelElForAltars = document.querySelector(".left-panel");

function updateAltarsLeftPanelAccent() {

    if (!leftPanelElForAltars || !altarsPanel) {

        return;

    }

    const altarsOpen = altarsPanel.classList.contains("open");

    leftPanelElForAltars.classList.toggle("left-panel--altars", altarsOpen);

}


if (altarsPanel) {

    const altarsAccentObserver = new MutationObserver(updateAltarsLeftPanelAccent);

    altarsAccentObserver.observe(altarsPanel, { attributes: true, attributeFilter: ["class"] });

}

updateAltarsLeftPanelAccent();
renderProtectionAltarCalculator();
renderPurificationAltarCalculator();


/* Source: lobby-maker-editor.js */
/*
 * Lobby Maker panel logic — v3 (preselect-then-type title editor)
 * --------------------------
 * Same fourth-panel shell as before (toggle button + sliding overlay,
 * mutual exclusion with Upgrades/Death/Altars, keyboard shortcut "L",
 * left-panel accent sync) but the body is now a full per-letter title
 * editor: free-text input, font / color / style sub-panels, solid +
 * gradient coloring, outline support, and a compiler that turns the
 * styled text into Roblox rich-text tags ready to paste into a lobby
 * name field.
 *
 * v3 workflow change: the toolbar/sub-panels no longer require the
 * person to highlight text first. Whatever font/color/style is
 * "armed" (lobbyEditor.typingStyle) is what new characters get as
 * they're typed. Highlighting existing letters (click, shift+arrow,
 * ctrl+click, drag-select) is still supported and now exists purely
 * as an optional touch-up path for restyling specific letters after
 * the fact - it patches the highlighted letters directly instead of
 * the "armed" style. A Reset button clears the whole panel (text,
 * per-letter styles, the armed style, undo history, and the copied-
 * tag log) back to its starting state.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound, playPurifySound (button feedback sounds only).
 */


const LOBBY_TITLE_MAX_LENGTH = 35;
const LOBBY_TAG_HISTORY_LIMIT = 5;
const LOBBY_DEFAULT_STROKE_THICKNESS = 2;

/*
 * Per-letter style record shape:
 * {
 *   bold, italic, underline, strikethrough: boolean
 *   font: { label, face } | null
 *   color: "#rrggbb" | null
 *   fade: 0..1               (0 = fully opaque)
 *   ring: boolean            (has an outline)
 *   ringColor: "#rrggbb"
 *   ringFade: 0..1
 *   ringJoin: "round" | "miter" | "bevel"
 * }
 */

function blankTypingStyle() {

    return {

        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        font: null,
        color: null,
        fade: 0,
        ring: false,
        ringColor: "#000000",
        ringFade: 0,
        ringJoin: "round"

    };

}

const lobbyEditor = {

    letters: [],           // one entry per character in the input, index-aligned
    selection: [],          // sorted array of selected character indices
    selectionActive: false,
    caret: 0,
    caretShown: false,
    editingOutline: false,

    // The "armed" style: whatever font/color/style is picked while
    // nothing is highlighted gets stamped onto newly typed letters.
    typingStyle: blankTypingStyle(),

    history: [],
    historyAt: -1,
    restoring: false

};

const lobbyTagLog = [];

function blankLetterStyle() {

    return {};

}

/*
 * The letter style that should be stamped onto a freshly typed
 * character right now, or null if nothing is armed (plain text).
 */
function currentTypingStyleSnapshot() {

    const t = lobbyEditor.typingStyle;

    const hasAnything = t.bold || t.italic || t.underline || t.strikethrough ||
        t.font || t.color || (typeof t.fade === "number" && t.fade > 0) || t.ring;

    if (!hasAnything) {

        return null;

    }

    return { ...t };

}

function cloneLetterStyles(list) {

    return list.map(entry => (entry ? { ...entry } : null));

}

function lobbySnapshot() {

    return {

        text: lobbyEditorInput.value,
        letters: cloneLetterStyles(lobbyEditor.letters)

    };

}

function pushLobbySnapshot() {

    if (lobbyEditor.restoring) {

        return;

    }

    const snap = lobbySnapshot();
    const prior = lobbyEditor.history[lobbyEditor.historyAt];

    if (
        prior &&
        prior.text === snap.text &&
        JSON.stringify(prior.letters) === JSON.stringify(snap.letters)
    ) {

        return;

    }

    lobbyEditor.history = lobbyEditor.history.slice(0, lobbyEditor.historyAt + 1);
    lobbyEditor.history.push(snap);

    const cap = 150;

    if (lobbyEditor.history.length > cap) {

        lobbyEditor.history.shift();

    }

    lobbyEditor.historyAt = lobbyEditor.history.length - 1;

}

function restoreLobbySnapshot(snap) {

    lobbyEditor.restoring = true;

    lobbyEditorInput.value = snap.text;
    lobbyEditor.letters = cloneLetterStyles(snap.letters);

    lobbyEditor.restoring = false;

    lobbyEditor.selection = lobbyEditor.selection.filter(i => i < snap.text.length);
    lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

}

function lobbyUndo() {

    if (lobbyEditor.historyAt <= 0) {

        return;

    }

    lobbyEditor.historyAt--;
    restoreLobbySnapshot(lobbyEditor.history[lobbyEditor.historyAt]);

}

function lobbyRedo() {

    if (lobbyEditor.historyAt >= lobbyEditor.history.length - 1) {

        return;

    }

    lobbyEditor.historyAt++;
    restoreLobbySnapshot(lobbyEditor.history[lobbyEditor.historyAt]);

}

function letterStyleAt(index) {

    return lobbyEditor.letters[index] || null;

}

function letterStyleForWrite(index) {

    if (!lobbyEditor.letters[index]) {

        lobbyEditor.letters[index] = blankLetterStyle();

    }

    return lobbyEditor.letters[index];

}

/*
 * Keeps the per-letter style array lined up with the textarea after a
 * native edit (typing, pasting, deleting). Finds the untouched prefix
 * and suffix around the edit and only rebuilds the middle chunk, so
 * styling on unrelated letters survives.
 */
function reconcileLettersAfterEdit(nextText, previousText) {

    let head = 0;

    const shortest = Math.min(previousText.length, nextText.length);

    while (head < shortest && previousText[head] === nextText[head]) {

        head++;

    }

    let oldTail = previousText.length;
    let newTail = nextText.length;

    while (
        oldTail > head &&
        newTail > head &&
        previousText[oldTail - 1] === nextText[newTail - 1]
    ) {

        oldTail--;
        newTail--;

    }

    const rebuilt = lobbyEditor.letters.slice(0, head);
    const insertedStyle = currentTypingStyleSnapshot();

    for (let i = 0; i < newTail - head; i++) {

        rebuilt.push(insertedStyle ? { ...insertedStyle } : null);

    }

    rebuilt.push(...lobbyEditor.letters.slice(oldTail));

    lobbyEditor.letters = rebuilt;

}

function clearLobbySelection() {

    lobbyEditor.selection = [];
    lobbyEditor.selectionActive = false;
    lobbyEditor.caretShown = false;

}

function toggleIndexInSelection(index) {

    if (lobbyEditor.selection.includes(index)) {

        lobbyEditor.selection = lobbyEditor.selection.filter(i => i !== index);

    } else {

        lobbyEditor.selection.push(index);
        lobbyEditor.selection.sort((a, b) => a - b);

    }

    lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

}

function setSelectionRange(start, end) {

    const from = Math.max(0, Math.min(start, end));
    const to = Math.min(lobbyEditorInput.value.length, Math.max(start, end));

    const next = [];

    for (let i = from; i < to; i++) {

        next.push(i);

    }

    lobbyEditor.selection = next;
    lobbyEditor.selectionActive = next.length > 0;

}

/* ---- rendering: overlay + preview ---- */

function escapeForMarkup(str) {

    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

function letterVisualClasses(style) {

    if (!style) {

        return "";

    }

    const classes = ["lobby-letter"];

    if (style.bold) classes.push("lobby-letter--bold");
    if (style.italic) classes.push("lobby-letter--italic");
    if (style.underline) classes.push("lobby-letter--underline");
    if (style.strikethrough) classes.push("lobby-letter--strike");

    return classes.join(" ");

}

function hexToRgbaString(hex, alpha) {

    const clean = (hex || "#000000").replace("#", "");

    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;

}

function letterOutlineCss(style) {

    if (!style || !style.ring) {

        return "";

    }

    const rgba = hexToRgbaString(style.ringColor || "#000000", typeof style.ringFade === "number" ? 1 - style.ringFade : 1);

    const w = 1.2;
    const offsets = [[w, 0], [-w, 0], [0, w], [0, -w]];

    if (style.ringJoin === "miter") {

        offsets.push([w, w], [w, -w], [-w, w], [-w, -w]);

    } else if (style.ringJoin === "bevel") {

        const d = w * 0.6;

        offsets.push([d, d], [d, -d], [-d, d], [-d, -d]);

    }

    const shadow = offsets.map(([x, y]) => `${x}px ${y}px 0 ${rgba}`).join(", ");

    return `text-shadow:${shadow};-webkit-text-stroke:0.4px ${rgba};`;

}

function letterInlineCss(style) {

    if (!style) {

        return "";

    }

    const rules = [];

    if (style.color) {

        rules.push(`color:${style.color}`);

    }

    if (style.font) {

        rules.push(`font-family:${style.font.previewFamily}`);

    }

    if (typeof style.fade === "number" && style.fade > 0) {

        rules.push(`opacity:${1 - style.fade}`);

    }

    return rules.join(";");

}

function renderLetterMarkup(char, style) {

    const escaped = escapeForMarkup(char);
    const classes = letterVisualClasses(style);
    const inlineCss = letterInlineCss(style);
    const outlineCss = letterOutlineCss(style);

    if (!classes && !inlineCss && !outlineCss) {

        return escaped;

    }

    const content = outlineCss
        ? `<i class="lobby-letter-ring" style="${outlineCss}">${escaped}</i>`
        : escaped;

    return `<span${classes ? ` class="${classes}"` : ""}${inlineCss ? ` style="${inlineCss}"` : ""}>${content}</span>`;

}

function redrawLobbyOverlay() {

    const text = lobbyEditorInput.value;
    const selectedSet = new Set(lobbyEditor.selection);

    let html = "";

    for (let i = 0; i < text.length; i++) {

        const style = letterStyleAt(i);
        const selected = selectedSet.has(i);
        const isCaret = lobbyEditor.caretShown && i === lobbyEditor.caret && !selected;

        const inner = renderLetterMarkup(text[i], style);

        const cellClasses = "lobby-letter-cell" +
            (selected ? " lobby-letter-cell--selected" : "") +
            (isCaret ? " lobby-letter-cell--caret" : "");

        html += `<span class="${cellClasses}" data-letter-index="${i}">${inner}</span>`;

    }

    lobbyEditorOverlay.innerHTML = html;
    lobbyEditorOverlay.scrollLeft = lobbyEditorInput.scrollLeft;

    const empty = text.length === 0;

    lobbyEditorWrap.classList.toggle("lobby-editor-wrap--empty", empty);

}

function refreshLobbyPreview() {

    const text = lobbyEditorInput.value;

    if (!text) {

        lobbyPreviewValue.textContent = "Type something to see the tag output";
        lobbyPreviewValue.classList.remove("lobby-preview-value--filled");

        if (lobbyVisualPreview) {

            lobbyVisualPreview.textContent = "Your styled lobby name will appear here";
            lobbyVisualPreview.classList.remove("lobby-visual-preview--filled");

        }

        return;

    }

    lobbyPreviewValue.textContent = compileLobbyRichText(text, lobbyEditor.letters);
    lobbyPreviewValue.classList.add("lobby-preview-value--filled");

    if (lobbyVisualPreview) {

        let previewMarkup = "";

        for (let i = 0; i < text.length; i++) {

            previewMarkup += renderLetterMarkup(text[i], letterStyleAt(i));

        }

        lobbyVisualPreview.innerHTML = previewMarkup;
        lobbyVisualPreview.classList.add("lobby-visual-preview--filled");

    }

}

/* ---- rich text compiling ---- */

function roundedFade(n) {

    return Math.round(n * 1000) / 1000;

}

function escapeForTag(str) {

    // Used for attribute values (e.g. color="...", family="...").
    // &quot; and &apos; are required here because the attribute is
    // wrapped in double quotes in the generated tag string.
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}

function escapeForTagContent(str) {

    // Used for the visible character content between tags.
    // &quot; and &apos; are NOT needed outside of attribute contexts
    // and must not be used here — they count as 6/6 characters toward
    // the lobby name limit instead of 1, which is the reported bug.
    // Only &amp;, &lt;, and &gt; are required in text content.
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

/*
 * Returns the ordered tag "slots" a letter needs (outermost first):
 * font wrapper, stroke wrapper, then b/i/u/s. Each slot carries a key
 * so the compiler can tell when two neighbouring letters share the
 * exact same open tag and merge them into one run instead of
 * re-opening/closing every single character.
 */
function tagSlotsForLetter(style) {

    const slots = [null, null, null, null, null, null];

    if (!style) {

        return slots;

    }

    const face = style.font ? style.font.face : null;
    const color = style.color || null;
    const fade = typeof style.fade === "number" && style.fade > 0 ? roundedFade(style.fade) : null;

    if (face || color || fade !== null) {

        const attrs = [];

        if (face) attrs.push(`family="${escapeForTag(face)}"`);
        if (color) attrs.push(`color="${escapeForTag(color)}"`);
        if (fade !== null) attrs.push(`transparency="${fade}"`);

        slots[0] = {
            key: `font|${face || ""}|${color || ""}|${fade === null ? "" : fade}`,
            open: `<font ${attrs.join(" ")}>`,
            close: "</font>"
        };

    }

    if (style.ring) {

        const ringColor = style.ringColor || "#000000";
        const ringFade = typeof style.ringFade === "number" && style.ringFade > 0 ? roundedFade(style.ringFade) : null;
        const join = style.ringJoin && style.ringJoin !== "round" ? style.ringJoin : null;
        const thickness = typeof style.ringThickness === "number" && style.ringThickness > 0 ? style.ringThickness : LOBBY_DEFAULT_STROKE_THICKNESS;

        const attrs = [`color="${escapeForTag(ringColor)}"`, `thickness="${thickness}"`];

        if (ringFade !== null) attrs.push(`transparency="${ringFade}"`);
        if (join) attrs.push(`joins="${join}"`);

        slots[1] = {
            key: `stroke|${ringColor}|${ringFade === null ? "" : ringFade}|${join || ""}|${thickness}`,
            open: `<stroke ${attrs.join(" ")}>`,
            close: "</stroke>"
        };

    }

    if (style.bold) slots[2] = { key: "b", open: "<b>", close: "</b>" };
    if (style.italic) slots[3] = { key: "i", open: "<i>", close: "</i>" };
    if (style.underline) slots[4] = { key: "u", open: "<u>", close: "</u>" };
    if (style.strikethrough) slots[5] = { key: "s", open: "<s>", close: "</s>" };

    return slots;

}

function compileLobbyRichText(text, letters) {

    let out = "";
    let open = [null, null, null, null, null, null];

    for (let i = 0; i < text.length; i++) {

        const desired = tagSlotsForLetter(letters[i] || null);

        let splitAt = open.length;

        for (let s = 0; s < open.length; s++) {

            const a = open[s] ? open[s].key : null;
            const b = desired[s] ? desired[s].key : null;

            if (a !== b) {

                splitAt = s;
                break;

            }

        }

        if (splitAt < open.length) {

            for (let s = open.length - 1; s >= splitAt; s--) {

                if (open[s]) out += open[s].close;

            }

            for (let s = splitAt; s < desired.length; s++) {

                if (desired[s]) out += desired[s].open;

            }

            open = desired;

        }

        out += escapeForTagContent(text[i]);

    }

    for (let s = open.length - 1; s >= 0; s--) {

        if (open[s]) out += open[s].close;

    }

    return out;

}

/* ---- applying styles to the current selection ---- */

function patchSelection(patch, commit = true) {

    if (!lobbyEditor.selection.length) {

        return false;

    }

    lobbyEditor.selection.forEach(i => {

        Object.assign(letterStyleForWrite(i), patch);

    });

    if (commit) {

        pushLobbySnapshot();

    }

    redrawLobbyOverlay();
    refreshLobbyPreview();

    return true;

}

function selectionHasStyle(prop) {

    if (!lobbyEditor.selection.length) {

        return "off";

    }

    let sawOn = false;
    let sawOff = false;

    for (const i of lobbyEditor.selection) {

        const style = letterStyleAt(i);
        const on = !!(style && style[prop]);

        if (on) sawOn = true; else sawOff = true;

        if (sawOn && sawOff) return "mixed";

    }

    return sawOn ? "on" : "off";

}

/* ---- gradient math (shared by the rainbow / stop-based presets) ---- */

const LOBBY_GRADIENT_KINDS = Object.freeze({
    RAINBOW: "rainbow",
    TWO_STOP: "two-stop",
    THREE_STOP: "three-stop",
    BOOKEND: "bookend"
});

function hexToTuple(hex) {

    const v = (hex || "#000000").replace("#", "");

    return [
        parseInt(v.slice(0, 2), 16) || 0,
        parseInt(v.slice(2, 4), 16) || 0,
        parseInt(v.slice(4, 6), 16) || 0
    ];

}

function tupleToHex(rgb) {

    return "#" + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

}

function lerpTuple(a, b, t) {

    return a.map((v, i) => v + (b[i] - v) * t);

}

function sampleAcrossStops(stops, t, wraps) {

    const value = wraps ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));

    for (let i = 0; i < stops.length - 1; i++) {

        if (value <= stops[i + 1].at) {

            const span = stops[i + 1].at - stops[i].at || 1;

            return lerpTuple(stops[i].rgb, stops[i + 1].rgb, (value - stops[i].at) / span);

        }

    }

    return stops[stops.length - 1].rgb;

}

function hueToTuple(hue) {

    const h = ((hue % 360) + 360) % 360;
    const x = 1 - Math.abs((h / 60) % 2 - 1);
    const sector = Math.floor(h / 60);

    const table = [
        [1, x, 0], [x, 1, 0], [0, 1, x],
        [0, x, 1], [x, 0, 1], [1, 0, x]
    ];

    return table[sector].map(v => v * 255);

}

function remapThroughDividers(t, dividers) {

    const from = [0, ...dividers, 1];
    const segments = from.length - 1;
    const to = Array.from({ length: segments + 1 }, (_, i) => i / segments);

    for (let i = 0; i < from.length - 1; i++) {

        if (t >= from[i] && t <= from[i + 1]) {

            const span = from[i + 1] - from[i] || 1;
            const localT = (t - from[i]) / span;

            return to[i] + (to[i + 1] - to[i]) * localT;

        }

    }

    return t;

}

function sampleStopGradient(colors, dividers, t) {

    const stops = colors.map((hex, i) => ({ at: i / (colors.length - 1), rgb: hexToTuple(hex) }));

    return sampleAcrossStops(stops, remapThroughDividers(t, dividers), false);

}

function sampleRainbowGradient(t, spin) {

    const stops = [];

    for (let i = 0; i <= 12; i++) {

        stops.push({ at: i / 12, rgb: hueToTuple((i / 12) * 360) });

    }

    return sampleAcrossStops(stops, t + spin, true);

}

function sampleBookendGradient(edgeHex, midHex, t, midPos) {

    const mid = Math.max(0.08, Math.min(0.92, midPos));

    return sampleAcrossStops([
        { at: 0, rgb: hexToTuple(edgeHex) },
        { at: mid, rgb: hexToTuple(midHex) },
        { at: 1, rgb: hexToTuple(edgeHex) }
    ], t, false);

}

function applyGradientToSelection(config) {

    if (!lobbyEditor.selection.length) {

        return false;

    }

    const n = lobbyEditor.selection.length;

    lobbyEditor.selection.forEach((letterIndex, k) => {

        const t = n <= 1 ? 0 : k / (n - 1);
        let rgb;

        switch (config.kind) {

            case LOBBY_GRADIENT_KINDS.RAINBOW:
                rgb = sampleRainbowGradient(t, config.dividers[0]);
                break;

            case LOBBY_GRADIENT_KINDS.TWO_STOP:
            case LOBBY_GRADIENT_KINDS.THREE_STOP:
                rgb = sampleStopGradient(config.colors, config.dividers, t);
                break;

            case LOBBY_GRADIENT_KINDS.BOOKEND:
                rgb = sampleBookendGradient(config.colors[0], config.colors[1], t, config.dividers[0]);
                break;

            default:
                return;

        }

        const style = letterStyleForWrite(letterIndex);
        const hex = tupleToHex(rgb);

        if (lobbyEditor.editingOutline) {

            style.ring = true;
            style.ringColor = hex;

        } else {

            style.color = hex;

        }

    });

    redrawLobbyOverlay();
    refreshLobbyPreview();

    return true;

}

/* ---- character index lookup from a pointer position (single row) ---- */

function letterIndexAtClientX(clientX) {

    const cells = lobbyEditorOverlay.querySelectorAll("[data-letter-index]");

    if (!cells.length) {

        return 0;

    }

    for (const cell of cells) {

        const rect = cell.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;

        if (clientX <= mid) {

            return Number(cell.getAttribute("data-letter-index"));

        }

        if (clientX <= rect.right) {

            return Number(cell.getAttribute("data-letter-index")) + 1;

        }

    }

    return lobbyEditorInput.value.length;

}

/* ---- history-of-generated-tags panel ---- */

function renderLobbyTagLog() {

    if (!lobbyHistoryList) {

        return;

    }

    lobbyHistoryList.innerHTML = "";

    if (!lobbyTagLog.length) {

        const empty = document.createElement("div");

        empty.className = "lobby-empty-row";
        empty.textContent = "nothing copied yet this visit";

        lobbyHistoryList.appendChild(empty);

        return;

    }

    lobbyTagLog.forEach(entry => {

        const row = document.createElement("div");

        row.className = "lobby-history-entry";
        row.textContent = entry;

        lobbyHistoryList.appendChild(row);

    });

}

function logCopiedTag(tagString) {

    lobbyTagLog.unshift(tagString);

    if (lobbyTagLog.length > LOBBY_TAG_HISTORY_LIMIT) {

        lobbyTagLog.length = LOBBY_TAG_HISTORY_LIMIT;

    }

    renderLobbyTagLog();

}

/*
 * Same click-to-copy confirmation flash used elsewhere on the site.
 */
function copyLobbyTags() {

    const text = lobbyEditorInput.value;

    if (!text) {

        return;

    }

    const compiled = compileLobbyRichText(text, lobbyEditor.letters);

    const finish = () => {

        lobbyCopyButtonText.textContent = "Copied!";
        lobbyCopyButton.classList.add("lobby-copy-button--copied");

        logCopiedTag(compiled);

        setTimeout(() => {

            lobbyCopyButtonText.textContent = "Copy";
            lobbyCopyButton.classList.remove("lobby-copy-button--copied");

        }, 1400);

    };

    if (navigator.clipboard && navigator.clipboard.writeText) {

        navigator.clipboard.writeText(compiled).then(finish).catch(finish);

    } else {

        finish();

    }

}

/* ================================================================
 * Wiring — element lookups
 * ================================================================ */

const lobbyEditorInput = document.getElementById("lobbyEditorInput");
const lobbyEditorOverlay = document.getElementById("lobbyEditorOverlay");
const lobbyEditorWrap = document.getElementById("lobbyEditorWrap");
const lobbyPreviewValue = document.getElementById("lobbyPreviewValue");
const lobbyVisualPreview = document.getElementById("lobbyVisualPreview");
const lobbyCopyButton = document.getElementById("lobbyCopyButton");
const lobbyCopyButtonText = document.getElementById("lobbyCopyButtonText");
const lobbyHistoryList = document.getElementById("lobbyHistoryList");

const lobbyFontToggle = document.getElementById("lobbyFontToggle");
const lobbyColorToggle = document.getElementById("lobbyColorToggle");
const lobbyStyleToggle = document.getElementById("lobbyStyleToggle");
const lobbyHighlightAllButton = document.getElementById("lobbyHighlightAllButton");

const lobbyFontPanel = document.getElementById("lobbyFontPanel");
const lobbyColorPanel = document.getElementById("lobbyColorPanel");
const lobbyStylePanel = document.getElementById("lobbyStylePanel");

let previousLobbyText = lobbyEditorInput ? lobbyEditorInput.value : "";

if (lobbyEditorInput) {

    lobbyEditor.history = [lobbySnapshot()];
    lobbyEditor.historyAt = 0;

}

/* ---- tool workspace open/close (Font / Color / Style) ----
   The three now share one inline workspace box that sits in normal
   document flow right under the toolbar (see .lobby-tool-workspace
   in lobby.css) instead of each floating independently in its own
   absolutely-positioned popover under its own button. That's what
   used to let Color's popover overlap Font's neighboring button, and
   let an open popover cover the title input sitting just below it.
   Each inline panel can now remain open independently, so Font,
   Color, and Style can be used together in one persistent stack. */

const lobbyToolWorkspace = document.getElementById("lobbyToolWorkspace");

const lobbySubPanels = [
    { button: lobbyFontToggle, panel: lobbyFontPanel },
    { button: lobbyColorToggle, panel: lobbyColorPanel },
    { button: lobbyStyleToggle, panel: lobbyStylePanel }
].filter(entry => entry.button && entry.panel);

function updateLobbyWorkspaceState() {

    if (!lobbyToolWorkspace) {

        return;

    }

    const anyOpen = lobbySubPanels.some(({ panel }) => panel.classList.contains("lobby-subpanel--open"));

    lobbyToolWorkspace.classList.toggle("lobby-tool-workspace--open", anyOpen);

}

function setLobbySubPanelOpen(panel, isOpen) {

    const entry = lobbySubPanels.find(e => e.panel === panel);

    if (!entry) {

        return;

    }

    entry.panel.classList.toggle("lobby-subpanel--open", isOpen);
    entry.button.classList.toggle("active", isOpen);

    updateLobbyWorkspaceState();

}

function closeAllLobbySubPanels() {

    lobbySubPanels.forEach(({ button, panel }) => {

        panel.classList.remove("lobby-subpanel--open");
        button.classList.remove("active");

    });

    updateLobbyWorkspaceState();

}

lobbySubPanels.forEach(({ button, panel }) => {

    button.addEventListener("click", () => {

        const isOpen = panel.classList.contains("lobby-subpanel--open");

        setLobbySubPanelOpen(panel, !isOpen);

    });

});

/*
 * Tool panels deliberately remain open while the person works
 * elsewhere in the Lobby Maker. That keeps a chosen font, color, or
 * style handy while typing, selecting letters, or using its controls.
 * A panel only closes when its own toolbar button is pressed again,
 * the Lobby Maker closes, or Reset is used.
 */

/* ---- toolbar sync (bold/italic/underline/strike + outline) ---- */

function setTriState(button, state) {

    if (!button) {

        return;

    }

    button.setAttribute("aria-pressed", state === "on" ? "true" : state === "mixed" ? "mixed" : "false");
    button.classList.toggle("is-mixed", state === "mixed");

}

const lobbySelectionSyncCallbacks = [];

function onLobbySelectionSync(fn) {

    lobbySelectionSyncCallbacks.push(fn);

}

const lobbyResetCallbacks = [];

function onLobbyReset(fn) {

    lobbyResetCallbacks.push(fn);

}

/*
 * "on"/"off"/"mixed" for a given style property, sourced from the
 * current highlight if one exists, or from the armed typing style
 * (what the next character typed will get) otherwise.
 */
function activeStyleState(prop) {

    if (lobbyEditor.selection.length) {

        return selectionHasStyle(prop);

    }

    return lobbyEditor.typingStyle[prop] ? "on" : "off";

}

function syncLobbyToolbar() {

    setTriState(document.getElementById("lobbyStyleBold"), activeStyleState("bold"));
    setTriState(document.getElementById("lobbyStyleItalic"), activeStyleState("italic"));
    setTriState(document.getElementById("lobbyStyleUnderline"), activeStyleState("underline"));
    setTriState(document.getElementById("lobbyStyleStrike"), activeStyleState("strikethrough"));

    if (lobbyHighlightAllButton && lobbyEditorInput) {

        const textLength = lobbyEditorInput.value.length;
        const allHighlighted = textLength > 0 && lobbyEditor.selection.length === textLength;

        lobbyHighlightAllButton.disabled = textLength === 0;
        lobbyHighlightAllButton.setAttribute("aria-pressed", allHighlighted ? "true" : "false");
        lobbyHighlightAllButton.classList.toggle("active", allHighlighted);

    }

    lobbySelectionSyncCallbacks.forEach(fn => fn());

}

if (lobbyHighlightAllButton && lobbyEditorInput) {

    lobbyHighlightAllButton.addEventListener("click", () => {

        const textLength = lobbyEditorInput.value.length;

        if (!textLength) {

            return;

        }

        setSelectionRange(0, textLength);
        lobbyEditor.caretShown = false;
        lobbyEditorInput.focus();
        lobbyEditorInput.setSelectionRange(0, textLength);

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

}

["lobbyStyleBold", "bold", "lobbyStyleItalic", "italic", "lobbyStyleUnderline", "underline", "lobbyStyleStrike", "strikethrough"]
    .reduce((pairs, value, index, arr) => {

        if (index % 2 === 0) pairs.push([value, arr[index + 1]]);

        return pairs;

    }, [])
    .forEach(([id, prop]) => {

        const btn = document.getElementById(id);

        if (!btn) {

            return;

        }

        btn.addEventListener("click", () => {

            const nowOn = activeStyleState(prop) !== "on";

            if (lobbyEditor.selection.length) {

                patchSelection({ [prop]: nowOn });

            } else {

                lobbyEditor.typingStyle[prop] = nowOn;

            }

            syncLobbyToolbar();

        });

    });

/* ---- font list ---- */

/*
 * All 15 of these are confirmed entries in Roblox's Font enum
 * (https://create.roblox.com/docs/reference/engine/enums/Font), picked
 * to span a wide range of looks (clean sans, condensed, mono, serif,
 * rounded/casual, marker, handwritten, heavy display, comic, gothic,
 * typewriter, techno, horror, quirky script, friendly sans) rather
 * than several near-duplicates. "face" is the rbxasset family path
 * Roblox's rich-text <font family="..."> tag expects; "previewFamily"
 * is just a close-enough web font stand-in so the in-browser editor
 * looks roughly right (Roblox's real fonts aren't available here).
 */
const LOBBY_FONT_CATALOG = [
    // previewFamily uses the same web font family used by the rendered
    // editor/preview instead of an unrelated browser fallback.
    { label: "Sans", face: "rbxasset://fonts/families/SourceSansPro.json", previewFamily: "'Source Sans Pro', sans-serif" },
    { label: "Condensed", face: "rbxasset://fonts/families/RobotoCondensed.json", previewFamily: "'Roboto Condensed', sans-serif" },
    { label: "Mono", face: "rbxasset://fonts/families/RobotoMono.json", previewFamily: "'Roboto Mono', monospace" },
    { label: "Serif", face: "rbxasset://fonts/families/Merriweather.json", previewFamily: "Merriweather, serif" },
    { label: "Rounded", face: "rbxasset://fonts/families/FredokaOne.json", previewFamily: "'Fredoka One', cursive" },
    { label: "Marker", face: "rbxasset://fonts/families/PermanentMarker.json", previewFamily: "'Permanent Marker', cursive" },
    { label: "Handwritten", face: "rbxasset://fonts/families/IndieFlower.json", previewFamily: "'Indie Flower', cursive" },
    { label: "Display", face: "rbxasset://fonts/families/LuckiestGuy.json", previewFamily: "'Luckiest Guy', cursive" },
    { label: "Comic", face: "rbxasset://fonts/families/Bangers.json", previewFamily: "Bangers, cursive" },
    { label: "Gothic", face: "rbxasset://fonts/families/GrenzeGotisch.json", previewFamily: "'Grenze Gotisch', serif" },
    { label: "Typewriter", face: "rbxasset://fonts/families/SpecialElite.json", previewFamily: "'Special Elite', monospace" },
    { label: "Techno", face: "rbxasset://fonts/families/Michroma.json", previewFamily: "Michroma, sans-serif" },
    { label: "Spooky", face: "rbxasset://fonts/families/Creepster.json", previewFamily: "Creepster, cursive" },
    { label: "Quirky", face: "rbxasset://fonts/families/AmaticSC.json", previewFamily: "'Amatic SC', cursive" },
    { label: "Friendly", face: "rbxasset://fonts/families/Nunito.json", previewFamily: "Nunito, sans-serif" }
];

const lobbyFontList = document.getElementById("lobbyFontList");
const lobbyFontButtonsByFace = new Map();

if (lobbyFontList) {

    LOBBY_FONT_CATALOG.forEach(font => {

        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "lobby-font-option";
        btn.setAttribute("aria-pressed", "false");
        btn.title = font.label;

        const name = document.createElement("span");

        name.className = "lobby-font-option-name";
        name.textContent = font.label;

        const preview = document.createElement("span");

        preview.className = "lobby-font-option-preview";
        preview.style.fontFamily = font.previewFamily;
        preview.textContent = "AaBbCc";

        btn.appendChild(name);
        btn.appendChild(preview);

        btn.addEventListener("click", () => {

            if (lobbyEditor.selection.length) {

                const alreadyThisFont = lobbyEditor.selection.every(i => {

                    const s = letterStyleAt(i);

                    return s && s.font && s.font.face === font.face;

                });

                patchSelection({ font: alreadyThisFont ? null : font });

            } else {

                const alreadyThisFont = lobbyEditor.typingStyle.font && lobbyEditor.typingStyle.font.face === font.face;

                lobbyEditor.typingStyle.font = alreadyThisFont ? null : font;

            }

            syncLobbyFontList();

        });

        lobbyFontButtonsByFace.set(font.face, btn);
        lobbyFontList.appendChild(btn);

    });

}

function syncLobbyFontList() {

    if (!lobbyEditor.selection.length) {

        const armedFace = lobbyEditor.typingStyle.font ? lobbyEditor.typingStyle.font.face : null;

        lobbyFontButtonsByFace.forEach((btn, face) => setTriState(btn, face === armedFace ? "on" : "off"));

        return;

    }

    const facesUsed = new Set(lobbyEditor.selection.map(i => {

        const s = letterStyleAt(i);

        return (s && s.font && s.font.face) || null;

    }));

    if (facesUsed.size > 1) {

        lobbyFontButtonsByFace.forEach(btn => setTriState(btn, "mixed"));

        return;

    }

    const uniform = facesUsed.values().next().value;

    lobbyFontButtonsByFace.forEach((btn, face) => setTriState(btn, face === uniform ? "on" : "off"));

}

/* Source: lobby-maker-styling.js */

onLobbySelectionSync(syncLobbyFontList);

/* ---- color picker: mode toggle, SV square, hue strip, hex, opacity, gradients ---- */

(function initLobbyColorPicker() {

    const modeButtons = document.querySelectorAll("[data-lobby-color-mode]");
    const sv = document.getElementById("lobbySv");
    const svCursor = document.getElementById("lobbySvCursor");
    const hue = document.getElementById("lobbyHue");
    const hueCursor = document.getElementById("lobbyHueCursor");
    const hexInput = document.getElementById("lobbyHexInput");
    const swatchCircle = document.getElementById("lobbyColorSwatch");
    const opacityInput = document.getElementById("lobbyOpacityInput");
    const opacityValue = document.getElementById("lobbyOpacityValue");
    const opacityLabel = document.getElementById("lobbyOpacityLabel");
    const outlineToggle = document.getElementById("lobbyOutlineToggle");
    const outlineJoinRow = document.getElementById("lobbyOutlineJoinRow");
    const gradientPresetRow = document.getElementById("lobbyGradientPresets");
    const gradientStopRow = document.getElementById("lobbyGradientStops");
    const gradientPill = document.getElementById("lobbyGradientPill");

    if (!sv || !hue || !hexInput) {

        return;

    }

    let hue360 = 300;
    let sat = 0.6;
    let val = 1;
    let syncingFromSelection = false;

    let gradient = {
        kind: LOBBY_GRADIENT_KINDS.RAINBOW,
        colors: ["#ff5cc8", "#00c8ff", "#ffffff"],
        dividers: [0.5]
    };

    let activeStop = 0;
    let gradientPointerId = null;

    function hsvToRgb(h, s, v) {

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r = 0, g = 0, b = 0;

        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }

        return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];

    }

    function rgbToHsv(r, g, b) {

        r /= 255; g /= 255; b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h = 0;

        if (d !== 0) {

            if (max === r) h = (60 * ((g - b) / d) + 360) % 360;
            else if (max === g) h = 60 * ((b - r) / d) + 120;
            else h = 60 * ((r - g) / d) + 240;

        }

        return [h, max === 0 ? 0 : d / max, max];

    }

    function currentModeIsGradient() {

        return lobbyColorPanel && lobbyColorPanel.dataset.mode === "gradient";

    }

    function applySolidColor(hex, commit) {

        if (!lobbyEditor.selection.length) {

            if (lobbyEditor.editingOutline) {

                lobbyEditor.typingStyle.ring = true;
                lobbyEditor.typingStyle.ringColor = hex;

            } else {

                lobbyEditor.typingStyle.color = hex;

            }

            return;

        }

        if (lobbyEditor.editingOutline) {

            patchSelection({ ring: true, ringColor: hex }, commit);

        } else {

            patchSelection({ color: hex }, commit);

        }

    }

    function pushFromHsv(commit) {

        const [r, g, b] = hsvToRgb(hue360, sat, val);
        const hex = tupleToHex([r, g, b]);

        hexInput.value = hex;

        if (swatchCircle) {

            swatchCircle.style.backgroundColor = hex;

            if (!syncingFromSelection) {

                swatchCircle.classList.remove("is-mixed");

            }

        }

        sv.style.setProperty("--lobby-hue", hue360);
        svCursor.style.left = `${sat * 100}%`;
        svCursor.style.top = `${(1 - val) * 100}%`;
        hueCursor.style.top = `${(1 - hue360 / 360) * 100}%`;

        if (syncingFromSelection) {

            return;

        }

        if (currentModeIsGradient()) {

            if (gradient.kind !== LOBBY_GRADIENT_KINDS.RAINBOW) {

                gradient.colors[activeStop] = hex;
                renderGradientStops();
                renderGradientPill();
                applyGradientToSelection(gradient);

            }

            return;

        }

        applySolidColor(hex, commit);

    }

    function pushFromHex(hex, commit) {

        const v = hex.replace("#", "");

        if (v.length !== 6) {

            return;

        }

        const [h, s, val2] = rgbToHsv(
            parseInt(v.slice(0, 2), 16),
            parseInt(v.slice(2, 4), 16),
            parseInt(v.slice(4, 6), 16)
        );

        hue360 = h;
        sat = s;
        val = val2;

        pushFromHsv(commit);

    }

    function gradientVisibleColors() {

        return gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW ? [] : gradient.colors;

    }

    function renderGradientStops() {

        if (!gradientStopRow) {

            return;

        }

        gradientStopRow.innerHTML = "";

        gradientVisibleColors().forEach((color, index) => {

            const chip = document.createElement("button");

            chip.type = "button";
            chip.className = "lobby-color-swatch lobby-gradient-stop";
            chip.style.backgroundColor = color;
            chip.classList.toggle("is-active", index === activeStop);
            chip.dataset.stopIndex = index;
            chip.setAttribute("aria-label", `Edit gradient color ${index + 1}`);

            gradientStopRow.appendChild(chip);

        });

    }

    function renderGradientPill() {

        if (!gradientPill) {

            return;

        }

        const colors = gradientVisibleColors();
        const slices = 40;

        gradientPill.innerHTML = "";

        for (let i = 0; i < slices; i++) {

            const t = i / (slices - 1);
            let rgb;

            if (gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW) {

                rgb = sampleRainbowGradient(t, gradient.dividers[0]);

            } else if (gradient.kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

                rgb = sampleBookendGradient(colors[0], colors[1], t, gradient.dividers[0]);

            } else {

                rgb = sampleStopGradient(colors, gradient.dividers, t);

            }

            const slice = document.createElement("div");

            slice.className = "lobby-gradient-slice";
            slice.style.backgroundColor = tupleToHex(rgb);

            gradientPill.appendChild(slice);

        }

        gradient.dividers.forEach((pos, index) => {

            const handle = document.createElement("button");

            handle.type = "button";
            handle.className = "lobby-gradient-handle";
            handle.style.left = `${pos * 100}%`;
            handle.dataset.handleIndex = index;
            handle.setAttribute("aria-label", "Move gradient handle");

            gradientPill.appendChild(handle);

        });

    }

    function setGradientKind(kind) {

        gradient.kind = kind;
        activeStop = 0;

        if (lobbyColorPanel) {

            lobbyColorPanel.classList.toggle("lobby-color-panel--rainbow", kind === LOBBY_GRADIENT_KINDS.RAINBOW);

        }

        if (kind === LOBBY_GRADIENT_KINDS.TWO_STOP || kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

            gradient.colors = [hexInput.value || "#ff5cc8", "#ffffff"];

        } else if (kind === LOBBY_GRADIENT_KINDS.THREE_STOP) {

            gradient.colors = ["#ff5cc8", hexInput.value || "#ffffff", "#00c8ff"];

        } else {

            gradient.colors = ["#ff5cc8", "#00c8ff", "#ffffff"];

        }

        if (kind === LOBBY_GRADIENT_KINDS.THREE_STOP) {

            gradient.dividers = [0.33, 0.67];

        } else if (kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

            gradient.dividers = [0.3];

        } else {

            gradient.dividers = [0.5];

        }

        renderGradientPill();
        renderGradientStops();

        if (!lobbyEditor.selection.length && lobbyEditorInput.value.length) {

            setSelectionRange(0, lobbyEditorInput.value.length);
            redrawLobbyOverlay();
            syncLobbyToolbar();

        }

        applyGradientToSelection(gradient);

        if (lobbyEditor.selection.length) {

            pushLobbySnapshot();

        }

    }

    function setColorMode(mode) {

        if (!lobbyColorPanel) {

            return;

        }

        lobbyColorPanel.dataset.mode = mode;

        lobbyColorPanel.classList.toggle(
            "lobby-color-panel--rainbow",
            mode === "gradient" && gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW
        );

        modeButtons.forEach(btn => {

            const active = btn.dataset.lobbyColorMode === mode;

            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");

        });

        if (mode === "gradient") {

            renderGradientPill();
            renderGradientStops();

        }

    }

    modeButtons.forEach(btn => {

        btn.addEventListener("click", () => setColorMode(btn.dataset.lobbyColorMode));

    });

    if (gradientPresetRow) {

        gradientPresetRow.addEventListener("click", e => {

            const btn = e.target.closest("[data-lobby-gradient-kind]");

            if (!btn) {

                return;

            }

            setGradientKind(btn.dataset.lobbyGradientKind);

        });

    }

    if (gradientStopRow) {

        gradientStopRow.addEventListener("click", e => {

            const chip = e.target.closest("[data-stop-index]");

            if (!chip) {

                return;

            }

            activeStop = Number(chip.dataset.stopIndex);
            renderGradientStops();

            syncingFromSelection = true;
            pushFromHex(gradient.colors[activeStop], false);
            syncingFromSelection = false;

        });

    }

    if (gradientPill) {

        gradientPill.addEventListener("pointerdown", e => {

            const handle = e.target.closest(".lobby-gradient-handle");

            if (!handle) {

                return;

            }

            gradientPointerId = e.pointerId;

            try { gradientPill.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

            const handleIndex = Number(handle.dataset.handleIndex);

            const onMove = event => {

                const rect = gradientPill.getBoundingClientRect();

                let pos = (event.clientX - rect.left) / rect.width;

                pos = Math.max(0.04, Math.min(0.96, pos));

                const prev = gradient.dividers[handleIndex - 1];
                const next = gradient.dividers[handleIndex + 1];

                if (prev !== undefined) pos = Math.max(prev + 0.04, pos);
                if (next !== undefined) pos = Math.min(next - 0.04, pos);

                gradient.dividers[handleIndex] = pos;

                renderGradientPill();
                applyGradientToSelection(gradient);

            };

            const onUp = event => {

                if (event.pointerId !== gradientPointerId) return;

                gradientPill.removeEventListener("pointermove", onMove);
                gradientPill.removeEventListener("pointerup", onUp);
                gradientPill.removeEventListener("pointercancel", onUp);
                gradientPointerId = null;

                pushLobbySnapshot();

            };

            gradientPill.addEventListener("pointermove", onMove);
            gradientPill.addEventListener("pointerup", onUp);
            gradientPill.addEventListener("pointercancel", onUp);

            e.preventDefault();

        });

    }

    if (gradientPresetRow) {

        const syncPresetDisabled = () => {

            gradientPresetRow.querySelectorAll("[data-lobby-gradient-kind]").forEach(btn => {

                const disabled = lobbyEditor.selection.length === 0;

                btn.setAttribute("aria-disabled", disabled ? "true" : "false");
                btn.classList.toggle("is-disabled", disabled);

            });

        };

        onLobbySelectionSync(syncPresetDisabled);
        syncPresetDisabled();

    }

    /* SV square dragging */

    let svDragging = false;
    let svPointerId = null;

    function updateSvFromPoint(clientX, clientY) {

        const rect = sv.getBoundingClientRect();

        sat = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        val = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        pushFromHsv(false);

    }

    sv.addEventListener("pointerdown", e => {

        if (e.button !== 0) return;

        svDragging = true;
        svPointerId = e.pointerId;

        try { sv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

        updateSvFromPoint(e.clientX, e.clientY);

    });

    sv.addEventListener("pointermove", e => {

        if (!svDragging || e.pointerId !== svPointerId) return;

        updateSvFromPoint(e.clientX, e.clientY);

    });

    ["pointerup", "pointercancel"].forEach(evt => {

        sv.addEventListener(evt, e => {

            if (svPointerId !== null && e.pointerId !== svPointerId) return;

            if (svDragging) {

                svDragging = false;
                svPointerId = null;

                pushLobbySnapshot();

            }

        });

    });

    /* Hue strip dragging */

    let hueDragging = false;

    function updateHueFromPoint(clientY) {

        const rect = hue.getBoundingClientRect();

        let y = (clientY - rect.top) / rect.height;

        y = Math.max(0, Math.min(1, y));
        hue360 = (1 - y) * 360;

        pushFromHsv(false);

    }

    hue.addEventListener("pointerdown", e => {

        hueDragging = true;

        try { hue.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

        updateHueFromPoint(e.clientY);

    });

    hue.addEventListener("pointermove", e => {

        if (hueDragging) updateHueFromPoint(e.clientY);

    });

    ["pointerup", "pointercancel"].forEach(evt => {

        hue.addEventListener(evt, () => {

            if (hueDragging) {

                hueDragging = false;
                pushLobbySnapshot();

            }

        });

    });

    /* hex input */

    function normalizeHex(raw) {

        let v = (raw || "").trim();

        if (v && !v.startsWith("#")) v = "#" + v;

        return v;

    }

    function isValidHex(v) {

        return /^#[0-9a-fA-F]{6}$/.test(v);

    }

    hexInput.addEventListener("input", () => {

        const v = normalizeHex(hexInput.value);

        if (isValidHex(v)) pushFromHex(v, false);

    });

    hexInput.addEventListener("change", () => {

        const v = normalizeHex(hexInput.value);

        if (isValidHex(v)) {

            hexInput.value = v;
            pushFromHex(v, true);

        }

    });

    if (swatchCircle) {

        swatchCircle.addEventListener("click", () => {

            hexInput.focus();
            hexInput.select();

        });

    }

    /* opacity slider */

    function opacityPropName() {

        return lobbyEditor.editingOutline ? "ringFade" : "fade";

    }

    function setOpacityUi(fade) {

        if (opacityLabel) {

            opacityLabel.textContent = lobbyEditor.editingOutline ? "Outline opacity" : "Opacity";

        }

        const pct = Math.round((1 - fade) * 100);

        if (opacityInput) opacityInput.value = pct;
        if (opacityValue) opacityValue.textContent = `${pct}%`;

    }

    if (opacityInput) {

        opacityInput.addEventListener("input", () => {

            const fade = 1 - Number(opacityInput.value) / 100;

            setOpacityUi(fade);

            if (!lobbyEditor.selection.length) {

                lobbyEditor.typingStyle[opacityPropName()] = fade;

                if (lobbyEditor.editingOutline) lobbyEditor.typingStyle.ring = true;

                return;

            }

            const patch = { [opacityPropName()]: fade };

            if (lobbyEditor.editingOutline) patch.ring = true;

            patchSelection(patch, false);

        });

        opacityInput.addEventListener("change", () => {

            if (lobbyEditor.selection.length) {

                pushLobbySnapshot();

            }

        });

    }

    /* outline toggle + join popup */

    if (outlineToggle) {

        outlineToggle.setAttribute("aria-pressed", "false");

        outlineToggle.addEventListener("click", () => {

            lobbyEditor.editingOutline = !lobbyEditor.editingOutline;

            outlineToggle.setAttribute("aria-pressed", lobbyEditor.editingOutline ? "true" : "false");
            outlineToggle.classList.toggle("active", lobbyEditor.editingOutline);

            if (outlineJoinRow) {

                outlineJoinRow.classList.toggle("lobby-outline-joins--open", lobbyEditor.editingOutline);

            }

            syncColorPickerFromSelection();
            syncLobbyToolbar();

        });

    }

    if (outlineJoinRow) {

        outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

            btn.addEventListener("click", () => {

                if (lobbyEditor.selection.length) {

                    patchSelection({ ringJoin: btn.dataset.lobbyJoin });

                } else {

                    lobbyEditor.typingStyle.ring = true;
                    lobbyEditor.typingStyle.ringJoin = btn.dataset.lobbyJoin;

                }

                syncOutlineJoinButtons();

            });

        });

    }

    function syncOutlineJoinButtons() {

        if (!outlineJoinRow) {

            return;

        }

        if (!lobbyEditor.selection.length) {

            const armed = lobbyEditor.typingStyle.ring ? (lobbyEditor.typingStyle.ringJoin || "round") : null;

            outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

                btn.setAttribute("aria-pressed", armed !== null && btn.dataset.lobbyJoin === armed ? "true" : "false");

            });

            return;

        }

        const joins = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return (s && s.ringJoin) || "round";

        });

        const uniform = joins.length && joins.every(j => j === joins[0]) ? joins[0] : null;

        outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

            btn.setAttribute("aria-pressed", uniform !== null && btn.dataset.lobbyJoin === uniform ? "true" : "false");

        });

    }

    onLobbySelectionSync(syncOutlineJoinButtons);

    /* keep the picker's displayed color/opacity matched to selection */

    function syncColorPickerFromSelection() {

        if (!lobbyEditor.selection.length) {

            const colorProp = lobbyEditor.editingOutline ? "ringColor" : "color";
            const fadeProp = lobbyEditor.editingOutline ? "ringFade" : "fade";

            const fade = typeof lobbyEditor.typingStyle[fadeProp] === "number" ? lobbyEditor.typingStyle[fadeProp] : 0;

            setOpacityUi(fade);

            if (swatchCircle) swatchCircle.classList.remove("is-mixed");

            const armedHex = lobbyEditor.typingStyle[colorProp];

            if (armedHex) {

                syncingFromSelection = true;
                pushFromHex(armedHex, false);
                syncingFromSelection = false;

            }

            return;

        }

        const colorProp = lobbyEditor.editingOutline ? "ringColor" : "color";
        const fadeProp = lobbyEditor.editingOutline ? "ringFade" : "fade";

        const fades = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return s && typeof s[fadeProp] === "number" ? s[fadeProp] : 0;

        });

        setOpacityUi(fades.every(f => f === fades[0]) ? fades[0] : 0);

        const colors = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return (s && s[colorProp]) || null;

        });

        const uniform = colors.every(c => c === colors[0]);

        if (swatchCircle) {

            swatchCircle.classList.toggle("is-mixed", !uniform);

        }

        if (uniform && colors[0]) {

            syncingFromSelection = true;
            pushFromHex(colors[0], false);
            syncingFromSelection = false;

        }

    }

    onLobbySelectionSync(syncColorPickerFromSelection);

    onLobbyReset(() => {

        hue360 = 300;
        sat = 0.6;
        val = 1;
        activeStop = 0;

        gradient = {
            kind: LOBBY_GRADIENT_KINDS.RAINBOW,
            colors: ["#ff5cc8", "#00c8ff", "#ffffff"],
            dividers: [0.5]
        };

        if (outlineToggle) {

            outlineToggle.setAttribute("aria-pressed", "false");
            outlineToggle.classList.remove("active");

        }

        if (outlineJoinRow) {

            outlineJoinRow.classList.remove("lobby-outline-joins--open");

        }

        setColorMode("solid");
        renderGradientPill();
        renderGradientStops();

        syncingFromSelection = true;
        pushFromHex("#ff5cc8", false);
        syncingFromSelection = false;

    });

    setColorMode("solid");
    renderGradientPill();
    pushFromHsv(false);

})();

/* ---- text input wiring: edits, selection, keyboard, undo/redo ---- */

if (lobbyEditorInput) {

    lobbyEditorInput.addEventListener("input", () => {

        if (lobbyEditor.restoring) {

            return;

        }

        reconcileLettersAfterEdit(lobbyEditorInput.value, previousLobbyText);
        previousLobbyText = lobbyEditorInput.value;

        pushLobbySnapshot();
        clearLobbySelection();
        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("scroll", () => {

        lobbyEditorOverlay.scrollLeft = lobbyEditorInput.scrollLeft;

    });

    lobbyEditorInput.addEventListener("beforeinput", e => {

        if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {

            e.preventDefault();

        }

    });

    function captureNativeSelection() {

        const start = lobbyEditorInput.selectionStart;
        const end = lobbyEditorInput.selectionEnd;

        if (start === end) {

            return;

        }

        setSelectionRange(start, end);
        lobbyEditor.caretShown = false;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    }

    lobbyEditorInput.addEventListener("select", captureNativeSelection);
    lobbyEditorInput.addEventListener("mouseup", captureNativeSelection);

    lobbyEditorInput.addEventListener("click", e => {

        if (lobbyEditorInput.selectionStart !== lobbyEditorInput.selectionEnd) {

            return;

        }

        const index = letterIndexAtClientX(e.clientX);

        if (index >= lobbyEditorInput.value.length) {

            clearLobbySelection();
            redrawLobbyOverlay();
            refreshLobbyPreview();
            syncLobbyToolbar();

            return;

        }

        lobbyEditorInput.setSelectionRange(index, index);

        lobbyEditor.selection = [index];
        lobbyEditor.selectionActive = true;
        lobbyEditor.caretShown = false;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("keydown", e => {

        const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight";

        if (!isArrow || e.ctrlKey || e.metaKey || e.altKey) {

            return;

        }

        const len = lobbyEditorInput.value.length;

        if (!len) {

            return;

        }

        e.preventDefault();

        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const target = Math.max(0, Math.min(len - 1, lobbyEditor.caret + dir));

        lobbyEditor.caret = target;
        lobbyEditor.caretShown = true;

        if (e.shiftKey) {

            const next = new Set(lobbyEditor.selection);

            next.add(target);

            lobbyEditor.selection = [...next].sort((a, b) => a - b);

        } else {

            lobbyEditor.selection = [target];

        }

        lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("blur", () => {

        lobbyEditor.caretShown = false;
        redrawLobbyOverlay();

    });

}

/* Source: lobby-maker-actions.js */

document.addEventListener("mousedown", e => {

    if (!lobbyEditorInput || !lobbyEditorWrap) {

        return;

    }

    if (!(e.ctrlKey || e.metaKey)) {

        return;

    }

    if (!lobbyEditorWrap.contains(e.target)) {

        return;

    }

    e.preventDefault();

    const index = letterIndexAtClientX(e.clientX);

    if (index >= lobbyEditorInput.value.length) {

        return;

    }

    lobbyEditorInput.focus();
    lobbyEditorInput.setSelectionRange(index, index);

    toggleIndexInSelection(index);

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

});

document.addEventListener("keydown", e => {

    if (!lobbyEditorInput) {

        return;

    }

    const withinLobbyPanel = document.activeElement === lobbyEditorInput ||
        (lobbyPanel && lobbyPanel.contains(document.activeElement));

    if (!withinLobbyPanel) {

        return;

    }

    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    if (ctrlOrCmd && (e.key === "z" || e.key === "Z")) {

        e.preventDefault();

        if (e.shiftKey) lobbyRedo(); else lobbyUndo();

        return;

    }

    if (ctrlOrCmd && (e.key === "y" || e.key === "Y")) {

        e.preventDefault();
        lobbyRedo();
        return;

    }

    if (ctrlOrCmd && (e.key === "q" || e.key === "Q")) {

        e.preventDefault();

        clearLobbySelection();
        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    }

});

if (lobbyCopyButton) {

    lobbyCopyButton.addEventListener("click", copyLobbyTags);

}

/* ---- reset: wipes the whole panel back to its starting state ---- */

function resetLobbyMaker() {

    lobbyEditorInput.value = "";
    previousLobbyText = "";

    lobbyEditor.letters = [];
    lobbyEditor.selection = [];
    lobbyEditor.selectionActive = false;
    lobbyEditor.caret = 0;
    lobbyEditor.caretShown = false;
    lobbyEditor.editingOutline = false;
    lobbyEditor.typingStyle = blankTypingStyle();

    lobbyEditor.history = [lobbySnapshot()];
    lobbyEditor.historyAt = 0;

    lobbyTagLog.length = 0;

    closeAllLobbySubPanels();

    lobbyResetCallbacks.forEach(fn => fn());

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();
    renderLobbyTagLog();

}

const lobbyResetButton = document.getElementById("lobbyResetButton");

if (lobbyResetButton) {

    attachClickAction(
        lobbyResetButton,
        resetLobbyMaker,
        typeof playPurifySound === "function" ? playPurifySound : (typeof playUtilitySound === "function" ? playUtilitySound : undefined)
    );

}

/* ---- panel shell: toggle button, sliding panel, mutual exclusion ---- */

const lobbyToggleButton = document.getElementById("lobbyToggleButton");
const lobbyPanel = document.getElementById("lobbyPanel");
const lobbyBackButton = document.getElementById("lobbyBackButton");

function setLobbyPanelOpen(isOpen) {

    if (!lobbyPanel || !lobbyToggleButton) {

        return;

    }

    if (isOpen) {

        if (typeof setUpgradePanelOpen === "function") setUpgradePanelOpen(false);
        if (typeof setDeathPanelOpen === "function") setDeathPanelOpen(false);
        if (typeof setAltarsPanelOpen === "function") setAltarsPanelOpen(false);

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

if (lobbyBackButton) {

    attachClickAction(lobbyBackButton, () => {

        setLobbyPanelOpen(false);

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

}

const leftPanelElForLobby = document.querySelector(".left-panel");

function updateLobbyLeftPanelAccent() {

    if (!leftPanelElForLobby || !lobbyPanel) {

        return;

    }

    leftPanelElForLobby.classList.toggle("left-panel--lobby", lobbyPanel.classList.contains("open"));

}

if (lobbyPanel) {

    const lobbyAccentObserver = new MutationObserver(updateLobbyLeftPanelAccent);

    lobbyAccentObserver.observe(lobbyPanel, { attributes: true, attributeFilter: ["class"] });

}

updateLobbyLeftPanelAccent();

if (lobbyEditorInput) {

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

}

renderLobbyTagLog();

/* Source: visual-effects.js */
/* Source: particles.js */
/*
 * Ambient Particle Field
 * --------------------------
 * A lightweight canvas-based particle layer that drifts subtly
 * behind the app's content (sits between the background image
 * layer and the panels - see #particleCanvas in index.html, same
 * z-index tier as #bgLayer). Purely decorative and never intercepts
 * pointer events.
 *
 * Color theme syncs with whichever panel is open (purple default,
 * blue Upgrade Shop, red Death Tracker) by watching the same
 * .left-panel--upgrades / .left-panel--death classes that script.js
 * already toggles for the sidebar accent.
 *
 * Fully customizable at runtime through window.NullscapeParticles,
 * and through the small settings popover added next to the mute
 * button in the header. Settings persist in localStorage.
 *
 * Depends on globals defined in script.js (attachClickAction,
 * playUtilitySound, playRemoveSound) only for the settings UI's
 * button feedback sounds - the particle field itself has no
 * dependency on them and will run fine without them.
 */

(function () {

    const STORAGE_KEY = "nullscapeParticleConfig";
    const DEFAULT_OFF_MIGRATION_KEY = "nullscapeParticlesDefaultOffV1";

    const THEMES = {
        default: ["#b866ff", "#d59bff", "#7a2fc4"],
        upgrades: ["#8fd9ff", "#00c8ff", "#1c6f96"],
        death: ["#ff6b6b", "#ff9d9d", "#ae1313"]
    };

    const DEFAULT_CONFIG = {
        enabled: false,
        density: 150,  // particles per ~1,000,000px^2 of viewport
        speed: 1,      // multiplier on drift speed
        size: 2.5,     // multiplier on particle radius
        opacity: 1.5,  // multiplier on base opacity
        theme: "auto", // "auto" follows the open panel, or a hex color
        twinkle: true,
        connect: false // faint connecting lines between nearby particles
    };

    let config = { ...DEFAULT_CONFIG };

    function loadConfig() {

        try {

            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return;
            }

            const saved = JSON.parse(raw);

            config = { ...DEFAULT_CONFIG, ...saved };

            // Apply the new default once for people who saved settings before
            // particles became opt-in. Afterwards, their own toggle choice is
            // respected on future visits.
            if (!localStorage.getItem(DEFAULT_OFF_MIGRATION_KEY)) {

                config.enabled = false;
                localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
                localStorage.setItem(DEFAULT_OFF_MIGRATION_KEY, "true");

            }

        } catch (error) {

            console.warn("couldn't load particle config:", error);

        }

    }

    function saveConfig() {

        try {

            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

        } catch (error) {

            console.warn("couldn't save particle config:", error);

        }

    }

    const prefersReducedMotion = Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const canvas = document.getElementById("particleCanvas");

    if (!canvas) {

        console.warn("Particles.js: #particleCanvas not found in the page, skipping.");
        return;

    }

    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let currentThemeKey = "default";
    let mouseX = 0;
    let mouseY = 0;
    let animationFrame = null;

    function shouldAnimate() {
        return config.enabled
            && !prefersReducedMotion
            && !document.documentElement.classList.contains("low-detail-mode");
    }

    function randomBetween(min, max) {

        return min + Math.random() * (max - min);

    }

    function pickColor() {

        if (config.theme !== "auto" && /^#/.test(config.theme)) {

            return config.theme;

        }

        const palette = THEMES[currentThemeKey] || THEMES.default;

        return palette[Math.floor(Math.random() * palette.length)];

    }

    function hexToRgba(hex, alpha) {

        const clean = hex.replace("#", "");

        const full = clean.length === 3
            ? clean.split("").map(c => c + c).join("")
            : clean;

        const bigint = parseInt(full, 16) || 0;

        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;

    }

    function createParticle() {

        return {
            x: Math.random() * width,
            y: Math.random() * height,
            baseRadius: randomBetween(0.6, 2.1),
            vx: randomBetween(-0.06, 0.06),
            vy: randomBetween(-0.16, -0.03),
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: randomBetween(0.002, 0.006),
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: randomBetween(0.01, 0.025),
            color: pickColor()
        };

    }

    function getTargetCount() {

        if (!config.enabled) {
            return 0;
        }

        const area = width * height;

        return Math.round((area / 1000000) * config.density);

    }

    function seedParticles() {

        const target = getTargetCount();

        if (particles.length > target) {

            particles.length = target;

        } else {

            while (particles.length < target) {

                particles.push(createParticle());

            }

        }

    }

    function resize() {

        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        seedParticles();

    }

    function drawConnections() {

        const maxDist = 90;

        for (let i = 0; i < particles.length; i++) {

            for (let j = i + 1; j < particles.length; j++) {

                const a = particles[i];
                const b = particles[j];

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {

                    const alpha = (1 - dist / maxDist) * 0.08 * config.opacity;

                    ctx.strokeStyle = hexToRgba(a.color, alpha);
                    ctx.lineWidth = 0.6;

                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();

                }

            }

        }

    }

    function step() {

        ctx.clearRect(0, 0, width, height);

        if (shouldAnimate()) {

            const parallaxX = ((mouseX / width) - 0.5) * 10;
            const parallaxY = ((mouseY / height) - 0.5) * 10;

            for (const p of particles) {

                p.wobble += p.wobbleSpeed;
                p.twinklePhase += p.twinkleSpeed;

                p.x += p.vx * config.speed + Math.sin(p.wobble) * 0.03;
                p.y += p.vy * config.speed;

                if (p.y < -10) {

                    p.y = height + 10;
                    p.x = Math.random() * width;

                }

                if (p.x < -10) {
                    p.x = width + 10;
                }

                if (p.x > width + 10) {
                    p.x = -10;
                }

                const twinkle = config.twinkle
                    ? (0.55 + 0.45 * Math.sin(p.twinklePhase))
                    : 1;

                const alpha = 0.35 * config.opacity * twinkle;
                const radius = p.baseRadius * config.size;

                ctx.beginPath();
                ctx.fillStyle = hexToRgba(p.color, alpha);
                ctx.arc(p.x + parallaxX, p.y + parallaxY, radius, 0, Math.PI * 2);
                ctx.fill();

            }

            if (config.connect) {

                drawConnections();

            }

        }

        if (shouldAnimate()) {
            animationFrame = requestAnimationFrame(step);
        } else {
            animationFrame = null;
        }

    }

    function refreshAnimationState() {
        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        ctx.clearRect(0, 0, width, height);

        if (shouldAnimate()) {
            seedParticles();
            step();
        }
    }

    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", event => {

        mouseX = event.clientX;
        mouseY = event.clientY;

    });

    function detectTheme() {

        const leftPanel = document.querySelector(".left-panel");

        if (!leftPanel) {
            return "default";
        }

        if (leftPanel.classList.contains("left-panel--upgrades")) {
            return "upgrades";
        }

        if (leftPanel.classList.contains("left-panel--death")) {
            return "death";
        }

        return "default";

    }

    function syncTheme() {

        const next = detectTheme();

        if (next !== currentThemeKey) {

            currentThemeKey = next;

            // Recolor everything immediately - each particle's own
            // twinkle fade masks the swap so it still reads as
            // smooth rather than a hard cut.
            particles.forEach(p => {

                p.color = pickColor();

            });

        }

    }

    const leftPanelEl = document.querySelector(".left-panel");

    if (leftPanelEl) {

        const themeObserver = new MutationObserver(syncTheme);

        themeObserver.observe(leftPanelEl, { attributes: true, attributeFilter: ["class"] });

    }

    // ---- Public API ----
    window.NullscapeParticles = {

        setConfig(partial) {

            config = { ...config, ...partial };

            saveConfig();
            seedParticles();
            refreshAnimationState();

            if (typeof window.refreshParticleSettingsUI === "function") {

                window.refreshParticleSettingsUI();

            }

        },

        getConfig() {

            return { ...config };

        },

        reset() {

            config = { ...DEFAULT_CONFIG };

            saveConfig();
            seedParticles();
            refreshAnimationState();

            if (typeof window.refreshParticleSettingsUI === "function") {

                window.refreshParticleSettingsUI();

            }

        }

    };

    window.addEventListener("nullscape-low-detail-change", refreshAnimationState);

    loadConfig();
    resize();
    syncTheme();
    refreshAnimationState();

    /*
     * ---- Settings popover ----
     * A small "particle field" button dropped next to the existing
     * mute toggle in the header, opening a compact card of sliders
     * (density/speed/size/opacity), an auto-vs-custom color choice,
     * an optional connecting-lines mode, and a reset button. Same
     * switch/button visual language as the rest of the site.
     */
    function buildSettingsUI() {

        const settingsContainer = document.getElementById("settingsPanel");
        const headerControls = document.querySelector(".site-header-controls");

        if ((!settingsContainer && !headerControls) || document.getElementById("particleSettingsButton")) {

            return;

        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "particleSettingsButton";
        button.className = settingsContainer
            ? "settings-option particle-settings-button"
            : "mute-toggle-button particle-settings-button";
        button.setAttribute("aria-label", "Particle effect settings");
        button.setAttribute("aria-expanded", "false");
        button.title = "Customize ambient particles";
        button.innerHTML = settingsContainer
            ? "PARTICLE FIELD"
            : '<span class="particle-settings-icon">&#10022;</span>';

        const panel = document.createElement("div");

        panel.id = "particleSettingsPanel";
        panel.className = "particle-settings-panel";
        panel.setAttribute("role", "dialog");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="particle-settings-header-row">
                <div class="particle-settings-heading">PARTICLE FIELD</div>
                <button type="button" id="particleCloseButton" class="particle-close-button" aria-label="Close particle settings">&times;</button>
            </div>

            <button type="button" id="particleEnabledToggle" class="upgrade-switch particle-enabled-switch" role="switch">
                <span class="upgrade-switch-track"><span class="upgrade-switch-thumb"></span></span>
                <span class="upgrade-switch-label">ON</span>
            </button>

            <label class="particle-settings-row">
                <span>Density</span>
                <input type="range" id="particleDensityInput" min="0" max="150" step="5">
                <span class="particle-settings-value" id="particleDensityValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Speed</span>
                <input type="range" id="particleSpeedInput" min="0.2" max="3" step="0.1">
                <span class="particle-settings-value" id="particleSpeedValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Size</span>
                <input type="range" id="particleSizeInput" min="0.5" max="2.5" step="0.1">
                <span class="particle-settings-value" id="particleSizeValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Opacity</span>
                <input type="range" id="particleOpacityInput" min="0.2" max="1.5" step="0.1">
                <span class="particle-settings-value" id="particleOpacityValue"></span>
            </label>

            <label class="particle-settings-row particle-settings-row--color">
                <span>Color</span>
                <select id="particleThemeSelect">
                    <option value="auto">Auto (match panel)</option>
                    <option value="custom">Custom</option>
                </select>
                <input type="color" id="particleColorInput" value="#b866ff">
            </label>

            <label class="particle-settings-row particle-settings-row--checkbox">
                <span>Connecting lines</span>
                <input type="checkbox" id="particleConnectInput">
            </label>

            <button type="button" id="particleResetButton" class="upgrade-reset-button particle-reset-button">
                <span class="btn-label">RESET</span>
            </button>
        `;

        document.body.appendChild(panel);

        const muteButton = document.getElementById("muteToggleButton");

        if (settingsContainer) {

            settingsContainer.appendChild(button);

        } else if (muteButton) {

            headerControls.insertBefore(button, muteButton);

        } else {

            headerControls.appendChild(button);

        }

        function positionPanel() {

            const rect = button.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 240;

            // Anchor the panel's left edge to the button's left edge
            // so it opens rightward into the page - the button sits
            // near the left edge of the 400px sidebar, so anchoring
            // via `right` (panel's right edge to the button) pushed
            // the whole panel further left, off the visible screen.
            // Still clamped so it can't overflow the right edge of
            // the viewport either.
            const maxLeft = window.innerWidth - panelWidth - 8;
            const left = Math.min(rect.left, maxLeft);

            panel.style.top = (rect.bottom + 8) + "px";
            panel.style.left = Math.max(8, left) + "px";
            panel.style.right = "auto";

        }

        function openPanel() {

            panel.hidden = false;
            button.setAttribute("aria-expanded", "true");
            button.classList.add("active");
            positionPanel();

        }

        function closePanel() {

            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("active");

        }

        button.addEventListener("click", event => {

            // Stop this click from also reaching the document-level
            // "click outside closes it" listener below - without
            // this, a click on the button's icon (a child element)
            // opens the panel and then immediately closes it again
            // in the very same click, since that listener only
            // checked for an exact match against the button element
            // itself.
            event.stopPropagation();

            if (panel.hidden) {
                openPanel();
            } else {
                closePanel();
            }

            if (typeof playUtilitySound === "function") {

                playUtilitySound();

            }

        });

        const closeButton = panel.querySelector("#particleCloseButton");

        closeButton.addEventListener("click", event => {

            event.stopPropagation();
            closePanel();

            if (typeof playUtilitySound === "function") {

                playUtilitySound();

            }

        });

        document.addEventListener("click", event => {

            // button.contains(...) instead of a strict !== check, so
            // this only fires for genuine clicks outside both the
            // button and the panel - not for clicks on something
            // nested inside the button (its icon span) or the panel
            // (its sliders, dropdown, etc).
            if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) {

                closePanel();

            }

        });

        document.addEventListener("keydown", event => {

            if (event.key === "Escape" && !panel.hidden) {

                closePanel();

            }

        });

        window.addEventListener("resize", () => {

            if (!panel.hidden) {

                positionPanel();

            }

        });

        const enabledToggle = panel.querySelector("#particleEnabledToggle");
        const densityInput = panel.querySelector("#particleDensityInput");
        const densityValue = panel.querySelector("#particleDensityValue");
        const speedInput = panel.querySelector("#particleSpeedInput");
        const speedValue = panel.querySelector("#particleSpeedValue");
        const sizeInput = panel.querySelector("#particleSizeInput");
        const sizeValue = panel.querySelector("#particleSizeValue");
        const opacityInput = panel.querySelector("#particleOpacityInput");
        const opacityValue = panel.querySelector("#particleOpacityValue");
        const themeSelect = panel.querySelector("#particleThemeSelect");
        const colorInput = panel.querySelector("#particleColorInput");
        const connectInput = panel.querySelector("#particleConnectInput");
        const resetButton = panel.querySelector("#particleResetButton");

        function refresh() {

            const cfg = window.NullscapeParticles.getConfig();

            enabledToggle.classList.toggle("active", cfg.enabled);
            enabledToggle.setAttribute("aria-checked", cfg.enabled ? "true" : "false");
            enabledToggle.querySelector(".upgrade-switch-label").textContent = cfg.enabled ? "ON" : "OFF";

            densityInput.value = cfg.density;
            densityValue.textContent = cfg.density;

            speedInput.value = cfg.speed;
            speedValue.textContent = cfg.speed.toFixed(1) + "x";

            sizeInput.value = cfg.size;
            sizeValue.textContent = cfg.size.toFixed(1) + "x";

            opacityInput.value = cfg.opacity;
            opacityValue.textContent = cfg.opacity.toFixed(1) + "x";

            const isCustom = cfg.theme !== "auto";

            themeSelect.value = isCustom ? "custom" : "auto";
            colorInput.value = isCustom ? cfg.theme : "#b866ff";
            colorInput.style.visibility = isCustom ? "visible" : "hidden";

            connectInput.checked = cfg.connect;

        }

        window.refreshParticleSettingsUI = refresh;

        enabledToggle.addEventListener("click", () => {

            window.NullscapeParticles.setConfig({ enabled: !window.NullscapeParticles.getConfig().enabled });

        });

        densityInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ density: Number(densityInput.value) });

        });

        speedInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ speed: Number(speedInput.value) });

        });

        sizeInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ size: Number(sizeInput.value) });

        });

        opacityInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ opacity: Number(opacityInput.value) });

        });

        themeSelect.addEventListener("change", () => {

            if (themeSelect.value === "auto") {

                window.NullscapeParticles.setConfig({ theme: "auto" });

            } else {

                window.NullscapeParticles.setConfig({ theme: colorInput.value });

            }

        });

        colorInput.addEventListener("input", () => {

            themeSelect.value = "custom";

            window.NullscapeParticles.setConfig({ theme: colorInput.value });

        });

        connectInput.addEventListener("change", () => {

            window.NullscapeParticles.setConfig({ connect: connectInput.checked });

        });

        resetButton.addEventListener("click", () => {

            window.NullscapeParticles.reset();

            if (typeof playRemoveSound === "function") {

                playRemoveSound();

            }

        });

        refresh();

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", buildSettingsUI);

    } else {

        buildSettingsUI();

    }

})();

/* Source: spotlight.js */
/*
 * Tools Spotlight
 * --------------------------
 * A one-time-per-visit highlight pointing at the floating Upgrades/
 * Deaths/Altars buttons in the bottom-right corner, for anyone who's
 * only ever touched the curse tracker and might not notice there's
 * more here. Dims the rest of the page, leaves a clear "window"
 * exactly around those buttons, and shows a small callout explaining
 * what they are.
 *
 * Shows again on every page load by design (not just once ever) -
 * that's what was asked for - until the person dismisses it with
 * "Don't show again", which is the only thing that persists via
 * localStorage. Plain "Got it" only closes it for this visit.
 *
 * Fully self-contained: no dependency on script.js globals, so load
 * order relative to the other feature scripts doesn't matter.
 */

(function () {

    const STORAGE_KEY = "nullscapeHideToolsSpotlight";
    const SHOW_DELAY_MS = 900;
    const FADE_OUT_MS = 250;

    function shouldShow() {

        try {

            return localStorage.getItem(STORAGE_KEY) !== "true";

        } catch (error) {

            // If storage is unavailable for some reason, default to
            // showing it rather than silently never showing it.
            return true;

        }

    }

    function hidePermanently() {

        try {

            localStorage.setItem(STORAGE_KEY, "true");

        } catch (error) {

            console.warn("couldn't save spotlight dismissal:", error);

        }

    }

    let elements = null;
    let resizeHandler = null;
    let keydownHandler = null;

    /*
     * Positions the four dimming panels (top/bottom/left/right)
     * around the target's bounding box, leaving that exact rectangle
     * completely uncovered - not punched via a mask or box-shadow
     * trick, just four rectangles filling in everywhere else. That
     * means the target itself needs no pointer-events workaround: it
     * was never covered by anything to begin with, so it's already
     * at full brightness and fully clickable underneath.
     */
    function position(target) {

        if (!elements) {

            return;

        }

        const rect = target.getBoundingClientRect();
        const padding = 10;

        const rectTop = Math.max(0, rect.top - padding);
        const rectLeft = Math.max(0, rect.left - padding);
        const rectRight = Math.min(window.innerWidth, rect.right + padding);
        const rectBottom = Math.min(window.innerHeight, rect.bottom + padding);

        const width = rectRight - rectLeft;
        const height = rectBottom - rectTop;

        elements.top.style.height = rectTop + "px";

        elements.bottom.style.top = rectBottom + "px";

        elements.left.style.top = rectTop + "px";
        elements.left.style.width = rectLeft + "px";
        elements.left.style.height = height + "px";

        elements.right.style.top = rectTop + "px";
        elements.right.style.left = rectRight + "px";
        elements.right.style.height = height + "px";

        elements.ring.style.top = rectTop + "px";
        elements.ring.style.left = rectLeft + "px";
        elements.ring.style.width = width + "px";
        elements.ring.style.height = height + "px";

        // Callout sits above the target, right-aligned to it, and
        // clamps to stay fully on-screen. On short viewports where
        // there's no room above, it drops below the target instead
        // and flips its little arrow to match.
        const calloutWidth = elements.callout.offsetWidth || 280;
        const calloutHeight = elements.callout.offsetHeight || 150;
        const gap = 16;

        let calloutLeft = rectRight - calloutWidth;

        calloutLeft = Math.max(12, Math.min(calloutLeft, window.innerWidth - calloutWidth - 12));

        let calloutTop = rectTop - calloutHeight - gap;
        let below = false;

        if (calloutTop < 12) {

            calloutTop = rectBottom + gap;
            below = true;

        }

        elements.callout.style.left = calloutLeft + "px";
        elements.callout.style.top = calloutTop + "px";
        elements.callout.classList.toggle("tools-spotlight-callout--below", below);

    }

    function close(neverAgain) {

        if (!elements) {

            return;

        }

        if (neverAgain) {

            hidePermanently();

        }

        const { overlay } = elements;

        overlay.classList.remove("tools-spotlight-overlay--visible");

        if (resizeHandler) {

            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;

        }

        if (keydownHandler) {

            document.removeEventListener("keydown", keydownHandler);
            keydownHandler = null;

        }

        setTimeout(() => {

            overlay.remove();
            elements = null;

        }, FADE_OUT_MS);

    }

    function buildSpotlight(target) {

        const overlay = document.createElement("div");

        overlay.className = "tools-spotlight-overlay";

        const top = document.createElement("div");
        const bottom = document.createElement("div");
        const left = document.createElement("div");
        const right = document.createElement("div");

        top.className = "tools-spotlight-panel tools-spotlight-panel--top";
        bottom.className = "tools-spotlight-panel tools-spotlight-panel--bottom";
        left.className = "tools-spotlight-panel tools-spotlight-panel--left";
        right.className = "tools-spotlight-panel tools-spotlight-panel--right";

        [top, bottom, left, right].forEach(panel => {

            panel.addEventListener("click", () => close(false));

        });

        const ring = document.createElement("div");

        ring.className = "tools-spotlight-ring";

        const callout = document.createElement("div");

        callout.className = "tools-spotlight-callout";
        callout.innerHTML = ""
            + '<div class="tools-spotlight-callout-arrow"></div>'
            + '<div class="tools-spotlight-callout-title">More tools live down here</div>'
            + '<div class="tools-spotlight-callout-body">'
            + "The curse tracker isn't the only thing on this page - the "
            + "Upgrade Calculator, Death Tracker, and Altars buttons are "
            + "right there too."
            + "</div>"
            + '<div class="tools-spotlight-callout-actions">'
            + '<button type="button" class="tools-spotlight-dismiss-button" id="toolsSpotlightGotIt">Got it</button>'
            + '<button type="button" class="tools-spotlight-neveragain-button" id="toolsSpotlightNeverAgain">Don\'t show again</button>'
            + "</div>";

        overlay.append(top, bottom, left, right, ring, callout);
        document.body.appendChild(overlay);

        elements = { overlay, top, bottom, left, right, ring, callout };

        position(target);

        // Double rAF so the browser commits the initial (zero-opacity)
        // state to a frame before the "visible" class kicks off the
        // fade-in transition - a single rAF can still land in the
        // same paint in some browsers and skip the transition.
        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                overlay.classList.add("tools-spotlight-overlay--visible");

            });

        });

        callout.querySelector("#toolsSpotlightGotIt").addEventListener("click", () => close(false));
        callout.querySelector("#toolsSpotlightNeverAgain").addEventListener("click", () => close(true));

    }

    function open() {

        const target = document.querySelector(".floating-toggle-buttons");

        // Nothing to point at if the person has collapsed the buttons
        // away with the arrow toggle - the ring would frame empty space.
        if (!target || target.classList.contains("collapsed")) {

            return;

        }

        buildSpotlight(target);

        resizeHandler = () => position(target);
        window.addEventListener("resize", resizeHandler);

        keydownHandler = event => {

            if (event.key === "Escape") {

                close(false);

            }

        };

        document.addEventListener("keydown", keydownHandler);

    }

    function init() {

        if (!shouldShow()) {

            return;

        }

        setTimeout(open, SHOW_DELAY_MS);

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", init);

    } else {

        init();

    }

})();


/* Source: site-utilities.js */
/* Source: feedback.js */
/*
 * Feedback / Suggestions
 * --------------------------
 * A small popover (same shape/pattern as the particle settings
 * popover in Particles.js) that lets a visitor type a suggestion or
 * bug report and send it straight to a Discord channel via a
 * webhook - no backend needed. Opens from a glowing "envelope +
 * Feedback" pill dropped into the header controls, next to
 * mute/particles.
 *
 * The "From" field is prefilled with the username the person picked
 * on their first visit (saved by presence.js under the same
 * localStorage key below) and stays editable, so every message
 * arrives in Discord labeled with who sent it.
 *
 * NOTE: the webhook URL below is visible to anyone who views this
 * site's source, since this is a static page with no server. If it
 * gets abused (spam, flooding), regenerate the webhook in Discord's
 * Integrations settings and swap the URL here.
 */

(function () {

    const WEBHOOK_URL = "https://discord.com/api/webhooks/1551104793592864879/LpqVlT8oA1Uc8asE-7SmJqSo2GiomDVB6rGgnjLRkNFUymYOcEOuNTNQxehqMGYO0IUO";

    const MAX_LENGTH = 800;
    const MAX_FROM_LENGTH = 32;

    // Same key presence.js saves the first-visit username under.
    const USERNAME_KEY = "nullscape_username";

    const PLACEHOLDER = "let me know if you want something added! i'll likely add it here, if not then you can send anything here lol just don't spam and don't be weird.";

    // Very light throttle so one person mashing "send" can't spam
    // the channel - purely client-side, easy to bypass, but stops
    // accidental double-sends and casual abuse.
    const COOLDOWN_MS = 15000;
    let lastSentAt = 0;

    function getStoredUsername() {

        try {

            return localStorage.getItem(USERNAME_KEY) || "";

        } catch (error) {

            return "";

        }

    }

    function buildUI() {

        const headerControls = document.querySelector(".site-header-controls");

        if (!headerControls || document.getElementById("feedbackButton")) {

            return;

        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "feedbackButton";
        button.className = "mute-toggle-button feedback-button";
        button.setAttribute("aria-label", "Send feedback or a suggestion");
        button.setAttribute("aria-expanded", "false");
        button.title = "Send feedback or a suggestion";
        button.innerHTML = '<span class="feedback-icon">&#9993;</span><span class="feedback-label">Feedback</span>';

        const panel = document.createElement("div");

        panel.id = "feedbackPanel";
        panel.className = "feedback-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Send feedback or a suggestion");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="feedback-header-row">
                <div class="feedback-heading">SUGGESTION / FEEDBACK</div>
                <button type="button" id="feedbackCloseButton" class="particle-close-button" aria-label="Close feedback">&times;</button>
            </div>

            <label class="feedback-from-row" for="feedbackFromInput">
                <span class="feedback-from-label">From:</span>
                <input
                    type="text"
                    id="feedbackFromInput"
                    class="feedback-from-input"
                    maxlength="${MAX_FROM_LENGTH}"
                    placeholder="your name or alias"
                    autocomplete="off"
                    spellcheck="false"
                >
            </label>

            <textarea
                id="feedbackTextarea"
                class="feedback-textarea"
                maxlength="${MAX_LENGTH}"
                spellcheck="true"
            ></textarea>

            <div class="feedback-footer-row">
                <span class="feedback-char-count" id="feedbackCharCount">0 / ${MAX_LENGTH}</span>
                <button type="button" id="feedbackSubmitButton" class="feedback-submit-button">
                    <span class="btn-label">Send</span>
                </button>
            </div>

            <div class="feedback-status" id="feedbackStatus" role="status" aria-live="polite"></div>
        `;

        document.body.appendChild(panel);

        const muteButton = document.getElementById("muteToggleButton");

        if (muteButton) {

            headerControls.insertBefore(button, muteButton);

        } else {

            headerControls.appendChild(button);

        }

        // Settings stays immediately to Feedback's right, even though this
        // button is created dynamically after the page markup is parsed.
        const settingsButton = document.getElementById("settingsToggleButton");

        if (settingsButton) {

            headerControls.appendChild(settingsButton);

        }

        const textarea = panel.querySelector("#feedbackTextarea");
        const fromInput = panel.querySelector("#feedbackFromInput");
        const charCount = panel.querySelector("#feedbackCharCount");
        const submitButton = panel.querySelector("#feedbackSubmitButton");
        const statusEl = panel.querySelector("#feedbackStatus");
        const closeButton = panel.querySelector("#feedbackCloseButton");

        // Set via the property (not inside the template literal) so the
        // apostrophe in "i'll" never has to be escaped in markup.
        textarea.placeholder = PLACEHOLDER;

        // Once the person edits the From box themselves, stop
        // overwriting it from storage on later opens.
        let fromEdited = false;

        fromInput.addEventListener("input", () => {

            fromEdited = true;

        });

        function syncFromField() {

            // Re-read on every open: on a first visit the username
            // gate (presence.js) may not have been filled in yet when
            // this script ran.
            if (!fromEdited) {

                fromInput.value = getStoredUsername();

            }

        }

        function positionPanel() {

            const rect = button.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 280;

            const maxLeft = window.innerWidth - panelWidth - 8;
            const left = Math.min(rect.left, maxLeft);

            panel.style.top = (rect.bottom + 8) + "px";
            panel.style.left = Math.max(8, left) + "px";
            panel.style.right = "auto";

        }

        function openPanel() {

            syncFromField();

            panel.hidden = false;
            button.setAttribute("aria-expanded", "true");
            button.classList.add("active");
            positionPanel();

            // If the name is already filled in, go straight to the
            // message; otherwise let them fill in the name first.
            if (fromInput.value.trim()) {

                textarea.focus();

            } else {

                fromInput.focus();

            }

        }

        function closePanel() {

            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("active");

        }

        button.addEventListener("click", event => {

            event.stopPropagation();

            if (panel.hidden) {
                openPanel();
            } else {
                closePanel();
            }

            if (typeof playUtilitySound === "function") {

                playUtilitySound();

            }

        });

        closeButton.addEventListener("click", event => {

            event.stopPropagation();
            closePanel();

            if (typeof playUtilitySound === "function") {

                playUtilitySound();

            }

        });

        document.addEventListener("click", event => {

            if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) {

                closePanel();

            }

        });

        document.addEventListener("keydown", event => {

            if (event.key === "Escape" && !panel.hidden) {

                closePanel();

            }

        });

        window.addEventListener("resize", () => {

            if (!panel.hidden) {

                positionPanel();

            }

        });

        textarea.addEventListener("input", () => {

            charCount.textContent = `${textarea.value.length} / ${MAX_LENGTH}`;

        });

        function setStatus(text, isError) {

            statusEl.textContent = text;
            statusEl.classList.toggle("feedback-status--error", Boolean(isError));

        }

        async function submitFeedback() {

            const message = textarea.value.trim();

            if (!message) {

                setStatus("Type something first.", true);
                return;

            }

            const now = Date.now();

            if (now - lastSentAt < COOLDOWN_MS) {

                const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastSentAt)) / 1000);

                setStatus(`Please wait ${waitSeconds}s before sending again.`, true);
                return;

            }

            const from = fromInput.value.trim() || "Anonymous";

            submitButton.disabled = true;
            setStatus("Sending...", false);

            try {

                const response = await fetch(WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: `**New suggestion/feedback:**\n**From:** ${from}\n\n${message}`,

                        // The webhook URL is public, so make sure a
                        // message can never ping @everyone/@here or
                        // any role/user, whatever gets typed in.
                        allowed_mentions: { parse: [] }
                    })
                });

                if (!response.ok) {

                    throw new Error(`Webhook responded with ${response.status}`);

                }

                lastSentAt = now;

                textarea.value = "";
                charCount.textContent = `0 / ${MAX_LENGTH}`;

                setStatus("Sent - thank you!", false);

                if (typeof playPurifySound === "function") {

                    playPurifySound();

                }

                setTimeout(() => {

                    closePanel();
                    setStatus("", false);

                }, 1400);

            } catch (error) {

                console.warn("couldn't send feedback:", error);
                setStatus("Couldn't send - try again later.", true);

                if (typeof playRemoveSound === "function") {

                    playRemoveSound();

                }

            } finally {

                submitButton.disabled = false;

            }

        }

        submitButton.addEventListener("click", submitFeedback);

        function submitOnCtrlEnter(event) {

            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {

                event.preventDefault();
                submitFeedback();

            }

        }

        textarea.addEventListener("keydown", submitOnCtrlEnter);
        fromInput.addEventListener("keydown", submitOnCtrlEnter);

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", buildUI);

    } else {

        buildUI();

    }

})();

/* Source: update-check.js */
/*
 * Update check
 * --------------------------
 * Lets people who already have the site open pick up a new deploy
 * without having to know to refresh.
 *
 * How it works: the site ships a tiny version.json next to
 * Toolkits.html. Every visitor's page reads it once on load (that's
 * the version they're running) and then again every minute, and
 * whenever they switch back to the tab. When the number in the file
 * changes, a toast slides up: "New update available - refreshing in
 * 1:00", with a Refresh now button and a note that their run
 * is saved automatically (curses, upgrades and deaths all live in
 * localStorage, so a refresh doesn't lose them).
 *
 * To push an update to everyone who's online: change the "version"
 * value in version.json in the same commit as the code changes (any
 * new value works - a date, a counter, whatever). Because the file
 * deploys together with the code, nobody is told to refresh before
 * the new code is actually live.
 *
 * It never yanks the page out from under someone mid-task: if any
 * text box has unsent text in it (the lobby name, a feedback
 * message, ...) it skips the automatic refresh and just leaves the
 * toast up until they choose to refresh.
 *
 * Self-contained: no dependency on the other scripts (only uses
 * playUtilitySound for the button click if it happens to exist).
 * Does nothing when the page is opened straight from disk (file://),
 * since version.json can't be fetched there.
 */

(function () {

    const VERSION_URL = "version.json";

    const CHECK_INTERVAL_MS = 60000;
    const COUNTDOWN_SECONDS = 60;

    // A short personal note shown above the update copy, so it reads
    // like a heads-up from a person rather than a generic system
    // toast. Edit this string whenever you want the note to say
    // something different for a given update - it's just plain text,
    // no markup needed.
    const HAZU_NOTE = "hazu here! i just updated something on this website just now, so this page is about to refresh to grab it.";

    let loadedVersion = null;
    let updateShown = false;

    let toast = null;
    let textEl = null;
    let barEl = null;

    let countdownTimer = null;
    let deadline = 0;

    async function fetchVersion() {

        try {

            // no-store + a throwaway query string so neither the browser
            // cache nor the host's CDN can hand back an old copy.
            const url = new URL(VERSION_URL, document.baseURI);

            url.searchParams.set("_", Date.now());

            const response = await fetch(url.href, { cache: "no-store" });

            if (!response.ok) {

                return null;

            }

            const data = await response.json();

            return data && data.version !== undefined && data.version !== null
                ? String(data.version)
                : null;

        } catch (error) {

            return null;

        }

    }

    async function check() {

        if (updateShown) {

            return;

        }

        const version = await fetchVersion();

        if (version === null) {

            return;

        }

        // First successful read = the version this page is running.
        if (loadedVersion === null) {

            loadedVersion = version;

            return;

        }

        if (version !== loadedVersion) {

            showUpdate();

        }

    }

    /*
     * True if a reload would throw something away: any textarea with
     * text in it (lobby name, feedback message) or a text box the
     * person is in the middle of typing in.
     */
    function hasUnsavedText() {

        const boxes = Array.from(document.querySelectorAll("textarea"));

        if (boxes.some(box => box.value.trim().length > 0)) {

            return true;

        }

        const active = document.activeElement;

        return Boolean(
            active
            && active.tagName === "INPUT"
            && active.type === "text"
            && active.value.trim().length > 0
        );

    }

    function playClick() {

        if (typeof playUtilitySound === "function") {

            playUtilitySound();

        }

    }

    /*
     * Static hosts usually let files sit in the browser cache for
     * several minutes, and a plain reload only re-checks the page
     * itself - so without this the reload could still run the old
     * scripts/styles. Re-download the page's own files first (this
     * refreshes the cache entries), then reload.
     */
    async function refreshNow() {

        stopCountdown();

        if (toast) {

            toast.classList.add("update-toast--busy");

            if (textEl) {

                textEl.textContent = "Refreshing...";

            }

        }

        const urls = new Set([location.href]);

        document.querySelectorAll("script[src], link[rel~='stylesheet'][href]").forEach(element => {

            try {

                const url = new URL(element.src || element.href, document.baseURI);

                if (url.origin === location.origin) {

                    urls.add(url.href);

                }

            } catch (error) {

                // ignore anything that isn't a valid URL

            }

        });

        await Promise.all(Array.from(urls).map(url => fetch(url, { cache: "reload" }).catch(() => {})));

        location.reload();

    }

    function stopCountdown() {

        if (countdownTimer) {

            clearInterval(countdownTimer);
            countdownTimer = null;

        }

    }

    /*
     * Leaves the toast up with just a Refresh button - used only when
     * there's unsent text, so an automatic refresh would lose it.
     */
    function enterManualMode(reason) {

        stopCountdown();

        if (!toast) {

            return;

        }

        toast.classList.add("update-toast--manual");

        if (textEl) {

            textEl.textContent = reason === "typing"
                ? "You have unsent text, so it won't refresh on its own. Refresh when you're ready."
                : "Refresh whenever you're ready.";

        }

        if (barEl) {

            barEl.style.transition = "none";
            barEl.style.width = "0%";

        }

    }

    // HAZU_NOTE is a hardcoded constant above, not user input, but
    // this keeps the innerHTML assignment safe even if that string
    // is ever edited to include something like an apostrophe-heavy
    // sentence with stray angle brackets.
    function escapeHtmlForToast(str) {

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }

    function formatTime(totalSeconds) {

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return minutes + ":" + String(seconds).padStart(2, "0");

    }

    /*
     * Counts down against a fixed deadline instead of subtracting one
     * per tick: browsers slow timers down in background tabs, which
     * would stretch a tick-counted 2 minutes out far longer.
     */
    function tickCountdown() {

        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

        if (remaining <= 0) {

            stopCountdown();

            if (hasUnsavedText()) {

                enterManualMode("typing");

            } else {

                refreshNow();

            }

            return;

        }

        textEl.textContent = `Refreshing in ${formatTime(remaining)} to load it.`;

    }

    function startCountdown() {

        deadline = Date.now() + COUNTDOWN_SECONDS * 1000;

        // Shrinks the progress bar over the whole countdown.
        barEl.style.transition = "none";
        barEl.style.width = "100%";

        void barEl.offsetWidth;

        barEl.style.transition = `width ${COUNTDOWN_SECONDS}s linear`;
        barEl.style.width = "0%";

        tickCountdown();

        countdownTimer = setInterval(tickCountdown, 1000);

    }

    function showUpdate() {

        updateShown = true;

        toast = document.createElement("div");

        toast.className = "update-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");

        toast.innerHTML = `
            <div class="update-toast-main">
                <span class="update-toast-icon" aria-hidden="true">&#10227;</span>

                <div class="update-toast-copy">
                    <div class="update-toast-title">New update available</div>
                    <div class="update-toast-text" id="updateToastText"></div>
                </div>
            </div>

            <div class="update-toast-hazu-note">${escapeHtmlForToast(HAZU_NOTE)}</div>

            <div class="update-toast-note">
                <span class="update-toast-note-icon" aria-hidden="true">&#10003;</span>
                <span>Your run is saved automatically - curses, upgrades, and deaths carry over after the refresh.</span>
            </div>

            <div class="update-toast-actions">
                <button type="button" class="update-toast-button update-toast-button--primary" id="updateToastRefresh">Refresh now</button>
            </div>

            <div class="update-toast-bar-track"><div class="update-toast-bar" id="updateToastBar"></div></div>
        `;

        document.body.appendChild(toast);

        textEl = toast.querySelector("#updateToastText");
        barEl = toast.querySelector("#updateToastBar");

        toast.querySelector("#updateToastRefresh").addEventListener("click", () => {

            playClick();
            refreshNow();

        });

        // Next frame so the slide-in has a starting state to animate from.
        requestAnimationFrame(() => {

            toast.classList.add("update-toast--visible");

        });

        startCountdown();

    }

    document.addEventListener("visibilitychange", () => {

        if (document.visibilityState === "visible") {

            if (countdownTimer) {

                tickCountdown();

            }

            check();

        }

    });

    setInterval(check, CHECK_INTERVAL_MS);

    check();

})();

/* Source: settings.js */
/* Settings panel controls that depend on the main app's persisted preferences. */
(function () {
    const panel = document.getElementById("settingsPanel");
    const openButton = document.getElementById("settingsToggleButton");
    const closeButton = document.getElementById("settingsCloseButton");
    const sfxButton = document.getElementById("settingsSfxToggle");
    function setOpen(open) { if (!panel || !openButton) return; panel.hidden = !open; openButton.setAttribute("aria-expanded", String(open)); if (open) document.dispatchEvent(new CustomEvent("nullscape-settings-opened")); }
    if (openButton) openButton.addEventListener("click", () => setOpen(panel.hidden));
    if (closeButton) closeButton.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", event => { if (event.key === "Escape") setOpen(false); });
    function refreshSfx() { if (!sfxButton || !window.NullscapeSound) return; const enabled = !window.NullscapeSound.isMuted(); sfxButton.setAttribute("aria-pressed", String(enabled)); sfxButton.textContent = `SFX: ${enabled ? "ON" : "OFF"}`; }
    if (sfxButton) sfxButton.addEventListener("click", () => { if (window.NullscapeSound) window.NullscapeSound.setMuted(!window.NullscapeSound.isMuted()); refreshSfx(); });
    window.addEventListener("nullscape-sound-change", refreshSfx);
    refreshSfx();

}());

/* Source: settings-spotlight.js */
/*
 * Settings Spotlight
 * --------------------------
 * A first-visit highlight that points at the settings (⚙) button
 * and recommends Low Detail Mode for anyone on a slower PC or
 * running a CPU/GPU-intensive Nullscape session.
 *
 * Behaviour mirrors tools-spotlight.js:
 *   - Shows on every page load until permanently dismissed.
 *   - "Got it"          → closes for this visit only.
 *   - "Don't show again" → closes and sets localStorage so it never
 *                          appears again.
 *   - Clicking the dim panels or pressing Escape → same as "Got it".
 *   - If the user opens the settings panel themselves before
 *     dismissing, the spotlight closes automatically (they found it!).
 *
 * Depends on nothing in script.js - safe to load in any order.
 */

(function () {

    const STORAGE_KEY  = "nullscapeHideSettingsSpotlight";
    const SHOW_DELAY_MS = 1600;   // staggered after the tools spotlight (900 ms)
    const FADE_OUT_MS  = 250;

    // ─── persistence ──────────────────────────────────────────────

    function shouldShow() {
        try {
            return localStorage.getItem(STORAGE_KEY) !== "true";
        } catch (_) {
            return true;
        }
    }

    function hidePermanently() {
        try {
            localStorage.setItem(STORAGE_KEY, "true");
        } catch (err) {
            console.warn("settings spotlight: couldn't save dismissal:", err);
        }
    }

    // ─── state ────────────────────────────────────────────────────

    let elements       = null;
    let resizeHandler  = null;
    let keydownHandler = null;
    let panelOpenHandler = null;

    // ─── positioning ──────────────────────────────────────────────

    /*
     * Same four-panel strategy as tools-spotlight: four opaque rects
     * fill every area except a padded window around the target,
     * leaving the button itself untouched and fully clickable.
     */
    function position(target) {
        if (!elements) return;

        const rect    = target.getBoundingClientRect();
        const padding = 12;

        const rectTop    = Math.max(0, rect.top    - padding);
        const rectLeft   = Math.max(0, rect.left   - padding);
        const rectRight  = Math.min(window.innerWidth,  rect.right  + padding);
        const rectBottom = Math.min(window.innerHeight, rect.bottom + padding);

        const width  = rectRight  - rectLeft;
        const height = rectBottom - rectTop;

        elements.top.style.height = rectTop + "px";

        elements.bottom.style.top = rectBottom + "px";

        elements.left.style.top    = rectTop  + "px";
        elements.left.style.width  = rectLeft + "px";
        elements.left.style.height = height   + "px";

        elements.right.style.top    = rectTop   + "px";
        elements.right.style.left   = rectRight + "px";
        elements.right.style.height = height    + "px";

        elements.ring.style.top    = rectTop  + "px";
        elements.ring.style.left   = rectLeft + "px";
        elements.ring.style.width  = width    + "px";
        elements.ring.style.height = height   + "px";

        // Callout: try to sit to the right of the target (it's near
        // the top-left corner of the screen). If that spills off the
        // right edge, fall back to below the target.
        const calloutWidth  = elements.callout.offsetWidth  || 296;
        const calloutHeight = elements.callout.offsetHeight || 180;
        const gap = 16;

        let calloutLeft = rectRight + gap;
        let calloutTop  = rectTop;
        let posClass    = "settings-spotlight-callout--right";

        // No room to the right → try below
        if (calloutLeft + calloutWidth > window.innerWidth - 12) {
            calloutLeft = Math.max(12, Math.min(
                rectLeft,
                window.innerWidth - calloutWidth - 12
            ));
            calloutTop = rectBottom + gap;
            posClass   = "settings-spotlight-callout--below";
        }

        // Clamp vertically so it stays on screen
        calloutTop = Math.max(12, Math.min(calloutTop, window.innerHeight - calloutHeight - 12));

        elements.callout.style.left = calloutLeft + "px";
        elements.callout.style.top  = calloutTop  + "px";

        // Toggle position-class for the arrow direction
        elements.callout.classList.toggle(
            "settings-spotlight-callout--right", posClass === "settings-spotlight-callout--right"
        );
        elements.callout.classList.toggle(
            "settings-spotlight-callout--below", posClass === "settings-spotlight-callout--below"
        );
    }

    // ─── teardown ─────────────────────────────────────────────────

    function close(neverAgain) {
        if (!elements) return;

        if (neverAgain) hidePermanently();

        const { overlay } = elements;
        overlay.classList.remove("settings-spotlight-overlay--visible");

        if (resizeHandler) {
            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;
        }
        if (keydownHandler) {
            document.removeEventListener("keydown", keydownHandler);
            keydownHandler = null;
        }
        if (panelOpenHandler) {
            document.removeEventListener("nullscape-settings-opened", panelOpenHandler);
            panelOpenHandler = null;
        }

        setTimeout(() => {
            overlay.remove();
            elements = null;
        }, FADE_OUT_MS);
    }

    // ─── build ────────────────────────────────────────────────────

    function buildSpotlight(target) {

        const overlay = document.createElement("div");
        overlay.className = "settings-spotlight-overlay";

        const top    = document.createElement("div");
        const bottom = document.createElement("div");
        const left   = document.createElement("div");
        const right  = document.createElement("div");

        top.className    = "settings-spotlight-panel settings-spotlight-panel--top";
        bottom.className = "settings-spotlight-panel settings-spotlight-panel--bottom";
        left.className   = "settings-spotlight-panel settings-spotlight-panel--left";
        right.className  = "settings-spotlight-panel settings-spotlight-panel--right";

        [top, bottom, left, right].forEach(panel =>
            panel.addEventListener("click", () => close(false))
        );

        const ring = document.createElement("div");
        ring.className = "settings-spotlight-ring";

        const callout = document.createElement("div");
        callout.className = "settings-spotlight-callout";
        callout.innerHTML =
            '<div class="settings-spotlight-callout-arrow"></div>'
            + '<div class="settings-spotlight-callout-icon" aria-hidden="true">⚙</div>'
            + '<div class="settings-spotlight-callout-title">Low Detail Mode has been added!</div>'
            + '<div class="settings-spotlight-callout-body">'
            +   '<p>Since this website has a lot of animations and effects, it\'s recommended '
            +   'to turn this on if you\'re on a low-end device or deep into a '
            +   'CPU/GPU-intensive late-game run, since it can cause a lot of delayed clicks '
            +   'and lag without it.</p>'
            +   '<p class="settings-spotlight-callout-tip">'
            +     '⚙ You can find it in Settings anytime if you need it later.'
            +   '</p>'
            + '</div>'
            + '<div class="settings-spotlight-callout-actions">'
            +   '<button type="button" class="settings-spotlight-open-button" id="settingsSpotlightOpen">'
            +     'Open Settings'
            +   '</button>'
            +   '<button type="button" class="settings-spotlight-dismiss-button" id="settingsSpotlightGotIt">'
            +     'Got it'
            +   '</button>'
            +   '<button type="button" class="settings-spotlight-neveragain-button" id="settingsSpotlightNeverAgain">'
            +     "Don't show again"
            +   '</button>'
            + '</div>';

        overlay.append(top, bottom, left, right, ring, callout);
        document.body.appendChild(overlay);

        elements = { overlay, top, bottom, left, right, ring, callout };

        position(target);

        // Double rAF so the initial zero-opacity state is committed
        // to a frame before the fade-in class is added (same trick
        // as tools-spotlight - single rAF can land in the same paint
        // on some browsers and skip the transition entirely).
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add("settings-spotlight-overlay--visible");
            });
        });

        // "Open Settings" → open the panel and close the spotlight
        callout.querySelector("#settingsSpotlightOpen").addEventListener("click", () => {
            close(false);
            const settingsBtn = document.getElementById("settingsToggleButton");
            if (settingsBtn) settingsBtn.click();
        });

        callout.querySelector("#settingsSpotlightGotIt").addEventListener("click", () => close(false));
        callout.querySelector("#settingsSpotlightNeverAgain").addEventListener("click", () => close(true));
    }

    // ─── open / init ──────────────────────────────────────────────

    function open() {
        const target = document.getElementById("settingsToggleButton");

        // No button → nothing to point at; bail silently.
        if (!target) return;

        buildSpotlight(target);

        resizeHandler = () => position(target);
        window.addEventListener("resize", resizeHandler);

        keydownHandler = event => {
            if (event.key === "Escape") close(false);
        };
        document.addEventListener("keydown", keydownHandler);

        // If the user opens the settings panel themselves (by clicking
        // the button directly, underneath the spotlight ring), treat
        // that as a "Got it" and close so the spotlight doesn't linger
        // on top of the open panel.
        panelOpenHandler = () => close(false);
        document.addEventListener("nullscape-settings-opened", panelOpenHandler);
    }

    function init() {
        if (!shouldShow()) return;
        setTimeout(open, SHOW_DELAY_MS);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();


