/*
 * Expandable "online" list
 * --------------------------
 * presence.js keeps #liveViewerCount and #liveViewerList up to date
 * from Firebase. This file only handles how that list is shown:
 *
 * - Opens on hover, and pins open on click/tap/Enter/Space so it also
 *   works on touch screens and can be left open to read. Click the
 *   badge again, click elsewhere, or press Escape to close it.
 * - The list is position: fixed (placed under the badge from here)
 *   instead of absolute inside the sidebar, because the sidebar
 *   clips anything that sticks out past its own 400px width - fixed
 *   lets the list grow to the right, over the main area.
 * - Names fill columns top-to-bottom (8 per column). As more people
 *   join, columns are added and the box widens to the right, with
 *   the CSS transitions on width/clip-path doing the animating.
 *   Past what fits on screen it scrolls instead.
 *
 * Doesn't touch presence.js's data code at all: a MutationObserver
 * notices whenever it rewrites the list and re-lays it out.
 * The styles live next to the badge in style.css.
 */

(function () {

    const badge = document.getElementById("liveViewerBadge");
    const list = document.getElementById("liveViewerList");

    if (!badge || !list) {

        return;

    }

    const COL_WIDTH = 140;     // px per column of names
    const GAP = 4;             // px between names / columns
    const PADDING = 8;         // px inside the list box
    const MAX_ROWS = 8;        // names per column before a new column starts
    const MAX_COLS = 5;        // never wider than this, scroll instead
    const EDGE = 8;            // px kept clear of the viewport edge
    const CLOSE_DELAY_MS = 200; // grace period for crossing the gap to the list
    const STAGGER_WINDOW_MS = 1200;

    let hovering = false;
    let pinned = false;
    let isOpen = false;

    let closeTimer = null;
    let openingTimer = null;

    list.style.setProperty("--viewer-col-w", COL_WIDTH + "px");
    list.style.setProperty("--viewer-gap", GAP + "px");
    list.style.setProperty("--viewer-pad", PADDING + "px");

    badge.setAttribute("role", "button");
    badge.setAttribute("tabindex", "0");
    badge.setAttribute("aria-expanded", "false");
    badge.setAttribute("aria-controls", "liveViewerList");
    badge.setAttribute("aria-label", "People online - show list");

    list.setAttribute("role", "group");
    list.setAttribute("aria-label", "People online");

    /*
     * Picks how many columns/rows the current number of names needs
     * (limited by how much screen is left to the right of the badge)
     * and numbers each name so the open animation can stagger them
     * left-to-right, column by column.
     */
    function layout() {

        const items = Array.from(list.children);
        const count = Math.max(1, items.length);

        const rect = badge.getBoundingClientRect();
        const left = Math.max(EDGE, rect.left);

        const roomForCols = Math.floor(
            (window.innerWidth - left - EDGE - PADDING * 2 + GAP) / (COL_WIDTH + GAP)
        );

        const maxCols = Math.max(1, Math.min(MAX_COLS, roomForCols));
        const cols = Math.min(maxCols, Math.max(1, Math.ceil(count / MAX_ROWS)));
        const rows = Math.ceil(count / cols);

        list.style.setProperty("--viewer-cols", cols);
        list.style.setProperty("--viewer-rows", rows);

        items.forEach((item, index) => {

            item.style.setProperty("--i", index);

        });

    }

    function position() {

        const rect = badge.getBoundingClientRect();
        const top = rect.bottom + 8;

        list.style.top = top + "px";
        list.style.left = Math.max(EDGE, rect.left) + "px";
        list.style.maxHeight = Math.max(120, window.innerHeight - top - EDGE) + "px";

    }

    function update() {

        const shouldOpen = pinned || hovering;

        if (shouldOpen === isOpen) {

            return;

        }

        isOpen = shouldOpen;

        if (isOpen) {

            layout();
            position();

        }

        list.classList.toggle("open", isOpen);
        badge.classList.toggle("open", isOpen);
        badge.setAttribute("aria-expanded", isOpen ? "true" : "false");
        badge.setAttribute("aria-label", isOpen ? "People online - hide list" : "People online - show list");

        // The per-name slide-in only plays as the list opens. Names get
        // re-created whenever anyone joins or leaves, so leaving it on
        // would replay it on every update while the list is open.
        clearTimeout(openingTimer);

        if (isOpen) {

            list.classList.add("opening");

            openingTimer = setTimeout(() => {

                list.classList.remove("opening");

            }, STAGGER_WINDOW_MS);

        } else {

            list.classList.remove("opening");

        }

    }

    badge.addEventListener("mouseenter", () => {

        clearTimeout(closeTimer);

        hovering = true;
        update();

    });

    badge.addEventListener("mouseleave", () => {

        clearTimeout(closeTimer);

        closeTimer = setTimeout(() => {

            hovering = false;
            update();

        }, CLOSE_DELAY_MS);

    });

    badge.addEventListener("click", event => {

        // Clicks on names inside the list bubble up here too - those
        // shouldn't pin/unpin anything.
        if (list.contains(event.target)) {

            return;

        }

        if (pinned) {

            pinned = false;
            hovering = false;

        } else {

            pinned = true;

        }

        update();

        if (typeof playUtilitySound === "function") {

            playUtilitySound();

        }

    });

    badge.addEventListener("keydown", event => {

        if (event.target !== badge) {

            return;

        }

        if (event.key === "Enter" || event.key === " ") {

            event.preventDefault();
            badge.click();

        }

    });

    document.addEventListener("click", event => {

        if (pinned && !badge.contains(event.target)) {

            pinned = false;
            update();

        }

    });

    document.addEventListener("keydown", event => {

        if (event.key === "Escape" && isOpen) {

            pinned = false;
            hovering = false;
            update();

        }

    });

    // Names are re-rendered by presence.js on every join/leave; re-fit
    // the columns each time (the box widens/narrows via CSS transition).
    new MutationObserver(() => {

        layout();

        if (isOpen) {

            position();

        }

    }).observe(list, { childList: true });

    window.addEventListener("resize", () => {

        layout();

        if (isOpen) {

            position();

        }

    });

    // The sidebar scrolls; keep the fixed list attached to the badge.
    window.addEventListener("scroll", () => {

        if (isOpen) {

            position();

        }

    }, true);

    layout();

})();