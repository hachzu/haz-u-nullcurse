/* Persistent low-detail setting shared by the landing page and the toolkit. */
(function () {
    const STORAGE_KEY = "nullscapeLowDetailMode";
    const root = document.documentElement;

    function readSetting() {
        try { return localStorage.getItem(STORAGE_KEY) === "true"; }
        catch (error) { return root.classList.contains("low-detail-mode"); }
    }

    function apply(enabled, save) {
        root.classList.toggle("low-detail-mode", Boolean(enabled));
        if (save) {
            try { localStorage.setItem(STORAGE_KEY, String(Boolean(enabled))); }
            catch (error) { console.warn("couldn't save low-detail setting:", error); }
        }
        document.querySelectorAll(".low-detail-toggle-button").forEach(button => {
            button.setAttribute("aria-pressed", String(Boolean(enabled)));
            button.textContent = enabled ? "LOW DETAIL: ON" : "LOW DETAIL";
            button.title = enabled ? "Use full-detail mode" : "Use low-detail mode";
        });
        window.dispatchEvent(new CustomEvent("nullscape-low-detail-change", { detail: { enabled: Boolean(enabled) } }));
    }

    window.NullscapeLowDetail = {
        isEnabled: () => root.classList.contains("low-detail-mode"),
        setEnabled: enabled => apply(enabled, true)
    };

    function applyWithLoader(enabled) {
        const loader = document.getElementById("detailLoader");
        if (!loader) return apply(enabled, true);

        loader.classList.add("detail-loader--active");
        window.setTimeout(() => apply(enabled, true), 180);
        window.setTimeout(() => loader.classList.remove("detail-loader--active"), 650);
    }

    document.querySelectorAll(".low-detail-toggle-button").forEach(toggle => {
        toggle.addEventListener("click", () => applyWithLoader(!root.classList.contains("low-detail-mode")));
    });
    apply(readSetting(), false);
}());
