/*
 * Lobby Maker panel logic — v3 (preselect-then-type title editor)
 * --------------------------
 * Same fourth-panel shell as before (toggle button + sliding overlay,
 * mutual exclusion with Upgrades/Death/Altars, keyboard shortcut "L",
 * left-panel accent sync) but the body is now a full per-letter title
 * editor: free-text input, font / color / style sub-panels, solid +
 * gradient coloring, outline support, and a compiler that turns the
 * styled text into Roblox rich-text tags ready to paste into a lobby
 * name field.
 *
 * v3 workflow change: the toolbar/sub-panels no longer require the
 * person to highlight text first. Whatever font/color/style is
 * "armed" (lobbyEditor.typingStyle) is what new characters get as
 * they're typed. Highlighting existing letters (click, shift+arrow,
 * ctrl+click, drag-select) is still supported and now exists purely
 * as an optional touch-up path for restyling specific letters after
 * the fact - it patches the highlighted letters directly instead of
 * the "armed" style. A Reset button clears the whole panel (text,
 * per-letter styles, the armed style, undo history, and the copied-
 * tag log) back to its starting state.
 *
 * Depends on globals defined in script.js: attachClickAction,
 * playUtilitySound, playPurifySound (button feedback sounds only).
 */


const LOBBY_TITLE_MAX_LENGTH = 35;
const LOBBY_TAG_HISTORY_LIMIT = 5;
const LOBBY_DEFAULT_STROKE_THICKNESS = 2;

/*
 * Per-letter style record shape:
 * {
 *   bold, italic, underline, strikethrough: boolean
 *   font: { label, face } | null
 *   color: "#rrggbb" | null
 *   fade: 0..1               (0 = fully opaque)
 *   ring: boolean            (has an outline)
 *   ringColor: "#rrggbb"
 *   ringFade: 0..1
 *   ringJoin: "round" | "miter" | "bevel"
 * }
 */

function blankTypingStyle() {

    return {

        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        font: null,
        color: null,
        fade: 0,
        ring: false,
        ringColor: "#000000",
        ringFade: 0,
        ringJoin: "round"

    };

}

const lobbyEditor = {

    letters: [],           // one entry per character in the input, index-aligned
    selection: [],          // sorted array of selected character indices
    selectionActive: false,
    caret: 0,
    caretShown: false,
    editingOutline: false,

    // The "armed" style: whatever font/color/style is picked while
    // nothing is highlighted gets stamped onto newly typed letters.
    typingStyle: blankTypingStyle(),

    history: [],
    historyAt: -1,
    restoring: false

};

const lobbyTagLog = [];

function blankLetterStyle() {

    return {};

}

/*
 * The letter style that should be stamped onto a freshly typed
 * character right now, or null if nothing is armed (plain text).
 */
function currentTypingStyleSnapshot() {

    const t = lobbyEditor.typingStyle;

    const hasAnything = t.bold || t.italic || t.underline || t.strikethrough ||
        t.font || t.color || (typeof t.fade === "number" && t.fade > 0) || t.ring;

    if (!hasAnything) {

        return null;

    }

    return { ...t };

}

function cloneLetterStyles(list) {

    return list.map(entry => (entry ? { ...entry } : null));

}

function lobbySnapshot() {

    return {

        text: lobbyEditorInput.value,
        letters: cloneLetterStyles(lobbyEditor.letters)

    };

}

function pushLobbySnapshot() {

    if (lobbyEditor.restoring) {

        return;

    }

    const snap = lobbySnapshot();
    const prior = lobbyEditor.history[lobbyEditor.historyAt];

    if (
        prior &&
        prior.text === snap.text &&
        JSON.stringify(prior.letters) === JSON.stringify(snap.letters)
    ) {

        return;

    }

    lobbyEditor.history = lobbyEditor.history.slice(0, lobbyEditor.historyAt + 1);
    lobbyEditor.history.push(snap);

    const cap = 150;

    if (lobbyEditor.history.length > cap) {

        lobbyEditor.history.shift();

    }

    lobbyEditor.historyAt = lobbyEditor.history.length - 1;

}

function restoreLobbySnapshot(snap) {

    lobbyEditor.restoring = true;

    lobbyEditorInput.value = snap.text;
    lobbyEditor.letters = cloneLetterStyles(snap.letters);

    lobbyEditor.restoring = false;

    lobbyEditor.selection = lobbyEditor.selection.filter(i => i < snap.text.length);
    lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

}

function lobbyUndo() {

    if (lobbyEditor.historyAt <= 0) {

        return;

    }

    lobbyEditor.historyAt--;
    restoreLobbySnapshot(lobbyEditor.history[lobbyEditor.historyAt]);

}

function lobbyRedo() {

    if (lobbyEditor.historyAt >= lobbyEditor.history.length - 1) {

        return;

    }

    lobbyEditor.historyAt++;
    restoreLobbySnapshot(lobbyEditor.history[lobbyEditor.historyAt]);

}

function letterStyleAt(index) {

    return lobbyEditor.letters[index] || null;

}

function letterStyleForWrite(index) {

    if (!lobbyEditor.letters[index]) {

        lobbyEditor.letters[index] = blankLetterStyle();

    }

    return lobbyEditor.letters[index];

}

/*
 * Keeps the per-letter style array lined up with the textarea after a
 * native edit (typing, pasting, deleting). Finds the untouched prefix
 * and suffix around the edit and only rebuilds the middle chunk, so
 * styling on unrelated letters survives.
 */
function reconcileLettersAfterEdit(nextText, previousText) {

    let head = 0;

    const shortest = Math.min(previousText.length, nextText.length);

    while (head < shortest && previousText[head] === nextText[head]) {

        head++;

    }

    let oldTail = previousText.length;
    let newTail = nextText.length;

    while (
        oldTail > head &&
        newTail > head &&
        previousText[oldTail - 1] === nextText[newTail - 1]
    ) {

        oldTail--;
        newTail--;

    }

    const rebuilt = lobbyEditor.letters.slice(0, head);
    const insertedStyle = currentTypingStyleSnapshot();

    for (let i = 0; i < newTail - head; i++) {

        rebuilt.push(insertedStyle ? { ...insertedStyle } : null);

    }

    rebuilt.push(...lobbyEditor.letters.slice(oldTail));

    lobbyEditor.letters = rebuilt;

}

function clearLobbySelection() {

    lobbyEditor.selection = [];
    lobbyEditor.selectionActive = false;
    lobbyEditor.caretShown = false;

}

function toggleIndexInSelection(index) {

    if (lobbyEditor.selection.includes(index)) {

        lobbyEditor.selection = lobbyEditor.selection.filter(i => i !== index);

    } else {

        lobbyEditor.selection.push(index);
        lobbyEditor.selection.sort((a, b) => a - b);

    }

    lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

}

function setSelectionRange(start, end) {

    const from = Math.max(0, Math.min(start, end));
    const to = Math.min(lobbyEditorInput.value.length, Math.max(start, end));

    const next = [];

    for (let i = from; i < to; i++) {

        next.push(i);

    }

    lobbyEditor.selection = next;
    lobbyEditor.selectionActive = next.length > 0;

}

/* ---- rendering: overlay + preview ---- */

