/*
 * Curse Tracker help overlay
 * --------------------------
 * Wires up the small "?" trigger next to the CURSE POOLS title (see
 * the markup in Toolkits.html and the styles in curse-help.css) to a
 * full-screen overlay dialog explaining how the curse tracker works.
 * Purely presentational: no game state is read or written here, this
 * file only opens/closes the overlay.
 *
 * Unlike the sliding Upgrade/Death/Altars/Lobby panels, this overlay
 * deliberately does not remember being left open across page loads -
 * a help dialog popping up unasked on every visit would be worse
 * than not having it at all, so it always starts closed.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound. Both are optional - this still works with a
 * plain click and no sound if either is missing.
 */

const curseHelpToggle = document.getElementById("curseHelpToggle");
const curseHelpOverlay = document.getElementById("curseHelpOverlay");
const curseHelpBackdrop = document.getElementById("curseHelpOverlayBackdrop");
const curseHelpCloseButton = document.getElementById("curseHelpCloseButton");

let curseHelpPreviousBodyOverflow = "";

function setCurseHelpOpen(isOpen) {

    if (!curseHelpToggle || !curseHelpOverlay) {

        return;

    }

    curseHelpOverlay.classList.toggle("curse-help-overlay--open", isOpen);
    curseHelpOverlay.setAttribute("aria-hidden", isOpen ? "false" : "true");

    curseHelpToggle.classList.toggle("active", isOpen);
    curseHelpToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");

    // Lock page scroll behind the overlay while it's open, same idea
    // as any other modal - restores whatever inline overflow value
    // (if any) was already on body rather than assuming it was
    // empty, so this plays nicely if something else ever sets that
    // property too.
    if (isOpen) {

        curseHelpPreviousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        curseHelpOverlay.focus?.();

    } else {

        document.body.style.overflow = curseHelpPreviousBodyOverflow;

    }

}

function isCurseHelpOpen() {

    return Boolean(curseHelpOverlay && curseHelpOverlay.classList.contains("curse-help-overlay--open"));

}

if (curseHelpToggle && curseHelpOverlay) {

    const openHelp = () => setCurseHelpOpen(!isCurseHelpOpen());

    if (typeof attachClickAction === "function") {

        attachClickAction(curseHelpToggle, openHelp, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    } else {

        curseHelpToggle.addEventListener("click", openHelp);

    }

    if (curseHelpCloseButton) {

        const closeHelp = () => setCurseHelpOpen(false);

        if (typeof attachClickAction === "function") {

            attachClickAction(curseHelpCloseButton, closeHelp, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

        } else {

            curseHelpCloseButton.addEventListener("click", closeHelp);

        }

    }

    if (curseHelpBackdrop) {

        curseHelpBackdrop.addEventListener("click", () => setCurseHelpOpen(false));

    }

    document.addEventListener("keydown", event => {

        if (event.key === "Escape" && isCurseHelpOpen()) {

            setCurseHelpOpen(false);

        }

    });

}