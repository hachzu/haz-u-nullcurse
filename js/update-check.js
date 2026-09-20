/*
 * Update check
 * --------------------------
 * Lets people who already have the site open pick up a new deploy
 * without having to know to refresh.
 *
 * How it works: the site ships a tiny version.json next to
 * Toolkits.html. Every visitor's page reads it once on load (that's
 * the version they're running) and then again every minute, and
 * whenever they switch back to the tab. When the number in the file
 * changes, a toast slides up: "New update available - refreshing in
 * 1:00", with a Refresh now button and a note that their run
 * is saved automatically (curses, upgrades and deaths all live in
 * localStorage, so a refresh doesn't lose them).
 *
 * To push an update to everyone who's online: change the "version"
 * value in version.json in the same commit as the code changes (any
 * new value works - a date, a counter, whatever). Because the file
 * deploys together with the code, nobody is told to refresh before
 * the new code is actually live.
 *
 * It never yanks the page out from under someone mid-task: if any
 * text box has unsent text in it (the lobby name, a feedback
 * message, ...) it skips the automatic refresh and just leaves the
 * toast up until they choose to refresh.
 *
 * Self-contained: no dependency on the other scripts (only uses
 * playUtilitySound for the button click if it happens to exist).
 * Does nothing when the page is opened straight from disk (file://),
 * since version.json can't be fetched there.
 */