function escapeForMarkup(str) {

    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

function letterVisualClasses(style) {

    if (!style) {

        return "";

    }

    const classes = ["lobby-letter"];

    if (style.bold) classes.push("lobby-letter--bold");
    if (style.italic) classes.push("lobby-letter--italic");
    if (style.underline) classes.push("lobby-letter--underline");
    if (style.strikethrough) classes.push("lobby-letter--strike");

    return classes.join(" ");

}

function hexToRgbaString(hex, alpha) {

    const clean = (hex || "#000000").replace("#", "");

    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;

}

function letterOutlineCss(style) {

    if (!style || !style.ring) {

        return "";

    }

    const rgba = hexToRgbaString(style.ringColor || "#000000", typeof style.ringFade === "number" ? 1 - style.ringFade : 1);

    const w = 1.2;
    const offsets = [[w, 0], [-w, 0], [0, w], [0, -w]];

    if (style.ringJoin === "miter") {

        offsets.push([w, w], [w, -w], [-w, w], [-w, -w]);

    } else if (style.ringJoin === "bevel") {

        const d = w * 0.6;

        offsets.push([d, d], [d, -d], [-d, d], [-d, -d]);

    }

    const shadow = offsets.map(([x, y]) => `${x}px ${y}px 0 ${rgba}`).join(", ");

    return `text-shadow:${shadow};-webkit-text-stroke:0.4px ${rgba};`;

}

function letterInlineCss(style) {

    if (!style) {

        return "";

    }

    const rules = [];

    if (style.color) {

        rules.push(`color:${style.color}`);

    }

    if (style.font) {

        rules.push(`font-family:${style.font.previewFamily}`);

    }

    if (typeof style.fade === "number" && style.fade > 0) {

        rules.push(`opacity:${1 - style.fade}`);

    }

    return rules.join(";");

}

function renderLetterMarkup(char, style) {

    const escaped = escapeForMarkup(char);
    const classes = letterVisualClasses(style);
    const inlineCss = letterInlineCss(style);
    const outlineCss = letterOutlineCss(style);

    if (!classes && !inlineCss && !outlineCss) {

        return escaped;

    }

    const content = outlineCss
        ? `<i class="lobby-letter-ring" style="${outlineCss}">${escaped}</i>`
        : escaped;

    return `<span${classes ? ` class="${classes}"` : ""}${inlineCss ? ` style="${inlineCss}"` : ""}>${content}</span>`;

}

function redrawLobbyOverlay() {

    const text = lobbyEditorInput.value;
    const selectedSet = new Set(lobbyEditor.selection);

    let html = "";

    for (let i = 0; i < text.length; i++) {

        const style = letterStyleAt(i);
        const selected = selectedSet.has(i);
        const isCaret = lobbyEditor.caretShown && i === lobbyEditor.caret && !selected;

        const inner = renderLetterMarkup(text[i], style);

        const cellClasses = "lobby-letter-cell" +
            (selected ? " lobby-letter-cell--selected" : "") +
            (isCaret ? " lobby-letter-cell--caret" : "");

        html += `<span class="${cellClasses}" data-letter-index="${i}">${inner}</span>`;

    }

    lobbyEditorOverlay.innerHTML = html;
    lobbyEditorOverlay.scrollLeft = lobbyEditorInput.scrollLeft;

    const empty = text.length === 0;

    lobbyEditorWrap.classList.toggle("lobby-editor-wrap--empty", empty);

}

function refreshLobbyPreview() {

    const text = lobbyEditorInput.value;

    if (!text) {

        lobbyPreviewValue.textContent = "Type something to see the tag output";
        lobbyPreviewValue.classList.remove("lobby-preview-value--filled");

        if (lobbyVisualPreview) {

            lobbyVisualPreview.textContent = "Your styled lobby name will appear here";
            lobbyVisualPreview.classList.remove("lobby-visual-preview--filled");

        }

        return;

    }

    lobbyPreviewValue.textContent = compileLobbyRichText(text, lobbyEditor.letters);
    lobbyPreviewValue.classList.add("lobby-preview-value--filled");

    if (lobbyVisualPreview) {

        let previewMarkup = "";

        for (let i = 0; i < text.length; i++) {

            previewMarkup += renderLetterMarkup(text[i], letterStyleAt(i));

        }

        lobbyVisualPreview.innerHTML = previewMarkup;
        lobbyVisualPreview.classList.add("lobby-visual-preview--filled");

    }

}

/* ---- rich text compiling ---- */

function roundedFade(n) {

    return Math.round(n * 1000) / 1000;

}

function escapeForTag(str) {

    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

}

/*
 * Returns the ordered tag "slots" a letter needs (outermost first):
 * font wrapper, stroke wrapper, then b/i/u/s. Each slot carries a key
 * so the compiler can tell when two neighbouring letters share the
 * exact same open tag and merge them into one run instead of
 * re-opening/closing every single character.
 */
function tagSlotsForLetter(style) {

    const slots = [null, null, null, null, null, null];

    if (!style) {

        return slots;

    }

    const face = style.font ? style.font.face : null;
    const color = style.color || null;
    const fade = typeof style.fade === "number" && style.fade > 0 ? roundedFade(style.fade) : null;

    if (face || color || fade !== null) {

        const attrs = [];

        if (face) attrs.push(`family="${escapeForTag(face)}"`);
        if (color) attrs.push(`color="${escapeForTag(color)}"`);
        if (fade !== null) attrs.push(`transparency="${fade}"`);

        slots[0] = {
            key: `font|${face || ""}|${color || ""}|${fade === null ? "" : fade}`,
            open: `<font ${attrs.join(" ")}>`,
            close: "</font>"
        };

    }

    if (style.ring) {

        const ringColor = style.ringColor || "#000000";
        const ringFade = typeof style.ringFade === "number" && style.ringFade > 0 ? roundedFade(style.ringFade) : null;
        const join = style.ringJoin && style.ringJoin !== "round" ? style.ringJoin : null;
        const thickness = typeof style.ringThickness === "number" && style.ringThickness > 0 ? style.ringThickness : LOBBY_DEFAULT_STROKE_THICKNESS;

        const attrs = [`color="${escapeForTag(ringColor)}"`, `thickness="${thickness}"`];

        if (ringFade !== null) attrs.push(`transparency="${ringFade}"`);
        if (join) attrs.push(`joins="${join}"`);

        slots[1] = {
            key: `stroke|${ringColor}|${ringFade === null ? "" : ringFade}|${join || ""}|${thickness}`,
            open: `<stroke ${attrs.join(" ")}>`,
            close: "</stroke>"
        };

    }

    if (style.bold) slots[2] = { key: "b", open: "<b>", close: "</b>" };
    if (style.italic) slots[3] = { key: "i", open: "<i>", close: "</i>" };
    if (style.underline) slots[4] = { key: "u", open: "<u>", close: "</u>" };
    if (style.strikethrough) slots[5] = { key: "s", open: "<s>", close: "</s>" };

    return slots;

}

function compileLobbyRichText(text, letters) {

    let out = "";
    let open = [null, null, null, null, null, null];

    for (let i = 0; i < text.length; i++) {

        const desired = tagSlotsForLetter(letters[i] || null);

        let splitAt = open.length;

        for (let s = 0; s < open.length; s++) {

            const a = open[s] ? open[s].key : null;
            const b = desired[s] ? desired[s].key : null;

            if (a !== b) {

                splitAt = s;
                break;

            }

        }

        if (splitAt < open.length) {

            for (let s = open.length - 1; s >= splitAt; s--) {

                if (open[s]) out += open[s].close;

            }

            for (let s = splitAt; s < desired.length; s++) {

                if (desired[s]) out += desired[s].open;

            }

            open = desired;

        }

        out += escapeForTag(text[i]);

    }

    for (let s = open.length - 1; s >= 0; s--) {

        if (open[s]) out += open[s].close;

    }

    return out;

}

/* ---- applying styles to the current selection ---- */

function patchSelection(patch, commit = true) {

    if (!lobbyEditor.selection.length) {

        return false;

    }

    lobbyEditor.selection.forEach(i => {

        Object.assign(letterStyleForWrite(i), patch);

    });

    if (commit) {

        pushLobbySnapshot();

    }

    redrawLobbyOverlay();
    refreshLobbyPreview();

    return true;

}

function selectionHasStyle(prop) {

    if (!lobbyEditor.selection.length) {

        return "off";

    }

    let sawOn = false;
    let sawOff = false;

    for (const i of lobbyEditor.selection) {

        const style = letterStyleAt(i);
        const on = !!(style && style[prop]);

        if (on) sawOn = true; else sawOff = true;

        if (sawOn && sawOff) return "mixed";

    }

    return sawOn ? "on" : "off";

}

/* ---- gradient math (shared by the rainbow / stop-based presets) ---- */

const LOBBY_GRADIENT_KINDS = Object.freeze({
    RAINBOW: "rainbow",
    TWO_STOP: "two-stop",
    THREE_STOP: "three-stop",
    BOOKEND: "bookend"
});

function hexToTuple(hex) {

    const v = (hex || "#000000").replace("#", "");

    return [
        parseInt(v.slice(0, 2), 16) || 0,
        parseInt(v.slice(2, 4), 16) || 0,
        parseInt(v.slice(4, 6), 16) || 0
    ];

}

function tupleToHex(rgb) {

    return "#" + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

}

function lerpTuple(a, b, t) {

    return a.map((v, i) => v + (b[i] - v) * t);

}

function sampleAcrossStops(stops, t, wraps) {

    const value = wraps ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));

    for (let i = 0; i < stops.length - 1; i++) {

        if (value <= stops[i + 1].at) {

            const span = stops[i + 1].at - stops[i].at || 1;

            return lerpTuple(stops[i].rgb, stops[i + 1].rgb, (value - stops[i].at) / span);

        }

    }

    return stops[stops.length - 1].rgb;

}

