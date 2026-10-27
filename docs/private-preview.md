# Private local toolkit preview

Link's live Firebase transport is also disabled in this preview. The Link section can be inspected locally; `scripts/test-link-browser.cjs` tests collaboration between two browsers with mock rooms and all external requests blocked. See `docs/toolkit-link.md` for the one-time Firebase rules setup needed on the hosted site.

Double-click **Preview Toolkits.cmd** in the project folder, keep its window open, then open:

http://127.0.0.1:4173/#/curses

Other views: `/#/upgrades`, `/#/deaths`, `/#/altars`, `/#/lobby`, `/` for the original landing page, and `/contributors/` for credits. Press Ctrl+C in the preview window to stop it.

The preview serves the actual working files and automatically reloads after site files are saved. It removes the maintenance cover only from the HTML responses on this local server. The preview never changes maintenance settings in the source files. Public maintenance currently permits only Death Tracker and Lobby Name Maker; this private preview permits all tools. Local preview also substitutes empty modules for Firebase presence and visit counting, so testing does not write to the live database or ask for a public username.

The server binds to **127.0.0.1**, so the link works only on this computer. Other people on the internet or your Wi-Fi cannot reach it. Anyone using this same computer can access it while running; this is not account/password protection. Do not expose it through a tunnel or port forwarding. A private preview accessible from other devices would need a separate hosted deployment with real authentication.

The public site remains a static website: any future maintenance screen is a presentation cover, not protection for downloaded source files or assets. There is no secret public URL or browser password bypass added by this preview.

Preview selections are stored in this browser's local storage at this local address, separately from the live site's selections. Keep using the same address and port to retain them. Refreshes can reset unsaved UI state, so finish an in-progress input before saving source changes.

Requires the existing Node.js installation. Terminal alternative: `node scripts/private-preview.cjs` from the project folder. If port 4173 is occupied by this preview already, use its existing URL; otherwise set `NULLSCAPE_PREVIEW_PORT` to another unused port before launching.
