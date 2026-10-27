const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/tracker.js'), 'utf8');

function harness() {
    let now = 0, nextId = 0;
    const frames = new Map();
    const preferences = { reduced: false, lowDetail: false };
    const context = vm.createContext({
        Intl,
        performance: { now: () => now },
        document: { documentElement: { classList: { contains: () => preferences.lowDetail } } },
        window: { matchMedia: () => ({ matches: preferences.reduced }) },
        requestAnimationFrame: callback => { frames.set(++nextId, callback); return nextId; },
        cancelAnimationFrame: id => frames.delete(id)
    });
    vm.runInContext(source.slice(source.indexOf('const rollingNumberFormatter'), source.indexOf('\n\nconst difficulties')), context);
    return {
        frames, preferences,
        tween: (el, target, options) => context.tweenNumberText(el, target, options),
        tick(ms) {
            now += ms;
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback(now));
        }
    };
}

function readout() {
    return { textContent: '0', dataset: {}, isConnected: true,
        getBoundingClientRect() { throw Error('Number animation must not measure layout'); } };
}

test('all numeric readouts share one frame loop and settle on exact formatted targets', () => {
    const h = harness(), total = readout(), remaining = readout();
    h.tween(total, 0); h.tween(remaining, 0);
    h.tween(total, 5000); h.tween(remaining, -5);
    assert.equal(h.frames.size, 1);
    h.tick(140);
    assert.equal(h.frames.size, 1);
    h.tick(140);
    assert.equal(total.textContent, '5,000');
    assert.equal(remaining.textContent, '-5');
    assert.equal(h.frames.size, 0);
});

test('ordinary refreshes do not restart or snap an active number animation', () => {
    const h = harness(), el = readout();
    h.tween(el, 0); h.tween(el, 1000); h.tick(80);
    const displayed = el.textContent;
    h.tween(el, 1000);
    assert.equal(el.textContent, displayed);
    assert.notEqual(displayed, '1,000');
    assert.equal(h.frames.size, 1);
    h.tick(200);
    assert.equal(el.textContent, '1,000');
    assert.equal(h.frames.size, 0);
});

test('rapid retargeting continues from the displayed value and never finishes on a stale target', () => {
    const h = harness(), el = readout();
    h.tween(el, 0); h.tween(el, 1000); h.tick(70);
    const displayed = el.textContent;
    h.tween(el, 2000); h.tick(0);
    assert.equal(el.textContent, displayed);
    h.tick(280);
    assert.equal(el.textContent, '2,000');
    assert.equal(h.frames.size, 0);
});

test('reduced motion, low detail and zero duration settle immediately and cancel pending work', () => {
    for (const preference of ['reduced', 'lowDetail']) {
        const h = harness(), el = readout();
        h.tween(el, 0); h.tween(el, 1000); h.tick(20);
        h.preferences[preference] = true;
        h.tween(el, 10);
        assert.equal(el.textContent, '10');
        assert.equal(h.frames.size, 0);
    }
    const h = harness(), el = readout();
    h.tween(el, 100, { duration: 0, format: value => `$${value}` });
    assert.equal(el.textContent, '$100');
    h.tween(el, NaN);
    assert.equal(el.textContent, '$100');
    assert.equal(h.frames.size, 0);
});