function hueToTuple(hue) {

    const h = ((hue % 360) + 360) % 360;
    const x = 1 - Math.abs((h / 60) % 2 - 1);
    const sector = Math.floor(h / 60);

    const table = [
        [1, x, 0], [x, 1, 0], [0, 1, x],
        [0, x, 1], [x, 0, 1], [1, 0, x]
    ];

    return table[sector].map(v => v * 255);

}

function remapThroughDividers(t, dividers) {

    const from = [0, ...dividers, 1];
    const segments = from.length - 1;
    const to = Array.from({ length: segments + 1 }, (_, i) => i / segments);

    for (let i = 0; i < from.length - 1; i++) {

        if (t >= from[i] && t <= from[i + 1]) {

            const span = from[i + 1] - from[i] || 1;
            const localT = (t - from[i]) / span;

            return to[i] + (to[i + 1] - to[i]) * localT;

        }

    }

    return t;

}

function sampleStopGradient(colors, dividers, t) {

    const stops = colors.map((hex, i) => ({ at: i / (colors.length - 1), rgb: hexToTuple(hex) }));

    return sampleAcrossStops(stops, remapThroughDividers(t, dividers), false);

}

function sampleRainbowGradient(t, spin) {

    const stops = [];

    for (let i = 0; i <= 12; i++) {

        stops.push({ at: i / 12, rgb: hueToTuple((i / 12) * 360) });

    }

    return sampleAcrossStops(stops, t + spin, true);

}

function sampleBookendGradient(edgeHex, midHex, t, midPos) {

    const mid = Math.max(0.08, Math.min(0.92, midPos));

    return sampleAcrossStops([
        { at: 0, rgb: hexToTuple(edgeHex) },
        { at: mid, rgb: hexToTuple(midHex) },
        { at: 1, rgb: hexToTuple(edgeHex) }
    ], t, false);

}

function applyGradientToSelection(config) {

    if (!lobbyEditor.selection.length) {

        return false;

    }

    const n = lobbyEditor.selection.length;

    lobbyEditor.selection.forEach((letterIndex, k) => {

        const t = n <= 1 ? 0 : k / (n - 1);
        let rgb;

        switch (config.kind) {

            case LOBBY_GRADIENT_KINDS.RAINBOW:
                rgb = sampleRainbowGradient(t, config.dividers[0]);
                break;

            case LOBBY_GRADIENT_KINDS.TWO_STOP:
            case LOBBY_GRADIENT_KINDS.THREE_STOP:
                rgb = sampleStopGradient(config.colors, config.dividers, t);
                break;

            case LOBBY_GRADIENT_KINDS.BOOKEND:
                rgb = sampleBookendGradient(config.colors[0], config.colors[1], t, config.dividers[0]);
                break;

            default:
                return;

        }

        const style = letterStyleForWrite(letterIndex);
        const hex = tupleToHex(rgb);

        if (lobbyEditor.editingOutline) {

            style.ring = true;
            style.ringColor = hex;

        } else {

            style.color = hex;

        }

    });

    redrawLobbyOverlay();
    refreshLobbyPreview();

    return true;

}

/* ---- character index lookup from a pointer position (single row) ---- */

function letterIndexAtClientX(clientX) {

    const cells = lobbyEditorOverlay.querySelectorAll("[data-letter-index]");

    if (!cells.length) {

        return 0;

    }

    for (const cell of cells) {

        const rect = cell.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;

        if (clientX <= mid) {

            return Number(cell.getAttribute("data-letter-index"));

        }

        if (clientX <= rect.right) {

            return Number(cell.getAttribute("data-letter-index")) + 1;

        }

    }

    return lobbyEditorInput.value.length;

}

/* ---- history-of-generated-tags panel ---- */

function renderLobbyTagLog() {

    if (!lobbyHistoryList) {

        return;

    }

    lobbyHistoryList.innerHTML = "";

    if (!lobbyTagLog.length) {

        const empty = document.createElement("div");

        empty.className = "lobby-empty-row";
        empty.textContent = "nothing copied yet this visit";

        lobbyHistoryList.appendChild(empty);

        return;

    }

    lobbyTagLog.forEach(entry => {

        const row = document.createElement("div");

        row.className = "lobby-history-entry";
        row.textContent = entry;

        lobbyHistoryList.appendChild(row);

    });

}

function logCopiedTag(tagString) {

    lobbyTagLog.unshift(tagString);

    if (lobbyTagLog.length > LOBBY_TAG_HISTORY_LIMIT) {

        lobbyTagLog.length = LOBBY_TAG_HISTORY_LIMIT;

    }

    renderLobbyTagLog();

}

/*
 * Same click-to-copy confirmation flash used elsewhere on the site.
 */
function copyLobbyTags() {

    const text = lobbyEditorInput.value;

    if (!text) {

        return;

    }

    const compiled = compileLobbyRichText(text, lobbyEditor.letters);

    const finish = () => {

        lobbyCopyButtonText.textContent = "Copied!";
        lobbyCopyButton.classList.add("lobby-copy-button--copied");

        logCopiedTag(compiled);

        setTimeout(() => {

            lobbyCopyButtonText.textContent = "Copy";
            lobbyCopyButton.classList.remove("lobby-copy-button--copied");

        }, 1400);

    };

    if (navigator.clipboard && navigator.clipboard.writeText) {

        navigator.clipboard.writeText(compiled).then(finish).catch(finish);

    } else {

        finish();

    }

}

/* ================================================================
 * Wiring — element lookups
 * ================================================================ */

const lobbyEditorInput = document.getElementById("lobbyEditorInput");
const lobbyEditorOverlay = document.getElementById("lobbyEditorOverlay");
const lobbyEditorWrap = document.getElementById("lobbyEditorWrap");
const lobbyPreviewValue = document.getElementById("lobbyPreviewValue");
const lobbyVisualPreview = document.getElementById("lobbyVisualPreview");
const lobbyCopyButton = document.getElementById("lobbyCopyButton");
const lobbyCopyButtonText = document.getElementById("lobbyCopyButtonText");
const lobbyHistoryList = document.getElementById("lobbyHistoryList");

