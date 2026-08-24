/*
 * Upgrade Calculator
 * -------------------
 * Self-contained module for the upgrade calculator panel.
 *
 * Depends on the following being defined already by script.js (loaded
 * before this file):
 *   - runState                     (for runState.level / runState.difficulty)
 *   - getPlayerCount()
 *   - hasCurse(name)
 *   - attachClickAction(el, cb, soundFn)
 *   - playSelectSound() / playUtilitySound() / playRemoveSound()
 *
 * Everything else (data, pricing logic, rendering, panel toggle,
 * persistence) lives in this file.
 */


const CASUAL_OVERRIDES = {

    "Grace Wings":               { hidden: true },
    "Defuse Kit":                { hidden: true },
    "Radar Module : Tripmines":  { hidden: true },
    "Shield":               { casualPrice: 2000,  casualSoloPrice: 1000  },
    "Ice Skates":           { casualPrice: 400,   casualSoloPrice: 300   },
    "Ninja Belt":           { casualPrice: 700,   casualSoloPrice: 500   },
    "Matrix Tetrahedron":   { casualPrice: 1500,  casualSoloPrice: 1500  },
    "Shark Tail":           { casualPrice: 800,   casualSoloPrice: 800   },
    "Drowned Ægis":         { casualPrice: 4000,  casualSoloPrice: 4000  },
    "Panic Necklace":       { casualPrice: 1500,  casualSoloPrice: 1500  },
    "Sport Shoes":          { casualPrice: 1000,  casualSoloPrice: 1000  },
    "Gift Magnet":          { casualPrices: [750,  1050, 1350]            },
    "Gift Idol":            { casualPrices: [3000, 6000, 9000, 12000, 15000] },
    "Miniature Hourglass":  { casualPrice: 1500,  casualSoloPrice: 1500  }

};


const EXTREME_OVERRIDES = {

    "Sport Shoes":                  { extremePrice: 1600,  extremeSoloPrice: 1600  },
    "Shark Tail":                   { extremePrice: 1500,  extremeSoloPrice: 1500  },
    "Matrix Tetrahedron":           { extremePrice: 3000,  extremeSoloPrice: 3000  },
    "Shield":                       { extremePrice: 5000,  extremeSoloPrice: 1000  },
    "Gift Magnet":                  { extremePrices: [1800, 2520, 3240], extremeSoloPrices: [1800, 2520, 3240] },
    "Gift Idol":                    { extremePrices: [5000, 10000, 15000, 20000, 25000], extremeSoloPrices: [5000, 10000, 15000, 20000, 25000] }

};


