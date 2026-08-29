const runState = {

    level: 1,

    difficulty: "Standard",

    activeEnemies: new Map(),

    activeCurses: new Set(),

    curseStacks: new Map(),

    medalCurseValues: new Map(),

    medalPurified: new Set()

};


/*
 * Two independent toggles for browsing/planning curse pools.
 *
 * showAll: reveals every curse in every pool regardless of level,
 * casual-disabled, exclusive-group conflicts, missing enemy/curse
 * requirements, or already being maxed - unmet ones render as
 * locked cards instead of disappearing from the list.
 *
 * unlockAll: lets the user actually select those otherwise-locked
 * curses (no dependency required to add them). A curse already at
 * its stack cap still can't be selected again - that's not a
 * "dependency", it's the curse's own hard limit.
 *
 * unlockAll only has anything to unlock once showAll is revealing
 * the extra curses, so the UI keeps the Unlock All toggle disabled
 * until Show All is on, and turning Show All off also turns Unlock
 * All back off.
 */
const curseVisibilityState = {

    showAll: false,
    unlockAll: false

};

/*
 * Independent of curseVisibilityState - this just controls whether
 * the dedicated "Medal Curses" section at the top of the pools is
 * shown at all. When hidden, medal curses don't disappear - they
 * still render in their normal Global/Enemy Curses spot, just with
 * the same cyan/pink highlight + reward badge the dedicated section
 * gives them, so the "this is worth a medal" signal isn't lost.
 */
const medalDisplayState = {
    hideSection: false
};

const MEDAL_DISPLAY_STORAGE_KEY = "nullscapeMedalDisplayState";

function saveMedalDisplayState() {

    try {

        localStorage.setItem(MEDAL_DISPLAY_STORAGE_KEY, JSON.stringify(medalDisplayState));

    } catch (error) {

        console.warn("couldn't save medal display state:", error);

    }

}

function loadMedalDisplayState() {

    try {

        const raw = localStorage.getItem(MEDAL_DISPLAY_STORAGE_KEY);

        if (!raw) {
            return;
        }

        const saved = JSON.parse(raw);

        medalDisplayState.hideSection = Boolean(saved.hideSection);

    } catch (error) {

        console.warn("couldn't load medal display state, starting fresh:", error);

    }

}


const CURSE_VISIBILITY_STORAGE_KEY = "nullscapeCurseVisibilityState";

function saveCurseVisibilityState() {

    try {

        localStorage.setItem(
            CURSE_VISIBILITY_STORAGE_KEY,
            JSON.stringify(curseVisibilityState)
        );

    } catch (error) {

        console.warn("couldn't save curse visibility state:", error);

    }

}