const lobbyFontToggle = document.getElementById("lobbyFontToggle");
const lobbyColorToggle = document.getElementById("lobbyColorToggle");
const lobbyStyleToggle = document.getElementById("lobbyStyleToggle");
const lobbyHighlightAllButton = document.getElementById("lobbyHighlightAllButton");

const lobbyFontPanel = document.getElementById("lobbyFontPanel");
const lobbyColorPanel = document.getElementById("lobbyColorPanel");
const lobbyStylePanel = document.getElementById("lobbyStylePanel");

let previousLobbyText = lobbyEditorInput ? lobbyEditorInput.value : "";

if (lobbyEditorInput) {

    lobbyEditor.history = [lobbySnapshot()];
    lobbyEditor.historyAt = 0;

}

/* ---- tool workspace open/close (Font / Color / Style) ----
   The three now share one inline workspace box that sits in normal
   document flow right under the toolbar (see .lobby-tool-workspace
   in lobby.css) instead of each floating independently in its own
   absolutely-positioned popover under its own button. That's what
   used to let Color's popover overlap Font's neighboring button, and
   let an open popover cover the title input sitting just below it.
   Each inline panel can now remain open independently, so Font,
   Color, and Style can be used together in one persistent stack. */

const lobbyToolWorkspace = document.getElementById("lobbyToolWorkspace");

const lobbySubPanels = [
    { button: lobbyFontToggle, panel: lobbyFontPanel },
    { button: lobbyColorToggle, panel: lobbyColorPanel },
    { button: lobbyStyleToggle, panel: lobbyStylePanel }
].filter(entry => entry.button && entry.panel);

function updateLobbyWorkspaceState() {

    if (!lobbyToolWorkspace) {

        return;

    }

    const anyOpen = lobbySubPanels.some(({ panel }) => panel.classList.contains("lobby-subpanel--open"));

    lobbyToolWorkspace.classList.toggle("lobby-tool-workspace--open", anyOpen);

}

function setLobbySubPanelOpen(panel, isOpen) {

    const entry = lobbySubPanels.find(e => e.panel === panel);

    if (!entry) {

        return;

    }

    entry.panel.classList.toggle("lobby-subpanel--open", isOpen);
    entry.button.classList.toggle("active", isOpen);

    updateLobbyWorkspaceState();

}

function closeAllLobbySubPanels() {

    lobbySubPanels.forEach(({ button, panel }) => {

        panel.classList.remove("lobby-subpanel--open");
        button.classList.remove("active");

    });

    updateLobbyWorkspaceState();

}

lobbySubPanels.forEach(({ button, panel }) => {

    button.addEventListener("click", () => {

        const isOpen = panel.classList.contains("lobby-subpanel--open");

        setLobbySubPanelOpen(panel, !isOpen);

    });

});

/*
 * Tool panels deliberately remain open while the person works
 * elsewhere in the Lobby Maker. That keeps a chosen font, color, or
 * style handy while typing, selecting letters, or using its controls.
 * A panel only closes when its own toolbar button is pressed again,
 * the Lobby Maker closes, or Reset is used.
 */

/* ---- toolbar sync (bold/italic/underline/strike + outline) ---- */

function setTriState(button, state) {

    if (!button) {

        return;

    }

    button.setAttribute("aria-pressed", state === "on" ? "true" : state === "mixed" ? "mixed" : "false");
    button.classList.toggle("is-mixed", state === "mixed");

}

const lobbySelectionSyncCallbacks = [];

function onLobbySelectionSync(fn) {

    lobbySelectionSyncCallbacks.push(fn);

}

const lobbyResetCallbacks = [];

function onLobbyReset(fn) {

    lobbyResetCallbacks.push(fn);

}

/*
 * "on"/"off"/"mixed" for a given style property, sourced from the
 * current highlight if one exists, or from the armed typing style
 * (what the next character typed will get) otherwise.
 */
function activeStyleState(prop) {

    if (lobbyEditor.selection.length) {

        return selectionHasStyle(prop);

    }

    return lobbyEditor.typingStyle[prop] ? "on" : "off";

}

function syncLobbyToolbar() {

    setTriState(document.getElementById("lobbyStyleBold"), activeStyleState("bold"));
    setTriState(document.getElementById("lobbyStyleItalic"), activeStyleState("italic"));
    setTriState(document.getElementById("lobbyStyleUnderline"), activeStyleState("underline"));
    setTriState(document.getElementById("lobbyStyleStrike"), activeStyleState("strikethrough"));

    if (lobbyHighlightAllButton && lobbyEditorInput) {

        const textLength = lobbyEditorInput.value.length;
        const allHighlighted = textLength > 0 && lobbyEditor.selection.length === textLength;

        lobbyHighlightAllButton.disabled = textLength === 0;
        lobbyHighlightAllButton.setAttribute("aria-pressed", allHighlighted ? "true" : "false");
        lobbyHighlightAllButton.classList.toggle("active", allHighlighted);

    }

    lobbySelectionSyncCallbacks.forEach(fn => fn());

}

