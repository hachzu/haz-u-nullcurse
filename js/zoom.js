/*
 * UI Zoom Control
 * --------------------------
 * Small zoom control living in the left sidebar - shrinks or grows
 * the whole `.app` layout via the CSS `zoom` property so curse
 * pools, upgrade rows, and death tracker rows can pack tighter on
 * smaller monitors instead of clipping or forcing a horizontal
 * scrollbar. `zoom` (not `transform: scale`) is used specifically
 * because it reflows the subtree to actually pack in more content
 * rather than just shrinking whitespace around it.
 *
 * Synced to the browser's own Ctrl +/- (and Ctrl+0) zoom shortcuts -
 * pressing them drives this same zoom level instead of leaving it to
 * the browser's separate native page zoom, so the familiar shortcut
 * does the same thing here as the sidebar buttons do.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound, playRemoveSound.
 */

const ZOOM_STORAGE_KEY = "nullscapeZoomLevel";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;

const supportsCssZoom = "zoom" in document.documentElement.style;

let zoomLevel = ZOOM_DEFAULT;

function clampZoom(value) {

    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

}

function roundZoom(value) {

    // Kills floating-point crumbs (0.7999999999) so the % readout
    // always lands on a clean number.
    return Math.round(value * 100) / 100;

}

function saveZoomLevel() {

    try {

        localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));

    } catch (error) {

        console.warn("couldn't save zoom level:", error);

    }

}

function loadZoomLevel() {

    try {

        const raw = localStorage.getItem(ZOOM_STORAGE_KEY);

        if (!raw) {

            return;

        }

        const saved = Number(raw);

        if (Number.isFinite(saved)) {

            zoomLevel = roundZoom(clampZoom(saved));

        }

    } catch (error) {

        console.warn("couldn't load saved zoom level, starting fresh:", error);

    }

}

function updateZoomDisplay() {

    const valueEl = document.getElementById("zoomValueDisplay");

    if (valueEl) {

        valueEl.textContent = Math.round(zoomLevel * 100) + "%";

    }

}

function applyZoomLevel() {

    const appEl = document.querySelector(".app");

    if (appEl) {

        // Browsers without CSS zoom support (older Firefox/Safari)
        // just stay at 100% instead of the layout silently breaking.
        appEl.style.zoom = supportsCssZoom ? String(zoomLevel) : "";

    }

    updateZoomDisplay();

}

function setZoomLevel(value) {

    zoomLevel = roundZoom(clampZoom(value));

    saveZoomLevel();
    applyZoomLevel();

}

function adjustZoomLevel(delta) {

    setZoomLevel(zoomLevel + delta);

}

function resetZoomLevel() {

    setZoomLevel(ZOOM_DEFAULT);

}

const zoomOutButton = document.getElementById("zoomOutButton");
const zoomInButton = document.getElementById("zoomInButton");
const zoomResetButton = document.getElementById("zoomResetButton");

if (zoomOutButton) {

    attachClickAction(zoomOutButton, () => adjustZoomLevel(-ZOOM_STEP), playUtilitySound);

}

if (zoomInButton) {

    attachClickAction(zoomInButton, () => adjustZoomLevel(ZOOM_STEP), playUtilitySound);

}

if (zoomResetButton) {

    attachClickAction(zoomResetButton, resetZoomLevel, playRemoveSound);

}

/*
 * Ctrl/Cmd +, -, and 0 drive this same zoom level instead of the
 * browser's own separate page zoom - preventDefault stops the
 * native zoom from also firing alongside this one, so the shortcut
 * just does one consistent thing.
 */
document.addEventListener("keydown", event => {

    if (!(event.ctrlKey || event.metaKey)) {

        return;

    }

    if (event.key === "+" || event.key === "=") {

        event.preventDefault();
        adjustZoomLevel(ZOOM_STEP);

    } else if (event.key === "-" || event.key === "_") {

        event.preventDefault();
        adjustZoomLevel(-ZOOM_STEP);

    } else if (event.key === "0") {

        event.preventDefault();
        resetZoomLevel();

    }

});

loadZoomLevel();
applyZoomLevel();