function loadCurseVisibilityState() {

    try {

        const raw = localStorage.getItem(CURSE_VISIBILITY_STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = JSON.parse(raw);

        curseVisibilityState.showAll = Boolean(saved.showAll);
        curseVisibilityState.unlockAll = Boolean(saved.unlockAll) && curseVisibilityState.showAll;

    } catch (error) {

        console.warn("couldn't load curse visibility state, starting fresh:", error);

    }

}


/*
 * Same idea as curseVisibilityState, but for the Active Enemies
 * grid in the sidebar.
 *
 * showAll: reveals every enemy in the pool regardless of level or
 * an unmet enemy-dependency (e.g. Voidbound Baby needing 2x Baby
 * active) - unmet ones render dimmed/locked instead of disappearing.
 *
 * unlockAll: lets the user actually mark those otherwise-locked
 * enemies active with no level or dependency required.
 *
 * unlockAll only has anything to unlock once showAll is revealing
 * the extra enemies, so it stays disabled until showAll is on, and
 * turning showAll off also turns unlockAll back off.
 */
const enemyVisibilityState = {

    showAll: false,
    unlockAll: false

};


const ENEMY_VISIBILITY_STORAGE_KEY = "nullscapeEnemyVisibilityState";

function saveEnemyVisibilityState() {

    try {

        localStorage.setItem(
            ENEMY_VISIBILITY_STORAGE_KEY,
            JSON.stringify(enemyVisibilityState)
        );

    } catch (error) {

        console.warn("couldn't save enemy visibility state:", error);

    }

}


function loadEnemyVisibilityState() {

    try {

        const raw = localStorage.getItem(ENEMY_VISIBILITY_STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = JSON.parse(raw);

        enemyVisibilityState.showAll = Boolean(saved.showAll);
        enemyVisibilityState.unlockAll = Boolean(saved.unlockAll) && enemyVisibilityState.showAll;

    } catch (error) {

        console.warn("couldn't load enemy visibility state, starting fresh:", error);

    }

}


/*
 * Rolling number animation
 * --------------------------
 * Smoothly tweens a numeric readout's text from whatever it
 * currently shows to a new target value, instead of snapping
 * straight to it - used for stat-style numbers that change on their
 * own as a side effect of other actions (medal payout, curse/enemy
 * counts, death totals, upgrade totals) rather than numbers the
 * player is actively typing into an input.
 *
 * If the element sits inside a `.roll-pill` wrapper, the wrapper's
 * own width is animated too (a small FLIP: measure the width before
 * and after the value changes, then transition between the two) so
 * a pill growing or shrinking - e.g. payout going from 2 digits to
 * 3 - stretches smoothly instead of snapping to its new size the
 * instant the extra digit appears.
 */
function tweenNumberText(el, targetValue, options = {}) {

    if (!el) {

        return;

    }

    const duration = options.duration ?? 550;
    const format = options.format || (value => Math.round(value).toLocaleString());

    const target = Number(targetValue);

    if (!Number.isFinite(target)) {

        return;

    }

    const previous = el.dataset.rollValue !== undefined
        ? parseFloat(el.dataset.rollValue)
        : NaN;

    const startValue = Number.isFinite(previous) ? previous : target;

    el.dataset.rollValue = target;

    if (startValue === target) {

        el.textContent = format(target);

        return;

    }

    if (el._rollRAF) {

        cancelAnimationFrame(el._rollRAF);
        el._rollRAF = null;

    }

    const pill = el.closest(".roll-pill");

    if (pill) {

        const firstWidth = pill.getBoundingClientRect().width;

        const currentText = el.textContent;

        el.textContent = format(target);

        const lastWidth = pill.getBoundingClientRect().width;

        el.textContent = currentText;

        if (Math.abs(lastWidth - firstWidth) > 0.5) {

            pill.style.transition = "none";
            pill.style.width = `${firstWidth}px`;

            void pill.offsetWidth;

            pill.style.transition = "width 0.4s cubic-bezier(0.22, 1, 0.36, 1)";
            pill.style.width = `${lastWidth}px`;

            const clearPillWidth = () => {

                pill.style.transition = "";
                pill.style.width = "";
                pill.removeEventListener("transitionend", clearPillWidth);

            };

            pill.addEventListener("transitionend", clearPillWidth);

        }

    }

    el.classList.add("roll-number-active");

    const startTime = performance.now();

    function step(now) {

        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);

        const current = startValue + (target - startValue) * eased;

        el.textContent = format(current);

        if (t < 1) {

            el._rollRAF = requestAnimationFrame(step);

        } else {

            el.textContent = format(target);
            el._rollRAF = null;
            el.classList.remove("roll-number-active");

        }

    }

    el._rollRAF = requestAnimationFrame(step);

}


const difficulties = [
    "Casual",
    "Standard",
    "Extreme"
];


const enemies = [

    { name: "Bell", level: 1 },
    { name: "Baby", level: 1, maxStack: 2 },
    { name: "Husk", level: 1, maxStack: 2 },
    { name: "ICBM", level: 1 },
    { name: "Springer", level: 1 },
    { name: "Mart", level: 1 },
    { name: "Flesh", level: 5 },
    { name: "Operator", level: 5 },
    { name: "Guardian", level: 8, maxStack: 2 },
    { name: "Telefragger", level: 8 },
    { name: "Kolona", level: 10 },

    {
        name: "Voidbound Baby",
        level: 10,
        requiresEnemies: [{ name: "Baby", count: 2 }]
    },

    { name: "Cadence", level: 15 },
    { name: "Voidbreaker", level: 15 },

    {
        name: "Voidbound Guardian",
        level: 20,
        requiresEnemies: [{ name: "Guardian", count: 2 }]
    },

    { name: "Scrapmaw", level: 20 },
    { name: "Sigil", level: 20 }

];


const globalCurses = [

    { name: "Lower Gravity", level: 1 },
    { name: "Random Spawn", level: 1 },
    { name: "Scattered Gifts", level: 1 },
    { name: "Weaker Jump Pads", level: 1 },
    { name: "Savory Ring", level: 5 },

    {
        name: "Bigger Tripmines",
        level: 5,
        casualDisabled: true,
        medal: true,
        value: 200
    },

    {
        name: "More Tripmines",
        level: 5,
        casualDisabled: true,
        max: 2,
        medal: true,
        value: 150
    },

    {
        name: "High Roller",
        level: 5,
        exclusiveGroup: "highroller-tweakedodds"
    },

    {
        name: "Tweaked Odds",
        level: 5,
        exclusiveGroup: "highroller-tweakedodds"
    },

    { name: "Fake Count", level: 8 },

    {
        name: "Lap 2",
        level: 8,
        medal: true,
        value: 400,
        exclusiveGroup: "lap2-fragilegifts"
    },

    {
        name: "Fragile Gifts",
        level: 8,
        exclusiveGroup: "lap2-fragilegifts"
    },

    { name: "Nothing", level: 8, medal: true, value: 325 },

    { name: "Jackpot", level: 10 },

    {
        name: "Barotrauma",
        level: 15,
        casualDisabled: true,
        medal: true,
        value: 125
    },

    {
        name: "Minefield",
        level: 15,
        casualDisabled: true,
        max: 2
    },

    { name: "Beacon Mirage", level: 25, medal: true, value: 300 }

];


const enemyCurses = [

    { name: "More Ringing", enemy: "Bell" },
    { name: "Mighty Gong", enemy: "Bell", medal: true, value: 150 },
    { name: "Concussion", enemy: "Bell", medal: true, value: 200 },

    { name: "Bigger Marts", enemy: "Mart" },

    {
        name: "Mart Infection",
        enemy: "Mart",
        level: 8,
        exclusiveGroup: "mart-infection-slide"
    },

    {
        name: "Mart Slide",
        enemy: "Mart",
        level: 8,
        medal: true,
        value: 330,
        exclusiveGroup: "mart-infection-slide"
    },

    { name: "Pacifier", enemy: "Baby", medal: true, value: 230 },
    { name: "Problem Child", enemy: "Baby", medal: true, value: 150 },

    {
        name: "Bigger Blast",
        enemy: "ICBM",
        medal: true,
        value: 200,
        max: 2
    },

    { name: "Scorched Earth", enemy: "ICBM", medal: true, value: 150 },

    {
        name: "Closer Husk",
        enemy: "Husk",
        exclusiveGroup: "husk-distance"
    },

    {
        name: "Further Husk",
        enemy: "Husk",
        exclusiveGroup: "husk-distance"
    },

    { name: "Taller Husk", enemy: "Husk" },
    { name: "Husk Express", enemy: "Husk", enemyCount: 2, medal: true, value: 200 },
    { name: "Conga Line", enemy: "Husk", medal: true, value: 200 },
    { name: "Random Husk", enemy: "Husk", level: 15 },

    { name: "Resonating Shockwaves", enemy: "Springer" },
    { name: "Springloaded", enemy: "Springer", medal: true, value: 200 },

    { name: "Bloodier Meat", enemy: "Flesh", medal: true, value: 300 },
    { name: "Blighted Jump Pads", enemy: "Flesh" },

    { name: "Camoflauge", enemy: "Guardian" },
    { name: "Shotgun", enemy: "Guardian", medal: true, value: 200 },

    { name: "Ambush", enemy: "Telefragger" },
    { name: "Accurate Telefragger", enemy: "Telefragger", medal: true, value: 150 },

    { name: "Lost Embers", enemy: "Kolona" },

    {
        name: "Burning Bouquet",
        enemy: "Kolona",
        medal: true,
        value: 250,
        requiresCurses: ["Razorbloom"]
    },

    { name: "Blade Carousel", enemy: "Voidbreaker", medal: true, value: 290 },

    { name: "Deadly Melody", enemy: "Cadence", medal: true, value: 280 }

];


const greaterCurses = [

    { name: "One Less Choice", type: "Global" },
    { name: "Inverse Destruction", type: "Global", level: 15 },
    { name: "Void Implosions", type: "Global" },
    { name: "Oblivion", type: "Global" },
    { name: "Razorbloom", type: "Global" },
    { name: "Trap Card", type: "Global", level: 15 },

    {
        name: "Run",
        type: "Global",
        level: 15,
        casualDisabled: true,
        requiresCurses: ["Barotrauma"]
    },

    {
        name: "Tantrum",
        type: "Enemy",
        requiresEnemies: ["Baby"]
    },

    {
        name: "Hollow Tiles",
        type: "Enemy",
        requiresEnemies: ["ICBM"]
    },

    {
        name: "Mass Infection",
        type: "Enemy",
        requiresEnemies: ["Flesh"]
    },

    {
        name: "Malfunction",
        type: "Enemy",
        requiresEnemies: ["Operator"]
    },

    {
        name: "Ballet of Blades",
        type: "Enemy",
        requiresEnemies: ["Voidbreaker"],
        exclusiveGroup: "blade-choice"
    },

    {
        name: "Blade Bombardment",
        type: "Enemy",
        requiresEnemies: ["Voidbreaker"],
        exclusiveGroup: "blade-choice"
    }

];


function getLevel() {

    return Math.max(
        1,
        Number(document.getElementById("levelInput").value) || 1
    );

}


function getPlayerCount() {

    return Math.min(
        100,
        Math.max(
            1,
            Number(document.getElementById("playerCountInput").value) || 1
        )
    );

}


function getEnemyCount(name) {

    return runState.activeEnemies.get(name) || 0;

}


function hasEnemy(name) {

    return getEnemyCount(name) > 0;

}


function getEnemyMaxStack(enemy) {

    return enemy.maxStack || 1;

}


/*
 * A dependency entry can be either a plain enemy name (meaning "at
 * least 1 active", the original behavior) or an { name, count }
 * object for the new 2x-style requirements (Husk Express, Voidbound
 * Baby/Guardian). Used both by curses' requiresEnemies/enemy fields
 * and by the enemies pool's own requiresEnemies field.
 */
function meetsEnemyRequirement(entry) {

    const name = typeof entry === "string" ? entry : entry.name;
    const count = typeof entry === "string" ? 1 : (entry.count || 1);

    return getEnemyCount(name) >= count;

}


function hasCurse(name) {

    return getCurseStackCount(name) > 0;

}


function getCurseStackCount(name) {

    return runState.curseStacks.get(name) || 0;

}


function getTotalMedalCurseValue() {

    let total = 0;

    for (const value of runState.medalCurseValues.values()) {

        total += value;

    }

    return total;

}


function getMedalPayout() {

    const totalCurseValue = getTotalMedalCurseValue();
    const playerCount = getPlayerCount();

    return Math.floor(
        (40 + totalCurseValue / 7.5) * Math.sqrt(playerCount)
    );

}


function getCurseMedalReward(curseValue) {

    const medalPayout = getMedalPayout();

    return Math.floor((curseValue * 0.8) * medalPayout / 40);

}


function getPurifyLevelMultiplier() {

    return Math.min(12, Math.floor(getLevel() / 5) * 2);

}


function computePurificationPrice(curseName) {

    const curse = findCurseByName(curseName);
    const curseValue = (curse && curse.value) || 0;

    const levelMult = getPurifyLevelMultiplier();
    const playerCount = getPlayerCount();

    return Math.floor(curseValue * levelMult * Math.sqrt(playerCount));

}


function isGreaterCurse(curse) {

    return curse.type !== undefined;

}


function getCurseTier(curse) {

    if (isGreaterCurse(curse)) {

        return 0;

    }

    if (curse.medal) {

        return 1;

    }

    return 2;

}


function togglePurify(curseName) {

    if (runState.medalPurified.has(curseName)) {

        runState.medalPurified.delete(curseName);

        runState.activeCurses.add(curseName);
        runState.curseStacks.set(curseName, 1);

    } else {

        runState.medalPurified.add(curseName);

        runState.activeCurses.delete(curseName);
        runState.curseStacks.delete(curseName);

    }

    render();

}


function getDisplayedCurseNames() {

    const names = new Set(runState.activeCurses);

    for (const name of runState.medalPurified) {

        names.add(name);

    }

    return Array.from(names);

}


const assetCache = new Map();

function slugify(name) {

    return name
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");

}


function getAssetPath(assetType, name) {

    return `assets/${assetType}/${slugify(name)}.png`;

}


function resolveAsset(assetType, name, onResolved) {

    const cacheKey = `${assetType}/${name}`;

    if (assetCache.has(cacheKey)) {

        onResolved(assetCache.get(cacheKey));

        return;

    }

    const path = getAssetPath(assetType, name);
    const probe = new Image();

    probe.onload = () => {

        assetCache.set(cacheKey, path);

        onResolved(path);

    };

    probe.onerror = () => {

        assetCache.set(cacheKey, false);

        onResolved(false);

    };

    probe.src = path;

}


function createMediaBox(assetType, name) {

    const media = document.createElement("div");

    media.className = "card-media";

    const placeholder = document.createElement("span");

    placeholder.className = "card-media-placeholder";
    placeholder.textContent = name;

    media.appendChild(placeholder);

    resolveAsset(assetType, name, path => {

        if (!path) {

            return;

        }

        media.innerHTML = "";

        const img = document.createElement("img");

        img.className = "card-media-image";
        img.src = path;
        img.alt = name;

        media.appendChild(img);

    });

    return media;

}


function createActiveCurseIcon(assetType, name) {

    const icon = document.createElement("div");

    icon.className = "active-curse-icon";

    resolveAsset(assetType, name, path => {

        if (!path) {

            return;

        }

        const img = document.createElement("img");

        img.className = "active-curse-icon-image";
        img.src = path;
        img.alt = "";

        icon.appendChild(img);

    });

    return icon;

}


function createDependencyBadge(enemyName, count = 1, extraClass) {

    const badge = document.createElement("div");

    badge.className = extraClass ? `curse-enemy-badge ${extraClass}` : "curse-enemy-badge";
    badge.title = count > 1 ? `${count}x ${enemyName}` : enemyName;

    // The circular mask (overflow: hidden, so the icon image crops
    // to a circle) lives on this inner wrapper instead of the badge
    // itself - the count label below is appended straight onto the
    // badge, outside that mask, so it isn't clipped off.
    const inner = document.createElement("div");

    inner.className = "curse-enemy-badge-inner";

    const placeholder = document.createElement("span");

    placeholder.className = "curse-enemy-badge-placeholder";
    placeholder.textContent = enemyName;

    inner.appendChild(placeholder);
    badge.appendChild(inner);

    if (count > 1) {

        const countLabel = document.createElement("span");

        countLabel.className = "curse-enemy-badge-count";
        countLabel.textContent = `\u00d7${count}`;

        badge.appendChild(countLabel);

    }

    resolveAsset("enemies", enemyName, path => {

        if (!path) {

            return;

        }

        inner.innerHTML = "";

        const img = document.createElement("img");

        img.className = "curse-enemy-badge-image";
        img.src = path;
        img.alt = enemyName;

        inner.appendChild(img);

    });

    return badge;

}


function createCurseEnemyBadge(enemyName, count = 1) {

    return createDependencyBadge(enemyName, count);

}


/*
 * Same badge, scaled down and repositioned to sit inside an enemy
 * button's own small corner (rather than protruding above it, which
 * only works on curse cards because .result-grid reserves extra
 * row-gap for that). Used to show what an enemy itself depends on -
 * e.g. Voidbound Baby showing a 2x Baby icon.
 */
function createEnemyDependencyBadge(enemyName, count = 1) {

    return createDependencyBadge(enemyName, count, "enemy-dependency-badge");

}


function createCurseNameLabel(name) {

    const label = document.createElement("div");

    label.className = "curse-name-label";
    label.textContent = name;

    return label;

}


function findCurseByName(name) {

    const allCurses = [
        ...globalCurses,
        ...enemyCurses,
        ...greaterCurses
    ];

    return allCurses.find(item => item.name === name);

}


function requirementsMet(curse) {

    if (curse.enemy && !meetsEnemyRequirement({ name: curse.enemy, count: curse.enemyCount || 1 })) {

        return false;

    }

    if (curse.requiresEnemies) {

        for (const requiredEnemy of curse.requiresEnemies) {

            if (!meetsEnemyRequirement(requiredEnemy)) {

                return false;

            }

        }

    }

    if (curse.requiresCurses) {

        for (const requiredCurse of curse.requiresCurses) {

            if (!hasCurse(requiredCurse)) {

                return false;

            }

        }

    }

    return true;

}


function exclusiveGroupAvailable(curse) {

    if (!curse.exclusiveGroup) {

        return true;

    }

    for (const activeCurse of runState.activeCurses) {

        if (activeCurse === curse.name) {

            continue;

        }

        const existing = findCurseByName(activeCurse);

        if (existing && existing.exclusiveGroup === curse.exclusiveGroup) {

            return false;

        }

    }

    return true;

}


function isCurseAtCap(curse) {

    const stackCount = getCurseStackCount(curse.name);

    if (curse.max) {

        return stackCount >= curse.max;

    }

    return stackCount >= 1;

}


function isCurseDependencyMet(curse, ignoreLevel) {

    const level = getLevel();

    // Greater curses without an explicit "level" default to an
    // unlock level of 10 (see getGreaterCurseUnlockLevel) - that
    // default has to be enforced here too, not just in the "Level X"
    // badge, or those curses show locked but are still selectable.
    const requiredLevel = isGreaterCurse(curse)
        ? getGreaterCurseUnlockLevel(curse)
        : curse.level;

    if (!ignoreLevel && requiredLevel !== undefined && level < requiredLevel) {

        return false;

    }

    if (runState.difficulty === "Casual" && curse.casualDisabled) {

        return false;

    }

    if (!requirementsMet(curse)) {

        return false;

    }

    if (!exclusiveGroupAvailable(curse)) {

        return false;

    }

    return true;

}


function canAppear(curse) {

    return !isCurseAtCap(curse) && isCurseDependencyMet(curse, false);

}


function canAppearIgnoringLevel(curse) {

    return !isCurseAtCap(curse) && isCurseDependencyMet(curse, true);

}


/*
 * Whether a curse should show up in a pool listing at all. With
 * neither toggle on, this is identical to canAppear/
 * canAppearIgnoringLevel - unchanged default behavior. With Show
 * All or Unlock All on, every curse in the category shows up, met
 * or not; createCurseCard renders the unmet ones as locked.
 */
function isCurseVisibleInPool(curse, ignoreLevel) {

    if (curseVisibilityState.showAll || curseVisibilityState.unlockAll) {

        return true;

    }

    return !isCurseAtCap(curse) && isCurseDependencyMet(curse, ignoreLevel);

}


/*
 * Whether a curse can actually be added right now. Unlock All lets
 * the player add a curse with no level/casual/requirement/exclusive-
 * group check - but a curse already at its own stack cap is still
 * blocked, since that's not a "dependency" to unlock, it's the
 * curse's own limit.
 *
 * ignoreLevel skips just the level check while still enforcing
 * everything else - used by the upgrade panel's Nothing-curse
 * discount toggle, which should always be available regardless of
 * the sidebar's current level.
 */
function isCurseSelectable(curse, ignoreLevel = false) {

    if (isCurseAtCap(curse)) {

        return false;

    }

    if (curseVisibilityState.unlockAll) {

        return true;

    }

    return isCurseDependencyMet(curse, ignoreLevel);

}


function getCurseUnlockLevel(curse) {

    return isGreaterCurse(curse) ? getGreaterCurseUnlockLevel(curse) : curse.level;

}


/*
 * True only when level is the single thing standing between this
 * curse and being selectable - used to pick the red "Level X" badge
 * over the purple "OWNED" one, or no badge at all.
 */
function isCurseLockedOnlyByLevel(curse) {

    if (isCurseAtCap(curse)) {

        return false;

    }

    if (runState.difficulty === "Casual" && curse.casualDisabled) {

        return false;

    }

    if (!requirementsMet(curse)) {

        return false;

    }

    if (!exclusiveGroupAvailable(curse)) {

        return false;

    }

    if (isGreaterCurse(curse)) {

        return isGreaterCurseLevelLocked(curse);

    }

    return curse.level !== undefined && getLevel() < curse.level;

}


/*
 * Returns what badge (if any) to show on a locked curse card.
 * Capped curses get a purple "OWNED" badge, curses blocked purely
 * by level get a red "Level XX" badge, and anything locked for a
 * different reason (missing enemy, exclusive-group conflict,
 * casual-disabled) gets no badge at all - the dimmed/grayscale card
 * styling alone communicates it's unavailable.
 */
function getCurseLockBadgeInfo(curse) {

    if (isCurseAtCap(curse)) {

        return { text: "OWNED", className: "curse-lock-badge--owned" };

    }

    if (isCurseLockedOnlyByLevel(curse)) {

        return { text: `Level ${getCurseUnlockLevel(curse)}`, className: "curse-lock-badge--level" };

    }

    return null;

}


function getGreaterCurseUnlockLevel(curse) {

    return curse.level !== undefined ? curse.level : 10;

}


function isGreaterCurseLevelLocked(curse) {

    return getLevel() < getGreaterCurseUnlockLevel(curse);

}


function getGlobalPool() {

    return globalCurses.filter(curse => isCurseVisibleInPool(curse, false));

}


function getEnemyPool() {

    return enemyCurses.filter(curse => isCurseVisibleInPool(curse, false));

}


/*
 * Greater curses always show once their other requirements are met
 * (an active enemy for Enemy-type ones, no exclusive-group conflict,
 * not already maxed/active, not casual-disabled) - level alone no
 * longer hides them. Cards for ones you haven't reached the level
 * for yet render locked with an "Unlocks Lv X" indicator instead of
 * disappearing from the list. Actually selecting one is still
 * blocked by the real level check inside canAppear/selectCurse
 * (unless Unlock All Curses is on - see isCurseSelectable). With
 * Show All Curses on, this same locked-card treatment extends to
 * greater curses whose other requirements aren't met either.
 */
function getGreaterPool() {

    return greaterCurses.filter(curse => isCurseVisibleInPool(curse, true));

}


function getMedalPool() {

    const global = getGlobalPool();
    const enemy = getEnemyPool();

    return [...global, ...enemy]
        .filter(curse => curse.medal)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

}


function isEnemyLevelMet(enemy) {

    return runState.level >= (enemy.level || 1);

}


function isEnemyDependencyMet(enemy) {

    if (!enemy.requiresEnemies) {

        return true;

    }

    return enemy.requiresEnemies.every(req => meetsEnemyRequirement(req));

}


/*
 * Whether an enemy should show up in the Active Enemies grid at
 * all. With Show/Unlock All Enemies off, this is the original
 * level-only filter. With either on, every enemy in the pool shows
 * up, met or not - createEnemyButton renders the unmet ones dimmed
 * and disabled.
 */
function isEnemyVisible(enemy) {

    if (enemyVisibilityState.showAll || enemyVisibilityState.unlockAll) {

        return true;

    }

    return isEnemyLevelMet(enemy) && isEnemyDependencyMet(enemy);

}


/*
 * Whether an enemy can actually be marked active right now.
 * Unlock All Enemies skips the level and dependency checks
 * entirely, same as Unlock All Curses does for the curse pools.
 */
function isEnemySelectable(enemy) {

    if (enemyVisibilityState.unlockAll) {

        return true;

    }

    return isEnemyLevelMet(enemy) && isEnemyDependencyMet(enemy);

}


function findUnmetEnemyRequirement(enemy) {

    if (!enemy.requiresEnemies) {

        return null;

    }

    return enemy.requiresEnemies.find(req => !meetsEnemyRequirement(req)) || null;

}


/*
 * Base enemies (Baby, Husk, Guardian) can now be marked active more
 * than once - some dependencies (Husk Express, Voidbound Baby/
 * Guardian) need 2 of them active at the same time. Clicking cycles
 * the stack up by one until it hits the enemy's maxStack, then
 * resets it back to 0. Enemies with no maxStack behave exactly as
 * before: a plain on/off toggle.
 */
function toggleEnemy(enemy) {

    const maxStack = getEnemyMaxStack(enemy);
    const current = getEnemyCount(enemy.name);

    if (current > 0) {

        if (current < maxStack) {

            runState.activeEnemies.set(enemy.name, current + 1);

        } else {

            runState.activeEnemies.delete(enemy.name);

        }

        render();

        return;

    }

    if (!enemyVisibilityState.unlockAll && !isEnemySelectable(enemy)) {

        const unmet = findUnmetEnemyRequirement(enemy);

        if (unmet) {

            const name = typeof unmet === "string" ? unmet : unmet.name;
            const count = typeof unmet === "string" ? 1 : (unmet.count || 1);

            alert(count > 1
                ? `${enemy.name} requires ${count}x ${name} to be active.`
                : `${enemy.name} requires ${name} to be active.`);

        }

        return;

    }

    runState.activeEnemies.set(enemy.name, 1);

    render();

}


function selectCurse(curse, ignoreLevel = false) {

    if (!isCurseSelectable(curse, ignoreLevel)) {

        return;

    }

    runState.activeCurses.add(curse.name);

    runState.curseStacks.set(
        curse.name,
        getCurseStackCount(curse.name) + 1
    );

    if (curse.medal) {

        runState.medalCurseValues.set(curse.name, curse.value || 0);
        runState.medalPurified.delete(curse.name);

    }

    render();

}


function removeCurse(curseName) {

    const curse = findCurseByName(curseName);
    const currentCount = getCurseStackCount(curseName);

    if (currentCount <= 1) {

        runState.activeCurses.delete(curseName);
        runState.curseStacks.delete(curseName);

        if (curse && curse.medal) {

            runState.medalPurified.delete(curseName);
            runState.medalCurseValues.delete(curseName);

        }

    } else {

        runState.curseStacks.set(curseName, currentCount - 1);

    }

    render();

}


function removeAllCurses() {

    runState.activeCurses.clear();
    runState.curseStacks.clear();
    runState.medalCurseValues.clear();
    runState.medalPurified.clear();

    render();

}


const SOUND_MUTE_KEY = "nullscapeSoundMuted";

let soundMuted = false;

try {

    soundMuted = localStorage.getItem(SOUND_MUTE_KEY) === "true";

} catch (error) {

    soundMuted = false;

}


let audioCtx = null;

function getAudioCtx() {

    if (soundMuted) {

        return null;

    }

    if (!audioCtx) {

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) {

            return null;

        }

        audioCtx = new AudioContextClass();

    }

    if (audioCtx.state === "suspended") {

        audioCtx.resume();

    }

    return audioCtx;

}