const upgradesList = [

    { name: "Adrenaline",                 price: 50,   soloPrice: 50,   icon: "assets/Adrenaline.png",                 level: 3,  currentStack: 0 },
    { name: "Business License",           prices: [75, 188],           icon: "assets/Business_License.png",           level: 3,  currentStack: 0, maxStack: 2 },
    { name: "Defuse Kit",                 price: 30,   soloPrice: 30,   icon: "assets/Defuse_Kit.png",                 level: 3,  currentStack: 0 },
    { name: "Paycheck",                   price: 55,   soloPrice: 55,   icon: "assets/Paycheck.png",                   level: 3,  currentStack: 0 },
    { name: "Swiftness Ring",             price: 80,   soloPrice: 80,   icon: "assets/Swiftness_Ring.png",             level: 3,  currentStack: 0 },
    { name: "Radar",                      price: 175,  soloPrice: 175,  icon: "assets/Radar.png",                      level: 5,  currentStack: 0 },
    { name: "Better Jump Pads",           price: 50,   soloPrice: 50,   icon: "assets/Better_Jump_Pads.png",           level: 5,  currentStack: 0 },
    { name: "Double Jump",                price: 150,  soloPrice: 150,  icon: "assets/Double_Jump.png",                level: 5,  currentStack: 0 },
    { name: "Grapple Points",             price: 100,  soloPrice: 100,  icon: "assets/Grapple_Points.png",             level: 5,  currentStack: 0 },
    { name: "Tria Orb",                   price: 100,  soloPrice: 100,  icon: "assets/Tria_Orb.png",                   level: 5,  currentStack: 0 },
    { name: "Medal",                      price: 100,  soloPrice: 100,  icon: "assets/Medal.png",                      level: 5,  currentStack: 0 },
    { name: "Advanced Gravity Coil",      price: 600,  soloPrice: 600,  icon: "assets/Advanced_Gravity_Coil.png",      level: 8,  currentStack: 0 },
    { name: "Ice Skates",                 price: 400,  soloPrice: 300,  icon: "assets/Ice_Skates.png",                 level: 8,  currentStack: 0 },
    { name: "Fanny Pack",                 price: 300,  soloPrice: 300,  icon: "assets/Fanny_Pack.png",                 level: 8,  currentStack: 0 },
    { name: "Grace Wings",                price: 300,  soloPrice: 200,  icon: "assets/Grace_Wings.png",                level: 8,  currentStack: 0 },
    { name: "Helmet",                     price: 400,  soloPrice: 400,  icon: "assets/Helmet.png",                     level: 8,  currentStack: 0 },
    { name: "Pocket Bell",                price: 300,  soloPrice: 300,  icon: "assets/Pocket_Bell.png",                level: 8,  currentStack: 0 },
    { name: "Last Robloxian Standing",    price: 300,  soloPrice: 300,  icon: "assets/Last_Robloxian_Standing.png",   id: "opt-lrs", level: 8, currentStack: 0 },
    { name: "Radar Module : Altars",      price: 300,  soloPrice: 300,  icon: "assets/Radar_Module_Altars.png",        level: 8,  currentStack: 0 },
    { name: "Radar Module : Tripmines",   price: 400,  soloPrice: 400,  icon: "assets/Radar_Module_Tripmines.png",     level: 8,  currentStack: 0 },
    { name: "Radar Module : Enemies",     price: 200,  soloPrice: 200,  icon: "assets/Radar_Module_Enemies.png",       level: 8,  currentStack: 0 },
    { name: "More Altars",                price: 600,  soloPrice: 600,  icon: "assets/More_Altars.png",                level: 10, currentStack: 0 },
    { name: "Ninja Belt",                 price: 700,  soloPrice: 500,  icon: "assets/Ninja_Belt.png",                 level: 13, currentStack: 0 },
    { name: "Subspacial Barrier",         prices: [1000, 3000], soloPrices: [500, 1500], icon: "assets/Subspacial_Barrier.png", level: 13, currentStack: 0, maxStack: 2 },
    { name: "Large Grapple Points",       price: 500,  soloPrice: 500,  icon: "assets/Large_Grapple_Points.png",       level: 13, currentStack: 0 },
    { name: "Gift Magnet",                prices: [1500, 2100, 2700],  icon: "assets/Gift_Magnet.png",                level: 15, currentStack: 0, maxStack: 3 },
    { name: "Matrix Tetrahedron",         price: 2500, soloPrice: 2500, icon: "assets/Matrix_Tetrahedron.png",         level: 15, currentStack: 0 },
    { name: "Shield",                     price: 4000, soloPrice: 1000, icon: "assets/Shield.png",                    level: 15, currentStack: 0 },
    { name: "Sport Shoes",                price: 1350, soloPrice: 1350, icon: "assets/Sport_Shoes.png",               level: 15, currentStack: 0 },
    { name: "Shark Tail",                 price: 1200, soloPrice: 1200, icon: "assets/Shark_Tail.png",                level: 15, currentStack: 0 },
    { name: "Radar Module : Instruments", price: 1000, soloPrice: 1000, icon: "assets/Radar_Module_Instruments.png",  level: 18, currentStack: 0 },
    { name: "Panic Necklace",             price: 3000, soloPrice: 3000, icon: "assets/Panic_Necklace.png",            level: 18, currentStack: 0 },
    { name: "Drowned Ægis",              price: 6000, soloPrice: 6000, icon: "assets/DrownedAegis.png",              level: 20, currentStack: 0 },
    { name: "Miniature Hourglass",        price: 3000, soloPrice: 3000, icon: "assets/Miniature_Hourglass.png",       level: 20, currentStack: 0 },
    { name: "Gift Idol",                  prices: [4000, 8000, 12000, 16000, 20000], icon: "assets/Gift_Idol.png",   level: 20, currentStack: 0, maxStack: 5 }

];


