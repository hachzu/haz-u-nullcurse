/*
 * Altars panel logic
 * --------------------------
 * Third sliding panel, following the same toggle-button + overlay
 * pattern as Upgrades.js / DeathTracker.js. The panel itself is
 * currently just a "coming soon" placeholder (see index.html /
 * Altars.css) - no game data model needed yet, so this file only
 * handles opening/closing the panel and keeping it mutually
 * exclusive with the other two.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound.
 * Mutual exclusion with the other two panels is wired both ways:
 * this file closes them when Altars opens, and small hooks added to
 * setUpgradePanelOpen (Upgrades.js) / setDeathPanelOpen
 * (DeathTracker.js) close Altars when either of those opens.
 */


const altarsToggleButton = document.getElementById("altarsToggleButton");
const altarsPanel = document.getElementById("altarsPanel");


function setAltarsPanelOpen(isOpen) {

    if (!altarsPanel || !altarsToggleButton) {

        return;

    }

    // Mutually exclusive with the Upgrade and Death Tracker panels -
    // opening this one closes both of those instead of letting the
    // panels overlay each other.
    if (isOpen) {

        if (typeof setUpgradePanelOpen === "function") {

            setUpgradePanelOpen(false);

        }

        if (typeof setDeathPanelOpen === "function") {

            setDeathPanelOpen(false);

        }

    }

    altarsPanel.classList.toggle("open", isOpen);
    altarsToggleButton.classList.toggle("active", isOpen);
    altarsToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

}


if (altarsToggleButton && altarsPanel) {

    attachClickAction(altarsToggleButton, () => {

        setAltarsPanelOpen(!altarsPanel.classList.contains("open"));

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {

        if (!event.key || event.key.toLowerCase() !== "n") {

            return;

        }

        if (event.metaKey || event.ctrlKey || event.altKey) {

            return;

        }

        const active = document.activeElement;
        const isTyping = active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");

        if (isTyping) {

            return;

        }

        setAltarsPanelOpen(!altarsPanel.classList.contains("open"));

    });

}


/*
 * Left panel accent sync, scoped just to this panel's own
 * .left-panel--altars class. script.js already runs its own
 * MutationObserver on #upgradePanel/#deathPanel that toggles
 * .left-panel--upgrades/--death whenever either panel's "open"
 * class changes - that still fires correctly here, since
 * setUpgradePanelOpen(false)/setDeathPanelOpen(false) above toggle
 * their real "open" class off. This observer only needs to handle
 * the new Altars accent, not duplicate the other two.
 */
const leftPanelElForAltars = document.querySelector(".left-panel");

function updateAltarsLeftPanelAccent() {

    if (!leftPanelElForAltars || !altarsPanel) {

        return;

    }

    const altarsOpen = altarsPanel.classList.contains("open");

    leftPanelElForAltars.classList.toggle("left-panel--altars", altarsOpen);

}


if (altarsPanel) {

    const altarsAccentObserver = new MutationObserver(updateAltarsLeftPanelAccent);

    altarsAccentObserver.observe(altarsPanel, { attributes: true, attributeFilter: ["class"] });

}

updateAltarsLeftPanelAccent();