function createNoiseBuffer(ctx, duration) {

    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {

        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

    }

    return buffer;

}


function playNoiseHit(ctx, now, duration, filterFreq, filterType, peakGain) {

    const noise = ctx.createBufferSource();

    noise.buffer = createNoiseBuffer(ctx, duration);

    const filter = ctx.createBiquadFilter();

    filter.type = filterType;
    filter.frequency.value = filterFreq;

    const gain = ctx.createGain();

    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + duration);

}


function playTone(ctx, now, freqStart, freqEnd, duration, type, peakGain) {

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + Math.min(0.006, duration / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.01);

}


function playThockSound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 380, 190, 0.045, "triangle", 0.4);
        playNoiseHit(ctx, now, 0.022, 1500, "bandpass", 0.3);

    } catch (error) {

        console.warn("couldn't play thock sound:", error);

    }

}


function playSelectSound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 340, 560, 0.07, "triangle", 0.3);
        playNoiseHit(ctx, now, 0.018, 2200, "highpass", 0.06);

    } catch (error) {

        console.warn("couldn't play select sound:", error);

    }

}


function playEnemySound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 200, 340, 0.06, "sawtooth", 0.16);
        playNoiseHit(ctx, now, 0.025, 700, "lowpass", 0.14);

    } catch (error) {

        console.warn("couldn't play enemy sound:", error);

    }

}


