const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { shuffledDeck } = require('../js/curse-backgrounds.js');

function harness({ landing = false } = {}) {
    let now = 0, id = 0;
    const timers = new Map(), properties = new Map(), classes = new Set(), events = new Map();
    const layer = { style: { setProperty: (key, value) => properties.set(key, value) },
        classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
    const document = { hidden: false, baseURI: 'https://example.test/toolkits/', getElementById: id => id === (landing ? 'landingBackground' : 'bgLayer') ? layer : null,
        addEventListener: (name, callback) => events.set(name, callback) };
    const location = { hash: landing ? '#/' : '#/curses' };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/curse-backgrounds.js'), 'utf8'), {
        document, location, URL, performance: { now: () => now },
        Image: class { decode() { return Promise.resolve(); } },
        matchMedia: () => ({ matches: false }),
        window: { addEventListener: (name, callback) => events.set(name, callback) },
        setTimeout(callback, delay) { const key = ++id; timers.set(key, { callback, at: now + delay }); return key; },
        clearTimeout: key => timers.delete(key)
    });
    return { properties, classes, document, location, events,
        async advance(ms) {
            const end = now + ms;
            while (true) {
                const due = [...timers].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                now = due[1].at; timers.delete(due[0]); await due[1].callback();
            }
            now = end;
        } };
}

test('shuffle uses every scene and avoids consecutive repeats at deck boundaries', () => {
    for (const value of [0, 0.5, 0.99]) {
        const deck = shuffledDeck(['a', 'b', 'c'], 'a', () => value);
        assert.notEqual(deck[0], 'a');
        assert.deepEqual([...deck].sort(), ['a', 'b', 'c']);
    }
});
test('background changes after one minute and completes its smooth fade', async () => {
    const h = harness(), initial = h.properties.get('--curse-background');
    await h.advance(59999);
    assert.equal(h.properties.get('--curse-background'), initial);
    await h.advance(1);
    assert(h.classes.has('background-changing'));
    await h.advance(800);
    assert(!h.classes.has('background-changing'));
    assert.notEqual(h.properties.get('--curse-background'), initial);
});
test('CSS background URLs are absolute and preserve a subdirectory deployment', () => {
    const h = harness();
    assert.equal(h.properties.get('--curse-background'), 'url("https://example.test/toolkits/assets/background/CurseTracker3.png")');
});
test('leaving the tracker pauses the timer and returning resumes its remaining time', async () => {
    const h = harness(), initial = h.properties.get('--curse-background');
    await h.advance(30000);
    h.location.hash = '#/upgrades'; h.events.get('hashchange')();
    await h.advance(120000);
    assert.equal(h.properties.get('--curse-background'), initial);
    h.location.hash = '#/curses'; h.events.get('hashchange')();
    await h.advance(29999);
    assert(!h.classes.has('background-changing'));
    await h.advance(1);
    assert(h.classes.has('background-changing'));
});

test('landing shuffles all three original scenes every ten seconds without immediate repeats', async () => {
    const h = harness({ landing: true });
    const initial = h.properties.get('--landing-background');
    assert.match(initial, /CurseTracker2\.png/);
    await h.advance(9999);
    assert.equal(h.properties.get('--landing-background'), initial);
    await h.advance(1);
    assert(h.classes.has('background-changing'));
    await h.advance(800);
    const second = h.properties.get('--landing-background');
    assert.notEqual(second, initial);
    await h.advance(10000);
    const third = h.properties.get('--landing-background');
    assert.equal(new Set([initial, second, third]).size, 3);
    const paths = new Set([initial, second, third]);
    let previous = third;
    for (let i = 0; i < 8; i++) {
        await h.advance(10000);
        const current = h.properties.get('--landing-background');
        assert(paths.has(current));
        assert.notEqual(current, previous);
        previous = current;
    }
});

test('landing rotation pauses on tool routes and when the tab is hidden', async () => {
    const h = harness({ landing: true }), initial = h.properties.get('--landing-background');
    await h.advance(4000);
    h.location.hash = '#/curses'; h.events.get('hashchange')();
    await h.advance(60000);
    assert.equal(h.properties.get('--landing-background'), initial);
    h.location.hash = '#/'; h.events.get('hashchange')();
    await h.advance(5999);
    assert.equal(h.properties.get('--landing-background'), initial);
    h.document.hidden = true; h.events.get('visibilitychange')();
    await h.advance(60000);
    assert.equal(h.properties.get('--landing-background'), initial);
    h.document.hidden = false; h.events.get('visibilitychange')();
    await h.advance(801);
    assert.notEqual(h.properties.get('--landing-background'), initial);
});
