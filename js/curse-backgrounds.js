(() => {
    function shuffledDeck(paths, previous, random = Math.random) {
        const deck = [...paths];
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        if (deck.length > 1 && deck[0] === previous) [deck[0], deck[1]] = [deck[1], deck[0]];
        return deck;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { shuffledDeck };
        return;
    }

    const initialized = window.NullscapeBackgroundLayers ||= new WeakSet();
    function startBackground({ id, paths, interval, property, nextProperty, route }) {
        const layer = document.getElementById(id);
        if (!layer) return;
        if (initialized.has(layer)) return;
        initialized.add(layer);
        paths = paths.map(name => `assets/background/${name}`);
        let current = paths[0];
        let deck = shuffledDeck(paths.filter(path => path !== current), current);
        let timer;
        let fadeTimer;
        let deadline;
        let remaining = interval;
        const imageCSS = path => `url("${new URL(path, document.baseURI).href}")`;
        const isVisible = () => !document.hidden && location.hash.replace(/^#\/?/, '').replace(/\/$/, '') === route;
        layer.style.setProperty(property, imageCSS(current));

        function schedule() {
            clearTimeout(timer);
            timer = undefined;
            if (!isVisible()) return;
            deadline = performance.now() + remaining;
            timer = setTimeout(rotate, remaining);
        }

        async function rotate() {
            timer = undefined;
            remaining = interval;
            if (!deck.length) deck = shuffledDeck(paths, current);
            const next = deck.shift();
            try {
                const image = new Image();
                image.src = next;
                await image.decode();
                if (!isVisible()) {
                    deck.unshift(next);
                    return;
                }
                layer.style.setProperty(nextProperty, imageCSS(next));
                layer.classList.add('background-changing');
                const fade = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 800;
                fadeTimer = setTimeout(() => {
                    current = next;
                    layer.style.setProperty(property, imageCSS(current));
                    layer.classList.remove('background-changing');
                }, fade);
            } catch {
                // A missing scene leaves the current background intact.
            }
            schedule();
        }

        function visibilityChanged() {
            if (!isVisible() && timer !== undefined) remaining = Math.max(1, deadline - performance.now());
            schedule();
        }
        document.addEventListener('visibilitychange', visibilityChanged);
        window.addEventListener('hashchange', visibilityChanged);
        window.addEventListener('pagehide', event => {
            if (event.persisted) return;
            clearTimeout(timer);
            clearTimeout(fadeTimer);
        });
        schedule();
    }
    startBackground({ id: 'landingBackground', paths: ['CurseTracker2.png', 'CurseTracker3.png', 'CurseTracker.png'],
        interval: 10000, property: '--landing-background', nextProperty: '--next-landing-background', route: '' });
    startBackground({ id: 'bgLayer', paths: ['CurseTracker3.png', 'CurseTracker2.png', 'CurseTracker.png'],
        interval: 60000, property: '--curse-background', nextProperty: '--next-curse-background', route: 'curses' });
})();