function playDifficultySound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 300, 260, 0.055, "sine", 0.28);

    } catch (error) {

        console.warn("couldn't play difficulty sound:", error);

    }

}


function playRemoveSound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 640, 180, 0.06, "square", 0.1);
        playNoiseHit(ctx, now, 0.035, 2600, "highpass", 0.2);

    } catch (error) {

        console.warn("couldn't play remove sound:", error);

    }

}


function playUtilitySound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 720, 700, 0.03, "sine", 0.12);

    } catch (error) {

        console.warn("couldn't play utility sound:", error);

    }

}


function playPurifySound() {

    const ctx = getAudioCtx();

    if (!ctx) {

        return;

    }

    try {

        const now = ctx.currentTime;

        playTone(ctx, now, 520, 700, 0.06, "sine", 0.22);
        playTone(ctx, now + 0.05, 780, 900, 0.07, "sine", 0.18);

    } catch (error) {

        console.warn("couldn't play purify sound:", error);

    }

}


const HOLD_DURATION_MS = 450;

function attachHoldAction(button, callback, soundFn = playThockSound) {

    button.classList.add("hold-button");

    const fill = document.createElement("div");

    fill.className = "hold-fill";

    button.appendChild(fill);

    let holdTimer = null;
    let isHolding = false;

    function resetFill(instant) {

        fill.style.transitionDuration = instant ? "0ms" : "150ms";
        fill.style.width = "0%";

    }

    function startHold(event) {

        if (isHolding) {

            return;

        }

        getAudioCtx();

        isHolding = true;

        button.classList.add("holding");

        resetFill(true);

        void fill.offsetWidth;

        fill.style.transitionDuration = `${HOLD_DURATION_MS}ms`;
        fill.style.width = "100%";

        holdTimer = setTimeout(() => {

            isHolding = false;

            button.classList.remove("holding");

            soundFn();

            callback(event);

            resetFill(false);

        }, HOLD_DURATION_MS);

    }

    function cancelHold() {

        if (!isHolding) {

            return;

        }

        isHolding = false;

        clearTimeout(holdTimer);

        button.classList.remove("holding");

        resetFill(false);

    }

    button.addEventListener("mousedown", startHold);
    button.addEventListener("touchstart", startHold, { passive: true });

    button.addEventListener("mouseup", cancelHold);
    button.addEventListener("mouseleave", cancelHold);
    button.addEventListener("touchend", cancelHold);
    button.addEventListener("touchcancel", cancelHold);

}


