/*
 * Upgrade Calculator logic
 * --------------------------
 * Drives the sliding upgrade panel: game-mode price scaling (player
 * count is shared with the sidebar), a Golden Gifts balance, level +
 * prerequisite + affordability states per upgrade, a temporary
 * "pending purchase" queue, and an un-own control for correcting the
 * owned tracker.
 *
 * Depends on globals defined in script.js: runState, hasCurse,
 * hasEnemy, findCurseByName, canAppear, selectCurse, removeCurse,
 * getPlayerCount, resolveAsset, attachClickAction, playSelectSound,
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

    { name: "Adrenaline", price: 50, soloPrice: 50, level: 3, category: "movement" },
    { name: "Business License", prices: [75, 188], level: 3, maxStack: 2, category: "eco" },
    { name: "Defuse Kit", price: 30, soloPrice: 30, level: 3, maxStack: 3, category: "survival" },
    { name: "Paycheck", price: 55, soloPrice: 55, level: 3, maxStack: 5, category: "eco" },
    { name: "Swiftness Ring", price: 80, soloPrice: 80, level: 3, maxStack: 3, category: "movement" },

    { name: "Radar", price: 175, soloPrice: 175, level: 5, category: "environment" },
    { name: "Better Jump Pads", price: 50, soloPrice: 50, level: 5, category: "environment" },
    { name: "Double Jump", price: 150, soloPrice: 150, level: 5, category: "movement" },
    { name: "Grapple Points", price: 100, soloPrice: 100, level: 5, category: "environment" },
    { name: "Tria Orb", price: 100, soloPrice: 100, level: 5, category: "environment" },
    { name: "Medal", price: 100, soloPrice: 100, level: 5, category: "eco" },


    { name: "Advanced Gravity Coil", price: 600, soloPrice: 600, level: 8, category: "movement" },
    { name: "Ice Skates", price: 400, soloPrice: 300, level: 8, category: "movement" },
    { name: "Fanny Pack", price: 300, soloPrice: 300, level: 8, category: "eco" },
    { name: "Grace Wings", price: 300, soloPrice: 200, level: 8, category: "movement" },
    { name: "Helmet", price: 400, soloPrice: 400, level: 8, category: "movement" },

    {
        name: "Pocket Bell", price: 300, soloPrice: 300, level: 8, category: "movement",
        requires: { type: "upgrade", name: "Double Jump", stack: 1 }
    },

    { name: "Last Robloxian Standing", price: 300, soloPrice: 300, level: 8, category: "survival" },

    {
        name: "Radar Module : Altars", price: 300, soloPrice: 300, level: 8, category: "environment",
        requires: { type: "upgrade", name: "Radar", stack: 1 }
    },

    {
        name: "Radar Module : Tripmines", price: 400, soloPrice: 400, level: 8, category: "environment",
        requires: { type: "upgrade", name: "Radar", stack: 1 }
    },

    {
        name: "Radar Module : Enemies", price: 200, soloPrice: 200, level: 8, category: "environment",
        requires: { type: "upgrade", name: "Radar", stack: 1 }
    },

    {
        name: "Radar Module : Players", price: 200, soloPrice: 200, level: 8, category: "environment",
        requires: { type: "upgrade", name: "Radar", stack: 1 }
    },

    { name: "More Altars", price: 600, soloPrice: 600, level: 10, category: "environment" },

    { name: "Ninja Belt", price: 700, soloPrice: 500, level: 13, category: "movement" },

    {
        name: "Subspacial Barrier", prices: [1000, 3000], soloPrices: [500, 1500], level: 13,
        maxStack: 2, category: "survival",
        requires: { type: "upgrade", name: "Defuse Kit", stack: 3 }
    },

    {
        name: "Large Grapple Points", price: 500, soloPrice: 500, level: 13, category: "environment",
        requires: { type: "upgrade", name: "Grapple Points", stack: 1 }
    },

    { name: "Gift Magnet", prices: [1500, 2100, 2700], level: 15, maxStack: 3, category: "eco" },
    { name: "Matrix Tetrahedron", price: 2500, soloPrice: 2500, level: 15, category: "movement" },
    { name: "Shield", price: 4000, soloPrice: 1000, level: 15, category: "survival" },
    { name: "Sport Shoes", price: 1350, soloPrice: 1350, level: 15, category: "movement" },

    {
        name: "Shark Tail", price: 1200, soloPrice: 1200, level: 15, category: "movement",
        requires: { type: "upgrade", name: "Ninja Belt", stack: 1 }
    },

    {
        name: "Radar Module : Instruments", price: 1000, soloPrice: 1000, level: 18, category: "environment",
        requires: { type: "enemy", name: "Cadence" }
    },

    {
        name: "Panic Necklace", price: 3000, soloPrice: 3000, level: 18, category: "survival",
        requires: { type: "upgrade", name: "Shield", stack: 1 }
    },

    {
        name: "Drowned Ægis", price: 6000, soloPrice: 6000, level: 20, category: "survival",
        requires: { type: "upgrade", name: "More Altars", stack: 1 }
    },

    {
        name: "Miniature Hourglass", price: 3000, soloPrice: 3000, level: 20, category: "movement",
        requires: { type: "upgrade", name: "Ninja Belt", stack: 1 }
    },

    { name: "Gift Idol", prices: [4000, 8000, 12000, 16000, 20000], level: 20, maxStack: 5, category: "eco" }

];


const upgradeCategories = [

    { key: "movement", label: "MOVEMENT" },
    { key: "eco", label: "ECO" },
    { key: "environment", label: "ENVIRONMENT" },
    { key: "survival", label: "SURVIVAL" }

];


const upgradeModes = [

    { key: "solo", label: "Solo" },
    { key: "duo", label: "Duo" },
    { key: "party", label: "Party" },
    { key: "partyplus", label: "Party+" }

];


const upgradeState = {

    mode: "solo",
    goldenGifts: 0,

    // Progressive mode: off by default. Off means every upgrade is
    // open regardless of level or prerequisites (a free sandbox for
    // planning). On restores normal level/dependency gating and
    // advances the run level to the next shop tier on every
    // purchase - see getNextShopLevel().
    progressive: false,

    pending: new Map(),
    owned: new Map()

};


const UPGRADE_STORAGE_KEY = "nullscapeUpgradeState";

function saveUpgradeState() {

    try {

        const payload = {

            mode: upgradeState.mode,
            goldenGifts: upgradeState.goldenGifts,
            progressive: upgradeState.progressive,

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
        upgradeState.progressive = Boolean(saved.progressive);
        upgradeState.pending = new Map(saved.pending || []);
        upgradeState.owned = new Map(saved.owned || []);

    } catch (error) {

        console.warn("couldn't load saved upgrade state, starting fresh:", error);

    }

}


/*
 * Resets everything owned inside the upgrade shop (owned stacks,
 * pending selections, Golden Gifts, and mode) without touching the
 * sidebar run state.
 */