if (lobbyHighlightAllButton && lobbyEditorInput) {

    lobbyHighlightAllButton.addEventListener("click", () => {

        const textLength = lobbyEditorInput.value.length;

        if (!textLength) {

            return;

        }

        setSelectionRange(0, textLength);
        lobbyEditor.caretShown = false;
        lobbyEditorInput.focus();
        lobbyEditorInput.setSelectionRange(0, textLength);

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

}

["lobbyStyleBold", "bold", "lobbyStyleItalic", "italic", "lobbyStyleUnderline", "underline", "lobbyStyleStrike", "strikethrough"]
    .reduce((pairs, value, index, arr) => {

        if (index % 2 === 0) pairs.push([value, arr[index + 1]]);

        return pairs;

    }, [])
    .forEach(([id, prop]) => {

        const btn = document.getElementById(id);

        if (!btn) {

            return;

        }

        btn.addEventListener("click", () => {

            const nowOn = activeStyleState(prop) !== "on";

            if (lobbyEditor.selection.length) {

                patchSelection({ [prop]: nowOn });

            } else {

                lobbyEditor.typingStyle[prop] = nowOn;

            }

            syncLobbyToolbar();

        });

    });

/* ---- font list ---- */

/*
 * All 15 of these are confirmed entries in Roblox's Font enum
 * (https://create.roblox.com/docs/reference/engine/enums/Font), picked
 * to span a wide range of looks (clean sans, condensed, mono, serif,
 * rounded/casual, marker, handwritten, heavy display, comic, gothic,
 * typewriter, techno, horror, quirky script, friendly sans) rather
 * than several near-duplicates. "face" is the rbxasset family path
 * Roblox's rich-text <font family="..."> tag expects; "previewFamily"
 * is just a close-enough web font stand-in so the in-browser editor
 * looks roughly right (Roblox's real fonts aren't available here).
 */
const LOBBY_FONT_CATALOG = [
    { label: "Sans", face: "rbxasset://fonts/families/SourceSansPro.json", previewFamily: "Arial, Helvetica, sans-serif" },
    { label: "Condensed", face: "rbxasset://fonts/families/RobotoCondensed.json", previewFamily: "'Arial Narrow', sans-serif" },
    { label: "Mono", face: "rbxasset://fonts/families/RobotoMono.json", previewFamily: "'Courier New', monospace" },
    { label: "Serif", face: "rbxasset://fonts/families/Merriweather.json", previewFamily: "Georgia, serif" },
    { label: "Rounded", face: "rbxasset://fonts/families/FredokaOne.json", previewFamily: "'Trebuchet MS', sans-serif" },
    { label: "Marker", face: "rbxasset://fonts/families/PermanentMarker.json", previewFamily: "'Comic Sans MS', cursive" },
    { label: "Handwritten", face: "rbxasset://fonts/families/IndieFlower.json", previewFamily: "'Segoe Script', cursive" },
    { label: "Display", face: "rbxasset://fonts/families/LuckiestGuy.json", previewFamily: "Impact, sans-serif" },
    { label: "Comic", face: "rbxasset://fonts/families/Bangers.json", previewFamily: "'Arial Black', sans-serif" },
    { label: "Gothic", face: "rbxasset://fonts/families/GrenzeGotisch.json", previewFamily: "'Times New Roman', serif" },
    { label: "Typewriter", face: "rbxasset://fonts/families/SpecialElite.json", previewFamily: "'Courier New', monospace" },
    { label: "Techno", face: "rbxasset://fonts/families/Michroma.json", previewFamily: "'Trebuchet MS', sans-serif" },
    { label: "Spooky", face: "rbxasset://fonts/families/Creepster.json", previewFamily: "'Papyrus', fantasy" },
    { label: "Quirky", face: "rbxasset://fonts/families/AmaticSC.json", previewFamily: "'Segoe Script', cursive" },
    { label: "Friendly", face: "rbxasset://fonts/families/Nunito.json", previewFamily: "'Trebuchet MS', sans-serif" }
];

const lobbyFontList = document.getElementById("lobbyFontList");
const lobbyFontButtonsByFace = new Map();

if (lobbyFontList) {

    LOBBY_FONT_CATALOG.forEach(font => {

        const btn = document.createElement("button");

        btn.type = "button";
        btn.className = "lobby-font-option";
        btn.setAttribute("aria-pressed", "false");
        btn.title = font.label;

        const name = document.createElement("span");

        name.className = "lobby-font-option-name";
        name.textContent = font.label;

        const preview = document.createElement("span");

        preview.className = "lobby-font-option-preview";
        preview.style.fontFamily = font.previewFamily;
        preview.textContent = "AaBbCc";

        btn.appendChild(name);
        btn.appendChild(preview);

        btn.addEventListener("click", () => {

            if (lobbyEditor.selection.length) {

                const alreadyThisFont = lobbyEditor.selection.every(i => {

                    const s = letterStyleAt(i);

                    return s && s.font && s.font.face === font.face;

                });

                patchSelection({ font: alreadyThisFont ? null : font });

            } else {

                const alreadyThisFont = lobbyEditor.typingStyle.font && lobbyEditor.typingStyle.font.face === font.face;

                lobbyEditor.typingStyle.font = alreadyThisFont ? null : font;

            }

            syncLobbyFontList();

        });

        lobbyFontButtonsByFace.set(font.face, btn);
        lobbyFontList.appendChild(btn);

    });

}

function syncLobbyFontList() {

    if (!lobbyEditor.selection.length) {

        const armedFace = lobbyEditor.typingStyle.font ? lobbyEditor.typingStyle.font.face : null;

        lobbyFontButtonsByFace.forEach((btn, face) => setTriState(btn, face === armedFace ? "on" : "off"));

        return;

    }

    const facesUsed = new Set(lobbyEditor.selection.map(i => {

        const s = letterStyleAt(i);

        return (s && s.font && s.font.face) || null;

    }));

    if (facesUsed.size > 1) {

        lobbyFontButtonsByFace.forEach(btn => setTriState(btn, "mixed"));

        return;

    }

    const uniform = facesUsed.values().next().value;

    lobbyFontButtonsByFace.forEach((btn, face) => setTriState(btn, face === uniform ? "on" : "off"));

}

onLobbySelectionSync(syncLobbyFontList);

/* ---- color picker: mode toggle, SV square, hue strip, hex, opacity, gradients ---- */

(function initLobbyColorPicker() {

    const modeButtons = document.querySelectorAll("[data-lobby-color-mode]");
    const sv = document.getElementById("lobbySv");
    const svCursor = document.getElementById("lobbySvCursor");
    const hue = document.getElementById("lobbyHue");
    const hueCursor = document.getElementById("lobbyHueCursor");
    const hexInput = document.getElementById("lobbyHexInput");
    const swatchCircle = document.getElementById("lobbyColorSwatch");
    const opacityInput = document.getElementById("lobbyOpacityInput");
    const opacityValue = document.getElementById("lobbyOpacityValue");
    const opacityLabel = document.getElementById("lobbyOpacityLabel");
    const outlineToggle = document.getElementById("lobbyOutlineToggle");
    const outlineJoinRow = document.getElementById("lobbyOutlineJoinRow");
    const gradientPresetRow = document.getElementById("lobbyGradientPresets");
    const gradientStopRow = document.getElementById("lobbyGradientStops");
    const gradientPill = document.getElementById("lobbyGradientPill");

    if (!sv || !hue || !hexInput) {

        return;

    }

    let hue360 = 300;
    let sat = 0.6;
    let val = 1;
    let syncingFromSelection = false;

    let gradient = {
        kind: LOBBY_GRADIENT_KINDS.RAINBOW,
        colors: ["#ff5cc8", "#00c8ff", "#ffffff"],
        dividers: [0.5]
    };

    let activeStop = 0;
    let gradientPointerId = null;

    function hsvToRgb(h, s, v) {

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        let r = 0, g = 0, b = 0;

        if (h < 60) { r = c; g = x; }
        else if (h < 120) { r = x; g = c; }
        else if (h < 180) { g = c; b = x; }
        else if (h < 240) { g = x; b = c; }
        else if (h < 300) { r = x; b = c; }
        else { r = c; b = x; }

        return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];

    }

    function rgbToHsv(r, g, b) {

        r /= 255; g /= 255; b /= 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;

        let h = 0;

        if (d !== 0) {

            if (max === r) h = (60 * ((g - b) / d) + 360) % 360;
            else if (max === g) h = 60 * ((b - r) / d) + 120;
            else h = 60 * ((r - g) / d) + 240;

        }

        return [h, max === 0 ? 0 : d / max, max];

    }

    function currentModeIsGradient() {

        return lobbyColorPanel && lobbyColorPanel.dataset.mode === "gradient";

    }

    function applySolidColor(hex, commit) {

        if (!lobbyEditor.selection.length) {

            if (lobbyEditor.editingOutline) {

                lobbyEditor.typingStyle.ring = true;
                lobbyEditor.typingStyle.ringColor = hex;

            } else {

                lobbyEditor.typingStyle.color = hex;

            }

            return;

        }

        if (lobbyEditor.editingOutline) {

            patchSelection({ ring: true, ringColor: hex }, commit);

        } else {

            patchSelection({ color: hex }, commit);

        }

    }

    function pushFromHsv(commit) {

        const [r, g, b] = hsvToRgb(hue360, sat, val);
        const hex = tupleToHex([r, g, b]);

        hexInput.value = hex;

        if (swatchCircle) {

            swatchCircle.style.backgroundColor = hex;

            if (!syncingFromSelection) {

                swatchCircle.classList.remove("is-mixed");

            }

        }

        sv.style.setProperty("--lobby-hue", hue360);
        svCursor.style.left = `${sat * 100}%`;
        svCursor.style.top = `${(1 - val) * 100}%`;
        hueCursor.style.top = `${(1 - hue360 / 360) * 100}%`;

        if (syncingFromSelection) {

            return;

        }

        if (currentModeIsGradient()) {

            if (gradient.kind !== LOBBY_GRADIENT_KINDS.RAINBOW) {

                gradient.colors[activeStop] = hex;
                renderGradientStops();
                renderGradientPill();
                applyGradientToSelection(gradient);

            }

            return;

        }

        applySolidColor(hex, commit);

    }

    function pushFromHex(hex, commit) {

        const v = hex.replace("#", "");

        if (v.length !== 6) {

            return;

        }

        const [h, s, val2] = rgbToHsv(
            parseInt(v.slice(0, 2), 16),
            parseInt(v.slice(2, 4), 16),
            parseInt(v.slice(4, 6), 16)
        );

        hue360 = h;
        sat = s;
        val = val2;

        pushFromHsv(commit);

    }

    function gradientVisibleColors() {

        return gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW ? [] : gradient.colors;

    }

    function renderGradientStops() {

        if (!gradientStopRow) {

            return;

        }

        gradientStopRow.innerHTML = "";

        gradientVisibleColors().forEach((color, index) => {

            const chip = document.createElement("button");

            chip.type = "button";
            chip.className = "lobby-color-swatch lobby-gradient-stop";
            chip.style.backgroundColor = color;
            chip.classList.toggle("is-active", index === activeStop);
            chip.dataset.stopIndex = index;
            chip.setAttribute("aria-label", `Edit gradient color ${index + 1}`);

            gradientStopRow.appendChild(chip);

        });

    }

    function renderGradientPill() {

        if (!gradientPill) {

            return;

        }

        const colors = gradientVisibleColors();
        const slices = 40;

        gradientPill.innerHTML = "";

        for (let i = 0; i < slices; i++) {

            const t = i / (slices - 1);
            let rgb;

            if (gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW) {

                rgb = sampleRainbowGradient(t, gradient.dividers[0]);

            } else if (gradient.kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

                rgb = sampleBookendGradient(colors[0], colors[1], t, gradient.dividers[0]);

            } else {

                rgb = sampleStopGradient(colors, gradient.dividers, t);

            }

            const slice = document.createElement("div");

            slice.className = "lobby-gradient-slice";
            slice.style.backgroundColor = tupleToHex(rgb);

            gradientPill.appendChild(slice);

        }

        gradient.dividers.forEach((pos, index) => {

            const handle = document.createElement("button");

            handle.type = "button";
            handle.className = "lobby-gradient-handle";
            handle.style.left = `${pos * 100}%`;
            handle.dataset.handleIndex = index;
            handle.setAttribute("aria-label", "Move gradient handle");

            gradientPill.appendChild(handle);

        });

    }

    function setGradientKind(kind) {

        gradient.kind = kind;
        activeStop = 0;

        if (lobbyColorPanel) {

            lobbyColorPanel.classList.toggle("lobby-color-panel--rainbow", kind === LOBBY_GRADIENT_KINDS.RAINBOW);

        }

        if (kind === LOBBY_GRADIENT_KINDS.TWO_STOP || kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

            gradient.colors = [hexInput.value || "#ff5cc8", "#ffffff"];

        } else if (kind === LOBBY_GRADIENT_KINDS.THREE_STOP) {

            gradient.colors = ["#ff5cc8", hexInput.value || "#ffffff", "#00c8ff"];

        } else {

            gradient.colors = ["#ff5cc8", "#00c8ff", "#ffffff"];

        }

        if (kind === LOBBY_GRADIENT_KINDS.THREE_STOP) {

            gradient.dividers = [0.33, 0.67];

        } else if (kind === LOBBY_GRADIENT_KINDS.BOOKEND) {

            gradient.dividers = [0.3];

        } else {

            gradient.dividers = [0.5];

        }

        renderGradientPill();
        renderGradientStops();

        if (!lobbyEditor.selection.length && lobbyEditorInput.value.length) {

            setSelectionRange(0, lobbyEditorInput.value.length);
            redrawLobbyOverlay();
            syncLobbyToolbar();

        }

        applyGradientToSelection(gradient);

        if (lobbyEditor.selection.length) {

            pushLobbySnapshot();

        }

    }

    function setColorMode(mode) {

        if (!lobbyColorPanel) {

            return;

        }

        lobbyColorPanel.dataset.mode = mode;

        lobbyColorPanel.classList.toggle(
            "lobby-color-panel--rainbow",
            mode === "gradient" && gradient.kind === LOBBY_GRADIENT_KINDS.RAINBOW
        );

        modeButtons.forEach(btn => {

            const active = btn.dataset.lobbyColorMode === mode;

            btn.classList.toggle("is-active", active);
            btn.setAttribute("aria-selected", active ? "true" : "false");

        });

        if (mode === "gradient") {

            renderGradientPill();
            renderGradientStops();

        }

    }

    modeButtons.forEach(btn => {

        btn.addEventListener("click", () => setColorMode(btn.dataset.lobbyColorMode));

    });

    if (gradientPresetRow) {

        gradientPresetRow.addEventListener("click", e => {

            const btn = e.target.closest("[data-lobby-gradient-kind]");

            if (!btn) {

                return;

            }

            setGradientKind(btn.dataset.lobbyGradientKind);

        });

    }

    if (gradientStopRow) {

        gradientStopRow.addEventListener("click", e => {

            const chip = e.target.closest("[data-stop-index]");

            if (!chip) {

                return;

            }

            activeStop = Number(chip.dataset.stopIndex);
            renderGradientStops();

            syncingFromSelection = true;
            pushFromHex(gradient.colors[activeStop], false);
            syncingFromSelection = false;

        });

    }

    if (gradientPill) {

        gradientPill.addEventListener("pointerdown", e => {

            const handle = e.target.closest(".lobby-gradient-handle");

            if (!handle) {

                return;

            }

            gradientPointerId = e.pointerId;

            try { gradientPill.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

            const handleIndex = Number(handle.dataset.handleIndex);

            const onMove = event => {

                const rect = gradientPill.getBoundingClientRect();

                let pos = (event.clientX - rect.left) / rect.width;

                pos = Math.max(0.04, Math.min(0.96, pos));

                const prev = gradient.dividers[handleIndex - 1];
                const next = gradient.dividers[handleIndex + 1];

                if (prev !== undefined) pos = Math.max(prev + 0.04, pos);
                if (next !== undefined) pos = Math.min(next - 0.04, pos);

                gradient.dividers[handleIndex] = pos;

                renderGradientPill();
                applyGradientToSelection(gradient);

            };

            const onUp = event => {

                if (event.pointerId !== gradientPointerId) return;

                gradientPill.removeEventListener("pointermove", onMove);
                gradientPill.removeEventListener("pointerup", onUp);
                gradientPill.removeEventListener("pointercancel", onUp);
                gradientPointerId = null;

                pushLobbySnapshot();

            };

            gradientPill.addEventListener("pointermove", onMove);
            gradientPill.addEventListener("pointerup", onUp);
            gradientPill.addEventListener("pointercancel", onUp);

            e.preventDefault();

        });

    }

    if (gradientPresetRow) {

        const syncPresetDisabled = () => {

            gradientPresetRow.querySelectorAll("[data-lobby-gradient-kind]").forEach(btn => {

                const disabled = lobbyEditor.selection.length === 0;

                btn.setAttribute("aria-disabled", disabled ? "true" : "false");
                btn.classList.toggle("is-disabled", disabled);

            });

        };

        onLobbySelectionSync(syncPresetDisabled);
        syncPresetDisabled();

    }

    /* SV square dragging */

    let svDragging = false;
    let svPointerId = null;

    function updateSvFromPoint(clientX, clientY) {

        const rect = sv.getBoundingClientRect();

        sat = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        val = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));

        pushFromHsv(false);

    }

    sv.addEventListener("pointerdown", e => {

        if (e.button !== 0) return;

        svDragging = true;
        svPointerId = e.pointerId;

        try { sv.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

        updateSvFromPoint(e.clientX, e.clientY);

    });

    sv.addEventListener("pointermove", e => {

        if (!svDragging || e.pointerId !== svPointerId) return;

        updateSvFromPoint(e.clientX, e.clientY);

    });

    ["pointerup", "pointercancel"].forEach(evt => {

        sv.addEventListener(evt, e => {

            if (svPointerId !== null && e.pointerId !== svPointerId) return;

            if (svDragging) {

                svDragging = false;
                svPointerId = null;

                pushLobbySnapshot();

            }

        });

    });

    /* Hue strip dragging */

    let hueDragging = false;

    function updateHueFromPoint(clientY) {

        const rect = hue.getBoundingClientRect();

        let y = (clientY - rect.top) / rect.height;

        y = Math.max(0, Math.min(1, y));
        hue360 = (1 - y) * 360;

        pushFromHsv(false);

    }

    hue.addEventListener("pointerdown", e => {

        hueDragging = true;

        try { hue.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }

        updateHueFromPoint(e.clientY);

    });

    hue.addEventListener("pointermove", e => {

        if (hueDragging) updateHueFromPoint(e.clientY);

    });

    ["pointerup", "pointercancel"].forEach(evt => {

        hue.addEventListener(evt, () => {

            if (hueDragging) {

                hueDragging = false;
                pushLobbySnapshot();

            }

        });

    });

    /* hex input */

    function normalizeHex(raw) {

        let v = (raw || "").trim();

        if (v && !v.startsWith("#")) v = "#" + v;

        return v;

    }

    function isValidHex(v) {

        return /^#[0-9a-fA-F]{6}$/.test(v);

    }

    hexInput.addEventListener("input", () => {

        const v = normalizeHex(hexInput.value);

        if (isValidHex(v)) pushFromHex(v, false);

    });

    hexInput.addEventListener("change", () => {

        const v = normalizeHex(hexInput.value);

        if (isValidHex(v)) {

            hexInput.value = v;
            pushFromHex(v, true);

        }

    });

    if (swatchCircle) {

        swatchCircle.addEventListener("click", () => {

            hexInput.focus();
            hexInput.select();

        });

    }

    /* opacity slider */

    function opacityPropName() {

        return lobbyEditor.editingOutline ? "ringFade" : "fade";

    }

    function setOpacityUi(fade) {

        if (opacityLabel) {

            opacityLabel.textContent = lobbyEditor.editingOutline ? "Outline opacity" : "Opacity";

        }

        const pct = Math.round((1 - fade) * 100);

        if (opacityInput) opacityInput.value = pct;
        if (opacityValue) opacityValue.textContent = `${pct}%`;

    }

    if (opacityInput) {

        opacityInput.addEventListener("input", () => {

            const fade = 1 - Number(opacityInput.value) / 100;

            setOpacityUi(fade);

            if (!lobbyEditor.selection.length) {

                lobbyEditor.typingStyle[opacityPropName()] = fade;

                if (lobbyEditor.editingOutline) lobbyEditor.typingStyle.ring = true;

                return;

            }

            const patch = { [opacityPropName()]: fade };

            if (lobbyEditor.editingOutline) patch.ring = true;

            patchSelection(patch, false);

        });

        opacityInput.addEventListener("change", () => {

            if (lobbyEditor.selection.length) {

                pushLobbySnapshot();

            }

        });

    }

    /* outline toggle + join popup */

    if (outlineToggle) {

        outlineToggle.setAttribute("aria-pressed", "false");

        outlineToggle.addEventListener("click", () => {

            lobbyEditor.editingOutline = !lobbyEditor.editingOutline;

            outlineToggle.setAttribute("aria-pressed", lobbyEditor.editingOutline ? "true" : "false");
            outlineToggle.classList.toggle("active", lobbyEditor.editingOutline);

            if (outlineJoinRow) {

                outlineJoinRow.classList.toggle("lobby-outline-joins--open", lobbyEditor.editingOutline);

            }

            syncColorPickerFromSelection();
            syncLobbyToolbar();

        });

    }

    if (outlineJoinRow) {

        outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

            btn.addEventListener("click", () => {

                if (lobbyEditor.selection.length) {

                    patchSelection({ ringJoin: btn.dataset.lobbyJoin });

                } else {

                    lobbyEditor.typingStyle.ring = true;
                    lobbyEditor.typingStyle.ringJoin = btn.dataset.lobbyJoin;

                }

                syncOutlineJoinButtons();

            });

        });

    }

    function syncOutlineJoinButtons() {

        if (!outlineJoinRow) {

            return;

        }

        if (!lobbyEditor.selection.length) {

            const armed = lobbyEditor.typingStyle.ring ? (lobbyEditor.typingStyle.ringJoin || "round") : null;

            outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

                btn.setAttribute("aria-pressed", armed !== null && btn.dataset.lobbyJoin === armed ? "true" : "false");

            });

            return;

        }

        const joins = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return (s && s.ringJoin) || "round";

        });

        const uniform = joins.length && joins.every(j => j === joins[0]) ? joins[0] : null;

        outlineJoinRow.querySelectorAll("[data-lobby-join]").forEach(btn => {

            btn.setAttribute("aria-pressed", uniform !== null && btn.dataset.lobbyJoin === uniform ? "true" : "false");

        });

    }

    onLobbySelectionSync(syncOutlineJoinButtons);

    /* keep the picker's displayed color/opacity matched to selection */

    function syncColorPickerFromSelection() {

        if (!lobbyEditor.selection.length) {

            const colorProp = lobbyEditor.editingOutline ? "ringColor" : "color";
            const fadeProp = lobbyEditor.editingOutline ? "ringFade" : "fade";

            const fade = typeof lobbyEditor.typingStyle[fadeProp] === "number" ? lobbyEditor.typingStyle[fadeProp] : 0;

            setOpacityUi(fade);

            if (swatchCircle) swatchCircle.classList.remove("is-mixed");

            const armedHex = lobbyEditor.typingStyle[colorProp];

            if (armedHex) {

                syncingFromSelection = true;
                pushFromHex(armedHex, false);
                syncingFromSelection = false;

            }

            return;

        }

        const colorProp = lobbyEditor.editingOutline ? "ringColor" : "color";
        const fadeProp = lobbyEditor.editingOutline ? "ringFade" : "fade";

        const fades = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return s && typeof s[fadeProp] === "number" ? s[fadeProp] : 0;

        });

        setOpacityUi(fades.every(f => f === fades[0]) ? fades[0] : 0);

        const colors = lobbyEditor.selection.map(i => {

            const s = letterStyleAt(i);

            return (s && s[colorProp]) || null;

        });

        const uniform = colors.every(c => c === colors[0]);

        if (swatchCircle) {

            swatchCircle.classList.toggle("is-mixed", !uniform);

        }

        if (uniform && colors[0]) {

            syncingFromSelection = true;
            pushFromHex(colors[0], false);
            syncingFromSelection = false;

        }

    }

    onLobbySelectionSync(syncColorPickerFromSelection);

    onLobbyReset(() => {

        hue360 = 300;
        sat = 0.6;
        val = 1;
        activeStop = 0;

        gradient = {
            kind: LOBBY_GRADIENT_KINDS.RAINBOW,
            colors: ["#ff5cc8", "#00c8ff", "#ffffff"],
            dividers: [0.5]
        };

        if (outlineToggle) {

            outlineToggle.setAttribute("aria-pressed", "false");
            outlineToggle.classList.remove("active");

        }

        if (outlineJoinRow) {

            outlineJoinRow.classList.remove("lobby-outline-joins--open");

        }

        setColorMode("solid");
        renderGradientPill();
        renderGradientStops();

        syncingFromSelection = true;
        pushFromHex("#ff5cc8", false);
        syncingFromSelection = false;

    });

    setColorMode("solid");
    renderGradientPill();
    pushFromHsv(false);

})();