function attachClickAction(button, callback, soundFn = playSelectSound) {

    button.addEventListener("click", event => {

        soundFn();

        callback(event);

    });

}


function createEnemyButton(enemy) {

    const button = document.createElement("button");

    button.className = "select-button enemy-button";

    const count = getEnemyCount(enemy.name);
    const maxStack = getEnemyMaxStack(enemy);
    const selectable = enemyVisibilityState.unlockAll || isEnemySelectable(enemy);
    const locked = count === 0 && !selectable;

    if (count > 0) {

        button.classList.add("selected");

    }

    if (locked) {

        button.classList.add("enemy-button--locked");

        if (!isEnemyLevelMet(enemy)) {

            button.title = `Unlocks at level ${enemy.level}`;

        } else {

            const unmet = findUnmetEnemyRequirement(enemy);

            if (unmet) {

                const name = typeof unmet === "string" ? unmet : unmet.name;
                const reqCount = typeof unmet === "string" ? 1 : (unmet.count || 1);

                button.title = reqCount > 1
                    ? `Requires ${reqCount}x ${name} active`
                    : `Requires ${name} active`;

            }

        }

    }

    const media = createMediaBox("enemies", enemy.name);

    button.appendChild(media);

    if (enemy.requiresEnemies && enemy.requiresEnemies.length > 0) {

        const [dependency] = enemy.requiresEnemies;
        const dependencyName = typeof dependency === "string" ? dependency : dependency.name;
        const dependencyCount = typeof dependency === "string" ? 1 : (dependency.count || 1);

        button.appendChild(createEnemyDependencyBadge(dependencyName, dependencyCount));

    }

    if (maxStack > 1 && count > 0) {

        const stackBadge = document.createElement("span");

        stackBadge.className = "enemy-stack-badge";
        stackBadge.textContent = `${count}/${maxStack}`;

        button.appendChild(stackBadge);

    }

    attachClickAction(button, () => toggleEnemy(enemy), playEnemySound);

    return button;

}