function resetUpgradeShopState() {

    upgradeState.pending.clear();
    upgradeState.owned.clear();
    upgradeState.goldenGifts = 0;
    upgradeState.mode = "solo";
    upgradeState.progressive = false;

    saveUpgradeState();
    refreshUpgradePanel();

}


/*
 * Prices scale directly off the current player count shown on the
 * sidebar - going up or down as that number changes. Solo always
 * scales as 1 player, since that's the definition of Solo,
 * regardless of what the sidebar's player count says.
 */
function getScalingPlayerCount() {

    if (upgradeState.mode === "solo") {

        return 1;

    }

    const current = typeof getPlayerCount === "function" ? getPlayerCount() : 1;

    return Math.max(1, current);

}


function isPartyLikeMode() {

    return upgradeState.mode === "party" || upgradeState.mode === "partyplus";

}


function isNothingCurseActive() {

    return typeof hasCurse === "function" && hasCurse("Nothing");

}


function isUpgradeContextHidden(item) {

    const difficultyKey = (runState.difficulty || "Standard").toLowerCase();

    if (difficultyKey === "casual" && CASUAL_OVERRIDES[item.name] && CASUAL_OVERRIDES[item.name].hidden) {

        return true;

    }

    if (difficultyKey === "extreme" && EXTREME_OVERRIDES[item.name] && EXTREME_OVERRIDES[item.name].hidden) {

        return true;

    }

    if (item.name === "Adrenaline" && isPartyLikeMode()) {

        return true;

    }

    if (item.name === "Last Robloxian Standing") {

        const playerCount = typeof getPlayerCount === "function" ? getPlayerCount() : 1;
        const eligible = isPartyLikeMode() || (upgradeState.mode === "duo" && playerCount >= 2);

        if (!eligible) {

            return true;

        }

    }

    if (item.name === "Radar Module : Players") {

        const playerCount = typeof getPlayerCount === "function" ? getPlayerCount() : 1;

        if (playerCount < 2) {

            return true;

        }

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


/*
 * Resolves the un-scaled price for owning `stack` total copies of
 * an item. Items with a "prices" table (Business License, Gift
 * Magnet, etc.) look the tier up directly - those tables already
 * represent the full price for owning that many. Items with only a
 * flat "price" but a maxStack above 1 (Defuse Kit, Swiftness Ring,
 * Paycheck) scale linearly: each additional copy costs the same
 * base unit price.
 */
function computeBaseForStack(item, stack) {

    if (stack <= 0) {

        return 0;

    }

    const effective = getEffectivePrices(item);
    const isSolo = upgradeState.mode === "solo";

    if (effective.prices) {

        const table = (isSolo && effective.soloPrices) ? effective.soloPrices : effective.prices;

        return table[stack - 1] !== undefined ? table[stack - 1] : 0;

    }

    const unit = (isSolo && effective.soloPrice !== undefined) ? effective.soloPrice : effective.price;

    return unit * stack;

}


/*
 * ceil(basePrice * sqrt(playerCount)), with the Party+ multiplier
 * divided by 1.125 before rounding (not after - rounding twice would
 * throw the number off), then the Nothing-curse -15% discount
 * applied as its own rounding step on top.
 */
function computeStackPrice(item, stack) {

    if (stack <= 0) {

        return 0;

    }

    const base = computeBaseForStack(item, stack);
    const playerCount = getScalingPlayerCount();

    let multiplier = Math.sqrt(playerCount);

    if (upgradeState.mode === "partyplus") {

        multiplier = multiplier / 1.125;

    }

    let scaled = Math.ceil(base * multiplier);

    if (isNothingCurseActive()) {

        scaled = Math.ceil(scaled * 0.85);

    }

    return scaled;

}


function isUpgradeLockedByLevel(item) {

    return runState.level < item.level;

}


function isUpgradeRequirementMet(item) {

    if (!item.requires) {

        return true;

    }

    if (item.requires.type === "upgrade") {

        return getOwnedStack(item.requires.name) >= (item.requires.stack || 1);

    }

    if (item.requires.type === "enemy") {

        return typeof hasEnemy === "function" && hasEnemy(item.requires.name);

    }

    return true;

}


/*
 * Upgrade shops appear on levels ending in 0, 3, 5, or 8, starting
 * at level 3 (levels 1-2 have no shop). Returns the next such level
 * strictly above currentLevel. Used by Progressive mode to advance
 * the run level after every purchase.
 */
function getNextShopLevel(currentLevel) {

    let level = Math.max(0, Math.floor(currentLevel) || 0) + 1;

    while (level < 3 || ![0, 3, 5, 8].includes(level % 10)) {

        level++;

    }

    return level;

}


function isUpgradeUnavailable(item) {

    // Progressive mode off (the default) - nothing is locked, so
    // every upgrade is open with no level or dependency required.
    if (!upgradeState.progressive) {

        return false;

    }

    return isUpgradeLockedByLevel(item)
        || !isUpgradeRequirementMet(item);

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

        if (isUpgradeContextHidden(item)) {

            continue;

        }

        total += Math.max(0, getUpgradePendingCost(item));

    }

    return total;

}


function computeRemainingGifts() {

    return upgradeState.goldenGifts - computePendingTotal();

}


/*
 * True for upgrades priced off a per-tier table (Business License,
 * Gift Magnet, Gift Idol, Subspacial Barrier) rather than a flat
 * unit price times stack count. These don't scale linearly, so
 * jumping straight to a tier (via its dot) is the correct way to
 * price them - unlike linear items, "3 stacks" isn't just "1 stack
 * priced 3 times".
 */
function hasVariablePricing(item) {

    return Boolean(item.prices);

}


/*
 * Single source of truth for moving an upgrade's stack toward a
 * specific target count - used by row clicks, the stepper buttons,
 * and the clickable per-tier dots alike. Works the same way
 * regardless of whether the item prices linearly or off a table,
 * since computeStackPrice already resolves either correctly for any
 * target stack.
 *
 * - Target at or below what's already owned: reduces the owned
 *   stack as a tracker correction (no refund), same as the old
 *   dedicated un-own button. Clears any pending selection too, since
 *   it no longer makes sense against the new owned count. Landing
 *   exactly on the current owned count with nothing pending is a
 *   no-op; with a pending selection queued, it cancels that
 *   selection instead of touching owned.
 * - Target above what's owned: queues that target as the pending
 *   selection (what would be bought on the next Purchase). Clicking
 *   the tier that's already pending cancels it back down to owned.
 *   Affordability is only enforced in Progressive mode, matching the
 *   rest of the shop - with it off this is a free planning sandbox.
 */
function setStackTarget(item, targetStack) {

    if (isUpgradeContextHidden(item)) {

        return;

    }

    const owned = getOwnedStack(item.name);
    const maxStack = item.maxStack || 1;

    const target = Math.max(0, Math.min(maxStack, targetStack));

    if (target <= owned) {

        const pending = getPendingStack(item.name);

        if (target === owned) {

            if (pending > owned) {

                upgradeState.pending.delete(item.name);

                playSelectSound();

                saveUpgradeState();
                renderUpgradeGrid();

            }

            return;

        }

        if (target <= 0) {

            upgradeState.owned.delete(item.name);

        } else {

            upgradeState.owned.set(item.name, target);

        }

        upgradeState.pending.delete(item.name);

        playRemoveSound();

        saveUpgradeState();
        renderUpgradeGrid();

        return;

    }

    if (isUpgradeUnavailable(item)) {

        return;

    }

    const pending = getPendingStack(item.name);

    // Clicking the tier that's already queued as pending cancels it,
    // same as clicking an already-selected row used to.
    if (target === pending) {

        upgradeState.pending.delete(item.name);

        playSelectSound();

        saveUpgradeState();
        renderUpgradeGrid();

        return;

    }

    if (upgradeState.progressive) {

        const oldPendingCost = computeStackPrice(item, pending) - computeStackPrice(item, owned);
        const newTargetCost = computeStackPrice(item, target) - computeStackPrice(item, owned);
        const remaining = computeRemainingGifts();

        if ((newTargetCost - oldPendingCost) > remaining) {

            playRemoveSound();

            return;

        }

    }

    upgradeState.pending.set(item.name, target);

    playSelectSound();

    saveUpgradeState();
    renderUpgradeGrid();

}


/*
 * Row-click shortcut: queues one more stack than what's currently
 * owned/pending, or cancels a pending selection if one's already
 * queued. Same +1-per-click cycle for every stackable upgrade,
 * whether it's flat-priced (Swiftness Ring, Paycheck, Defuse Kit) or
 * priced off a per-tier table (Business License, Gift Magnet, Gift
 * Idol, Subspacial Barrier) - setStackTarget/computeStackPrice
 * already resolve the correct cost either way. The up/down stepper
 * (see createStackStepper) offers the same +1/-1 stepping as a
 * secondary control alongside the row click.
 */
function cycleUpgradeSelection(item) {

    if (isUpgradeContextHidden(item)) {

        return;

    }

    const owned = getOwnedStack(item.name);
    const maxStack = item.maxStack || 1;

    if (owned >= maxStack) {

        return;

    }

    const pending = getPendingStack(item.name);

    if (pending > owned) {

        setStackTarget(item, owned);

        return;

    }

    if (isUpgradeUnavailable(item)) {

        return;

    }

    setStackTarget(item, owned + 1);

}


function resetUpgradeSelections() {

    resetUpgradeShopState();

}


/*
 * Marks every upgrade as fully owned at once - a quick way to see
 * the whole owned board, not an in-run purchase. Doesn't touch
 * Golden Gifts (same "tracker correction, no refund/no charge" idea
 * as the un-own controls), and clears out any pending selections
 * since there's nothing left to buy once everything's owned.
 */
function ownAllUpgrades() {

    upgradesList.forEach(item => {

        upgradeState.owned.set(item.name, item.maxStack || 1);

    });

    upgradeState.pending.clear();

    saveUpgradeState();
    refreshUpgradePanel();

}


function purchaseSelectedUpgrades() {

    if (upgradeState.pending.size === 0) {

        return;

    }

    const total = computePendingTotal();

    // Same rule as cycleUpgradeSelection: affordability is only a
    // hard requirement in Progressive mode. With it off, the
    // purchase always goes through and Golden Gifts can go negative.
    if (upgradeState.progressive && total > upgradeState.goldenGifts) {

        playRemoveSound();

        return;

    }

    for (const name of upgradeState.pending.keys()) {

        const item = upgradesList.find(candidate => candidate.name === name);

        if (!item || isUpgradeUnavailable(item) || isUpgradeContextHidden(item)) {

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

    // Full refresh so any other panel state (mode, totals, etc.)
    // stays in sync after the purchase.
    refreshUpgradePanel();

}


/*
 * Progressive mode no longer advances the level automatically on
 * purchase - the player clicks this explicitly (see the "-> Lv X"
 * button next to the Progressive toggle, built in
 * renderProgressiveLevelBadge) whenever they're ready to move up to
 * the next shop tier.
 */
function advanceProgressiveLevel() {

    if (!upgradeState.progressive) {

        return;

    }

    if (!runState || typeof runState.level !== "number") {

        return;

    }

    runState.level = getNextShopLevel(runState.level);

    const levelInput = document.getElementById("levelInput");

    if (levelInput) {

        levelInput.value = runState.level;

    }

    if (typeof render === "function") {

        render();

    }

    refreshUpgradePanel();

}


function isNothingCurseSelectable(nothingCurse) {

    if (typeof isCurseSelectable === "function") {

        return isCurseSelectable(nothingCurse, true);

    }

    if (typeof canAppearIgnoringLevel === "function") {

        return canAppearIgnoringLevel(nothingCurse);

    }

    return typeof canAppear === "function" && canAppear(nothingCurse);

}


function toggleNothingCurse() {

    if (typeof findCurseByName !== "function") {

        return;

    }

    const nothingCurse = findCurseByName("Nothing");

    if (!nothingCurse) {

        return;

    }

    if (isNothingCurseActive()) {

        removeCurse("Nothing");

    } else if (isNothingCurseSelectable(nothingCurse)) {

        selectCurse(nothingCurse, true);

    } else {

        playRemoveSound();

    }

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


function describeRequirement(requires) {

    if (requires.type === "upgrade") {

        return requires.stack > 1
            ? `Requires ${requires.stack}x ${requires.name}`
            : `Requires ${requires.name}`;

    }

    if (requires.type === "enemy") {

        return `Requires ${requires.name} active in the enemy pool`;

    }

    return "";

}


function createRequirementChip(item) {

    if (!item.requires) {

        return null;

    }

    const chip = document.createElement("div");

    chip.className = "upgrade-requirement-chip";
    chip.title = describeRequirement(item.requires);

    if (isUpgradeRequirementMet(item)) {

        chip.classList.add("upgrade-requirement-chip--met");

    }

    const arrow = document.createElement("span");

    arrow.className = "upgrade-requirement-arrow";
    arrow.textContent = "\u2192";

    chip.appendChild(arrow);

    const icon = document.createElement("div");

    icon.className = "upgrade-requirement-icon";

    if (item.requires.type === "upgrade") {

        const placeholder = document.createElement("span");

        placeholder.className = "upgrade-icon-placeholder";
        placeholder.textContent = item.requires.name;

        icon.appendChild(placeholder);

        resolveAsset("upgrades", item.requires.name, path => {

            if (!path) {

                return;

            }

            icon.innerHTML = "";

            const img = document.createElement("img");

            img.className = "upgrade-icon-image";
            img.src = path;
            img.alt = item.requires.name;

            icon.appendChild(img);

        });

    } else if (item.requires.type === "enemy") {

        const placeholder = document.createElement("span");

        placeholder.className = "upgrade-icon-placeholder";
        placeholder.textContent = item.requires.name;

        icon.appendChild(placeholder);

        resolveAsset("enemies", item.requires.name, path => {

            if (!path) {

                return;

            }

            icon.innerHTML = "";

            const img = document.createElement("img");

            img.className = "upgrade-icon-image";
            img.src = path;
            img.alt = item.requires.name;

            icon.appendChild(img);

        });

    }

    chip.appendChild(icon);

    return chip;

}


/*
 * Up/down stepper shown on rows that aren't fully owned yet - the
 * "unowned" stacks. Up queues one more pending stack (mirrors a row
 * click); down cancels a pending stack back toward what's actually
 * owned. It never un-owns an already-purchased stack itself - that's
 * the single "-" button's job once a row is fully owned and sitting
 * in the OWNED UPGRADES basin. Works the same for linear and
 * per-tier-priced items alike, since setStackTarget/computeStackPrice
 * already resolve either correctly - each arrow press on a
 * variable-priced item steps one tier "elevator style," pricing off
 * that tier's own table entry rather than adding tiers together.
 */
function createStackStepper(item, locked) {

    const owned = getOwnedStack(item.name);
    const pending = getPendingStack(item.name);
    const maxStack = item.maxStack || 1;

    const wrapper = document.createElement("div");

    wrapper.className = "upgrade-row-stepper";

    const upButton = document.createElement("button");

    upButton.type = "button";
    upButton.className = "upgrade-stepper-button upgrade-stepper-button--up";
    upButton.setAttribute("aria-label", `Select one more ${item.name} stack`);
    upButton.title = "Select one more stack";
    upButton.textContent = "\u25B2";
    upButton.disabled = locked || pending >= maxStack;

    const downButton = document.createElement("button");

    downButton.type = "button";
    downButton.className = "upgrade-stepper-button upgrade-stepper-button--down";
    downButton.setAttribute("aria-label", `Deselect a pending ${item.name} stack`);
    downButton.title = "Cancel one pending stack";
    downButton.textContent = "\u25BC";
    downButton.disabled = pending <= owned;

    upButton.addEventListener("click", event => {

        event.stopPropagation();

        if (upButton.disabled) {

            return;

        }

        setStackTarget(item, pending + 1);

    });

    downButton.addEventListener("click", event => {

        event.stopPropagation();

        if (downButton.disabled) {

            return;

        }

        setStackTarget(item, pending - 1);

    });

    wrapper.appendChild(upButton);
    wrapper.appendChild(downButton);

    return wrapper;

}


function createUpgradeCard(item) {

    if (isUpgradeContextHidden(item)) {

        return null;

    }

    const row = document.createElement("div");

    row.className = "upgrade-row";
    row.setAttribute("role", "button");
    row.tabIndex = 0;

    const locked = isUpgradeUnavailable(item);
    const owned = getOwnedStack(item.name);
    const pending = getPendingStack(item.name);
    const maxStack = item.maxStack || 1;

    const isFullyOwned = owned >= maxStack;
    const isSelected = !locked && pending > owned;

    const remaining = computeRemainingGifts();
    const variablePricing = hasVariablePricing(item);

    // Flat-priced upgrades (Swiftness Ring, Paycheck, Defuse Kit, and
    // friends) charge the exact same static price for every stack -
    // scaled only by player count/difficulty/Nothing curse, never by
    // how many you've already got or how many are queued up. So
    // their badge always shows that one flat "cost of one more"
    // number, whether you're on stack 1 or the last one, instead of
    // ballooning into the cumulative total of everything queued.
    //
    // Per-tier-priced upgrades (Business License, Gift Magnet, Gift
    // Idol, Subspacial Barrier) genuinely do differ tier to tier, so
    // their badge keeps showing the cost of reaching whatever's
    // currently selected (or the next single tier if nothing's
    // selected yet) - the "elevator" price for that specific floor.
    const priceTargetStack = (!locked && !isFullyOwned)
        ? (variablePricing
            ? (isSelected ? pending : Math.min(owned + 1, maxStack))
            : owned + 1)
        : owned;

    const nextTierCost = (!locked && !isFullyOwned)
        ? computeStackPrice(item, priceTargetStack) - computeStackPrice(item, owned)
        : 0;

    const canAffordNext = !locked && !isFullyOwned && nextTierCost <= remaining;

    if (locked) {

        row.classList.add("upgrade-row--locked");

    } else if (isFullyOwned) {

        row.classList.add("upgrade-row--owned");

    } else if (isSelected) {

        row.classList.add("upgrade-row--active");

    } else if (canAffordNext) {

        row.classList.add("upgrade-row--affordable");

    }

    const requirementChip = createRequirementChip(item);

    if (requirementChip) {

        row.appendChild(requirementChip);

    }

    const levelBadge = document.createElement("span");

    levelBadge.className = "upgrade-row-level";
    levelBadge.textContent = `Lv${item.level}`;

    row.appendChild(levelBadge);

    row.appendChild(createUpgradeIcon(item.name));

    const info = document.createElement("div");

    info.className = "upgrade-row-info";

    const nameLabel = document.createElement("span");

    nameLabel.className = "upgrade-row-name";
    nameLabel.textContent = item.name;

    info.appendChild(nameLabel);

    row.appendChild(info);

    if (maxStack > 1) {

        const stack = document.createElement("div");

        stack.className = "upgrade-row-stack";

        const stackText = document.createElement("span");

        stackText.className = "upgrade-row-stack-text";
        stackText.textContent = `${pending}/${maxStack}`;

        stack.appendChild(stackText);

        const dots = document.createElement("div");

        dots.className = "upgrade-row-dots";

        for (let i = 0; i < maxStack; i++) {

            const dot = document.createElement("span");

            dot.className = "upgrade-dot";

            // Elevator-style indicator: a stack that's actually been
            // bought turns green, and at most one further dot lights
            // up - the specific tier currently selected/pending, not
            // every dot leading up to it - so the row reads as "which
            // floor am I on" rather than a filled progress bar.
            if (i < owned) {

                dot.classList.add("upgrade-dot--owned");

            } else if (i === pending - 1 && pending > owned) {

                dot.classList.add("upgrade-dot--current");

            }

            dots.appendChild(dot);

        }

        stack.appendChild(dots);

        row.appendChild(stack);

    }

    const badge = document.createElement("span");

    badge.className = "upgrade-row-price";

    if (locked) {

        badge.classList.add("upgrade-row-price--locked");
        badge.textContent = "LOCKED";

    } else if (isFullyOwned) {

        badge.classList.add("upgrade-row-price--owned");
        badge.textContent = "OWNED";

    } else {

        if (!canAffordNext) {

            badge.classList.add("upgrade-row-price--unaffordable");

        }

        const priceIcon = document.createElement("img");

        priceIcon.className = "upgrade-row-price-icon";
        priceIcon.src = "assets/upgrades/GoldGiftIcon.png";
        priceIcon.alt = "";

        badge.appendChild(priceIcon);

        const priceAmount = document.createElement("span");

        priceAmount.className = "upgrade-row-price-amount";
        priceAmount.textContent = nextTierCost.toLocaleString();

        badge.appendChild(priceAmount);

    }

    row.appendChild(badge);

    // Active (not-yet-fully-owned) rows get the up/down stepper, but
    // only when the upgrade actually stacks (maxStack > 1) - a
    // one-off upgrade has nothing to step through, so it keeps the
    // plain row-click buy behavior with no arrows at all. Once a row
    // is fully owned it moves into the OWNED UPGRADES basin and
    // switches to the single un-own "-" button instead, for
    // correcting an already-purchased stack.
    if (!isFullyOwned) {

        if (maxStack > 1) {

            row.appendChild(createStackStepper(item, locked));

        }

    } else {

        const unownButton = document.createElement("button");

        unownButton.type = "button";
        unownButton.className = "upgrade-unown-button";
        unownButton.setAttribute("aria-label", `Un-own ${item.name}`);
        unownButton.title = `Un-own ${item.name}`;
        unownButton.textContent = "\u2212";

        unownButton.addEventListener("click", event => {

            event.stopPropagation();

            // Removing from the OWNED UPGRADES basin clears the whole
            // stack back to 0 rather than peeling off one at a time -
            // the stepper (while it was still active/unowned) is where
            // stack count gets fine-tuned; this button is just "take
            // it off the owned board."
            setStackTarget(item, 0);

        });

        row.appendChild(unownButton);

    }

    // Clicking the whole box cycles the stack up by one (same as
    // pressing the up arrow once), or cancels a pending selection if
    // one's already queued - this now works the same for every
    // stackable upgrade, flat-priced (Swiftness Ring, Paycheck,
    // Defuse Kit - each stack costs the same as the first, so the
    // price tag just adds unit price per stack) or per-tier-priced
    // (Business License, Gift Magnet, Gift Idol, Subspacial Barrier -
    // each tier priced from its own table entry). The arrows remain
    // available alongside it for stepping/cancelling one at a time.
    if (!locked && !isFullyOwned) {

        row.addEventListener("click", () => cycleUpgradeSelection(item));

        row.addEventListener("keydown", event => {

            if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();
                cycleUpgradeSelection(item);

            }

        });

    }

    return row;

}


function createUpgradeEmptyRow(text) {

    const empty = document.createElement("div");

    empty.className = "upgrade-empty-row";
    empty.textContent = text;

    return empty;

}


function buildUpgradeCategoryColumn(category, rows, emptyText, headingModifierClass) {

    const section = document.createElement("div");

    section.className = "upgrade-category";

    const heading = document.createElement("div");

    heading.className = "upgrade-category-heading";

    if (headingModifierClass) {

        heading.classList.add(headingModifierClass);

    }

    heading.textContent = category.label;

    section.appendChild(heading);

    const grid = document.createElement("div");

    grid.className = "upgrade-grid";

    if (rows.length > 0) {

        rows.forEach(row => grid.appendChild(row));

    } else {

        grid.appendChild(createUpgradeEmptyRow(emptyText));

    }

    section.appendChild(grid);

    return section;

}


/*
 * Renders two aligned rows of category columns: buyable/locked
 * upgrades on top, and a separate "Owned" basin below holding
 * anything fully purchased. Every category always gets a column in
 * both rows (even if empty) so a column in the Owned basin lines up
 * directly under its matching category above, instead of drifting
 * out of alignment when one section has fewer categories with items
 * than the other.
 */
function renderUpgradeGrid() {

    const activeContainer = document.getElementById("upgradeCategories");
    const ownedContainer = document.getElementById("upgradeOwnedCategories");

    if (!activeContainer) {

        return;

    }

    activeContainer.innerHTML = "";

    if (ownedContainer) {

        ownedContainer.innerHTML = "";

    }

    upgradeCategories.forEach(category => {

        const items = upgradesList.filter(item => item.category === category.key);
        const activeRows = [];
        const ownedRows = [];

        items.forEach(item => {

            if (isUpgradeContextHidden(item)) {

                return;

            }

            const owned = getOwnedStack(item.name);
            const maxStack = item.maxStack || 1;

            const row = createUpgradeCard(item);

            if (!row) {

                return;

            }

            if (owned >= maxStack) {

                ownedRows.push(row);

            } else {

                activeRows.push(row);

            }

        });

        activeContainer.appendChild(
            buildUpgradeCategoryColumn(category, activeRows, "All owned")
        );

        if (ownedContainer) {

            ownedContainer.appendChild(
                buildUpgradeCategoryColumn(category, ownedRows, "Nothing owned yet", "upgrade-category-heading--owned")
            );

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

        // Nothing Curse now shares the exact same switch markup and
        // styling as the Progressive toggle (see .upgrade-switch in
        // Upgrades.css) - just update its state and ON/OFF label.
        const active = isNothingCurseActive();
        const nothingCurse = typeof findCurseByName === "function" ? findCurseByName("Nothing") : null;
        const canToggleOn = active || (nothingCurse && isNothingCurseSelectable(nothingCurse));

        nothingIndicator.classList.toggle("active", active);
        nothingIndicator.setAttribute("aria-checked", active ? "true" : "false");
        nothingIndicator.disabled = !canToggleOn;

        const nothingLabelEl = nothingIndicator.querySelector(".upgrade-switch-label");

        if (nothingLabelEl) {

            nothingLabelEl.textContent = active ? "ON" : "OFF";

        }

    }

    if (purchaseButton) {

        // Same rule as the two functions above: only Progressive
        // mode locks the button on insufficient Golden Gifts. With
        // it off, the button stays clickable and the purchase can
        // push "Left" negative.
        const disabled = upgradeState.pending.size === 0
            || (upgradeState.progressive && total > upgradeState.goldenGifts);

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


function syncGoldenGiftsInput() {

    const input = document.getElementById("goldenGiftsInput");

    if (!input) {

        return;

    }

    input.value = upgradeState.goldenGifts;

}


function createProgressiveToggle() {

    const button = document.createElement("button");

    button.type = "button";
    button.id = "upgradeProgressiveToggle";
    button.className = "upgrade-switch upgrade-progressive-toggle";
    button.setAttribute("role", "switch");
    button.title = "OFF: Sandbox mode. Every upgrade is unlocked no matter your "
        + "level, and you can still select and buy things even without enough "
        + "Golden Gifts - \"Left\" will just show a negative number. "
        + "ON: Simulates a real run. Upgrades stay level-locked, purchases "
        + "require enough Golden Gifts to go through, and you move up to the "
        + "next shop level yourself using the button that appears here.";

    const track = document.createElement("span");

    track.className = "upgrade-switch-track";

    const thumb = document.createElement("span");

    thumb.className = "upgrade-switch-thumb";

    track.appendChild(thumb);
    button.appendChild(track);

    const label = document.createElement("span");

    label.className = "upgrade-switch-label";

    button.appendChild(label);

    attachClickAction(button, () => {

        upgradeState.progressive = !upgradeState.progressive;

        // Progressive mode simulates a real run, and shops don't
        // start appearing until level 3 - force-start there instead
        // of leaving the player stuck at level 1 with nothing to buy.
        // Only bumps up, never down, so turning it on at a higher
        // level (e.g. level 20) doesn't reset progress.
        if (
            upgradeState.progressive
            && typeof runState !== "undefined" && runState
            && typeof runState.level === "number"
            && runState.level < 3
        ) {

            runState.level = 3;

            const levelInput = document.getElementById("levelInput");

            if (levelInput) {

                levelInput.value = 3;

            }

        }

        saveUpgradeState();

        if (typeof render === "function") {

            render();

        }

        refreshUpgradePanel();

    }, playUtilitySound);

    return button;

}


/*
 * Small badge next to the Progressive toggle showing the current run
 * level, plus a button showing (and letting the player click through
 * to) the next shop level - only shown while Progressive mode is on,
 * since that's the only time the level is meant to move at all.
 * Advancing is now an explicit click (see advanceProgressiveLevel),
 * not something that happens automatically on purchase.
 */
function renderProgressiveLevelBadge(wrapper) {

    let levelEl = document.getElementById("upgradeProgressiveLevel");

    if (!levelEl) {

        levelEl = document.createElement("span");

        levelEl.id = "upgradeProgressiveLevel";
        levelEl.className = "upgrade-progressive-level";

        wrapper.appendChild(levelEl);

    }

    let advanceButton = document.getElementById("upgradeProgressiveAdvanceButton");

    if (!advanceButton) {

        advanceButton = document.createElement("button");

        advanceButton.type = "button";
        advanceButton.id = "upgradeProgressiveAdvanceButton";
        advanceButton.className = "upgrade-progressive-advance-button";

        wrapper.appendChild(advanceButton);

        attachClickAction(advanceButton, () => {

            advanceProgressiveLevel();

        }, playDifficultySound);

    }

    const showControls = upgradeState.progressive
        && typeof runState !== "undefined" && runState
        && typeof runState.level === "number";

    levelEl.style.display = showControls ? "" : "none";
    advanceButton.style.display = showControls ? "" : "none";

    if (showControls) {

        levelEl.textContent = "LVL " + runState.level;

        const nextLevel = getNextShopLevel(runState.level);

        advanceButton.textContent = "\u2192 Lv " + nextLevel;
        advanceButton.title = "Advance the run to level " + nextLevel;

    }

}


/*
 * The toggle isn't part of the static markup (it's new), so the
 * first call builds it once and drops it into the toggle group that
 * sits beside the Purchase Upgrade button (alongside the Nothing
 * Curse toggle); later calls just sync its on/off state and the
 * level badge.
 */
function renderProgressiveToggle() {

    let wrapper = document.getElementById("upgradeProgressiveBlock");

    if (!wrapper) {

        const toggleGroup = document.getElementById("upgradeToggleGroup");

        if (!toggleGroup) {

            return;

        }

        wrapper = document.createElement("div");

        wrapper.id = "upgradeProgressiveBlock";
        wrapper.className = "upgrade-progressive-header-slot";

        const label = document.createElement("span");

        label.className = "upgrade-control-label";
        label.textContent = "Progressive";
        label.style.marginBottom = "0";

        wrapper.appendChild(label);
        wrapper.appendChild(createProgressiveToggle());

        toggleGroup.appendChild(wrapper);

    }

    const toggle = document.getElementById("upgradeProgressiveToggle");

    if (!toggle) {

        return;

    }

    toggle.classList.toggle("active", upgradeState.progressive);
    toggle.setAttribute("aria-checked", upgradeState.progressive ? "true" : "false");

    const labelEl = toggle.querySelector(".upgrade-switch-label");

    if (labelEl) {

        labelEl.textContent = upgradeState.progressive ? "ON" : "OFF";

    }

    renderProgressiveLevelBadge(wrapper);

}


function refreshUpgradePanel() {

    renderUpgradeModeButtons();
    syncGoldenGiftsInput();
    renderProgressiveToggle();
    renderUpgradeGrid();

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


const upgradeOwnAllButton = document.getElementById("upgradeOwnAllButton");

if (upgradeOwnAllButton) {

    attachClickAction(upgradeOwnAllButton, ownAllUpgrades, playPurifySound);

}


const purchaseUpgradeButton = document.getElementById("purchaseUpgradeButton");

if (purchaseUpgradeButton) {

    purchaseUpgradeButton.addEventListener("click", () => {

        purchaseSelectedUpgrades();

    });

}


const upgradeNothingIndicator = document.getElementById("upgradeNothingIndicator");

if (upgradeNothingIndicator) {

    upgradeNothingIndicator.addEventListener("click", () => {

        toggleNothingCurse();

    });

}


const upgradeToggleButton = document.getElementById("upgradeToggleButton");
const upgradePanel = document.getElementById("upgradePanel");

// Player Count and Game Mode (Solo/Duo/Party/Party+) only matter
// while the Upgrade Shop Calculator is open, so their sidebar
// sections are hidden by default and revealed/removed in lockstep
// with the panel itself (see .upgrade-panel-only-section in
// Upgrades.css). Both sections share that same class, so a single
// querySelectorAll toggles them together.
const upgradePanelOnlySections = document.querySelectorAll(".upgrade-panel-only-section");

function setUpgradePanelOpen(isOpen) {

    if (!upgradePanel || !upgradeToggleButton) {

        return;

    }

    upgradePanel.classList.toggle("open", isOpen);
    upgradeToggleButton.classList.toggle("active", isOpen);
    upgradeToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

    upgradePanelOnlySections.forEach(section => {

        section.classList.toggle("visible", isOpen);

    });

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