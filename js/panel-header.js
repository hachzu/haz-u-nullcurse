/* Shared sidebar artwork and local header visibility. */
(() => {
    const frame = document.getElementById('sidebarHeader');
    if (!frame) return;
    const brand = document.getElementById('logoText');
    const menu = document.getElementById('sidebarHeaderMenu');
    const hideButton = document.getElementById('sidebarHeaderHide');
    const showButton = document.getElementById('sidebarHeaderShow');
    const storageKey = 'nullscapeHeaderHidden';
    const panels = [
        { name: 'upgrades', id: 'upgradePanel', selector: '.tool-header-brand--upgrades', title: 'Upgrade Calculator' },
        { name: 'altars', id: 'altarsPanel', selector: '.tool-header-brand--altars', title: 'Altars' },
        { name: 'deaths', id: 'deathPanel', selector: '.death-panel-heading', title: 'Death Tracker' },
        { name: 'lobby', id: 'lobbyPanel', selector: '.lobby-panel-heading', title: 'Lobby Maker' },
        { name: 'curses', selector: '.tool-header-brand--curses', title: 'Curse Tracker' }
    ];
    const titles = new Map([['logo', 'Nullscape Toolkits']]);
    for (const panel of panels) {
        titles.set(panel.name, panel.title);
        const source = document.querySelector(panel.selector);
        if (!source) continue;
        const slide = document.createElement('span');
        slide.className = 'sidebar-header-slide';
        slide.dataset.header = panel.name;
        slide.setAttribute('aria-hidden', 'true');
        const artwork = document.createElement('span');
        if (source.classList.contains('tool-header-brand')) {
            artwork.className = source.className;
            artwork.append(...source.childNodes);
        } else {
            artwork.className = `sidebar-header-title sidebar-header-title--${panel.name}`;
            artwork.textContent = panel.title;
        }
        slide.append(artwork);
        brand.append(slide);
        if (panel.name === 'curses') source.closest('.pool-title-row').parentElement.remove();
        else source.remove();
    }
    document.querySelector('.app').classList.add('panel-headers-in-sidebar');
    let hidden = false;
    try { hidden = localStorage.getItem(storageKey) === 'true'; } catch (_) {}
    let route;
    let showingLogo = true;
    let rotationTimer;

    function showArtwork(name) {
        brand.querySelectorAll('.sidebar-header-slide').forEach(slide => {
            slide.classList.toggle('is-current', slide.dataset.header === name);
        });
        brand.setAttribute('aria-label', `${titles.get(name)} — header options`);
    }

    function scheduleRotation() {
        clearTimeout(rotationTimer);
        if (route !== 'curses' || hidden || !menu.hidden || document.hidden ||
            document.getElementById('toolkitView')?.hidden) return;
        rotationTimer = setTimeout(() => {
            showingLogo = !showingLogo;
            showArtwork(showingLogo ? 'logo' : 'curses');
            scheduleRotation();
        }, 15000);
    }

    function closeMenu() {
        menu.hidden = true;
        brand.setAttribute('aria-expanded', 'false');
        scheduleRotation();
    }

    function syncVisibility() {
        brand.hidden = hidden;
        showButton.hidden = !hidden;
        frame.classList.toggle('is-hidden', hidden);
        scheduleRotation();
    }

    function refresh() {
        const active = panels.find(panel => panel.id &&
            document.getElementById(panel.id)?.classList.contains('open'));
        const nextRoute = active?.name || 'curses';
        if (route !== nextRoute) {
            route = nextRoute;
            showingLogo = true;
            showArtwork(route === 'curses' ? 'logo' : route);
            closeMenu();
        }
        scheduleRotation();
    }

    brand.addEventListener('click', () => {
        const opening = menu.hidden;
        menu.hidden = !opening;
        brand.setAttribute('aria-expanded', String(opening));
        scheduleRotation();
        if (opening) hideButton.focus({ preventScroll: true });
    });
    hideButton.addEventListener('click', () => {
        hidden = true;
        closeMenu();
        syncVisibility();
        try { localStorage.setItem(storageKey, 'true'); } catch (_) {}
        showButton.focus({ preventScroll: true });
    });
    showButton.addEventListener('click', () => {
        hidden = false;
        syncVisibility();
        try { localStorage.setItem(storageKey, 'false'); } catch (_) {}
        brand.focus({ preventScroll: true });
    });
    menu.querySelector('a').addEventListener('click', closeMenu);
    document.addEventListener('pointerdown', event => {
        if (!menu.hidden && !frame.contains(event.target)) closeMenu();
    });
    frame.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            event.preventDefault();
            closeMenu();
            brand.focus({ preventScroll: true });
        }
    });
    const observer = new MutationObserver(refresh);
    panels.filter(panel => panel.id).forEach(panel => {
        observer.observe(document.getElementById(panel.id), { attributes: true, attributeFilter: ['class'] });
    });
    document.addEventListener('visibilitychange', scheduleRotation);
    window.addEventListener('nullscape-route-change', refresh);
    window.addEventListener('pageshow', scheduleRotation);
    window.addEventListener('pagehide', event => {
        clearTimeout(rotationTimer);
        if (!event.persisted) observer.disconnect();
    });
    syncVisibility();
    refresh();
})();