function createDifficultyButton(difficulty) {

    const button = document.createElement("button");

    button.className = `select-button difficulty-${difficulty.toLowerCase()}`;

    if (runState.difficulty === difficulty) {

        button.classList.add("selected");

    }

    const label = document.createElement("span");

    label.className = "btn-label";
    label.textContent = difficulty;

    button.appendChild(label);

    attachClickAction(button, () => {

        runState.difficulty = difficulty;

        render();

    }, playDifficultySound);

    return button;

}


function createCurseCard(curse, isMedal = false) {

    const card = document.createElement("button");

    card.className = "curse-card";

    if (isMedal) {

        card.classList.add("medal");

    }

    const selectable = isCurseSelectable(curse);
    const locked = !selectable;
    const capped = isCurseAtCap(curse);
    const removableViaCard = curseVisibilityState.unlockAll && capped;

    if (locked) {

        card.classList.add("curse-card--locked");

    }

    if (removableViaCard) {

        card.classList.add("curse-card--removable");

    }

    const media = createMediaBox("curses", curse.name);

    card.appendChild(media);

    card.appendChild(createCurseNameLabel(curse.name));

    const dependentEnemyRaw = curse.enemy || (curse.requiresEnemies && curse.requiresEnemies[0]);
    const dependentEnemy = typeof dependentEnemyRaw === "string" ? dependentEnemyRaw : (dependentEnemyRaw && dependentEnemyRaw.name);

    const dependentEnemyCount = curse.enemy
        ? (curse.enemyCount || 1)
        : (dependentEnemyRaw && typeof dependentEnemyRaw === "object" ? (dependentEnemyRaw.count || 1) : 1);

    if (dependentEnemy) {

        card.appendChild(createCurseEnemyBadge(dependentEnemy, dependentEnemyCount));

    }

    if (curse.max) {

        const stackInfo = document.createElement("div");

        stackInfo.className = "curse-info stack-info";
        stackInfo.textContent = `${getCurseStackCount(curse.name)} / ${curse.max}`;

        card.appendChild(stackInfo);

    }

    // Reward and lock badges share the same bottom-center spot, so a
    // locked medal curse shows only the lock badge - previewing a
    // reward for something you can't select yet would be misleading
    // anyway.
    if (isMedal && !locked) {

        const reward = document.createElement("div");

        reward.className = "curse-reward-badge";
        reward.textContent = `+ ${getCurseMedalReward(curse.value || 0)}`;

        card.appendChild(reward);

    }

    if (locked) {

        const badgeInfo = getCurseLockBadgeInfo(curse);

        if (badgeInfo) {

            const lockBadge = document.createElement("div");

            lockBadge.className = `curse-lock-badge ${badgeInfo.className}`;
            lockBadge.textContent = badgeInfo.text;

            card.appendChild(lockBadge);

        }

    }

    attachClickAction(card, () => {

        // Unlock All Curses: reclicking an already-owned/maxed card
        // removes it right from the pool, instead of making the user
        // hunt it down in the Active Curses list to hit its × button.
        if (curseVisibilityState.unlockAll && isCurseAtCap(curse)) {

            removeCurse(curse.name);

            return;

        }

        selectCurse(curse);

    });

    return card;

}


function renderActiveCurses() {

    const container = document.getElementById("activeCurseContainer");

    container.innerHTML = "";

    const allNames = getDisplayedCurseNames();

    if (allNames.length === 0) {

        const empty = document.createElement("div");

        empty.className = "empty-state";
        empty.textContent = "no curses selected";

        container.appendChild(empty);

        return;

    }

    let orderedNames = allNames.sort((a, b) => {

        const curseA = findCurseByName(a);
        const curseB = findCurseByName(b);

        const tierA = curseA ? getCurseTier(curseA) : 2;
        const tierB = curseB ? getCurseTier(curseB) : 2;

        return tierA - tierB;

    });

    const searchInput = document.getElementById("activeCurseSearch");
    const query = searchInput ? searchInput.value.trim().toLowerCase() : "";

    if (query) {

        orderedNames = orderedNames.filter(curseName =>
            curseName.toLowerCase().includes(query)
        );

    }

    if (orderedNames.length === 0) {

        const empty = document.createElement("div");

        empty.className = "empty-state";
        empty.textContent = "no active curses match your search";

        container.appendChild(empty);

        return;

    }

    for (const curseName of orderedNames) {

        const curse = findCurseByName(curseName);

        if (!curse) {

            continue;

        }

        const greater = isGreaterCurse(curse);
        const isMedalCurse = !!curse.medal;
        const purified = runState.medalPurified.has(curseName);

        const item = document.createElement("div");

        item.className = "active-curse";

        if (greater) {

            item.classList.add("active-curse--greater");

        } else if (isMedalCurse && purified) {

            item.classList.add("active-curse--medal-purified");

        } else if (isMedalCurse) {

            item.classList.add("active-curse--medal");

        }

        const removeButton = document.createElement("button");

        removeButton.className = "active-curse-remove";

        const removeLabel = document.createElement("span");

        removeLabel.className = "btn-label";
        removeLabel.textContent = "\u00d7";

        removeButton.appendChild(removeLabel);

        removeButton.setAttribute("aria-label", `Remove ${curse.name}`);

        attachClickAction(removeButton, event => {

            if (event && event.stopPropagation) {

                event.stopPropagation();

            }

            removeCurse(curse.name);

        }, playRemoveSound);

        item.appendChild(removeButton);

        const content = document.createElement("div");

        content.className = "active-curse-content";

        const name = document.createElement("span");

        name.className = "active-curse-name";
        name.textContent = curse.name;

        const stackCount = getCurseStackCount(curse.name);

        if (stackCount > 1) {

            name.textContent += ` \u00d7${stackCount}`;

        }

        content.appendChild(name);

        if (isMedalCurse) {

            if (!purified) {

                const priceLabel = document.createElement("span");

                priceLabel.className = "purify-price";
                priceLabel.textContent = `-${computePurificationPrice(curse.name).toLocaleString()}`;

                content.appendChild(priceLabel);

            }

            const purifyButton = document.createElement("button");

            purifyButton.className = "purify-button";

            if (purified) {

                purifyButton.classList.add("purified");

            }

            const purifyLabel = document.createElement("span");

            purifyLabel.className = "btn-label";
            purifyLabel.textContent = purified ? "Purified" : "Purify?";

            purifyButton.appendChild(purifyLabel);

            attachClickAction(purifyButton, event => {

                if (event && event.stopPropagation) {

                    event.stopPropagation();

                }

                togglePurify(curse.name);

            }, playPurifySound);

            content.appendChild(purifyButton);

        }

        item.appendChild(content);

        const icon = createActiveCurseIcon("curses", curse.name);

        item.appendChild(icon);

        container.appendChild(item);

    }

}


