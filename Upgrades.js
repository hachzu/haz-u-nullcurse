/*
 * Upgrade Calculator logic
 * --------------------------
 * Drives the sliding upgrade panel: game-mode / player-count price
 * scaling, a Golden Gifts balance, level + affordability states per
 * upgrade, and a temporary "pending purchase" queue that only spends
 * Golden Gifts once the Purchase Upgrade button is pressed.
 *
 * Depends on globals defined in script.js: runState, hasCurse,
 * resolveAsset, attachClickAction, attachHoldAction, playSelectSound,
 * playDifficultySound, playPurifySound, playRemoveSound, playUtilitySound.
 */


const CASUAL_OVERRIDES = {

    "Grace Wings": { hidden: true },
    "Defuse Kit": { hidden: true },
    "Radar Module : Tripmines": { hidden: true },

    "Shield": { casualPrice: 2000, casualSoloPrice: 1000 },
    "Ice Skates": { casualPrice: 400, casualSoloPrice: 300 },
    "Ninja Belt": { casualPrice: 700, casualSoloPrice: 500 },
    "Matrix Tetrahedron": { casualPrice: 1500, casualSoloPrice: 1500 },
    "Shark Tail": { casualPrice: 800, casualSoloPrice: 800 },
    "Drowned Ægis": { casualPrice: 4000, casualSoloPrice: 4000 },
    "Panic Necklace": { casualPrice: 1500, casualSoloPrice: 1500 },
    "Sport Shoes": { casualPrice: 1000, casualSoloPrice: 1000 },
    "Gift Magnet": { casualPrices: [750, 1050, 1350] },
    "Gift Idol": { casualPrices: [3000, 6000, 9000, 12000, 15000] },
    "Miniature Hourglass": { casualPrice: 1500, casualSoloPrice: 1500 }

};


const EXTREME_OVERRIDES = {

    "Sport Shoes": { extremePrice: 1600, extremeSoloPrice: 1600 },
    "Shark Tail": { extremePrice: 1500, extremeSoloPrice: 1500 },
    "Matrix Tetrahedron": { extremePrice: 3000, extremeSoloPrice: 3000 },
    "Shield": { extremePrice: 5000, extremeSoloPrice: 1000 },
    "Gift Magnet": { extremePrices: [1800, 2520, 3240], extremeSoloPrices: [1800, 2520, 3240] },
    "Gift Idol": {
        extremePrices: [5000, 10000, 15000, 20000, 25000],
        extremeSoloPrices: [5000, 10000, 15000, 20000, 25000]
    }

};


const upgradesList = [

    { name: "Adrenaline", price: 50, soloPrice: 50, level: 3 },
    { name: "Business License", prices: [75, 188], level: 3, maxStack: 2 },
    { name: "Defuse Kit", price: 30, soloPrice: 30, level: 3 },
    { name: "Paycheck", price: 55, soloPrice: 55, level: 3 },
    { name: "Swiftness Ring", price: 80, soloPrice: 80, level: 3 },

    { name: "Radar", price: 175, soloPrice: 175, level: 5 },
    { name: "Better Jump Pads", price: 50, soloPrice: 50, level: 5 },
    { name: "Double Jump", price: 150, soloPrice: 150, level: 5 },
    { name: "Grapple Points", price: 100, soloPrice: 100, level: 5 },
    { name: "Tria Orb", price: 100, soloPrice: 100, level: 5 },
    { name: "Medal", price: 100, soloPrice: 100, level: 5 },

    { name: "Advanced Gravity Coil", price: 600, soloPrice: 600, level: 8 },
    { name: "Ice Skates", price: 400, soloPrice: 300, level: 8 },
    { name: "Fanny Pack", price: 300, soloPrice: 300, level: 8 },
    { name: "Grace Wings", price: 300, soloPrice: 200, level: 8 },
    { name: "Helmet", price: 400, soloPrice: 400, level: 8 },
    { name: "Pocket Bell", price: 300, soloPrice: 300, level: 8 },
    { name: "Last Robloxian Standing", price: 300, soloPrice: 300, level: 8 },
    { name: "Radar Module : Altars", price: 300, soloPrice: 300, level: 8 },
    { name: "Radar Module : Tripmines", price: 400, soloPrice: 400, level: 8 },
    { name: "Radar Module : Enemies", price: 200, soloPrice: 200, level: 8 },

    { name: "More Altars", price: 600, soloPrice: 600, level: 10 },

    { name: "Ninja Belt", price: 700, soloPrice: 500, level: 13 },
    { name: "Subspacial Barrier", prices: [1000, 3000], soloPrices: [500, 1500], level: 13, maxStack: 2 },
    { name: "Large Grapple Points", price: 500, soloPrice: 500, level: 13 },

    { name: "Gift Magnet", prices: [1500, 2100, 2700], level: 15, maxStack: 3 },
    { name: "Matrix Tetrahedron", price: 2500, soloPrice: 2500, level: 15 },
    { name: "Shield", price: 4000, soloPrice: 1000, level: 15 },
    { name: "Sport Shoes", price: 1350, soloPrice: 1350, level: 15 },
    { name: "Shark Tail", price: 1200, soloPrice: 1200, level: 15 },

    { name: "Radar Module : Instruments", price: 1000, soloPrice: 1000, level: 18 },
    { name: "Panic Necklace", price: 3000, soloPrice: 3000, level: 18 },

    { name: "Drowned Ægis", price: 6000, soloPrice: 6000, level: 20 },
    { name: "Miniature Hourglass", price: 3000, soloPrice: 3000, level: 20 },
    { name: "Gift Idol", prices: [4000, 8000, 12000, 16000, 20000], level: 20, maxStack: 5 }

];


