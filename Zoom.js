/*
 * UI Zoom Control
 * --------------------------
 * Lets the player shrink (or enlarge) the whole app layout to fit
 * smaller monitors/laptops - curse pools, the upgrade calculator,
 * and the death tracker can all get wide/tall enough to clip or
 * force scrollbars on tighter resolutions. Rather than rebuilding
 * every grid to be fully responsive, this scales the entire `.app`
 * container using the CSS `zoom` property.
 *
 * `zoom` (not `transform: scale`) is what's used here on purpose:
 * transform would require manually compensating width/height to
 * avoid clipping, and it also drags position:fixed descendants
 * along with it. `zoom` instead reflows the subtree as if its
 * effective pixel density changed - so shrinking it actually packs
 * in more curse cards/upgrade rows per row instead of just shrinking
 * whitespace, and anything position:fixed (the floating toggle
 * buttons, this control's own button) stays at its normal on-screen
 * size no matter what zoom level is chosen, so it's never at risk
 * of becoming too small to click.
 *
 * Adjustable by dragging the popover's slider, clicking a preset, or
 * scrolling the mouse wheel while hovering the floating ZOOM button
 * itself - a literal "zoom scroll." Persists to localStorage same as
 * the other trackers on this page.
 *
 * Depends on globals defined in script.js (playUtilitySound,
 * playDifficultySound, playRemoveSound) only for button feedback
 * sounds - each call is guarded with typeof so this file works fine
 * even if script.js hasn't loaded yet or those helpers are missing.
 */