function renderPool(containerId, curses, isDedicatedMedalContainer = false) {

    const container = document.getElementById(containerId);

    container.innerHTML = "";

    if (curses.length === 0) {

        const empty = document.createElement("div");

        empty.className = "empty-pool";
        empty.textContent = "nothing currently available";

        container.appendChild(empty);

        return;

    }

    curses.forEach(curse => {

        // Every card in the dedicated Medal Curses container gets
        // the medal highlight, same as before. Elsewhere (Global/
        // Enemy Curses), a medal curse only picks up that same
        // highlight once Hide Medal Curses is on - otherwise it
        // stays a plain card like today, since it's already shown
        // highlighted in the dedicated section.
        const showMedalHighlight = isDedicatedMedalContainer
            || (Boolean(curse.medal) && medalDisplayState.hideSection);

        const card = createCurseCard(curse, showMedalHighlight);

        container.appendChild(card);

    });

}


const STORAGE_KEY = "nullscapeRunState";

function saveRunState() {

    try {

        const payload = {

            level: runState.level,

            difficulty: runState.difficulty,

            playerCount: getPlayerCount(),

            activeEnemies: Array.from(runState.activeEnemies),

            activeCurses: Array.from(runState.activeCurses),

            curseStacks: Array.from(runState.curseStacks.entries()),

            medalCurseValues: Array.from(runState.medalCurseValues.entries()),

            medalPurified: Array.from(runState.medalPurified)

        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    } catch (error) {

        console.warn("couldn't save run state:", error);

    }

}


function loadRunState() {

    try {

        const raw = localStorage.getItem(STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = JSON.parse(raw);

        runState.level = saved.level || 1;
        runState.difficulty = saved.difficulty || "Standard";
        runState.activeEnemies = new Map(
            (saved.activeEnemies || []).map(entry => Array.isArray(entry) ? entry : [entry, 1])
        );
        runState.activeCurses = new Set(saved.activeCurses || []);
        runState.curseStacks = new Map(saved.curseStacks || []);
        runState.medalCurseValues = new Map(saved.medalCurseValues || []);
        runState.medalPurified = new Set(saved.medalPurified || []);

        if (saved.playerCount) {

            document.getElementById("playerCountInput").value =
                Math.min(100, Math.max(1, saved.playerCount));

        }

    } catch (error) {

        console.warn("couldn't load saved run state, starting fresh:", error);

    }

}


function render() {

    runState.level = getLevel();

    const difficultyContainer = document.getElementById("difficultyContainer");

    difficultyContainer.innerHTML = "";

    difficulties.forEach(difficulty => {

        difficultyContainer.appendChild(createDifficultyButton(difficulty));

    });

    tweenNumberText(document.getElementById("medalPayoutValue"), getMedalPayout());

    const enemyContainer = document.getElementById("enemyContainer");

    enemyContainer.innerHTML = "";

    enemies
        .filter(enemy => isEnemyVisible(enemy) || getEnemyCount(enemy.name) > 0)
        .forEach(enemy => {

            enemyContainer.appendChild(createEnemyButton(enemy));

        });

    tweenNumberText(document.getElementById("curseCount"), getDisplayedCurseNames().length);
    tweenNumberText(document.getElementById("enemyCount"), runState.activeEnemies.size);

    renderActiveCurses();

        const medalCurseContainerEl = document.getElementById("medalCurseContainer");
    const medalSectionEl = medalCurseContainerEl ? medalCurseContainerEl.closest(".result-section") : null;

    if (medalDisplayState.hideSection) {

        if (medalCurseContainerEl) {
            medalCurseContainerEl.innerHTML = "";
        }

    } else {

        renderPool("medalCurseContainer", getMedalPool(), true);

    }

    if (medalSectionEl) {

        medalSectionEl.classList.toggle("result-section--hidden", medalDisplayState.hideSection);

    }
    renderPool("globalCurseContainer", getGlobalPool());
    renderPool("enemyCurseContainer", getEnemyPool());
    renderPool("greaterCurseContainer", getGreaterPool());

    if (typeof renderUpgradeGrid === "function") {

        renderUpgradeGrid();

    }

    saveRunState();

}


function pruneInvalidActiveEnemies() {

    for (const enemyName of runState.activeEnemies.keys()) {

        const enemy = enemies.find(item => item.name === enemyName);

        if (enemy && runState.level < enemy.level) {

            runState.activeEnemies.delete(enemyName);

        }

    }

}


document.getElementById("levelInput").addEventListener("input", render);

document.getElementById("levelInput").addEventListener("change", () => {

    runState.level = getLevel();

    pruneInvalidActiveEnemies();

    render();

});


const playerCountInputEl = document.getElementById("playerCountInput");

// While typing, just re-render with whatever's currently in the box
// (getPlayerCount() already falls back to 1 for calculations if it's
// empty or invalid) - don't rewrite the field's value here. Doing so
// on every keystroke was the cause of a real bug: clearing the "1" to
// type "12" produces an empty string for an instant, which clamped
// straight back to "1" and blocked the rest of the digits from ever
// being entered.
playerCountInputEl.addEventListener("input", () => {

    render();

});

// Only normalize/clamp the field itself once the user's done editing
// (on blur, or Enter via the native "change" event) - so an empty or
// out-of-range value settles back to a valid one without fighting the
// user mid-type.
playerCountInputEl.addEventListener("change", () => {

    const clamped = getPlayerCount();

    playerCountInputEl.value = clamped;

    render();

});


const activeCurseSearchInput = document.getElementById("activeCurseSearch");
const activeCurseSearchClear = document.getElementById("activeCurseSearchClear");

function updateSearchClearVisibility() {

    if (!activeCurseSearchInput || !activeCurseSearchClear) {

        return;

    }

    activeCurseSearchClear.classList.toggle(
        "visible",
        activeCurseSearchInput.value.length > 0
    );

}


if (activeCurseSearchInput) {

    activeCurseSearchInput.addEventListener("input", () => {

        updateSearchClearVisibility();

        renderActiveCurses();

    });

}


if (activeCurseSearchClear) {

    attachClickAction(activeCurseSearchClear, () => {

        activeCurseSearchInput.value = "";

        updateSearchClearVisibility();

        renderActiveCurses();

        activeCurseSearchInput.focus();

    }, playUtilitySound);

}


attachHoldAction(document.getElementById("resetButton"), () => {

    runState.level = 1;
    runState.difficulty = "Standard";

    runState.activeEnemies.clear();
    runState.activeCurses.clear();
    runState.curseStacks.clear();
    runState.medalCurseValues.clear();
    runState.medalPurified.clear();

    document.getElementById("levelInput").value = 1;
    document.getElementById("playerCountInput").value = 1;

    if (activeCurseSearchInput) {

        activeCurseSearchInput.value = "";

        updateSearchClearVisibility();

    }

    if (typeof resetUpgradeShopState === "function") {

        resetUpgradeShopState();

    }

    render();

});


attachHoldAction(document.getElementById("removeAllCursesButton"), () => {

    removeAllCurses();

});


const muteToggleButton = document.getElementById("muteToggleButton");
const muteToggleIcon = document.getElementById("muteToggleIcon");

function updateMuteToggleUI() {

    if (!muteToggleButton) {

        return;

    }

    muteToggleButton.classList.toggle("muted", soundMuted);
    muteToggleButton.setAttribute("aria-pressed", soundMuted ? "true" : "false");

    if (muteToggleIcon) {

        muteToggleIcon.innerHTML = soundMuted ? "&#128263;" : "&#128266;";

    }

}

if (muteToggleButton) {

    muteToggleButton.addEventListener("click", () => {

        soundMuted = !soundMuted;

        try {

            localStorage.setItem(SOUND_MUTE_KEY, soundMuted ? "true" : "false");

        } catch (error) {

            console.warn("couldn't save mute preference:", error);

        }

        updateMuteToggleUI();

    });

}

updateMuteToggleUI();

const hideMedalCursesToggle = document.getElementById("hideMedalCursesToggle");

function updateMedalDisplayToggleUI() {

    if (hideMedalCursesToggle) {

        hideMedalCursesToggle.classList.toggle("active", medalDisplayState.hideSection);
        hideMedalCursesToggle.setAttribute("aria-checked", medalDisplayState.hideSection ? "true" : "false");

    }

}

if (hideMedalCursesToggle) {

    attachClickAction(hideMedalCursesToggle, () => {

        medalDisplayState.hideSection = !medalDisplayState.hideSection;

        saveMedalDisplayState();
        updateMedalDisplayToggleUI();
        render();

    }, playUtilitySound);

}

loadMedalDisplayState();
updateMedalDisplayToggleUI();

const showAllCursesToggle = document.getElementById("showAllCursesToggle");
const unlockAllCursesToggle = document.getElementById("unlockAllCursesToggle");

function updateCurseVisibilityToggleUI() {

    if (showAllCursesToggle) {

        showAllCursesToggle.classList.toggle("active", curseVisibilityState.showAll);
        showAllCursesToggle.setAttribute("aria-checked", curseVisibilityState.showAll ? "true" : "false");

    }

    if (unlockAllCursesToggle) {

        unlockAllCursesToggle.classList.toggle("active", curseVisibilityState.unlockAll);
        unlockAllCursesToggle.setAttribute("aria-checked", curseVisibilityState.unlockAll ? "true" : "false");

        // Unlock All only makes sense once Show All is revealing the
        // extra curses there'd be something to unlock - keep it
        // disabled until then instead of letting it silently do
        // nothing.
        unlockAllCursesToggle.disabled = !curseVisibilityState.showAll;

    }

}

if (showAllCursesToggle) {

    attachClickAction(showAllCursesToggle, () => {

        curseVisibilityState.showAll = !curseVisibilityState.showAll;

        if (!curseVisibilityState.showAll) {

            curseVisibilityState.unlockAll = false;

        }

        saveCurseVisibilityState();
        updateCurseVisibilityToggleUI();
        render();

    }, playUtilitySound);

}

if (unlockAllCursesToggle) {

    unlockAllCursesToggle.addEventListener("click", () => {

        if (unlockAllCursesToggle.disabled) {

            return;

        }

        playUtilitySound();

        curseVisibilityState.unlockAll = !curseVisibilityState.unlockAll;

        saveCurseVisibilityState();
        updateCurseVisibilityToggleUI();
        render();

    });

}

loadCurseVisibilityState();
updateCurseVisibilityToggleUI();


const showAllEnemiesToggle = document.getElementById("showAllEnemiesToggle");
const unlockAllEnemiesToggle = document.getElementById("unlockAllEnemiesToggle");

function updateEnemyVisibilityToggleUI() {

    if (showAllEnemiesToggle) {

        showAllEnemiesToggle.classList.toggle("active", enemyVisibilityState.showAll);
        showAllEnemiesToggle.setAttribute("aria-checked", enemyVisibilityState.showAll ? "true" : "false");

    }

    if (unlockAllEnemiesToggle) {

        unlockAllEnemiesToggle.classList.toggle("active", enemyVisibilityState.unlockAll);
        unlockAllEnemiesToggle.setAttribute("aria-checked", enemyVisibilityState.unlockAll ? "true" : "false");

        // Same rule as Unlock All Curses - nothing to unlock until
        // Show All is revealing the extra enemies.
        unlockAllEnemiesToggle.disabled = !enemyVisibilityState.showAll;

    }

}

if (showAllEnemiesToggle) {

    attachClickAction(showAllEnemiesToggle, () => {

        enemyVisibilityState.showAll = !enemyVisibilityState.showAll;

        if (!enemyVisibilityState.showAll) {

            enemyVisibilityState.unlockAll = false;

        }

        saveEnemyVisibilityState();
        updateEnemyVisibilityToggleUI();
        render();

    }, playUtilitySound);

}

if (unlockAllEnemiesToggle) {

    unlockAllEnemiesToggle.addEventListener("click", () => {

        if (unlockAllEnemiesToggle.disabled) {

            return;

        }

        playUtilitySound();

        enemyVisibilityState.unlockAll = !enemyVisibilityState.unlockAll;

        saveEnemyVisibilityState();
        updateEnemyVisibilityToggleUI();
        render();

    });

}

loadEnemyVisibilityState();
updateEnemyVisibilityToggleUI();


/*
 * Left panel accent sync
 * --------------------------
 * The left sidebar's border/glow shifts to match whichever
 * right-side panel is open - blue/cyan for the Upgrade Shop
 * Calculator, red for the Death Tracker, and back to the default
 * purple curse-tracker look when neither is open (see the
 * .left-panel--upgrades / .left-panel--death variants + transition
 * in style.css).
 *
 * This watches #upgradePanel and #deathPanel directly for their own
 * "open" class being toggled, rather than being called from
 * setUpgradePanelOpen/setDeathPanelOpen - so it works regardless of
 * which file toggles which panel, and doesn't need any changes in
 * DeathTracker.js.
 */
const leftPanelEl = document.querySelector(".left-panel");
const upgradePanelForAccent = document.getElementById("upgradePanel");
const deathPanelForAccent = document.getElementById("deathPanel");

function updateLeftPanelAccent() {

    if (!leftPanelEl) {

        return;

    }

    const upgradesOpen = Boolean(upgradePanelForAccent && upgradePanelForAccent.classList.contains("open"));
    const deathOpen = Boolean(deathPanelForAccent && deathPanelForAccent.classList.contains("open"));

    leftPanelEl.classList.toggle("left-panel--upgrades", upgradesOpen);
    leftPanelEl.classList.toggle("left-panel--death", deathOpen);

}

[upgradePanelForAccent, deathPanelForAccent].forEach(panel => {

    if (!panel) {

        return;

    }

    const observer = new MutationObserver(updateLeftPanelAccent);

    observer.observe(panel, { attributes: true, attributeFilter: ["class"] });

});

updateLeftPanelAccent();


const bgLayer = document.getElementById("bgLayer");

const BG_DRIFT_RANGE = 18;

if (bgLayer) {

    window.addEventListener("mousemove", event => {

        const normalizedX = (event.clientX / window.innerWidth) * 2 - 1;
        const normalizedY = (event.clientY / window.innerHeight) * 2 - 1;

        const moveX = -normalizedX * BG_DRIFT_RANGE;
        const moveY = -normalizedY * BG_DRIFT_RANGE;

        bgLayer.style.transform = `translate(${moveX}px, ${moveY}px)`;

    });

}


function applyHeaderImage(element, label, sizeClass) {

    if (!element) {

        return;

    }

    resolveAsset("branding", label, path => {

        if (!path) {

            return;

        }

        element.innerHTML = "";

        const img = document.createElement("img");

        img.className = sizeClass;
        img.src = path;
        img.alt = label;

        element.appendChild(img);

    });

}


applyHeaderImage(document.getElementById("logoText"), "Nullscape", "logo-image");


loadRunState();

document.getElementById("levelInput").value = runState.level;

render();