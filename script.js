const runState = {

    level: 1,

    difficulty: "Standard",

    activeEnemies: new Set(),

    activeCurses: new Set(),

    curseStacks: new Map(),

    medalCurseValues: new Map(),

    medalPurified: new Set()

};


const difficulties = [
    "Casual",
    "Standard",
    "Extreme"
];


const enemies = [

    { name: "Bell", level: 1 },
    { name: "Baby", level: 1 },
    { name: "Husk", level: 1 },
    { name: "ICBM", level: 1 },
    { name: "Springer", level: 1 },
    { name: "Mart", level: 1 },
    { name: "Flesh", level: 5 },
    { name: "Operator", level: 5 },
    { name: "Guardian", level: 8 },
    { name: "Telefragger", level: 8 },
    { name: "Kolona", level: 10 },

    {
        name: "Voidbound Baby",
        level: 10,
        requiresEnemies: ["Baby"]
    },

    { name: "Cadence", level: 15 },
    { name: "Voidbreaker", level: 15 },

    {
        name: "Voidbound Guardian",
        level: 20,
        requiresEnemies: ["Guardian"]
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
    { name: "Husk Express", enemy: "Husk", medal: true, value: 200 },
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
        casualDisabled: true
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
        20,
        Math.max(
            1,
            Number(document.getElementById("playerCountInput").value) || 1
        )
    );

}


function hasEnemy(name) {

    return runState.activeEnemies.has(name);

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

    if (curse.requiresEnemies) {

        for (const requiredEnemy of curse.requiresEnemies) {

            if (!hasEnemy(requiredEnemy)) {

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


function canAppear(curse) {

    const level = getLevel();
    const stackCount = getCurseStackCount(curse.name);

    if (curse.max) {

        if (stackCount >= curse.max) {

            return false;

        }

    } else {

        if (stackCount >= 1) {

            return false;

        }

    }

    if (curse.level !== undefined && level < curse.level) {

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


function getGlobalPool() {

    return globalCurses.filter(canAppear);

}


function getEnemyPool() {

    return enemyCurses.filter(curse => {

        if (!hasEnemy(curse.enemy)) {

            return false;

        }

        return canAppear(curse);

    });

}


function getGreaterPool() {

    const level = getLevel();

    if (level < 10) {

        return [];

    }

    return greaterCurses.filter(canAppear);

}


function getMedalPool() {

    const global = getGlobalPool();
    const enemy = getEnemyPool();

    return [...global, ...enemy]
        .filter(curse => curse.medal)
        .sort((a, b) => (b.value || 0) - (a.value || 0));

}


function toggleEnemy(enemy) {

    if (runState.activeEnemies.has(enemy.name)) {

        runState.activeEnemies.delete(enemy.name);

    } else {

        if (enemy.requiresEnemies) {

            for (const required of enemy.requiresEnemies) {

                if (!hasEnemy(required)) {

                    alert(`${enemy.name} requires ${required} to be active.`);

                    return;

                }

            }

        }

        runState.activeEnemies.add(enemy.name);

    }

    render();

}


function selectCurse(curse) {

    if (!canAppear(curse)) {

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


let audioCtx = null;

function getAudioCtx() {

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

    if (runState.activeEnemies.has(enemy.name)) {

        button.classList.add("selected");

    }

    const media = createMediaBox("enemies", enemy.name);

    button.appendChild(media);

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

    const media = createMediaBox("curses", curse.name);

    card.appendChild(media);

    card.appendChild(createCurseNameLabel(curse.name));

    if (curse.enemy) {

        const info = document.createElement("div");

        info.className = "curse-info";
        info.textContent = curse.enemy;

        card.appendChild(info);

    }

    if (curse.max) {

        const stackInfo = document.createElement("div");

        stackInfo.className = "curse-info stack-info";
        stackInfo.textContent = `${getCurseStackCount(curse.name)} / ${curse.max}`;

        card.appendChild(stackInfo);

    }

    if (isMedal) {

        const reward = document.createElement("div");

        reward.className = "curse-reward-badge";
        reward.textContent = `+ ${getCurseMedalReward(curse.value || 0)}`;

        card.appendChild(reward);

    }

    attachClickAction(card, () => selectCurse(curse));

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


function renderPool(containerId, curses, medal = false) {

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

        const card = createCurseCard(curse, medal);

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
        runState.activeEnemies = new Set(saved.activeEnemies || []);
        runState.activeCurses = new Set(saved.activeCurses || []);
        runState.curseStacks = new Map(saved.curseStacks || []);
        runState.medalCurseValues = new Map(saved.medalCurseValues || []);
        runState.medalPurified = new Set(saved.medalPurified || []);

        if (saved.playerCount) {

            document.getElementById("playerCountInput").value =
                Math.min(20, Math.max(1, saved.playerCount));

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

    document.getElementById("medalPayoutValue").textContent = getMedalPayout();

    const enemyContainer = document.getElementById("enemyContainer");

    enemyContainer.innerHTML = "";

    enemies
        .filter(enemy => runState.level >= enemy.level)
        .forEach(enemy => {

            enemyContainer.appendChild(createEnemyButton(enemy));

        });

    document.getElementById("curseCount").textContent = getDisplayedCurseNames().length;
    document.getElementById("enemyCount").textContent = runState.activeEnemies.size;

    renderActiveCurses();

    renderPool("medalCurseContainer", getMedalPool(), true);
    renderPool("globalCurseContainer", getGlobalPool());
    renderPool("enemyCurseContainer", getEnemyPool());
    renderPool("greaterCurseContainer", getGreaterPool());

    if (typeof renderUpgradeGrid === "function") {

        renderUpgradeGrid();

    }

    saveRunState();

}


function pruneInvalidActiveEnemies() {

    for (const enemyName of runState.activeEnemies) {

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


document.getElementById("playerCountInput").addEventListener("input", () => {

    const clamped = getPlayerCount();

    if (Number(document.getElementById("playerCountInput").value) !== clamped) {

        document.getElementById("playerCountInput").value = clamped;

    }

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