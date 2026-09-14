import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    getDatabase,
    ref,
    push,
    set,
    onValue,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCxx3I9XkmVLouC-5-JvJzkXRTr1bdWS1o",
    authDomain: "nullscape-tracker.firebaseapp.com",
    databaseURL: "https://nullscape-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nullscape-tracker",
    storageBucket: "nullscape-tracker.firebasestorage.app",
    messagingSenderId: "1063992213242",
    appId: "1:1063992213242:web:ec5bd3d8efe24965449343"
};

// Saved once per browser - this is the whole reason the username
// prompt only shows on a person's very first visit. Cleared browser
// data / incognito / a different browser will all trigger it again.
const USERNAME_KEY = "nullscape_username";

function getStoredUsername() {

    try {
        return localStorage.getItem(USERNAME_KEY);
    } catch {
        return null;
    }

}

function storeUsername(name) {

    try {
        localStorage.setItem(USERNAME_KEY, name);
    } catch {
        // localStorage unavailable (private mode, blocked storage, etc) -
        // just skip persisting, they'll get asked again next time.
    }

}

// Shows the full-page "pick a username" overlay only if one isn't
// already saved for this browser. Resolves with the username either
// way (immediately, if one was already stored).
function ensureUsername() {

    return new Promise((resolve) => {

        const existing = getStoredUsername();

        if (existing) {
            resolve(existing);
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "username-gate-overlay";
        overlay.innerHTML = `
            <div class="username-gate-box">
                <div class="username-gate-title username-gate-pop" style="animation-delay: 0.05s;">WELCOME</div>
                <div class="username-gate-subtitle username-gate-pop" style="animation-delay: 0.16s;">
                    What's your Roblox username or an alias you'd go by?
                </div>
                <input
                    type="text"
                    id="usernameGateInput"
                    class="username-gate-pop"
                    style="animation-delay: 0.27s;"
                    maxlength="20"
                    placeholder="Roblox username or alias..."
                    autocomplete="off"
                    spellcheck="false"
                >
                <button type="button" id="usernameGateSubmit" class="username-gate-pop" style="animation-delay: 0.38s;">
                    CONTINUE
                </button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Fade in on the next frame (starting from opacity 0, set in
        // CSS) rather than at insertion time, so the transition
        // actually has something to animate from.
        requestAnimationFrame(() => {
            overlay.classList.add("username-gate-overlay--visible");
        });

        const input = overlay.querySelector("#usernameGateInput");
        const submitButton = overlay.querySelector("#usernameGateSubmit");

        input.focus();

        function submit() {

            const value = input.value.trim();

            if (!value) {
                input.focus();
                return;
            }

            // (Bad-word filtering can slot in right here later.)

            storeUsername(value);

            overlay.classList.remove("username-gate-overlay--visible");

            overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });

            resolve(value);

        }

        submitButton.addEventListener("click", submit);

        input.addEventListener("keydown", (e) => {

            if (e.key === "Enter") {
                submit();
            }

        });

    });

}

function escapeHtml(str) {

    return str.replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

}

async function startPresence() {

    const username = await ensureUsername();

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);

    const presenceRef = ref(db, "presence");
    const myPresenceRef = push(presenceRef);

    const connectedRef = ref(db, ".info/connected");

    onValue(connectedRef, (snap) => {

        if (snap.val() === true) {

            // Auto-remove this entry the instant our connection drops -
            // tab closed, browser crashed, wifi died, whatever - no
            // manual cleanup needed on our end.
            onDisconnect(myPresenceRef).remove().then(() => {

                set(myPresenceRef, { username });

            });

        }

    });

    // Live count + live list of everyone currently marked present.
    onValue(presenceRef, (snap) => {

        const value = snap.val() || {};
        const entries = Object.values(value);

        const countEl = document.getElementById("liveViewerCount");
        const listEl = document.getElementById("liveViewerList");

        if (countEl) {
            countEl.textContent = entries.length;
        }

        if (listEl) {

            const names = entries
                .map((entry) => entry && entry.username)
                .filter(Boolean);

            if (names.length === 0) {

                listEl.innerHTML = `<div class="live-viewer-list-empty">No one else here yet</div>`;

            } else {

                listEl.innerHTML = names
                    .map((name) => `<div class="live-viewer-list-item">${escapeHtml(name)}</div>`)
                    .join("");

            }

        }

    });

}

startPresence();