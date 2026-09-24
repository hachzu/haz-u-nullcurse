/*
 * Feedback / Suggestions
 * --------------------------
 * A small popover (same shape/pattern as the particle settings
 * popover in Particles.js) that lets a visitor type a suggestion or
 * bug report and send it straight to a Discord channel via a
 * webhook - no backend needed. Opens from a glowing "envelope +
 * Feedback" pill dropped into the header controls, next to
 * mute/particles.
 *
 * The "From" field is prefilled with the username the person picked
 * on their first visit (saved by presence.js under the same
 * localStorage key below) and stays editable, so every message
 * arrives in Discord labeled with who sent it.
 *
 * NOTE: the webhook URL below is visible to anyone who views this
 * site's source, since this is a static page with no server. If it
 * gets abused (spam, flooding), regenerate the webhook in Discord's
 * Integrations settings and swap the URL here.
 */

(function () {

    const WEBHOOK_URL = "https://discord.com/api/webhooks/1551104793592864879/LpqVlT8oA1Uc8asE-7SmJqSo2GiomDVB6rGgnjLRkNFUymYOcEOuNTNQxehqMGYO0IUO";

    const MAX_LENGTH = 800;
    const MAX_FROM_LENGTH = 32;

    // Same key presence.js saves the first-visit username under.
    const USERNAME_KEY = "nullscape_username";

    const PLACEHOLDER = "let me know if you want something added! i'll likely add it here, if not then you can send anything here lol just don't spam and don't be weird.";

    // Very light throttle so one person mashing "send" can't spam
    // the channel - purely client-side, easy to bypass, but stops
    // accidental double-sends and casual abuse.
    const COOLDOWN_MS = 15000;
    let lastSentAt = 0;

    function getStoredUsername() {

        try {

            return localStorage.getItem(USERNAME_KEY) || "";

        } catch (error) {

            return "";

        }

    }

    function buildUI() {

        const headerControls = document.querySelector(".site-header-controls");

        if (!headerControls || document.getElementById("feedbackButton")) {

            return;

        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "feedbackButton";
        button.className = "mute-toggle-button feedback-button";
        button.setAttribute("aria-label", "Send feedback or a suggestion");
        button.setAttribute("aria-expanded", "false");
        button.title = "Send feedback or a suggestion";
        button.innerHTML = '<span class="feedback-icon">&#9993;</span><span class="feedback-label">Feedback</span>';

        const panel = document.createElement("div");

        panel.id = "feedbackPanel";
        panel.className = "feedback-panel";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-label", "Send feedback or a suggestion");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="feedback-header-row">
                <div class="feedback-heading">SUGGESTION / FEEDBACK</div>
                <button type="button" id="feedbackCloseButton" class="particle-close-button" aria-label="Close feedback">&times;</button>
            </div>

            <label class="feedback-from-row" for="feedbackFromInput">
                <span class="feedback-from-label">From:</span>
                <input
                    type="text"
                    id="feedbackFromInput"
                    class="feedback-from-input"
                    maxlength="${MAX_FROM_LENGTH}"
                    placeholder="your name or alias"
                    autocomplete="off"
                    spellcheck="false"
                >
            </label>

            <textarea
                id="feedbackTextarea"
                class="feedback-textarea"
                maxlength="${MAX_LENGTH}"
                spellcheck="true"
            ></textarea>

            <div class="feedback-footer-row">
                <span class="feedback-char-count" id="feedbackCharCount">0 / ${MAX_LENGTH}</span>
                <button type="button" id="feedbackSubmitButton" class="feedback-submit-button">
                    <span class="btn-label">Send</span>
                </button>
            </div>

            <div class="feedback-status" id="feedbackStatus" role="status" aria-live="polite"></div>
        `;

        document.body.appendChild(panel);

        const muteButton = document.getElementById("muteToggleButton");

        if (muteButton) {

            headerControls.insertBefore(button, muteButton);

        } else {

            headerControls.appendChild(button);

        }

        // Settings stays immediately to Feedback's right, even though this
        // button is created dynamically after the page markup is parsed.
        const settingsButton = document.getElementById("settingsToggleButton");

        if (settingsButton) {

            headerControls.appendChild(settingsButton);

        }

        const textarea = panel.querySelector("#feedbackTextarea");
        const fromInput = panel.querySelector("#feedbackFromInput");
        const charCount = panel.querySelector("#feedbackCharCount");
        const submitButton = panel.querySelector("#feedbackSubmitButton");
        const statusEl = panel.querySelector("#feedbackStatus");
        const closeButton = panel.querySelector("#feedbackCloseButton");

        // Set via the property (not inside the template literal) so the
        // apostrophe in "i'll" never has to be escaped in markup.
        textarea.placeholder = PLACEHOLDER;

        // Once the person edits the From box themselves, stop
        // overwriting it from storage on later opens.
        let fromEdited = false;

        fromInput.addEventListener("input", () => {

            fromEdited = true;

        });

        function syncFromField() {

            // Re-read on every open: on a first visit the username
            // gate (presence.js) may not have been filled in yet when
            // this script ran.
            if (!fromEdited) {

                fromInput.value = getStoredUsername();

            }

        }

        function positionPanel() {

            const rect = button.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 280;

            const maxLeft = window.innerWidth - panelWidth - 8;
            const left = Math.min(rect.left, maxLeft);

            panel.style.top = (rect.bottom + 8) + "px";
            panel.style.left = Math.max(8, left) + "px";
            panel.style.right = "auto";

        }

        function openPanel() {

            syncFromField();

            panel.hidden = false;
            button.setAttribute("aria-expanded", "true");
            button.classList.add("active");
            positionPanel();

            // If the name is already filled in, go straight to the
            // message; otherwise let them fill in the name first.
            if (fromInput.value.trim()) {

                textarea.focus();

            } else {

                fromInput.focus();

            }

        }

        function closePanel() {

            panel.hidden = true;
            button.setAttribute("aria-expanded", "false");
            button.classList.remove("active");

        }

        button.addEventListener("click", event => {

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

        textarea.addEventListener("input", () => {

            charCount.textContent = `${textarea.value.length} / ${MAX_LENGTH}`;

        });

        function setStatus(text, isError) {

            statusEl.textContent = text;
            statusEl.classList.toggle("feedback-status--error", Boolean(isError));

        }

        async function submitFeedback() {

            const message = textarea.value.trim();

            if (!message) {

                setStatus("Type something first.", true);
                return;

            }

            const now = Date.now();

            if (now - lastSentAt < COOLDOWN_MS) {

                const waitSeconds = Math.ceil((COOLDOWN_MS - (now - lastSentAt)) / 1000);

                setStatus(`Please wait ${waitSeconds}s before sending again.`, true);
                return;

            }

            const from = fromInput.value.trim() || "Anonymous";

            submitButton.disabled = true;
            setStatus("Sending...", false);

            try {

                const response = await fetch(WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content: `**New suggestion/feedback:**\n**From:** ${from}\n\n${message}`,

                        // The webhook URL is public, so make sure a
                        // message can never ping @everyone/@here or
                        // any role/user, whatever gets typed in.
                        allowed_mentions: { parse: [] }
                    })
                });

                if (!response.ok) {

                    throw new Error(`Webhook responded with ${response.status}`);

                }

                lastSentAt = now;

                textarea.value = "";
                charCount.textContent = `0 / ${MAX_LENGTH}`;

                setStatus("Sent - thank you!", false);

                if (typeof playPurifySound === "function") {

                    playPurifySound();

                }

                setTimeout(() => {

                    closePanel();
                    setStatus("", false);

                }, 1400);

            } catch (error) {

                console.warn("couldn't send feedback:", error);
                setStatus("Couldn't send - try again later.", true);

                if (typeof playRemoveSound === "function") {

                    playRemoveSound();

                }

            } finally {

                submitButton.disabled = false;

            }

        }

        submitButton.addEventListener("click", submitFeedback);

        function submitOnCtrlEnter(event) {

            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {

                event.preventDefault();
                submitFeedback();

            }

        }

        textarea.addEventListener("keydown", submitOnCtrlEnter);
        fromInput.addEventListener("keydown", submitOnCtrlEnter);

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", buildUI);

    } else {

        buildUI();

    }

})();