(function () {

    const ZOOM_STORAGE_KEY = "nullscapeZoomLevel";

    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 1.5;
    const STEP = 0.05;
    const DEFAULT_ZOOM = 1;

    const supportsCssZoom = typeof document !== "undefined"
        && document.documentElement
        && "zoom" in document.documentElement.style;

    let zoomLevel = DEFAULT_ZOOM;

    function clampZoom(value) {

        return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

    }

    function roundToStep(value) {

        const stepped = Math.round(value / STEP) * STEP;

        // Kill floating-point crumbs (0.7999999999) so the slider and
        // the % readout always land on a clean number.
        return Math.round(stepped * 100) / 100;

    }

    function loadZoom() {

        try {

            const raw = localStorage.getItem(ZOOM_STORAGE_KEY);

            if (!raw) {

                return;

            }

            const saved = Number(raw);

            if (Number.isFinite(saved)) {

                zoomLevel = roundToStep(clampZoom(saved));

            }

        } catch (error) {

            console.warn("couldn't load saved zoom level:", error);

        }

    }

    function saveZoom() {

        try {

            localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel));

        } catch (error) {

            console.warn("couldn't save zoom level:", error);

        }

    }

    function applyZoom() {

        const appEl = document.querySelector(".app");

        if (appEl) {

            // Engines without CSS zoom support (older Firefox/Safari)
            // just render at 100% instead of silently breaking the
            // layout - not ideal, but safe.
            appEl.style.zoom = supportsCssZoom ? String(zoomLevel) : "";

        }

        if (typeof window.refreshZoomSettingsUI === "function") {

            window.refreshZoomSettingsUI();

        }

    }

    function setZoom(value) {

        zoomLevel = roundToStep(clampZoom(value));

        saveZoom();
        applyZoom();

    }

    function adjustZoom(delta) {

        setZoom(zoomLevel + delta);

    }

    function resetZoom() {

        setZoom(DEFAULT_ZOOM);

    }

    // ---- Public API - lets other scripts/consoles read or drive
    // the zoom level directly if ever needed. ----
    window.NullscapeZoom = {

        get() {

            return zoomLevel;

        },

        set(value) {

            setZoom(value);

        },

        adjust(delta) {

            adjustZoom(delta);

        },

        reset() {

            resetZoom();

        }

    };

    function buildUI() {

        const wrapper = document.querySelector(".floating-toggle-buttons");

        if (!wrapper || document.getElementById("zoomToggleButton")) {

            return;

        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "zoomToggleButton";
        button.className = "zoom-toggle-button";
        button.setAttribute("aria-label", "Adjust UI zoom");
        button.setAttribute("aria-expanded", "false");
        button.title = "Scroll to zoom, or click for more options";

        button.innerHTML = ""
            + '<span class="zoom-toggle-icon">&#128269;</span>'
            + '<span class="btn-label">ZOOM</span>'
            + '<span class="zoom-toggle-value" id="zoomToggleValue">100%</span>';

        wrapper.appendChild(button);

        const panel = document.createElement("div");

        panel.id = "zoomSettingsPanel";
        panel.className = "zoom-settings-panel";
        panel.setAttribute("role", "dialog");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="zoom-settings-header-row">
                <div class="zoom-settings-heading">UI ZOOM</div>
                <button type="button" id="zoomCloseButton" class="particle-close-button" aria-label="Close zoom settings">&times;</button>
            </div>

            <div class="zoom-settings-hint">
                Shrinks or enlarges the whole layout so curse pools, the
                upgrade calculator, and the death tracker fit smaller
                screens. Scroll over the ZOOM button any time to adjust
                without opening this panel.
            </div>

            <label class="zoom-settings-row">
                <span id="zoomSettingsValue">100%</span>
                <input
                    type="range"
                    id="zoomRangeInput"
                    min="${Math.round(MIN_ZOOM * 100)}"
                    max="${Math.round(MAX_ZOOM * 100)}"
                    step="${Math.round(STEP * 100)}"
                >
            </label>

            <div class="zoom-preset-row">
                <button type="button" class="zoom-preset-button" data-zoom="0.75">75%</button>
                <button type="button" class="zoom-preset-button" data-zoom="0.9">90%</button>
                <button type="button" class="zoom-preset-button" data-zoom="1">100%</button>
                <button type="button" class="zoom-preset-button" data-zoom="1.1">110%</button>
            </div>

            <button type="button" id="zoomResetButton" class="upgrade-reset-button particle-reset-button">
                <span class="btn-label">RESET</span>
            </button>
        `;

        document.body.appendChild(panel);

        function positionPanel() {

            const rect = button.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 240;
            const panelHeight = panel.offsetHeight || 220;

            // Opens upward from the floating button (parked in the
            // bottom-right corner) instead of downward off the
            // bottom of the viewport, and stays clamped on-screen
            // horizontally too.
            const maxLeft = window.innerWidth - panelWidth - 8;
            const left = Math.min(rect.left, maxLeft);

            panel.style.left = Math.max(8, left) + "px";
            panel.style.top = Math.max(8, rect.top - panelHeight - 10) + "px";

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

            // Stops this click from also tripping the document-level
            // "click outside closes it" listener below in the same
            // event (same trick Particles.js uses for its own
            // popover).
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

        // Scroll-to-zoom - the literal "zoom scroll": hovering the
        // floating button (or the open panel) and scrolling adjusts
        // the level immediately, no need to open anything first.
        function handleWheelZoom(event) {

            event.preventDefault();

            adjustZoom(event.deltaY < 0 ? STEP : -STEP);

        }

        button.addEventListener("wheel", handleWheelZoom, { passive: false });
        panel.addEventListener("wheel", handleWheelZoom, { passive: false });

        const closeButton = panel.querySelector("#zoomCloseButton");

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

        const rangeInput = panel.querySelector("#zoomRangeInput");
        const rangeValueLabel = panel.querySelector("#zoomSettingsValue");
        const presetButtons = panel.querySelectorAll(".zoom-preset-button");
        const resetButton = panel.querySelector("#zoomResetButton");

        rangeInput.addEventListener("input", () => {

            setZoom(Number(rangeInput.value) / 100);

        });

        presetButtons.forEach(presetButton => {

            presetButton.addEventListener("click", () => {

                setZoom(Number(presetButton.dataset.zoom));

                if (typeof playDifficultySound === "function") {

                    playDifficultySound();

                }

            });

        });

        resetButton.addEventListener("click", () => {

            resetZoom();

            if (typeof playRemoveSound === "function") {

                playRemoveSound();

            }

        });

        function refresh() {

            const percent = Math.round(zoomLevel * 100);

            rangeInput.value = percent;
            rangeValueLabel.textContent = percent + "%";

            const toggleValueEl = document.getElementById("zoomToggleValue");

            if (toggleValueEl) {

                toggleValueEl.textContent = percent + "%";

            }

            presetButtons.forEach(presetButton => {

                const matches = Math.abs(Number(presetButton.dataset.zoom) - zoomLevel) < 0.001;

                presetButton.classList.toggle("selected", matches);

            });

        }

        window.refreshZoomSettingsUI = refresh;

        refresh();

    }

    function init() {

        buildUI();
        loadZoom();
        applyZoom();

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", init);

    } else {

        init();

    }

})();