const upgradeModes = [

    { key: "solo", label: "Solo", min: 1, max: 1 },
    { key: "duo", label: "Duo", min: 1, max: 2 },
    { key: "party", label: "Party", min: 1, max: 8 },
    { key: "partyplus", label: "Party+", min: 1, max: 20 }

];


const upgradeState = {

    mode: "solo",
    playerCount: 1,
    goldenGifts: 0,

    pending: new Map(),
    owned: new Map()

};


const UPGRADE_STORAGE_KEY = "nullscapeUpgradeState";

function saveUpgradeState() {

    try {

        const payload = {

            mode: upgradeState.mode,
            playerCount: upgradeState.playerCount,
            goldenGifts: upgradeState.goldenGifts,

            pending: Array.from(upgradeState.pending.entries()),
            owned: Array.from(upgradeState.owned.entries())

        };

        localStorage.setItem(UPGRADE_STORAGE_KEY, JSON.stringify(payload));

    } catch (error) {

        console.warn("couldn't save upgrade state:", error);

    }

}


function loadUpgradeState() {

    try {

        const raw = localStorage.getItem(UPGRADE_STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = JSON.parse(raw);

        upgradeState.mode = saved.mode || "solo";
        upgradeState.goldenGifts = Math.max(0, Number(saved.goldenGifts) || 0);
        upgradeState.pending = new Map(saved.pending || []);
        upgradeState.owned = new Map(saved.owned || []);

        upgradeState.playerCount = clampPlayerCountForMode(upgradeState.mode, saved.playerCount || 1);

    } catch (error) {

        console.warn("couldn't load saved upgrade state, starting fresh:", error);

    }

}


function getUpgradeModeConfig() {

    return upgradeModes.find(mode => mode.key === upgradeState.mode) || upgradeModes[0];

}


function clampPlayerCountForMode(modeKey, count) {

    const config = upgradeModes.find(mode => mode.key === modeKey) || upgradeModes[0];

    return Math.min(config.max, Math.max(config.min, Number(count) || config.min));

}


function isPartyLikeMode() {

    return upgradeState.mode === "party" || upgradeState.mode === "partyplus";

}


function isNothingCurseActive() {

    return typeof hasCurse === "function" && hasCurse("Nothing");

}


function isUpgradeModeRestricted(item) {

    if (item.name === "Adrenaline") {

        return isPartyLikeMode();

    }

    if (item.name === "Last Robloxian Standing") {

        return !isPartyLikeMode() || upgradeState.playerCount <= 2;

    }

    return false;

}


function isUpgradeHiddenForDifficulty(item) {

    const difficultyKey = (runState.difficulty || "Standard").toLowerCase();

    if (difficultyKey === "casual") {

        return !!(CASUAL_OVERRIDES[item.name] && CASUAL_OVERRIDES[item.name].hidden);

    }

    if (difficultyKey === "extreme") {

        return !!(EXTREME_OVERRIDES[item.name] && EXTREME_OVERRIDES[item.name].hidden);

    }

    return false;

}


function getEffectivePrices(item) {

    const difficultyKey = (runState.difficulty || "Standard").toLowerCase();

    if (difficultyKey === "casual" && CASUAL_OVERRIDES[item.name]) {

        const override = CASUAL_OVERRIDES[item.name];

        return {

            price: override.casualPrice !== undefined ? override.casualPrice : item.price,
            soloPrice: override.casualSoloPrice !== undefined ? override.casualSoloPrice : item.soloPrice,
            prices: override.casualPrices !== undefined ? override.casualPrices : item.prices,
            soloPrices: item.soloPrices

        };

    }

    if (difficultyKey === "extreme" && EXTREME_OVERRIDES[item.name]) {

        const override = EXTREME_OVERRIDES[item.name];

        return {

            price: override.extremePrice !== undefined ? override.extremePrice : item.price,
            soloPrice: override.extremeSoloPrice !== undefined ? override.extremeSoloPrice : item.soloPrice,
            prices: override.extremePrices !== undefined ? override.extremePrices : item.prices,
            soloPrices: override.extremeSoloPrices !== undefined ? override.extremeSoloPrices : item.soloPrices

        };

    }

    return {

        price: item.price,
        soloPrice: item.soloPrice,
        prices: item.prices,
        soloPrices: item.soloPrices

    };

}


function computeStackPrice(item, stack) {

    if (stack <= 0) {

        return 0;

    }

    const effective = getEffectivePrices(item);
    const isSolo = upgradeState.mode === "solo";

    let base = 0;

    if (effective.prices) {

        const table = (isSolo && effective.soloPrices) ? effective.soloPrices : effective.prices;

        base = table[stack - 1] !== undefined ? table[stack - 1] : 0;

    } else {

        base = (isSolo && effective.soloPrice !== undefined) ? effective.soloPrice : effective.price;

    }

    const playerCount = upgradeState.playerCount;

    let scaled = (playerCount === 1) ? base : Math.ceil(base * Math.sqrt(playerCount));

    if (upgradeState.mode === "partyplus") {

        scaled = Math.ceil(scaled / 1.125);

    }

    if (isNothingCurseActive()) {

        scaled = Math.ceil(scaled * 0.85);

    }

    return scaled;

}


function isUpgradeLockedByLevel(item) {

    return runState.level < item.level;

}


function isUpgradeUnavailable(item) {

    return isUpgradeLockedByLevel(item) || isUpgradeModeRestricted(item);

}


function getOwnedStack(name) {

    return upgradeState.owned.get(name) || 0;

}


function getPendingStack(name) {

    return upgradeState.pending.has(name) ? upgradeState.pending.get(name) : getOwnedStack(name);

}


function getUpgradePendingCost(item) {

    const owned = getOwnedStack(item.name);
    const pending = getPendingStack(item.name);

    return computeStackPrice(item, pending) - computeStackPrice(item, owned);

}


function computePendingTotal() {

    let total = 0;

    for (const item of upgradesList) {

        if (isUpgradeHiddenForDifficulty(item)) {

            continue;

        }

        total += Math.max(0, getUpgradePendingCost(item));

    }

    return total;

}


function computeRemainingGifts() {

    return upgradeState.goldenGifts - computePendingTotal();

}


function cycleUpgradeSelection(item) {

    if (isUpgradeUnavailable(item) || isUpgradeHiddenForDifficulty(item)) {

        return;

    }

    const owned = getOwnedStack(item.name);
    const maxStack = item.maxStack || 1;

    if (owned >= maxStack) {

        return;

    }

    const pending = getPendingStack(item.name);
    let nextPending;

    if (pending >= maxStack) {

        nextPending = owned;

    } else {

        nextPending = pending + 1;

        const incrementCost = computeStackPrice(item, nextPending) - computeStackPrice(item, pending);
        const remaining = computeRemainingGifts();

        if (incrementCost > remaining) {

            playRemoveSound();

            return;

        }

    }

    if (nextPending === owned) {

        upgradeState.pending.delete(item.name);

    } else {

        upgradeState.pending.set(item.name, nextPending);

    }

    playSelectSound();

    saveUpgradeState();
    renderUpgradeGrid();

}


function resetUpgradeSelections() {

    if (upgradeState.pending.size === 0) {

        return;

    }

    upgradeState.pending.clear();

    saveUpgradeState();
    renderUpgradeGrid();

}


function purchaseSelectedUpgrades() {

    if (upgradeState.pending.size === 0) {

        return;

    }

    const total = computePendingTotal();

    if (total > upgradeState.goldenGifts) {

        playRemoveSound();

        return;

    }

    for (const name of upgradeState.pending.keys()) {

        const item = upgradesList.find(candidate => candidate.name === name);

        if (!item || isUpgradeUnavailable(item) || isUpgradeHiddenForDifficulty(item)) {

            playRemoveSound();

            return;

        }

    }

    upgradeState.goldenGifts -= total;

    for (const [name, stack] of upgradeState.pending.entries()) {

        upgradeState.owned.set(name, stack);

    }

    upgradeState.pending.clear();

    playPurifySound();

    saveUpgradeState();
    syncGoldenGiftsInput();
    renderUpgradeGrid();

}


function createUpgradeIcon(name) {

    const icon = document.createElement("div");

    icon.className = "upgrade-icon";

    const placeholder = document.createElement("span");

    placeholder.className = "upgrade-icon-placeholder";
    placeholder.textContent = name;

    icon.appendChild(placeholder);

    resolveAsset("upgrades", name, path => {

        if (!path) {

            return;

        }

        icon.innerHTML = "";

        const img = document.createElement("img");

        img.className = "upgrade-icon-image";
        img.src = path;
        img.alt = name;

        icon.appendChild(img);

    });

    return icon;

}


function createUpgradeCard(item) {

    if (isUpgradeHiddenForDifficulty(item)) {

        return null;

    }

    const card = document.createElement("button");

    card.type = "button";
    card.className = "upgrade-card";

    const locked = isUpgradeUnavailable(item);
    const owned = getOwnedStack(item.name);
    const pending = getPendingStack(item.name);
    const maxStack = item.maxStack || 1;

    const isFullyOwned = owned >= maxStack;
    const isSelected = !locked && pending > owned;

    const remaining = computeRemainingGifts();

    const nextTierCost = (!locked && !isFullyOwned)
        ? computeStackPrice(item, Math.min(pending + 1, maxStack)) - computeStackPrice(item, pending)
        : 0;

    const canAffordNext = !locked && !isFullyOwned && nextTierCost <= remaining;

    if (locked) {

        card.classList.add("upgrade-card--locked");

    } else if (isFullyOwned) {

        card.classList.add("upgrade-card--owned");

    } else if (isSelected) {

        card.classList.add("upgrade-card--active");

    } else if (canAffordNext) {

        card.classList.add("upgrade-card--affordable");

    }

    const levelBadge = document.createElement("span");

    levelBadge.className = "upgrade-card-level";
    levelBadge.textContent = `Lv${item.level}`;

    card.appendChild(levelBadge);

    card.appendChild(createUpgradeIcon(item.name));

    const nameLabel = document.createElement("div");

    nameLabel.className = "upgrade-card-name";
    nameLabel.textContent = item.name;

    card.appendChild(nameLabel);

    if (maxStack > 1) {

        const dots = document.createElement("div");

        dots.className = "upgrade-card-dots";

        for (let i = 0; i < maxStack; i++) {

            const dot = document.createElement("span");

            dot.className = "upgrade-dot";

            if (i < pending) {

                dot.classList.add("upgrade-dot--filled");

            }

            dots.appendChild(dot);

        }

        card.appendChild(dots);

    }

    const badge = document.createElement("div");

    badge.className = "upgrade-card-cost-badge";

    if (locked) {

        badge.classList.add("upgrade-card-cost-badge--locked");
        badge.textContent = "LOCKED";

    } else if (isFullyOwned) {

        badge.classList.add("upgrade-card-cost-badge--owned");
        badge.textContent = "OWNED";

    } else {

        if (!canAffordNext) {

            badge.classList.add("upgrade-card-cost-badge--unaffordable");

        }

        badge.textContent = nextTierCost.toLocaleString();

    }

    card.appendChild(badge);

    if (!locked && !isFullyOwned) {

        card.addEventListener("click", () => cycleUpgradeSelection(item));

    }

    return card;

}


function renderUpgradeGrid() {

    const grid = document.getElementById("upgradeGrid");

    if (!grid) {

        return;

    }

    grid.innerHTML = "";

    upgradesList.forEach(item => {

        const card = createUpgradeCard(item);

        if (card) {

            grid.appendChild(card);

        }

    });

    updateUpgradeTotals();

}


function updateUpgradeTotals() {

    const totalValueEl = document.getElementById("upgradeTotalValue");
    const remainingValueEl = document.getElementById("upgradeRemainingValue");
    const nothingIndicator = document.getElementById("upgradeNothingIndicator");
    const purchaseButton = document.getElementById("purchaseUpgradeButton");

    const total = computePendingTotal();
    const remaining = upgradeState.goldenGifts - total;

    if (totalValueEl) {

        totalValueEl.textContent = total.toLocaleString();

    }

    if (remainingValueEl) {

        remainingValueEl.textContent = remaining.toLocaleString();
        remainingValueEl.classList.toggle("upgrade-panel-total-value--negative", remaining < 0);

    }

    if (nothingIndicator) {

        nothingIndicator.classList.toggle("visible", isNothingCurseActive());

    }

    if (purchaseButton) {

        const disabled = upgradeState.pending.size === 0 || total > upgradeState.goldenGifts;

        purchaseButton.disabled = disabled;
        purchaseButton.classList.toggle("purchase-upgrade-button--disabled", disabled);

    }

}


function createUpgradeModeButton(mode) {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "select-button upgrade-mode-button";

    if (upgradeState.mode === mode.key) {

        button.classList.add("selected");

    }

    const label = document.createElement("span");

    label.className = "btn-label";
    label.textContent = mode.label;

    button.appendChild(label);

    attachClickAction(button, () => {

        upgradeState.mode = mode.key;
        upgradeState.playerCount = clampPlayerCountForMode(mode.key, upgradeState.playerCount);

        saveUpgradeState();
        refreshUpgradePanel();

    }, playDifficultySound);

    return button;

}


function renderUpgradeModeButtons() {

    const container = document.getElementById("upgradeModeContainer");

    if (!container) {

        return;

    }

    container.innerHTML = "";

    upgradeModes.forEach(mode => {

        container.appendChild(createUpgradeModeButton(mode));

    });

}


function syncPlayerCountInput() {

    const input = document.getElementById("upgradePlayerCountInput");

    if (!input) {

        return;

    }

    const config = getUpgradeModeConfig();

    input.min = config.min;
    input.max = config.max;
    input.disabled = config.min === config.max;
    input.value = upgradeState.playerCount;

}


function syncGoldenGiftsInput() {

    const input = document.getElementById("goldenGiftsInput");

    if (!input) {

        return;

    }

    input.value = upgradeState.goldenGifts;

}


function refreshUpgradePanel() {

    renderUpgradeModeButtons();
    syncPlayerCountInput();
    syncGoldenGiftsInput();
    renderUpgradeGrid();

}


const upgradePlayerCountInput = document.getElementById("upgradePlayerCountInput");

if (upgradePlayerCountInput) {

    upgradePlayerCountInput.addEventListener("input", () => {

        const clamped = clampPlayerCountForMode(upgradeState.mode, upgradePlayerCountInput.value);

        upgradeState.playerCount = clamped;

        if (Number(upgradePlayerCountInput.value) !== clamped) {

            upgradePlayerCountInput.value = clamped;

        }

        saveUpgradeState();
        renderUpgradeGrid();

    });

}


const goldenGiftsInput = document.getElementById("goldenGiftsInput");

if (goldenGiftsInput) {

    goldenGiftsInput.addEventListener("input", () => {

        upgradeState.goldenGifts = Math.max(0, Number(goldenGiftsInput.value) || 0);

        saveUpgradeState();
        renderUpgradeGrid();

    });

}


const upgradeResetButton = document.getElementById("upgradeResetButton");

if (upgradeResetButton) {

    attachClickAction(upgradeResetButton, resetUpgradeSelections, playRemoveSound);

}


const purchaseUpgradeButton = document.getElementById("purchaseUpgradeButton");

if (purchaseUpgradeButton) {

    purchaseUpgradeButton.addEventListener("click", () => {

        purchaseSelectedUpgrades();

    });

}


const upgradeToggleButton = document.getElementById("upgradeToggleButton");
const upgradePanel = document.getElementById("upgradePanel");

function setUpgradePanelOpen(isOpen) {

    if (!upgradePanel || !upgradeToggleButton) {

        return;

    }

    upgradePanel.classList.toggle("open", isOpen);
    upgradeToggleButton.classList.toggle("active", isOpen);
    upgradeToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

}

if (upgradeToggleButton && upgradePanel) {

    attachClickAction(upgradeToggleButton, () => {

        setUpgradePanelOpen(!upgradePanel.classList.contains("open"));

    }, playUtilitySound);

    document.addEventListener("keydown", event => {

        if (!event.key || event.key.toLowerCase() !== "b") {

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

        setUpgradePanelOpen(!upgradePanel.classList.contains("open"));

    });

}


loadUpgradeState();
refreshUpgradePanel();