/* ---- text input wiring: edits, selection, keyboard, undo/redo ---- */

if (lobbyEditorInput) {

    lobbyEditorInput.addEventListener("input", () => {

        if (lobbyEditor.restoring) {

            return;

        }

        reconcileLettersAfterEdit(lobbyEditorInput.value, previousLobbyText);
        previousLobbyText = lobbyEditorInput.value;

        pushLobbySnapshot();
        clearLobbySelection();
        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("scroll", () => {

        lobbyEditorOverlay.scrollLeft = lobbyEditorInput.scrollLeft;

    });

    lobbyEditorInput.addEventListener("beforeinput", e => {

        if (e.inputType === "historyUndo" || e.inputType === "historyRedo") {

            e.preventDefault();

        }

    });

    function captureNativeSelection() {

        const start = lobbyEditorInput.selectionStart;
        const end = lobbyEditorInput.selectionEnd;

        if (start === end) {

            return;

        }

        setSelectionRange(start, end);
        lobbyEditor.caretShown = false;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    }

    lobbyEditorInput.addEventListener("select", captureNativeSelection);
    lobbyEditorInput.addEventListener("mouseup", captureNativeSelection);

    lobbyEditorInput.addEventListener("click", e => {

        if (lobbyEditorInput.selectionStart !== lobbyEditorInput.selectionEnd) {

            return;

        }

        const index = letterIndexAtClientX(e.clientX);

        if (index >= lobbyEditorInput.value.length) {

            clearLobbySelection();
            redrawLobbyOverlay();
            refreshLobbyPreview();
            syncLobbyToolbar();

            return;

        }

        lobbyEditorInput.setSelectionRange(index, index);

        lobbyEditor.selection = [index];
        lobbyEditor.selectionActive = true;
        lobbyEditor.caretShown = false;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("keydown", e => {

        const isArrow = e.key === "ArrowLeft" || e.key === "ArrowRight";

        if (!isArrow || e.ctrlKey || e.metaKey || e.altKey) {

            return;

        }

        const len = lobbyEditorInput.value.length;

        if (!len) {

            return;

        }

        e.preventDefault();

        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const target = Math.max(0, Math.min(len - 1, lobbyEditor.caret + dir));

        lobbyEditor.caret = target;
        lobbyEditor.caretShown = true;

        if (e.shiftKey) {

            const next = new Set(lobbyEditor.selection);

            next.add(target);

            lobbyEditor.selection = [...next].sort((a, b) => a - b);

        } else {

            lobbyEditor.selection = [target];

        }

        lobbyEditor.selectionActive = lobbyEditor.selection.length > 0;

        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    });

    lobbyEditorInput.addEventListener("blur", () => {

        lobbyEditor.caretShown = false;
        redrawLobbyOverlay();

    });

}

document.addEventListener("mousedown", e => {

    if (!lobbyEditorInput || !lobbyEditorWrap) {

        return;

    }

    if (!(e.ctrlKey || e.metaKey)) {

        return;

    }

    if (!lobbyEditorWrap.contains(e.target)) {

        return;

    }

    e.preventDefault();

    const index = letterIndexAtClientX(e.clientX);

    if (index >= lobbyEditorInput.value.length) {

        return;

    }

    lobbyEditorInput.focus();
    lobbyEditorInput.setSelectionRange(index, index);

    toggleIndexInSelection(index);

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

});

document.addEventListener("keydown", e => {

    if (!lobbyEditorInput) {

        return;

    }

    const withinLobbyPanel = document.activeElement === lobbyEditorInput ||
        (lobbyPanel && lobbyPanel.contains(document.activeElement));

    if (!withinLobbyPanel) {

        return;

    }

    const ctrlOrCmd = e.ctrlKey || e.metaKey;

    if (ctrlOrCmd && (e.key === "z" || e.key === "Z")) {

        e.preventDefault();

        if (e.shiftKey) lobbyRedo(); else lobbyUndo();

        return;

    }

    if (ctrlOrCmd && (e.key === "y" || e.key === "Y")) {

        e.preventDefault();
        lobbyRedo();
        return;

    }

    if (ctrlOrCmd && (e.key === "q" || e.key === "Q")) {

        e.preventDefault();

        clearLobbySelection();
        redrawLobbyOverlay();
        refreshLobbyPreview();
        syncLobbyToolbar();

    }

});

if (lobbyCopyButton) {

    lobbyCopyButton.addEventListener("click", copyLobbyTags);

}

/* ---- reset: wipes the whole panel back to its starting state ---- */

function resetLobbyMaker() {

    lobbyEditorInput.value = "";
    previousLobbyText = "";

    lobbyEditor.letters = [];
    lobbyEditor.selection = [];
    lobbyEditor.selectionActive = false;
    lobbyEditor.caret = 0;
    lobbyEditor.caretShown = false;
    lobbyEditor.editingOutline = false;
    lobbyEditor.typingStyle = blankTypingStyle();

    lobbyEditor.history = [lobbySnapshot()];
    lobbyEditor.historyAt = 0;

    lobbyTagLog.length = 0;

    closeAllLobbySubPanels();

    lobbyResetCallbacks.forEach(fn => fn());

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();
    renderLobbyTagLog();

}

const lobbyResetButton = document.getElementById("lobbyResetButton");

if (lobbyResetButton) {

    attachClickAction(
        lobbyResetButton,
        resetLobbyMaker,
        typeof playPurifySound === "function" ? playPurifySound : (typeof playUtilitySound === "function" ? playUtilitySound : undefined)
    );

}

/* ---- panel shell: toggle button, sliding panel, mutual exclusion ---- */

const lobbyToggleButton = document.getElementById("lobbyToggleButton");
const lobbyPanel = document.getElementById("lobbyPanel");

function setLobbyPanelOpen(isOpen) {

    if (!lobbyPanel || !lobbyToggleButton) {

        return;

    }

    if (isOpen) {

        if (typeof setUpgradePanelOpen === "function") setUpgradePanelOpen(false);
        if (typeof setDeathPanelOpen === "function") setDeathPanelOpen(false);
        if (typeof setAltarsPanelOpen === "function") setAltarsPanelOpen(false);

    }

    lobbyPanel.classList.toggle("open", isOpen);
    lobbyToggleButton.classList.toggle("active", isOpen);
    lobbyToggleButton.setAttribute("aria-expanded", isOpen ? "true" : "false");

}

if (lobbyToggleButton && lobbyPanel) {

    attachClickAction(lobbyToggleButton, () => {

        setLobbyPanelOpen(!lobbyPanel.classList.contains("open"));

    }, typeof playUtilitySound === "function" ? playUtilitySound : undefined);

    document.addEventListener("keydown", event => {

        if (!event.key || event.key.toLowerCase() !== "l") {

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

        setLobbyPanelOpen(!lobbyPanel.classList.contains("open"));

    });

}

const leftPanelElForLobby = document.querySelector(".left-panel");

function updateLobbyLeftPanelAccent() {

    if (!leftPanelElForLobby || !lobbyPanel) {

        return;

    }

    leftPanelElForLobby.classList.toggle("left-panel--lobby", lobbyPanel.classList.contains("open"));

}

if (lobbyPanel) {

    const lobbyAccentObserver = new MutationObserver(updateLobbyLeftPanelAccent);

    lobbyAccentObserver.observe(lobbyPanel, { attributes: true, attributeFilter: ["class"] });

}

updateLobbyLeftPanelAccent();

if (lobbyEditorInput) {

    redrawLobbyOverlay();
    refreshLobbyPreview();
    syncLobbyToolbar();

}

renderLobbyTagLog();