function getUpgradeDifficultyKey() {

    return runState.difficulty.toLowerCase();

}


function getUpgradeMode(playerCount) {

    if (playerCount <= 1) {

        return "solo";

    }

    if (playerCount === 2) {

        return "duo";

    }

    if (playerCount <= 8) {

        return "party";

    }

    return "partyplus";

}


function isNothingCurseActive() {

    return hasCurse("Nothing");

}


function isUpgradeCasualHidden(item) {

    if (getUpgradeDifficultyKey() !== "casual") {

        return false;

    }

    return !!(CASUAL_OVERRIDES[item.name] && CASUAL_OVERRIDES[item.name].hidden);

}


function isUpgradeExtremeHidden(item) {

    if (getUpgradeDifficultyKey() !== "extreme") {

        return false;

    }

    return !!(EXTREME_OVERRIDES[item.name] && EXTREME_OVERRIDES[item.name].hidden);

}


function isUpgradeLocked(item) {

    return runState.level < item.level;

}


function getUpgradeEffectivePrices(item) {

    const difficultyKey = getUpgradeDifficultyKey();

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


function computeUpgradePrice(item, stackOverride) {

    const stack = stackOverride !== undefined ? stackOverride : item.currentStack;

    if (!stack) {

        return 0;

    }

    const effective = getUpgradeEffectivePrices(item);
    const players = getPlayerCount();
    const mode = getUpgradeMode(players);
    const isSolo = mode === "solo";

    let base = 0;

    if (effective.prices) {

        const tierPrices = (isSolo && effective.soloPrices) ? effective.soloPrices : effective.prices;

        base = tierPrices[stack - 1] || 0;

    } else {

        base = (isSolo && effective.soloPrice !== undefined) ? effective.soloPrice : effective.price;

    }

    let scaled = (players === 1) ? base : Math.ceil(base * Math.sqrt(players));

    if (mode === "partyplus") {

        scaled = Math.ceil(scaled / 1.125);

    }

    if (mode === "party" && players > 8) {

        scaled = Math.ceil(scaled / 1.125);

    }

    if (isNothingCurseActive()) {

        scaled = Math.ceil(scaled * 0.85);

    }

    return scaled;

}


function getUpgradeTotalCost() {

    let total = 0;

    upgradesList.forEach(item => {

        if (item.currentStack > 0 &&
            !isUpgradeCasualHidden(item) &&
            !isUpgradeExtremeHidden(item) &&
            !isUpgradeLocked(item)) {

            total += computeUpgradePrice(item);

        }

    });

    return total;

}


function createUpgradeIcon(item) {

    const wrapper = document.createElement("div");

    wrapper.className = "upgrade-icon";

    const img = document.createElement("img");

    img.className = "upgrade-icon-image";
    img.src = item.icon;
    img.alt = item.name;

    img.onerror = () => {

        wrapper.innerHTML = "";

        const placeholder = document.createElement("span");

        placeholder.className = "upgrade-icon-placeholder";
        placeholder.textContent = item.name;

        wrapper.appendChild(placeholder);

    };

    wrapper.appendChild(img);

    return wrapper;

}


function cycleUpgradeItem(item) {

    if (isUpgradeLocked(item)) {

        return;

    }

    const max = item.maxStack || 1;

    item.currentStack = (item.currentStack >= max) ? 0 : item.currentStack + 1;

    renderUpgradeGrid();

    saveUpgradeState();

}


function createUpgradeCard(item) {

    const card = document.createElement("button");

    card.type = "button";
    card.className = "upgrade-card";

    const locked = isUpgradeLocked(item);

    if (locked) {

        item.currentStack = 0;

        card.classList.add("upgrade-card--locked");

    }

    if (item.currentStack > 0) {

        card.classList.add("upgrade-card--active");

    }

    card.appendChild(createUpgradeIcon(item));

    const name = document.createElement("div");

    name.className = "upgrade-card-name";
    name.textContent = item.name;

    card.appendChild(name);

    const displayStack = item.currentStack > 0 ? item.currentStack : 1;
    const previewCost = computeUpgradePrice(item, displayStack);

    const priceTag = document.createElement("div");

    priceTag.className = "upgrade-card-price";
    priceTag.textContent = item.maxStack > 1
        ? `Stack ${displayStack}: ${previewCost.toLocaleString()}`
        : `Cost: ${previewCost.toLocaleString()}`;

    card.appendChild(priceTag);

    if (item.maxStack > 1) {

        const dots = document.createElement("div");

        dots.className = "upgrade-card-dots";

        for (let i = 0; i < item.maxStack; i++) {

            const dot = document.createElement("span");

            dot.className = "upgrade-dot";

            if (i < item.currentStack) {

                dot.classList.add("upgrade-dot--filled");

            }

            dots.appendChild(dot);

        }

        card.appendChild(dots);

    }

    const levelBadge = document.createElement("div");

    levelBadge.className = "upgrade-card-level";
    levelBadge.textContent = `Lv ${item.level}`;

    card.appendChild(levelBadge);

    if (!locked) {

        attachClickAction(card, () => {

            cycleUpgradeItem(item);

        }, playSelectSound);

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

        if (isUpgradeCasualHidden(item) || isUpgradeExtremeHidden(item)) {

            item.currentStack = 0;

            return;

        }

        grid.appendChild(createUpgradeCard(item));

    });

    const totalEl = document.getElementById("upgradeTotalValue");

    if (totalEl) {

        totalEl.textContent = getUpgradeTotalCost().toLocaleString();

    }

    const nothingIndicator = document.getElementById("upgradeNothingIndicator");

    if (nothingIndicator) {

        nothingIndicator.classList.toggle("visible", isNothingCurseActive());

    }

}


