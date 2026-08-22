/* =========================================================
   NULLSCAPE CURSE CALCULATOR
   ========================================================= */


/* =========================================================
   RUN STATE
   ========================================================= */

const runState = {

    level: 1,

    difficulty: "Standard",

    activeEnemies: new Set(),

    activeCurses: new Set(),

    /*
       Tracks how many times each curse has been
       taken this run. Most curses cap at 1; curses
       with a `max` (Minefield, More Tripmines,
       Bigger Blast) can be taken repeatedly up to
       that number.
    */
    curseStacks: new Map()

};


/* =========================================================
   DIFFICULTIES
   ========================================================= */

const difficulties = [
    "Casual",
    "Standard",
    "Extreme"
];


/* =========================================================
   ENEMIES
   ========================================================= */

const enemies = [

    {
        name: "Bell",
        level: 1
    },

    {
        name: "Baby",
        level: 1
    },

    {
        name: "Husk",
        level: 1
    },

    {
        name: "ICBM",
        level: 1
    },

    {
        name: "Springer",
        level: 1
    },

    {
        name: "Mart",
        level: 1
    },

    {
        name: "Flesh",
        level: 5
    },

    {
        name: "Operator",
        level: 5
    },

    {
        name: "Guardian",
        level: 8
    },

    {
        name: "Telefragger",
        level: 8
    },

    {
        name: "Kolona",
        level: 10
    },

    {
        name: "Voidbound Baby",
        level: 10,

        requiresEnemies: [
            "Baby"
        ]
    },

    {
        name: "Cadence",
        level: 15
    },

    {
        name: "Voidbreaker",
        level: 15
    },

    {
        name: "Voidbound Guardian",
        level: 20,

        requiresEnemies: [
            "Guardian"
        ]
    },

    {
        name: "Scrapmaw",
        level: 20
    },

    {
        name: "Sigil",
        level: 20
    }

];


/* =========================================================
   GLOBAL CURSES
   ========================================================= */

const globalCurses = [

    {
        name: "Lower Gravity",
        level: 1
    },

    {
        name: "Random Spawn",
        level: 1
    },

    {
        name: "Scattered Gifts",
        level: 1
    },

    {
        name: "Weaker Jump Pads",
        level: 1
    },

    {
        name: "Savory Ring",
        level: 5
    },

    {
        name: "Bigger Tripmines",
        level: 5,
        casualDisabled: true,
        medal: true
    },

    {
        name: "More Tripmines",
        level: 5,
        casualDisabled: true,
        max: 4,
        medal: true
    },

    {
        name: "High Roller",
        level: 5,

        exclusiveGroup:
            "highroller-tweakedodds"
    },

    {
        name: "Tweaked Odds",
        level: 5,

        exclusiveGroup:
            "highroller-tweakedodds"
    },

    {
        name: "Fake Count",
        level: 8
    },

    {
        name: "Lap 2",
        level: 8,

        medal: true,

        exclusiveGroup:
            "lap2-fragilegifts"
    },

    {
        name: "Fragile Gifts",
        level: 8,

        exclusiveGroup:
            "lap2-fragilegifts"
    },

    {
        name: "Nothing",
        level: 8,
        medal: true
    },

    {
        name: "Jackpot",
        level: 10
    },

    {
        name: "Barotrauma",
        level: 15,

        casualDisabled: true,
        medal: true
    },

    {
        name: "Minefield",
        level: 15,

        casualDisabled: true,
        max: 2
    },

    {
        name: "Beacon Mirage",
        level: 25,

        medal: true
    }

];


/* =========================================================
   ENEMY CURSES
   ========================================================= */