(function () {

    const VERSION_URL = "version.json";

    const CHECK_INTERVAL_MS = 60000;
    const COUNTDOWN_SECONDS = 60;

    // A short personal note shown above the update copy, so it reads
    // like a heads-up from a person rather than a generic system
    // toast. Edit this string whenever you want the note to say
    // something different for a given update - it's just plain text,
    // no markup needed.
    const HAZU_NOTE = "hazu here! i just updated something on this website just now, so this page is about to refresh to grab it.";

    let loadedVersion = null;
    let updateShown = false;

    let toast = null;
    let textEl = null;
    let barEl = null;

    let countdownTimer = null;
    let deadline = 0;

    async function fetchVersion() {

        try {

            // no-store + a throwaway query string so neither the browser
            // cache nor the host's CDN can hand back an old copy.
            const url = new URL(VERSION_URL, document.baseURI);

            url.searchParams.set("_", Date.now());

            const response = await fetch(url.href, { cache: "no-store" });

            if (!response.ok) {

                return null;

            }

            const data = await response.json();

            return data && data.version !== undefined && data.version !== null
                ? String(data.version)
                : null;

        } catch (error) {

            return null;

        }

    }

    async function check() {

        if (updateShown) {

            return;

        }

        const version = await fetchVersion();

        if (version === null) {

            return;

        }

        // First successful read = the version this page is running.
        if (loadedVersion === null) {

            loadedVersion = version;

            return;

        }

        if (version !== loadedVersion) {

            showUpdate();

        }

    }

    /*
     * True if a reload would throw something away: any textarea with
     * text in it (lobby name, feedback message) or a text box the
     * person is in the middle of typing in.
     */
    function hasUnsavedText() {

        const boxes = Array.from(document.querySelectorAll("textarea"));

        if (boxes.some(box => box.value.trim().length > 0)) {

            return true;

        }

        const active = document.activeElement;

        return Boolean(
            active
            && active.tagName === "INPUT"
            && active.type === "text"
            && active.value.trim().length > 0
        );

    }

    function playClick() {

        if (typeof playUtilitySound === "function") {

            playUtilitySound();

        }

    }

    /*
     * Static hosts usually let files sit in the browser cache for
     * several minutes, and a plain reload only re-checks the page
     * itself - so without this the reload could still run the old
     * scripts/styles. Re-download the page's own files first (this
     * refreshes the cache entries), then reload.
     */
    async function refreshNow() {

        stopCountdown();

        if (toast) {

            toast.classList.add("update-toast--busy");

            if (textEl) {

                textEl.textContent = "Refreshing...";

            }

        }

        const urls = new Set([location.href]);

        document.querySelectorAll("script[src], link[rel~='stylesheet'][href]").forEach(element => {

            try {

                const url = new URL(element.src || element.href, document.baseURI);

                if (url.origin === location.origin) {

                    urls.add(url.href);

                }

            } catch (error) {

                // ignore anything that isn't a valid URL

            }

        });

        await Promise.all(Array.from(urls).map(url => fetch(url, { cache: "reload" }).catch(() => {})));

        location.reload();

    }

    function stopCountdown() {

        if (countdownTimer) {

            clearInterval(countdownTimer);
            countdownTimer = null;

        }

    }

    /*
     * Leaves the toast up with just a Refresh button - used only when
     * there's unsent text, so an automatic refresh would lose it.
     */
    function enterManualMode(reason) {

        stopCountdown();

        if (!toast) {

            return;

        }

        toast.classList.add("update-toast--manual");

        if (textEl) {

            textEl.textContent = reason === "typing"
                ? "You have unsent text, so it won't refresh on its own. Refresh when you're ready."
                : "Refresh whenever you're ready.";

        }

        if (barEl) {

            barEl.style.transition = "none";
            barEl.style.width = "0%";

        }

    }

    // HAZU_NOTE is a hardcoded constant above, not user input, but
    // this keeps the innerHTML assignment safe even if that string
    // is ever edited to include something like an apostrophe-heavy
    // sentence with stray angle brackets.
    function escapeHtmlForToast(str) {

        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

    }

    function formatTime(totalSeconds) {

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return minutes + ":" + String(seconds).padStart(2, "0");

    }

    /*
     * Counts down against a fixed deadline instead of subtracting one
     * per tick: browsers slow timers down in background tabs, which
     * would stretch a tick-counted 2 minutes out far longer.
     */
    function tickCountdown() {

        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

        if (remaining <= 0) {

            stopCountdown();

            if (hasUnsavedText()) {

                enterManualMode("typing");

            } else {

                refreshNow();

            }

            return;

        }

        textEl.textContent = `Refreshing in ${formatTime(remaining)} to load it.`;

    }

    function startCountdown() {

        deadline = Date.now() + COUNTDOWN_SECONDS * 1000;

        // Shrinks the progress bar over the whole countdown.
        barEl.style.transition = "none";
        barEl.style.width = "100%";

        void barEl.offsetWidth;

        barEl.style.transition = `width ${COUNTDOWN_SECONDS}s linear`;
        barEl.style.width = "0%";

        tickCountdown();

        countdownTimer = setInterval(tickCountdown, 1000);

    }

    function showUpdate() {

        updateShown = true;

        toast = document.createElement("div");

        toast.className = "update-toast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");

        toast.innerHTML = `
            <div class="update-toast-main">
                <span class="update-toast-icon" aria-hidden="true">&#10227;</span>

                <div class="update-toast-copy">
                    <div class="update-toast-title">New update available</div>
                    <div class="update-toast-text" id="updateToastText"></div>
                </div>
            </div>

            <div class="update-toast-hazu-note">${escapeHtmlForToast(HAZU_NOTE)}</div>

            <div class="update-toast-note">
                <span class="update-toast-note-icon" aria-hidden="true">&#10003;</span>
                <span>Your run is saved automatically - curses, upgrades, and deaths carry over after the refresh.</span>
            </div>

            <div class="update-toast-actions">
                <button type="button" class="update-toast-button update-toast-button--primary" id="updateToastRefresh">Refresh now</button>
            </div>

            <div class="update-toast-bar-track"><div class="update-toast-bar" id="updateToastBar"></div></div>
        `;

        document.body.appendChild(toast);

        textEl = toast.querySelector("#updateToastText");
        barEl = toast.querySelector("#updateToastBar");

        toast.querySelector("#updateToastRefresh").addEventListener("click", () => {

            playClick();
            refreshNow();

        });

        // Next frame so the slide-in has a starting state to animate from.
        requestAnimationFrame(() => {

            toast.classList.add("update-toast--visible");

        });

        startCountdown();

    }

    document.addEventListener("visibilitychange", () => {

        if (document.visibilityState === "visible") {

            if (countdownTimer) {

                tickCountdown();

            }

            check();

        }

    });

    setInterval(check, CHECK_INTERVAL_MS);

    check();

})();