function resetUpgrades() {

    upgradesList.forEach(item => {

        item.currentStack = 0;

    });

    renderUpgradeGrid();

    saveUpgradeState();

}


const UPGRADE_STORAGE_KEY = "nullscapeUpgradeState";

function saveUpgradeState() {

    try {

        const payload = upgradesList.map(item => [item.name, item.currentStack]);

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

        const stackMap = new Map(JSON.parse(raw));

        upgradesList.forEach(item => {

            item.currentStack = stackMap.get(item.name) || 0;

        });

    } catch (error) {

        console.warn("couldn't load saved upgrade state, starting fresh:", error);

    }

}


const upgradePanel = document.getElementById("upgradePanel");
const upgradeToggleButton = document.getElementById("upgradeToggleButton");
const upgradeResetButton = document.getElementById("upgradeResetButton");

function isUpgradePanelOpen() {

    return upgradePanel ? upgradePanel.classList.contains("open") : false;

}


function setUpgradePanelOpen(open) {

    if (!upgradePanel || !upgradeToggleButton) {

        return;

    }

    upgradePanel.classList.toggle("open", open);
    upgradeToggleButton.classList.toggle("active", open);
    upgradeToggleButton.setAttribute("aria-expanded", open ? "true" : "false");

}


function toggleUpgradePanel() {

    setUpgradePanelOpen(!isUpgradePanelOpen());

}


if (upgradeToggleButton) {

    attachClickAction(upgradeToggleButton, () => {

        toggleUpgradePanel();

    }, playUtilitySound);

}


if (upgradeResetButton) {

    attachClickAction(upgradeResetButton, () => {

        resetUpgrades();

    }, playRemoveSound);

}


document.addEventListener("keydown", event => {

    if (event.key.toLowerCase() !== "b") {

        return;

    }

    const activeElement = document.activeElement;
    const activeTag = activeElement ? activeElement.tagName : "";

    if (activeTag === "INPUT" || activeTag === "TEXTAREA" || (activeElement && activeElement.isContentEditable)) {

        return;

    }

    toggleUpgradePanel();

});


loadUpgradeState();

renderUpgradeGrid();