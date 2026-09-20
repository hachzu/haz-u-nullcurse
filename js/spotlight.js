/*
 * Tools Spotlight
 * --------------------------
 * A one-time-per-visit highlight pointing at the floating Upgrades/
 * Deaths/Altars buttons in the bottom-right corner, for anyone who's
 * only ever touched the curse tracker and might not notice there's
 * more here. Dims the rest of the page, leaves a clear "window"
 * exactly around those buttons, and shows a small callout explaining
 * what they are.
 *
 * Shows again on every page load by design (not just once ever) -
 * that's what was asked for - until the person dismisses it with
 * "Don't show again", which is the only thing that persists via
 * localStorage. Plain "Got it" only closes it for this visit.
 *
 * Fully self-contained: no dependency on script.js globals, so load
 * order relative to the other feature scripts doesn't matter.
 */

(function () {

    const STORAGE_KEY = "nullscapeHideToolsSpotlight";
    const SHOW_DELAY_MS = 900;
    const FADE_OUT_MS = 250;

    function shouldShow() {

        try {

            return localStorage.getItem(STORAGE_KEY) !== "true";

        } catch (error) {

            // If storage is unavailable for some reason, default to
            // showing it rather than silently never showing it.
            return true;

        }

    }

    function hidePermanently() {

        try {

            localStorage.setItem(STORAGE_KEY, "true");

        } catch (error) {

            console.warn("couldn't save spotlight dismissal:", error);

        }

    }

    let elements = null;
    let resizeHandler = null;
    let keydownHandler = null;

    /*
     * Positions the four dimming panels (top/bottom/left/right)
     * around the target's bounding box, leaving that exact rectangle
     * completely uncovered - not punched via a mask or box-shadow
     * trick, just four rectangles filling in everywhere else. That
     * means the target itself needs no pointer-events workaround: it
     * was never covered by anything to begin with, so it's already
     * at full brightness and fully clickable underneath.
     */
    function position(target) {

        if (!elements) {

            return;

        }

        const rect = target.getBoundingClientRect();
        const padding = 10;

        const rectTop = Math.max(0, rect.top - padding);
        const rectLeft = Math.max(0, rect.left - padding);
        const rectRight = Math.min(window.innerWidth, rect.right + padding);
        const rectBottom = Math.min(window.innerHeight, rect.bottom + padding);

        const width = rectRight - rectLeft;
        const height = rectBottom - rectTop;

        elements.top.style.height = rectTop + "px";

        elements.bottom.style.top = rectBottom + "px";

        elements.left.style.top = rectTop + "px";
        elements.left.style.width = rectLeft + "px";
        elements.left.style.height = height + "px";

        elements.right.style.top = rectTop + "px";
        elements.right.style.left = rectRight + "px";
        elements.right.style.height = height + "px";

        elements.ring.style.top = rectTop + "px";
        elements.ring.style.left = rectLeft + "px";
        elements.ring.style.width = width + "px";
        elements.ring.style.height = height + "px";

        // Callout sits above the target, right-aligned to it, and
        // clamps to stay fully on-screen. On short viewports where
        // there's no room above, it drops below the target instead
        // and flips its little arrow to match.
        const calloutWidth = elements.callout.offsetWidth || 280;
        const calloutHeight = elements.callout.offsetHeight || 150;
        const gap = 16;

        let calloutLeft = rectRight - calloutWidth;

        calloutLeft = Math.max(12, Math.min(calloutLeft, window.innerWidth - calloutWidth - 12));

        let calloutTop = rectTop - calloutHeight - gap;
        let below = false;

        if (calloutTop < 12) {

            calloutTop = rectBottom + gap;
            below = true;

        }

        elements.callout.style.left = calloutLeft + "px";
        elements.callout.style.top = calloutTop + "px";
        elements.callout.classList.toggle("tools-spotlight-callout--below", below);

    }

    function close(neverAgain) {

        if (!elements) {

            return;

        }

        if (neverAgain) {

            hidePermanently();

        }

        const { overlay } = elements;

        overlay.classList.remove("tools-spotlight-overlay--visible");

        if (resizeHandler) {

            window.removeEventListener("resize", resizeHandler);
            resizeHandler = null;

        }

        if (keydownHandler) {

            document.removeEventListener("keydown", keydownHandler);
            keydownHandler = null;

        }

        setTimeout(() => {

            overlay.remove();
            elements = null;

        }, FADE_OUT_MS);

    }

    function buildSpotlight(target) {

        const overlay = document.createElement("div");

        overlay.className = "tools-spotlight-overlay";

        const top = document.createElement("div");
        const bottom = document.createElement("div");
        const left = document.createElement("div");
        const right = document.createElement("div");

        top.className = "tools-spotlight-panel tools-spotlight-panel--top";
        bottom.className = "tools-spotlight-panel tools-spotlight-panel--bottom";
        left.className = "tools-spotlight-panel tools-spotlight-panel--left";
        right.className = "tools-spotlight-panel tools-spotlight-panel--right";

        [top, bottom, left, right].forEach(panel => {

            panel.addEventListener("click", () => close(false));

        });

        const ring = document.createElement("div");

        ring.className = "tools-spotlight-ring";

        const callout = document.createElement("div");

        callout.className = "tools-spotlight-callout";
        callout.innerHTML = ""
            + '<div class="tools-spotlight-callout-arrow"></div>'
            + '<div class="tools-spotlight-callout-title">More tools live down here</div>'
            + '<div class="tools-spotlight-callout-body">'
            + "The curse tracker isn't the only thing on this page - the "
            + "Upgrade Calculator, Death Tracker, and Altars buttons are "
            + "right there too."
            + "</div>"
            + '<div class="tools-spotlight-callout-actions">'
            + '<button type="button" class="tools-spotlight-dismiss-button" id="toolsSpotlightGotIt">Got it</button>'
            + '<button type="button" class="tools-spotlight-neveragain-button" id="toolsSpotlightNeverAgain">Don\'t show again</button>'
            + "</div>";

        overlay.append(top, bottom, left, right, ring, callout);
        document.body.appendChild(overlay);

        elements = { overlay, top, bottom, left, right, ring, callout };

        position(target);

        // Double rAF so the browser commits the initial (zero-opacity)
        // state to a frame before the "visible" class kicks off the
        // fade-in transition - a single rAF can still land in the
        // same paint in some browsers and skip the transition.
        requestAnimationFrame(() => {

            requestAnimationFrame(() => {

                overlay.classList.add("tools-spotlight-overlay--visible");

            });

        });

        callout.querySelector("#toolsSpotlightGotIt").addEventListener("click", () => close(false));
        callout.querySelector("#toolsSpotlightNeverAgain").addEventListener("click", () => close(true));

    }

    function open() {

        const target = document.querySelector(".floating-toggle-buttons");

        // Nothing to point at if the person has collapsed the buttons
        // away with the arrow toggle - the ring would frame empty space.
        if (!target || target.classList.contains("collapsed")) {

            return;

        }

        buildSpotlight(target);

        resizeHandler = () => position(target);
        window.addEventListener("resize", resizeHandler);

        keydownHandler = event => {

            if (event.key === "Escape") {

                close(false);

            }

        };

        document.addEventListener("keydown", keydownHandler);

    }

    function init() {

        if (!shouldShow()) {

            return;

        }

        setTimeout(open, SHOW_DELAY_MS);

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", init);

    } else {

        init();

    }

})();