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
