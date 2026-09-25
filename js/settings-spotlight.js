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