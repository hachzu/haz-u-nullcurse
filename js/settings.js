/* Settings panel controls that depend on the main app's persisted preferences. */
(function () {
    const panel = document.getElementById("settingsPanel");
    const openButton = document.getElementById("settingsToggleButton");
    const closeButton = document.getElementById("settingsCloseButton");
    const sfxButton = document.getElementById("settingsSfxToggle");
    function setOpen(open) { if (!panel || !openButton) return; panel.hidden = !open; openButton.setAttribute("aria-expanded", String(open)); if (open) document.dispatchEvent(new CustomEvent("nullscape-settings-opened")); }
    if (openButton) openButton.addEventListener("click", () => setOpen(panel.hidden));
    if (closeButton) closeButton.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", event => { if (event.key === "Escape") setOpen(false); });
    function refreshSfx() { if (!sfxButton || !window.NullscapeSound) return; const enabled = !window.NullscapeSound.isMuted(); sfxButton.setAttribute("aria-pressed", String(enabled)); sfxButton.textContent = `SFX: ${enabled ? "ON" : "OFF"}`; }
    if (sfxButton) sfxButton.addEventListener("click", () => { if (window.NullscapeSound) window.NullscapeSound.setMuted(!window.NullscapeSound.isMuted()); refreshSfx(); });
    window.addEventListener("nullscape-sound-change", refreshSfx);
    refreshSfx();

}());