/* Retain the existing toolkit in one document. Hashes support shared links;
   the original floating buttons and hotkeys remain the tool navigation. */
(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const home = $('landingView');
    const toolkit = $('toolkitView');
    const routes = {
        curses: { title: 'Curse Tracker' },
        upgrades: { title: 'Upgrade Calculator', panel: 'upgradePanel', setter: 'setUpgradePanelOpen' },
        deaths: { title: 'Death Tracker', panel: 'deathPanel', setter: 'setDeathPanelOpen' },
        altars: { title: 'Altars', panel: 'altarsPanel', setter: 'setAltarsPanelOpen' },
        lobby: { title: 'Lobby Maker', panel: 'lobbyPanel', setter: 'setLobbyPanelOpen' }
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
        background.style.setProperty('--landing-x', `${-(event.clientX / innerWidth - .5) * 20}px`);
        background.style.setProperty('--landing-y', `${-(event.clientY / innerHeight - .5) * 20}px`);
    }, { passive: true });
    document.addEventListener('pointerleave', resetParallax);
    reducedMotion.addEventListener('change', resetParallax);

    function showError(message) {
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
            const core = [...toolDocument.querySelectorAll('link[rel="stylesheet"][href^="css/"], script[src]:not([type="module"])')].map(node => node.getAttribute('href') || node.getAttribute('src'));
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
            $('toolkitContent').replaceChildren(...body.childNodes);
            for (const source of toolDocument.querySelectorAll('script[src]:not([type="module"])')) {
                const script = document.createElement('script');
                script.src = source.getAttribute('src');
                await loadElement(script);
            }
            const presence = document.createElement('script');
            presence.type = 'module';
            presence.src = 'js/presence.js';
            document.head.append(presence);
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
        if (route && !routes[route]) {
            history.replaceState(null, '', `${location.pathname}${location.search}#/`);
            return '';
        }
        return route;
    }
    function syncPanelRoute() {
        if (toolkit.hidden || !initialized) return;
        const active = Object.entries(routes).find(([, route]) => route.panel && $(route.panel)?.classList.contains('open'));
        const route = active ? active[0] : 'curses';
        // Update the shareable URL without replaying navigation, resetting
        // scroll, or adding a browser-history entry for every panel toggle.
        if (readRoute() !== route) history.replaceState(null, '', `#/${route}`);
        document.title = `${routes[route].title} · Nullscape Toolkits`;
    }
    function showToolRoute(route) {
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
    const CREDIT = { text: 'made by @sxfthazu.html', url: '' };
    const credit = document.createElement(CREDIT.url ? 'a' : 'span');
    credit.className = 'landing-credit';
    credit.textContent = CREDIT.text;
    if (CREDIT.url) { credit.href = CREDIT.url; credit.target = '_blank'; credit.rel = 'noopener noreferrer'; }
    home.append(credit);

    // Satisfying reverbed "thock" when pressing the enter button.
    // Synthesized with Web Audio, so there is no audio file to load.
    let thockContext;
    let thockBus;
    function createThockBus(context) {
        const master = context.createGain();
        master.gain.value = .9;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -8;
        limiter.knee.value = 10;
        limiter.ratio.value = 10;
        limiter.attack.value = .002;
        limiter.release.value = .2;
        master.connect(limiter).connect(context.destination);
        // Dark, roomy tail: decaying noise run through a one-pole lowpass.
        const length = Math.ceil(context.sampleRate * 2.2);
        const impulse = context.createBuffer(2, length, context.sampleRate);
        let seed = 4242;
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            let last = 0;
            for (let i = 0; i < length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                const noise = seed / 4294967296 * 2 - 1;
                last += (noise - last) * .35;
                data[i] = last * Math.pow(1 - i / length, 3);
            }
        }
        const reverb = context.createConvolver();
        reverb.buffer = impulse;
        const preDelay = context.createDelay(.1);
        preDelay.delayTime.value = .012;
        const wet = context.createGain();
        wet.gain.value = .55;
        preDelay.connect(reverb).connect(wet).connect(master);
        return { master, send: preDelay };
    }
    function noiseBuffer(context, seconds) {
        const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * seconds), context.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buffer;
    }
    function playThock() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        try {
            thockContext ||= new AudioCtx({ latencyHint: 'interactive' });
            if (thockContext.state === 'suspended') thockContext.resume().catch(() => {});
            const context = thockContext;
            thockBus ||= createThockBus(context);
            const now = context.currentTime + .005;
            const drift = 1 + (Math.random() - .5) * .06; // tiny pitch variance so it never sounds canned
            const out = context.createGain();
            out.connect(thockBus.master);
            out.connect(thockBus.send);
            // Layer 1: deep rounded body, a fast pitch drop.
            const body = context.createOscillator();
            const bodyGain = context.createGain();
            body.type = 'sine';
            body.frequency.setValueAtTime(190 * drift, now);
            body.frequency.exponentialRampToValueAtTime(68 * drift, now + .11);
            bodyGain.gain.setValueAtTime(0, now);
            bodyGain.gain.linearRampToValueAtTime(.95, now + .003);
            bodyGain.gain.exponentialRampToValueAtTime(.0001, now + .26);
            body.connect(bodyGain).connect(out);
            body.start(now);
            body.stop(now + .3);
            // Layer 2: woody mid "knock".
            const knock = context.createOscillator();
            const knockGain = context.createGain();
            knock.type = 'triangle';
            knock.frequency.setValueAtTime(340 * drift, now);
            knock.frequency.exponentialRampToValueAtTime(150 * drift, now + .06);
            knockGain.gain.setValueAtTime(0, now);
            knockGain.gain.linearRampToValueAtTime(.38, now + .002);
            knockGain.gain.exponentialRampToValueAtTime(.0001, now + .13);
            knock.connect(knockGain).connect(out);
            knock.start(now);
            knock.stop(now + .16);
            // Layer 3: bottom-out thud (low-passed noise).
            const thud = context.createBufferSource();
            thud.buffer = noiseBuffer(context, .08);
            const thudFilter = context.createBiquadFilter();
            thudFilter.type = 'lowpass';
            thudFilter.frequency.value = 650;
            const thudGain = context.createGain();
            thudGain.gain.setValueAtTime(.7, now);
            thudGain.gain.exponentialRampToValueAtTime(.0001, now + .07);
            thud.connect(thudFilter).connect(thudGain).connect(out);
            thud.start(now);
            // Layer 4: crisp click transient on top.
            const tick = context.createBufferSource();
            tick.buffer = noiseBuffer(context, .03);
            const tickFilter = context.createBiquadFilter();
            tickFilter.type = 'bandpass';
            tickFilter.frequency.value = 2400 * drift;
            tickFilter.Q.value = 1.1;
            const tickGain = context.createGain();
            tickGain.gain.setValueAtTime(.28, now);
            tickGain.gain.exponentialRampToValueAtTime(.0001, now + .02);
            tick.connect(tickFilter).connect(tickGain).connect(out);
            tick.start(now);
            body.onended = () => out.disconnect();
        } catch (_) { /* Sound is optional. */ }
    }
    $('enterToolkit').addEventListener('click', playThock);

    prepareAssets();
    if (readRoute()) applyRoute();
})();
