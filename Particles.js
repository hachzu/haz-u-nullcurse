/*
 * Ambient Particle Field
 * --------------------------
 * A lightweight canvas-based particle layer that drifts subtly
 * behind the app's content (sits between the background image
 * layer and the panels - see #particleCanvas in index.html, same
 * z-index tier as #bgLayer). Purely decorative and never intercepts
 * pointer events.
 *
 * Color theme syncs with whichever panel is open (purple default,
 * blue Upgrade Shop, red Death Tracker) by watching the same
 * .left-panel--upgrades / .left-panel--death classes that script.js
 * already toggles for the sidebar accent.
 *
 * Fully customizable at runtime through window.NullscapeParticles,
 * and through the small settings popover added next to the mute
 * button in the header. Settings persist in localStorage.
 *
 * Depends on globals defined in script.js (attachClickAction,
 * playUtilitySound, playRemoveSound) only for the settings UI's
 * button feedback sounds - the particle field itself has no
 * dependency on them and will run fine without them.
 */

(function () {

    const STORAGE_KEY = "nullscapeParticleConfig";

    const THEMES = {
        default: ["#b866ff", "#d59bff", "#7a2fc4"],
        upgrades: ["#8fd9ff", "#00c8ff", "#1c6f96"],
        death: ["#ff6b6b", "#ff9d9d", "#ae1313"]
    };

    const DEFAULT_CONFIG = {
        enabled: true,
        density: 60,   // particles per ~1,000,000px^2 of viewport
        speed: 1,      // multiplier on drift speed
        size: 1,       // multiplier on particle radius
        opacity: 1,    // multiplier on base opacity
        theme: "auto", // "auto" follows the open panel, or a hex color
        twinkle: true,
        connect: false // faint connecting lines between nearby particles
    };

    let config = { ...DEFAULT_CONFIG };

    function loadConfig() {

        try {

            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                return;
            }

            const saved = JSON.parse(raw);

            config = { ...DEFAULT_CONFIG, ...saved };

        } catch (error) {

            console.warn("couldn't load particle config:", error);

        }

    }

    function saveConfig() {

        try {

            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));

        } catch (error) {

            console.warn("couldn't save particle config:", error);

        }

    }

    const prefersReducedMotion = Boolean(
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    const canvas = document.getElementById("particleCanvas");

    if (!canvas) {

        console.warn("Particles.js: #particleCanvas not found in the page, skipping.");
        return;

    }

    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let particles = [];
    let currentThemeKey = "default";
    let mouseX = 0;
    let mouseY = 0;

    function randomBetween(min, max) {

        return min + Math.random() * (max - min);

    }

    function pickColor() {

        if (config.theme !== "auto" && /^#/.test(config.theme)) {

            return config.theme;

        }

        const palette = THEMES[currentThemeKey] || THEMES.default;

        return palette[Math.floor(Math.random() * palette.length)];

    }

    function hexToRgba(hex, alpha) {

        const clean = hex.replace("#", "");

        const full = clean.length === 3
            ? clean.split("").map(c => c + c).join("")
            : clean;

        const bigint = parseInt(full, 16) || 0;

        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;

    }

    function createParticle() {

        return {
            x: Math.random() * width,
            y: Math.random() * height,
            baseRadius: randomBetween(0.6, 2.1),
            vx: randomBetween(-0.06, 0.06),
            vy: randomBetween(-0.16, -0.03),
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: randomBetween(0.002, 0.006),
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: randomBetween(0.01, 0.025),
            color: pickColor()
        };

    }

    function getTargetCount() {

        if (!config.enabled) {
            return 0;
        }

        const area = width * height;

        return Math.round((area / 1000000) * config.density);

    }

    function seedParticles() {

        const target = getTargetCount();

        if (particles.length > target) {

            particles.length = target;

        } else {

            while (particles.length < target) {

                particles.push(createParticle());

            }

        }

    }

    function resize() {

        width = window.innerWidth;
        height = window.innerHeight;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        seedParticles();

    }

    function drawConnections() {

        const maxDist = 90;

        for (let i = 0; i < particles.length; i++) {

            for (let j = i + 1; j < particles.length; j++) {

                const a = particles[i];
                const b = particles[j];

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < maxDist) {

                    const alpha = (1 - dist / maxDist) * 0.08 * config.opacity;

                    ctx.strokeStyle = hexToRgba(a.color, alpha);
                    ctx.lineWidth = 0.6;

                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();

                }

            }

        }

    }

    function step() {

        ctx.clearRect(0, 0, width, height);

        if (config.enabled && !prefersReducedMotion) {

            const parallaxX = ((mouseX / width) - 0.5) * 10;
            const parallaxY = ((mouseY / height) - 0.5) * 10;

            for (const p of particles) {

                p.wobble += p.wobbleSpeed;
                p.twinklePhase += p.twinkleSpeed;

                p.x += p.vx * config.speed + Math.sin(p.wobble) * 0.03;
                p.y += p.vy * config.speed;

                if (p.y < -10) {

                    p.y = height + 10;
                    p.x = Math.random() * width;

                }

                if (p.x < -10) {
                    p.x = width + 10;
                }

                if (p.x > width + 10) {
                    p.x = -10;
                }

                const twinkle = config.twinkle
                    ? (0.55 + 0.45 * Math.sin(p.twinklePhase))
                    : 1;

                const alpha = 0.35 * config.opacity * twinkle;
                const radius = p.baseRadius * config.size;

                ctx.beginPath();
                ctx.fillStyle = hexToRgba(p.color, alpha);
                ctx.arc(p.x + parallaxX, p.y + parallaxY, radius, 0, Math.PI * 2);
                ctx.fill();

            }

            if (config.connect) {

                drawConnections();

            }

        }

        requestAnimationFrame(step);

    }

    window.addEventListener("resize", resize);

    window.addEventListener("mousemove", event => {

        mouseX = event.clientX;
        mouseY = event.clientY;

    });

    function detectTheme() {

        const leftPanel = document.querySelector(".left-panel");

        if (!leftPanel) {
            return "default";
        }

        if (leftPanel.classList.contains("left-panel--upgrades")) {
            return "upgrades";
        }

        if (leftPanel.classList.contains("left-panel--death")) {
            return "death";
        }

        return "default";

    }

    function syncTheme() {

        const next = detectTheme();

        if (next !== currentThemeKey) {

            currentThemeKey = next;

            // Recolor everything immediately - each particle's own
            // twinkle fade masks the swap so it still reads as
            // smooth rather than a hard cut.
            particles.forEach(p => {

                p.color = pickColor();

            });

        }

    }

    const leftPanelEl = document.querySelector(".left-panel");

    if (leftPanelEl) {

        const themeObserver = new MutationObserver(syncTheme);

        themeObserver.observe(leftPanelEl, { attributes: true, attributeFilter: ["class"] });

    }

    // ---- Public API ----
    window.NullscapeParticles = {

        setConfig(partial) {

            config = { ...config, ...partial };

            saveConfig();
            seedParticles();

            if (typeof window.refreshParticleSettingsUI === "function") {

                window.refreshParticleSettingsUI();

            }

        },

        getConfig() {

            return { ...config };

        },

        reset() {

            config = { ...DEFAULT_CONFIG };

            saveConfig();
            seedParticles();

            if (typeof window.refreshParticleSettingsUI === "function") {

                window.refreshParticleSettingsUI();

            }

        }

    };

    loadConfig();
    resize();
    syncTheme();
    step();

    /*
     * ---- Settings popover ----
     * A small "particle field" button dropped next to the existing
     * mute toggle in the header, opening a compact card of sliders
     * (density/speed/size/opacity), an auto-vs-custom color choice,
     * an optional connecting-lines mode, and a reset button. Same
     * switch/button visual language as the rest of the site.
     */
    function buildSettingsUI() {

        const headerControls = document.querySelector(".site-header-controls");

        if (!headerControls || document.getElementById("particleSettingsButton")) {

            return;

        }

        const button = document.createElement("button");

        button.type = "button";
        button.id = "particleSettingsButton";
        button.className = "mute-toggle-button particle-settings-button";
        button.setAttribute("aria-label", "Particle effect settings");
        button.setAttribute("aria-expanded", "false");
        button.title = "Customize ambient particles";
        button.innerHTML = '<span class="particle-settings-icon">&#10022;</span>';

        const panel = document.createElement("div");

        panel.id = "particleSettingsPanel";
        panel.className = "particle-settings-panel";
        panel.setAttribute("role", "dialog");
        panel.hidden = true;

        panel.innerHTML = `
            <div class="particle-settings-header-row">
                <div class="particle-settings-heading">PARTICLE FIELD</div>
                <button type="button" id="particleCloseButton" class="particle-close-button" aria-label="Close particle settings">&times;</button>
            </div>

            <button type="button" id="particleEnabledToggle" class="upgrade-switch particle-enabled-switch" role="switch">
                <span class="upgrade-switch-track"><span class="upgrade-switch-thumb"></span></span>
                <span class="upgrade-switch-label">ON</span>
            </button>

            <label class="particle-settings-row">
                <span>Density</span>
                <input type="range" id="particleDensityInput" min="0" max="150" step="5">
                <span class="particle-settings-value" id="particleDensityValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Speed</span>
                <input type="range" id="particleSpeedInput" min="0.2" max="3" step="0.1">
                <span class="particle-settings-value" id="particleSpeedValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Size</span>
                <input type="range" id="particleSizeInput" min="0.5" max="2.5" step="0.1">
                <span class="particle-settings-value" id="particleSizeValue"></span>
            </label>

            <label class="particle-settings-row">
                <span>Opacity</span>
                <input type="range" id="particleOpacityInput" min="0.2" max="1.5" step="0.1">
                <span class="particle-settings-value" id="particleOpacityValue"></span>
            </label>

            <label class="particle-settings-row particle-settings-row--color">
                <span>Color</span>
                <select id="particleThemeSelect">
                    <option value="auto">Auto (match panel)</option>
                    <option value="custom">Custom</option>
                </select>
                <input type="color" id="particleColorInput" value="#b866ff">
            </label>

            <label class="particle-settings-row particle-settings-row--checkbox">
                <span>Connecting lines</span>
                <input type="checkbox" id="particleConnectInput">
            </label>

            <button type="button" id="particleResetButton" class="upgrade-reset-button particle-reset-button">
                <span class="btn-label">RESET</span>
            </button>
        `;

        document.body.appendChild(panel);

        const muteButton = document.getElementById("muteToggleButton");

        if (muteButton) {

            headerControls.insertBefore(button, muteButton);

        } else {

            headerControls.appendChild(button);

        }

        function positionPanel() {

            const rect = button.getBoundingClientRect();
            const panelWidth = panel.offsetWidth || 240;

            // Anchor the panel's left edge to the button's left edge
            // so it opens rightward into the page - the button sits
            // near the left edge of the 400px sidebar, so anchoring
            // via `right` (panel's right edge to the button) pushed
            // the whole panel further left, off the visible screen.
            // Still clamped so it can't overflow the right edge of
            // the viewport either.
            const maxLeft = window.innerWidth - panelWidth - 8;
            const left = Math.min(rect.left, maxLeft);

            panel.style.top = (rect.bottom + 8) + "px";
            panel.style.left = Math.max(8, left) + "px";
            panel.style.right = "auto";

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

            // Stop this click from also reaching the document-level
            // "click outside closes it" listener below - without
            // this, a click on the button's icon (a child element)
            // opens the panel and then immediately closes it again
            // in the very same click, since that listener only
            // checked for an exact match against the button element
            // itself.
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

        const closeButton = panel.querySelector("#particleCloseButton");

        closeButton.addEventListener("click", event => {

            event.stopPropagation();
            closePanel();

            if (typeof playUtilitySound === "function") {

                playUtilitySound();

            }

        });

        document.addEventListener("click", event => {

            // button.contains(...) instead of a strict !== check, so
            // this only fires for genuine clicks outside both the
            // button and the panel - not for clicks on something
            // nested inside the button (its icon span) or the panel
            // (its sliders, dropdown, etc).
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

        const enabledToggle = panel.querySelector("#particleEnabledToggle");
        const densityInput = panel.querySelector("#particleDensityInput");
        const densityValue = panel.querySelector("#particleDensityValue");
        const speedInput = panel.querySelector("#particleSpeedInput");
        const speedValue = panel.querySelector("#particleSpeedValue");
        const sizeInput = panel.querySelector("#particleSizeInput");
        const sizeValue = panel.querySelector("#particleSizeValue");
        const opacityInput = panel.querySelector("#particleOpacityInput");
        const opacityValue = panel.querySelector("#particleOpacityValue");
        const themeSelect = panel.querySelector("#particleThemeSelect");
        const colorInput = panel.querySelector("#particleColorInput");
        const connectInput = panel.querySelector("#particleConnectInput");
        const resetButton = panel.querySelector("#particleResetButton");

        function refresh() {

            const cfg = window.NullscapeParticles.getConfig();

            enabledToggle.classList.toggle("active", cfg.enabled);
            enabledToggle.setAttribute("aria-checked", cfg.enabled ? "true" : "false");
            enabledToggle.querySelector(".upgrade-switch-label").textContent = cfg.enabled ? "ON" : "OFF";

            densityInput.value = cfg.density;
            densityValue.textContent = cfg.density;

            speedInput.value = cfg.speed;
            speedValue.textContent = cfg.speed.toFixed(1) + "x";

            sizeInput.value = cfg.size;
            sizeValue.textContent = cfg.size.toFixed(1) + "x";

            opacityInput.value = cfg.opacity;
            opacityValue.textContent = cfg.opacity.toFixed(1) + "x";

            const isCustom = cfg.theme !== "auto";

            themeSelect.value = isCustom ? "custom" : "auto";
            colorInput.value = isCustom ? cfg.theme : "#b866ff";
            colorInput.style.visibility = isCustom ? "visible" : "hidden";

            connectInput.checked = cfg.connect;

        }

        window.refreshParticleSettingsUI = refresh;

        enabledToggle.addEventListener("click", () => {

            window.NullscapeParticles.setConfig({ enabled: !window.NullscapeParticles.getConfig().enabled });

        });

        densityInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ density: Number(densityInput.value) });

        });

        speedInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ speed: Number(speedInput.value) });

        });

        sizeInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ size: Number(sizeInput.value) });

        });

        opacityInput.addEventListener("input", () => {

            window.NullscapeParticles.setConfig({ opacity: Number(opacityInput.value) });

        });

        themeSelect.addEventListener("change", () => {

            if (themeSelect.value === "auto") {

                window.NullscapeParticles.setConfig({ theme: "auto" });

            } else {

                window.NullscapeParticles.setConfig({ theme: colorInput.value });

            }

        });

        colorInput.addEventListener("input", () => {

            themeSelect.value = "custom";

            window.NullscapeParticles.setConfig({ theme: colorInput.value });

        });

        connectInput.addEventListener("change", () => {

            window.NullscapeParticles.setConfig({ connect: connectInput.checked });

        });

        resetButton.addEventListener("click", () => {

            window.NullscapeParticles.reset();

            if (typeof playRemoveSound === "function") {

                playRemoveSound();

            }

        });

        refresh();

    }

    if (document.readyState === "loading") {

        document.addEventListener("DOMContentLoaded", buildSettingsUI);

    } else {

        buildSettingsUI();

    }

})();