const enemyCurses = [

    /* BELL */

    {
        name: "More Ringing",
        enemy: "Bell"
    },

    {
        name: "Mighty Gong",
        enemy: "Bell",
        medal: true
    },

    {
        name: "Concussion",
        enemy: "Bell",
        medal: true
    },


    /* MART */

    {
        name: "Bigger Marts",
        enemy: "Mart"
    },

    {
        name: "Mart Infection",
        enemy: "Mart",

        exclusiveGroup:
            "mart-infection-slide"
    },

    {
        name: "Mart Slide",
        enemy: "Mart",

        medal: true,

        exclusiveGroup:
            "mart-infection-slide"
    },


    /* BABY */

    {
        name: "Pacifier",
        enemy: "Baby",
        medal: true
    },

    {
        name: "Problem Child",
        enemy: "Baby",
        medal: true
    },


    /* ICBM */

    {
        name: "Bigger Blast",
        enemy: "ICBM",

        medal: true,

        max: 2
    },

    {
        name: "Scorched Earth",
        enemy: "ICBM",
        medal: true
    },


    /* HUSK */

    {
        name: "Closer Husk",
        enemy: "Husk",

        exclusiveGroup:
            "husk-distance"
    },

    {
        name: "Further Husk",
        enemy: "Husk",

        exclusiveGroup:
            "husk-distance"
    },

    {
        name: "Taller Husk",
        enemy: "Husk"
    },

    {
        name: "Husk Express",
        enemy: "Husk",
        medal: true
    },

    {
        name: "Conga Line",
        enemy: "Husk",
        medal: true
    },

    {
        name: "Random Husk",
        enemy: "Husk"
    },


    /* SPRINGER */

    {
        name: "Resonating Shockwaves",
        enemy: "Springer"
    },

    {
        name: "Springloaded",
        enemy: "Springer",
        medal: true
    },


    /* FLESH */

    {
        name: "Bloodier Meat",
        enemy: "Flesh",
        medal: true
    },

    {
        name: "Blighted Jump Pads",
        enemy: "Flesh"
    },


    /* GUARDIAN */

    {
        name: "Camoflauge",
        enemy: "Guardian"
    },

    {
        name: "Shotgun",
        enemy: "Guardian",
        medal: true
    },


    /* TELEFRAGGER */

    {
        name: "Ambush",
        enemy: "Telefragger"
    },

    {
        name: "Accurate Telefragger",
        enemy: "Telefragger",
        medal: true
    },


    /* KOLONA */

    {
        name: "Lost Embers",
        enemy: "Kolona"
    },

    {
        name: "Burning Bouquet",

        enemy: "Kolona",

        medal: true,

        requiresCurses: [
            "Razorbloom"
        ]
    },


    /* VOIDBREAKER */

    {
        name: "Blade Carousel",

        enemy: "Voidbreaker",

        medal: true
    },


    /* CADENCE */

    {
        name: "Deadly Melody",

        enemy: "Cadence",

        medal: true
    }

];


/* =========================================================
   GREATER CURSES
   ========================================================= */

const greaterCurses = [

    {
        name: "One Less Choice",
        type: "Global"
    },

    {
        name: "Inverse Destruction",
        type: "Global",
        level: 15
    },

    {
        name: "Void Implosions",
        type: "Global"
    },

    {
        name: "Oblivion",
        type: "Global"
    },

    {
        name: "Razorbloom",
        type: "Global"
    },

    {
        name: "Trap Card",
        type: "Global",
        level: 15
    },

    {
        name: "Run",
        type: "Global",

        level: 10,

        casualDisabled: true
    },

    {
        name: "Tantrum",
        type: "Enemy",

        requiresEnemies: [
            "Baby"
        ]
    },

    {
        name: "Hollow Tiles",
        type: "Enemy",

        requiresEnemies: [
            "ICBM"
        ]
    },

    {
        name: "Mass Infection",
        type: "Enemy",

        requiresEnemies: [
            "Flesh"
        ]
    },

    {
        name: "Malfunction",
        type: "Enemy",

        requiresEnemies: [
            "Operator"
        ]
    },

    {
        name: "Ballet of Blades",
        type: "Enemy",

        requiresEnemies: [
            "Voidbreaker"
        ],

        exclusiveGroup:
            "blade-choice"
    },

    {
        name: "Blade Bombardment",
        type: "Enemy",

        requiresEnemies: [
            "Voidbreaker"
        ],

        exclusiveGroup:
            "blade-choice"
    }

];


/* =========================================================
   HELPERS
   ========================================================= */

