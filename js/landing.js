/* Retain the existing toolkit in one document. Hashes support shared links;
   the original floating buttons and hotkeys remain the tool navigation. */
(() => {
    'use strict';
    if (window.NullscapeMoved) return;
    const maintenance = document.documentElement.classList.contains('maintenance-active');
    const maintenanceRoutes = new Set(['deaths', 'lobby']);
    const $ = id => document.getElementById(id);
    const home = $('landingView');
    const toolkit = $('toolkitView');
    const routes = {
        curses: { title: 'Curse Tracker' },
        upgrades: { title: 'Upgrade Calculator', panel: 'upgradePanel', setter: 'setUpgradePanelOpen' },
        deaths: { title: 'Death Tracker', panel: 'deathPanel', setter: 'setDeathPanelOpen' },
        altars: { title: 'Altars Calculator', panel: 'altarsPanel', setter: 'setAltarsPanelOpen' },
        lobby: { title: 'Lobby Name Maker', panel: 'lobbyPanel', setter: 'setLobbyPanelOpen' }
    };
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let toolDocument;
    let corePromise;
    let initPromise;
    let initialized = false;
    let routeRevision = 0;
    let loadRevision = 0;
    let assetState = { loaded: 0, total: 1, ready: false, error: false };
    // Required toolkit resources only; optional image preloading remains non-blocking.
    window.NullscapeAssets = Object.freeze({ getState: () => ({ ...assetState,
        progress: assetState.ready ? 1 : assetState.loaded / assetState.total }) });
    try {
        document.documentElement.classList.toggle('low-detail-mode', localStorage.getItem('nullscapeLowDetailMode') === 'true');
    } catch (_) { /* Storage is optional. */ }

    const background = $('landingBackground');
    function resetParallax() {
        background.style.removeProperty('--landing-x');
        background.style.removeProperty('--landing-y');
    }
    window.addEventListener('pointermove', event => {
        if (home.hidden || event.pointerType === 'touch' || reducedMotion.matches) return;
        background.style.setProperty('--landing-x', `${-(event.clientX / innerWidth - .5) * 8}px`);
        background.style.setProperty('--landing-y', `${-(event.clientY / innerHeight - .5) * 8}px`);
    }, { passive: true });
    document.addEventListener('pointerleave', resetParallax);
    reducedMotion.addEventListener('change', resetParallax);

    function showError(message) {
        if (maintenance) {
            document.querySelector('.maintenance-tool-status').textContent = message + ' Reload this page to retry.';
        }
        window.NullscapeIntro?.finish();
        $('errorMessage').textContent = message;
        $('loadError').hidden = false;
        $('assetStatus').textContent = '';
        $('enterToolkit').removeAttribute('aria-busy');
        $('retryAssets').textContent = initPromise ? 'Reload toolkit' : 'Try again';
    }
    async function fetchResource(url, type = 'text') {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
            return type === 'json' ? await response.json() : type === 'blob' ? await response.blob() : await response.text();
        } finally { clearTimeout(timeout); }
    }
    function prepareAssets() {
        const revision = ++loadRevision;
        assetState = { loaded: 0, total: 1, ready: false, error: false };
        $('loadError').hidden = true;
        corePromise = (async () => {
            const markup = await fetchResource('Toolkits.html');
            toolDocument = new DOMParser().parseFromString(markup, 'text/html');
            const core = [...toolDocument.querySelectorAll('link[rel="stylesheet"][href^="css/"], script[src]:not([type="module"]):not([src*="maintenance.js"])')].map(node => node.getAttribute('href') || node.getAttribute('src'));
            if (revision === loadRevision) assetState = { loaded: 1, total: core.length + 1, ready: false, error: false };
            // Preload silently; optional images never hold up the Continue button.
            fetchResource('assets/preload.json', 'json').then(assets => {
                const images = [...new Set(assets)];
                return Promise.all(Array.from({ length: 6 }, async () => {
                    while (images.length && revision === loadRevision) {
                        try { await fetchResource(images.shift(), 'blob'); } catch (_) { /* Load on demand later. */ }
                    }
                }));
            }).catch(() => {});
            await Promise.all(core.map(async url => {
                await fetchResource(url);
                if (revision === loadRevision) assetState.loaded++;
            }));
            if (revision === loadRevision) assetState.ready = true;
        })().catch(error => {
            if (revision === loadRevision) {
                assetState.error = true;
                showError('Could not load the toolkit. Please try again.');
            }
            throw error;
        });
        corePromise.catch(() => {});
        return corePromise;
    }
    function loadElement(node) {
        return new Promise((resolve, reject) => {
            node.onload = resolve;
            node.onerror = () => reject(new Error('Toolkit resource failed to load'));
            document.head.insertBefore(node, $('landingStyles'));
        });
    }
    function initializeToolkit() {
        if (initPromise) return initPromise;
        initPromise = (async () => {
            await corePromise;
            const styles = [...toolDocument.querySelectorAll('link[rel="stylesheet"]')];
            await Promise.all(styles.filter(node => node.getAttribute('href').startsWith('css/')).map(node => loadElement(node.cloneNode())));
            styles.filter(node => !node.getAttribute('href').startsWith('css/')).forEach(node => document.head.append(node.cloneNode()));
            const body = toolDocument.body.cloneNode(true);
            body.querySelectorAll('script').forEach(node => node.remove());
            body.querySelector('#maintenanceScreen')?.remove();
            $('toolkitContent').replaceChildren(...body.childNodes);
            if (maintenance) {
                document.querySelectorAll('#toolkitContent .left-panel > :not(.site-header), #toolkitContent .right-panel > :not(#deathPanel):not(#lobbyPanel), #upgradeToggleButton, #altarsToggleButton').forEach(node => { node.inert = true; });
            }
            for (const source of toolDocument.querySelectorAll('script[src]:not([type="module"]):not([src*="maintenance.js"])')) {
                const script = document.createElement('script');
                script.src = source.getAttribute('src');
                await loadElement(script);
            }
            const presence = document.createElement('script');
            presence.type = 'module';
            presence.src = 'js/presence.js?v=20261022-shared-config1';
            if (!maintenance) document.head.append(presence);
            initialized = true;
            const observer = new MutationObserver(syncPanelRoute);
            Object.values(routes).forEach(route => {
                const panel = route.panel && $(route.panel);
                if (panel) observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
            });
        })();
        initPromise.catch(() => showError('Toolkit could not start. Please reload to try again.'));
        return initPromise;
    }
    function readRoute() {
        const route = location.hash.replace(/^#\/?/, '').replace(/\/$/, '');
        if (route && (!routes[route] || (maintenance && !maintenanceRoutes.has(route)))) {
            history.replaceState(null, '', `${location.pathname}${location.search}#/`);
            return '';
        }
        return route;
    }
    function syncPanelRoute() {
        if (toolkit.hidden || !initialized) return;
        const active = Object.entries(routes).find(([, route]) => route.panel && $(route.panel)?.classList.contains('open'));
        if (maintenance && !active) {
            if (readRoute()) { history.replaceState(null, '', '#/'); applyRoute(); }
            return;
        }
        const route = active ? active[0] : 'curses';
        if (maintenance && !maintenanceRoutes.has(route)) { location.hash = '#/'; return; }
        // Update the shareable URL without replaying navigation, resetting
        // scroll, or adding a browser-history entry for every panel toggle.
        if (readRoute() !== route) history.replaceState(null, '', `#/${route}`);
        document.title = `${routes[route].title} · Nullscape Toolkits`;
    }
    function showToolRoute(route) {
        if (maintenance && !maintenanceRoutes.has(route)) return;
        if (maintenance) {
            document.documentElement.classList.add('maintenance-tool-open');
            document.getElementById('maintenanceScreen').inert = true;
            document.querySelector('.maintenance-tool-status').textContent = '';
        }
        window.NullscapeIntro?.finish();
        const entering = toolkit.hidden;
        home.hidden = true;
        toolkit.hidden = false;
        document.body.classList.remove('at-home');
        Object.entries(routes).forEach(([name, item]) => {
            if (item.setter && $(item.panel).classList.contains('open') !== (name === route)) window[item.setter](name === route);
        });
        document.title = `${routes[route].title} · Nullscape Toolkits`;
        if (entering) {
            window.scrollTo(0, 0);
            toolkit.focus({ preventScroll: true });
            window.dispatchEvent(new Event('resize'));
            window.dispatchEvent(new CustomEvent('nullscape-route-change', { detail: { route } }));
        }
        $('assetStatus').textContent = '';
        $('enterToolkit').removeAttribute('aria-busy');
    }
    async function applyRoute() {
        const revision = ++routeRevision;
        const route = readRoute();
        if (route) {
            if (!corePromise) prepareAssets();
            if (maintenance) document.querySelector('.maintenance-tool-status').textContent = 'Loading ' + routes[route].title + '…';
            // Once initialized, tool links switch synchronously with no overlay.
            if (initialized) { showToolRoute(route); return; }
            $('assetStatus').textContent = 'Loading toolkit';
            $('enterToolkit').setAttribute('aria-busy', 'true');
            try {
                await corePromise;
                if (revision !== routeRevision) return;
                await initializeToolkit();
                if (revision !== routeRevision) return;
                showToolRoute(route);
            } catch (error) { console.warn('Toolkit startup:', error); }
        } else {
            if (maintenance) {
                document.documentElement.classList.remove('maintenance-tool-open');
                document.getElementById('maintenanceScreen').inert = false;
                toolkit.hidden = true;
                home.hidden = true;
                document.body.classList.add('at-home');
                document.title = 'Maintenance · Nullscape Toolkits';
                document.querySelector('.maintenance-tools a')?.focus({ preventScroll: true });
                window.dispatchEvent(new CustomEvent('nullscape-route-change', { detail: { route: 'home' } }));
                return;
            }
            const returning = home.hidden;
            toolkit.hidden = true;
            home.hidden = false;
            document.body.classList.add('at-home');
            document.title = 'Nullscape Toolkits';
            $('assetStatus').textContent = '';
            $('enterToolkit').removeAttribute('aria-busy');
            if (returning) {
                window.scrollTo(0, 0);
                $('enterToolkit').focus({ preventScroll: true });
                window.dispatchEvent(new CustomEvent('nullscape-route-change', { detail: { route: 'home' } }));
            }
        }
    }
    $('retryAssets').addEventListener('click', () => {
        if (initPromise) { location.reload(); return; }
        prepareAssets();
        if (readRoute()) applyRoute();
    });
    document.addEventListener('keydown', event => {
        if (!home.hidden && !event.ctrlKey && !event.metaKey && !event.altKey && ['b','x','n','l'].includes(event.key.toLowerCase())) event.stopImmediatePropagation();
    }, true);
    window.addEventListener('hashchange', applyRoute);

    // Credit in the bottom-right corner. Edit the name (and optional link) here.
    const CREDIT = { text: 'made by Hazu', url: '' };
    const credit = document.createElement(CREDIT.url ? 'a' : 'span');
    credit.className = 'landing-credit';
    const author = document.createElement('span');
    author.textContent = CREDIT.text;
    const inspiration = document.createElement('span');
    inspiration.className = 'landing-inspiration';
    inspiration.append('inspired by ');
    ['alireza1303', 'stickstetris'].forEach((name, index) => {
        const handle = document.createElement('u');
        handle.textContent = name;
        if (index) inspiration.append(' and ');
        inspiration.append(handle);
    });
    inspiration.append("' calculators.");
    credit.append(author, inspiration);
    if (CREDIT.url) { credit.href = CREDIT.url; credit.target = '_blank'; credit.rel = 'noopener noreferrer'; }
    home.append(credit);

    // Proportional lettering needs its l/k boundary aligned, not its bounding-box center.
    function alignToolkitCaption() {
        const caption = home.querySelector('.ns-toolkit-caption');
        if (!caption?.firstChild || !document.createRange || !caption.offsetWidth) return;
        caption.style.translate = '0px 0px';
        const range = document.createRange();
        range.setStart(caption.firstChild, 4);
        range.setEnd(caption.firstChild, 4);
        const parent = caption.parentElement.getBoundingClientRect();
        const scale = caption.getBoundingClientRect().width / caption.offsetWidth;
        const offset = (parent.left + parent.width / 2 - range.getBoundingClientRect().left) / (scale || 1);
        caption.style.translate = `${offset}px 0px`;
    }
    window.addEventListener('resize', alignToolkitCaption);
    window.addEventListener('hashchange', () => requestAnimationFrame(alignToolkitCaption));
    document.fonts?.ready.then(alignToolkitCaption);
    alignToolkitCaption();

    // Play the recorded game cue and fade the landing mix while navigation proceeds.
    home.querySelectorAll('a[href^="#/"]').forEach(link => link.addEventListener('click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        window.NullscapeIntro?.enterToolkit();
    }));
    const featureViewport = home.querySelector('.landing-features-viewport');
    featureViewport.addEventListener('focusout', () => queueMicrotask(() => {
        if (!featureViewport.contains(document.activeElement)) {
            featureViewport.scrollLeft = 0;
            featureViewport.querySelector('.landing-conveyor-window').scrollLeft = 0;
        }
    }));

    if (!maintenance) prepareAssets();
    if (readRoute() || maintenance) applyRoute();
})();