function getLevel() {

    return Math.max(
        1,
        Number(
            document.getElementById("levelInput").value
        ) || 1
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


/* =========================================================
   ASSET RESOLUTION (image-with-text-fallback)
   ========================================================= */

/*
   The browser can't "read" a folder's contents directly,
   so instead we build the expected filename for each
   curse/enemy and try to load it. If it loads, we swap
   the image in. If it 404s, the text placeholder stays.

   Expected file naming:
     assets/curses/<PascalCaseName>.png
     assets/enemies/<PascalCaseName>.png

   Naming rule: strip spaces/punctuation, capitalize
   each word, no separators.

   Examples:
     "Bigger Tripmines"   -> assets/curses/BiggerTripmines.png
     "Voidbound Baby"     -> assets/enemies/VoidboundBaby.png
     "ICBM"               -> assets/enemies/ICBM.png
*/

const assetCache = new Map();

function slugify(name) {

    return name
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(
            word =>
                word.charAt(0).toUpperCase() +
                word.slice(1)
        )
        .join("");

}


function getAssetPath(assetType, name) {

    return `assets/${assetType}/${slugify(name)}.png`;

}


function resolveAsset(assetType, name, onResolved) {

    const cacheKey = `${assetType}/${name}`;


    /*
       Already know the answer (either the
       real path, or `false` for "no asset").
    */

    if (assetCache.has(cacheKey)) {

        onResolved(
            assetCache.get(cacheKey)
        );

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


/* =========================================================
   MEDIA BOX (image OR text placeholder)
   ========================================================= */

function createMediaBox(assetType, name) {

    const media =
        document.createElement("div");

    media.className =
        "card-media";


    /*
       Text placeholder shows immediately.
       If an asset is found, it gets swapped
       out for the image below.
    */

    const placeholder =
        document.createElement("span");

    placeholder.className =
        "card-media-placeholder";

    placeholder.textContent =
        name;

    media.appendChild(placeholder);


    resolveAsset(
        assetType,
        name,
        path => {

            if (!path) {

                return;

            }


            media.innerHTML = "";


            const img =
                document.createElement("img");

            img.className =
                "card-media-image";

            img.src = path;
            img.alt = name;


            media.appendChild(img);

        }
    );


    return media;

}


function findCurseByName(name) {

    const allCurses = [
        ...globalCurses,
        ...enemyCurses,
        ...greaterCurses
    ];

    return allCurses.find(
        item => item.name === name
    );

}


/* =========================================================
   CHECK REQUIREMENTS
   ========================================================= */

function requirementsMet(curse) {


    /* Required enemies */

    if (curse.requiresEnemies) {

        for (
            const requiredEnemy
            of curse.requiresEnemies
        ) {

            if (!hasEnemy(requiredEnemy)) {

                return false;

            }

        }

    }


    /* Required curses */

    if (curse.requiresCurses) {

        for (
            const requiredCurse
            of curse.requiresCurses
        ) {

            if (!hasCurse(requiredCurse)) {

                return false;

            }

        }

    }


    return true;

}


/* =========================================================
   CHECK EXCLUSIVE GROUP
   ========================================================= */

function exclusiveGroupAvailable(curse) {

    if (!curse.exclusiveGroup) {

        return true;

    }


    for (
        const activeCurse
        of runState.activeCurses
    ) {

        /*
           A curse never excludes itself -
           this only matters for stackable
           curses re-appearing in the pool.
        */

        if (activeCurse === curse.name) {

            continue;

        }


        const existing =
            findCurseByName(activeCurse);


        if (
            existing &&
            existing.exclusiveGroup ===
            curse.exclusiveGroup
        ) {

            return false;

        }

    }


    return true;

}


/* =========================================================
   CAN CURSE APPEAR?
   ========================================================= */

function canAppear(curse) {

    const level = getLevel();


    const stackCount =
        getCurseStackCount(curse.name);


    if (curse.max) {

        /*
           Stackable curse: stays in the pool
           until it's reached its max stacks.
        */

        if (stackCount >= curse.max) {

            return false;

        }

    }

    else {

        /*
           Normal curse: once taken, it's gone
           for the rest of the run.
        */

        if (stackCount >= 1) {

            return false;

        }

    }


    /* Level */

    if (
        curse.level !== undefined &&
        level < curse.level
    ) {

        return false;

    }


    /* Casual */

    if (
        runState.difficulty === "Casual" &&
        curse.casualDisabled
    ) {

        return false;

    }


    /* Requirements */

    if (!requirementsMet(curse)) {

        return false;

    }


    /* Exclusive curse */

    if (
        !exclusiveGroupAvailable(curse)
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   GET GLOBAL POOL
   ========================================================= */

function getGlobalPool() {

    return globalCurses.filter(
        canAppear
    );

}


/* =========================================================
   GET ENEMY POOL
   ========================================================= */

function getEnemyPool() {

    return enemyCurses.filter(
        curse => {

            if (
                !hasEnemy(curse.enemy)
            ) {

                return false;

            }


            return canAppear(curse);

        }
    );

}


/* =========================================================
   GET GREATER CURSE POOL
   ========================================================= */

function getGreaterPool() {

    const level =
        getLevel();


    /*
       Greater Curse scheduling:

       Casual:
       level 15, 25, then every 5

       Standard:
       level 10, 20, then every 5

       Extreme:
       level 10, then every 5
    */

    let isGreaterLevel = false;


    if (
        runState.difficulty ===
        "Casual"
    ) {

        isGreaterLevel =
            level >= 15 &&
            (
                level === 15 ||
                (
                    level >= 25 &&
                    level % 5 === 0
                )
            );

    }


    else if (
        runState.difficulty ===
        "Standard"
    ) {

        isGreaterLevel =
            level >= 10 &&
            level % 5 === 0;

    }


    else if (
        runState.difficulty ===
        "Extreme"
    ) {

        isGreaterLevel =
            level >= 10 &&
            level % 5 === 0;

    }


    if (!isGreaterLevel) {

        return [];

    }


    return greaterCurses.filter(
        canAppear
    );

}


/* =========================================================
   MEDAL POOL
   ========================================================= */

function getMedalPool() {

    const global =
        getGlobalPool();

    const enemy =
        getEnemyPool();


    return [
        ...global,
        ...enemy
    ].filter(
        curse => curse.medal
    );

}


/* =========================================================
   SELECT ENEMY
   ========================================================= */

function toggleEnemy(enemy) {

    if (
        runState.activeEnemies
            .has(enemy.name)
    ) {

        runState.activeEnemies
            .delete(enemy.name);

    }

    else {

        /*
           Make sure enemy requirements
           are satisfied.
        */

        if (enemy.requiresEnemies) {

            for (
                const required
                of enemy.requiresEnemies
            ) {

                if (
                    !hasEnemy(required)
                ) {

                    alert(
                        `${enemy.name} requires ${required} to be active.`
                    );

                    return;

                }

            }

        }


        runState.activeEnemies
            .add(enemy.name);

    }


    render();

}


/* =========================================================
   SELECT CURSE
   ========================================================= */

function selectCurse(curse) {

    /*
       Prevent selecting a stale card.
    */

    if (!canAppear(curse)) {

        return;

    }


    /*
       Store this run's pick. Adding to a Set is
       harmless even if the name is already in it;
       the real "how many times" answer lives in
       curseStacks.
    */

    runState.activeCurses
        .add(curse.name);

    runState.curseStacks.set(
        curse.name,
        getCurseStackCount(curse.name) + 1
    );


    /*
       Re-render immediately.
    */

    render();

}


/* =========================================================
   REMOVE CURSE
   ========================================================= */

function removeCurse(curseName) {

    /*
       Undo a mistaken pick: drop one stack of
       this curse. If that was the only stack,
       it also becomes available again in its
       original pool (or, for stackable curses,
       just opens up one more slot toward max).
    */

    const currentCount =
        getCurseStackCount(curseName);


    if (currentCount <= 1) {

        runState.activeCurses
            .delete(curseName);

        runState.curseStacks
            .delete(curseName);

    }

    else {

        runState.curseStacks.set(
            curseName,
            currentCount - 1
        );

    }


    render();

}


/* =========================================================
   CREATE ENEMY BUTTON
   ========================================================= */

function createEnemyButton(enemy) {

    const button =
        document.createElement("button");

    button.className =
        "select-button enemy-button";


    if (
        runState.activeEnemies
            .has(enemy.name)
    ) {

        button.classList.add(
            "selected"
        );

    }


    const media =
        createMediaBox(
            "enemies",
            enemy.name
        );

    button.appendChild(media);


    button.addEventListener(
        "click",
        () => toggleEnemy(enemy)
    );


    return button;

}


/* =========================================================
   CREATE DIFFICULTY BUTTON
   ========================================================= */

function createDifficultyButton(
    difficulty
) {

    const button =
        document.createElement("button");

    // base class + a per-difficulty class so css can
    // give each one its own hover color, see style.css
    button.className =
        `select-button difficulty-${difficulty.toLowerCase()}`;


    if (
        runState.difficulty ===
        difficulty
    ) {

        button.classList.add(
            "selected"
        );

    }


    button.textContent =
        difficulty;


    button.addEventListener(
        "click",
        () => {

            runState.difficulty =
                difficulty;

            render();

        }
    );


    return button;

}


/* =========================================================
   CREATE CURSE CARD
   ========================================================= */

function createCurseCard(
    curse,
    isMedal = false
) {

    const card =
        document.createElement("button");

    card.className =
        "curse-card";


    if (isMedal) {

        card.classList.add(
            "medal"
        );

    }


    const media =
        createMediaBox(
            "curses",
            curse.name
        );

    card.appendChild(media);


    if (
        curse.enemy
    ) {

        const info =
            document.createElement("div");

        info.className =
            "curse-info";

        info.textContent =
            curse.enemy;

        card.appendChild(info);

    }


    if (curse.max) {

        const stackInfo =
            document.createElement("div");

        stackInfo.className =
            "curse-info stack-info";

        stackInfo.textContent =
            `${getCurseStackCount(curse.name)} / ${curse.max}`;

        card.appendChild(stackInfo);

    }


    if (isMedal) {

        const medal =
            document.createElement("div");

        medal.className =
            "medal-label";

        medal.textContent =
            "MEDAL";

        card.appendChild(medal);

    }


    card.addEventListener(
        "click",
        () => selectCurse(curse)
    );


    return card;

}


/* =========================================================
   RENDER ACTIVE CURSES
   ========================================================= */

function renderActiveCurses() {

    const container =
        document.getElementById(
            "activeCurseContainer"
        );

    container.innerHTML = "";


    if (
        runState.activeCurses.size === 0
    ) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-state";

        empty.textContent =
            "no curses selected";

        container.appendChild(empty);

        return;

    }


    for (
        const curseName
        of runState.activeCurses
    ) {

        const curse =
            findCurseByName(curseName);


        if (!curse) {

            continue;

        }


        const item =
            document.createElement("div");

        item.className =
            "active-curse";


        const name =
            document.createElement("span");

        name.textContent =
            curse.name;


        const stackCount =
            getCurseStackCount(curse.name);


        if (stackCount > 1) {

            name.textContent +=
                ` ×${stackCount}`;

        }


        item.appendChild(name);


        const type =
            document.createElement("span");

        type.className =
            "active-curse-type";


        if (curse.enemy) {

            type.textContent =
                "ENEMY";

        }

        else if (curse.medal) {

            type.textContent =
                "MEDAL";

        }

        else {

            type.textContent =
                "CURSE";

        }


        item.appendChild(type);


        /*
           Remove button: undoes the pick
           and returns the curse to its
           original pool.
        */

        const removeButton =
            document.createElement("button");

        removeButton.className =
            "active-curse-remove";

        removeButton.textContent =
            "×";

        removeButton.setAttribute(
            "aria-label",
            `Remove ${curse.name}`
        );

        removeButton.addEventListener(
            "click",
            event => {

                /*
                   Stop this from bubbling up
                   in case the whole row ever
                   becomes clickable later.
                */

                event.stopPropagation();

                removeCurse(curse.name);

            }
        );

        item.appendChild(removeButton);


        container.appendChild(item);

    }

}


/* =========================================================
   RENDER RESULT SECTION
   ========================================================= */

function renderPool(
    containerId,
    curses,
    medal = false
) {

    const container =
        document.getElementById(
            containerId
        );

    container.innerHTML = "";


    if (curses.length === 0) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-pool";

        empty.textContent =
            "nothing currently available";

        container.appendChild(empty);

        return;

    }


    curses.forEach(
        curse => {

            const card =
                createCurseCard(
                    curse,
                    medal
                );

            container.appendChild(card);

        }
    );

}


/* =========================================================
   RENDER EVERYTHING
   ========================================================= */

function render() {


    /* Level */

    runState.level =
        getLevel();


    /* Difficulty */

    const difficultyContainer =
        document.getElementById(
            "difficultyContainer"
        );

    difficultyContainer.innerHTML = "";


    difficulties.forEach(
        difficulty => {

            difficultyContainer.appendChild(
                createDifficultyButton(
                    difficulty
                )
            );

        }
    );


    /* Enemies */

    const enemyContainer =
        document.getElementById(
            "enemyContainer"
        );

    enemyContainer.innerHTML = "";


    enemies
        .filter(
            enemy =>
                runState.level >=
                enemy.level
        )
        .forEach(
            enemy => {

                enemyContainer.appendChild(
                    createEnemyButton(
                        enemy
                    )
                );

            }
        );


    /*
       Remove enemies that are no
       longer valid after level change.
    */

    for (
        const enemyName
        of runState.activeEnemies
    ) {

        const enemy =
            enemies.find(
                item =>
                    item.name ===
                    enemyName
            );


        if (
            enemy &&
            runState.level <
            enemy.level
        ) {

            runState.activeEnemies
                .delete(enemyName);

        }

    }


    /* Active curse count */

    document.getElementById(
        "curseCount"
    ).textContent =
        runState.activeCurses.size;


    /* Enemy count */

    document.getElementById(
        "enemyCount"
    ).textContent =
        runState.activeEnemies.size;


    /* Active curses */

    renderActiveCurses();


    /* Pools */

    renderPool(
        "medalCurseContainer",
        getMedalPool(),
        true
    );


    renderPool(
        "globalCurseContainer",
        getGlobalPool()
    );


    renderPool(
        "enemyCurseContainer",
        getEnemyPool()
    );


    renderPool(
        "greaterCurseContainer",
        getGreaterPool()
    );

}


/* =========================================================
   LEVEL INPUT
   ========================================================= */

document
    .getElementById("levelInput")
    .addEventListener(
        "input",
        render
    );


/* =========================================================
   RESET
   ========================================================= */

document
    .getElementById("resetButton")
    .addEventListener(
        "click",
        () => {

            runState.level = 1;

            runState.difficulty =
                "Standard";

            runState.activeEnemies
                .clear();

            runState.activeCurses
                .clear();

            runState.curseStacks
                .clear();


            document
                .getElementById(
                    "levelInput"
                )
                .value = 1;


            render();

        }
    );


/* =========================================================
   background parallax
   moves #bgLayer a little based on mouse position, just
   enough to feel alive without making anyone seasick
   ========================================================= */

const bgLayer =
    document.getElementById("bgLayer");

// how far the background can drift, in px. keep this small,
// past like 30 it starts feeling like a bad webcam filter
const BG_DRIFT_RANGE = 18;

if (bgLayer) {

    window.addEventListener(
        "mousemove",
        event => {

            // where's the mouse, as -1 (left/top) to 1 (right/bottom),
            // 0 being dead center of the window
            const normalizedX =
                (event.clientX / window.innerWidth) * 2 - 1;

            const normalizedY =
                (event.clientY / window.innerHeight) * 2 - 1;

            // negative on purpose - background drifts AWAY from
            // the cursor, reads as depth instead of "thing glued
            // to mouse". flip the sign if you want the opposite feel
            const moveX =
                -normalizedX * BG_DRIFT_RANGE;

            const moveY =
                -normalizedY * BG_DRIFT_RANGE;

            bgLayer.style.transform =
                `translate(${moveX}px, ${moveY}px)`;

        }
    );

}
// if you're reading this at 3am debugging why the bg won't move,
// check that #bgLayer actually exists in the html first. ask me how i know


/* =========================================================
   INITIAL RENDER
   ========================================================= */

render();