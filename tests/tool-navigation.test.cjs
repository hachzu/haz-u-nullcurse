const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const tracker = fs.readFileSync(path.join(__dirname, '../js/tracker.js'), 'utf8');
const code = tracker.slice(tracker.indexOf('const FLOATING_BUTTONS_HIDDEN_KEY'), tracker.indexOf('\nloadRunState();', tracker.indexOf('const FLOATING_BUTTONS_HIDDEN_KEY')));

function harness({ stored = null, blocked = false } = {}) {
    const classes = new Set(), attributes = {}, events = [];
    const button = {}, inner = { inert: false, attributes: {}, contains: node => node === button,
        setAttribute(key, value) { this.attributes[key] = value; } };
    const toggle = { setAttribute(key, value) { attributes[key] = value; }, focus() { document.activeElement = this; } };
    const nav = { classList: { contains: key => classes.has(key), toggle: (key, on) => on ? classes.add(key) : classes.delete(key) },
        querySelector: () => inner };
    const document = { activeElement: null, getElementById: id => id === 'floatingToggleButtons' ? nav : toggle };
    let click;
    const sandbox = { document, console: { warn() {} },
        localStorage: { getItem() { if (blocked) throw Error('blocked'); return stored; },
            setItem(_, value) { if (blocked) throw Error('blocked'); stored = value; } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        window: { dispatchEvent: event => events.push(event) }, attachClickAction: (_, action) => { click = action; } };
    vm.runInNewContext(code, sandbox);
    return { classes, attributes, inner, toggle, document, button, events, click: () => click(), stored: () => stored };
}

test('tool navigation starts visible and remains available when storage is blocked', () => {
    for (const blocked of [false, true]) {
        const h = harness({ blocked });
        assert.equal(h.classes.has('collapsed'), false);
        assert.equal(h.attributes['aria-expanded'], 'true');
        assert.equal(h.inner.inert, false);
    }
});

test('hiding the row returns keyboard focus to its arrow and disables offscreen controls', () => {
    const h = harness(); h.document.activeElement = h.button; h.click();
    assert.equal(h.classes.has('collapsed'), true);
    assert.equal(h.document.activeElement, h.toggle);
    assert.equal(h.inner.inert, true);
    assert.equal(h.inner.attributes['aria-hidden'], 'true');
    assert.equal(h.attributes['aria-expanded'], 'false');
    assert.equal(h.attributes['aria-label'], 'Show toolkit buttons');
    assert.equal(h.stored(), 'true');
    assert.equal(h.events.at(-1).detail.hidden, true);
    h.click();
    assert.equal(h.classes.has('collapsed'), false);
    assert.equal(h.inner.inert, false);
    assert.equal(h.attributes['aria-label'], 'Hide toolkit buttons');
    assert.equal(h.stored(), 'false');
});

test('an explicitly saved hidden state is restored without disabling the show button', () => {
    const h = harness({ stored: 'true' });
    assert.equal(h.classes.has('collapsed'), true);
    assert.equal(h.inner.inert, true);
    h.click();
    assert.equal(h.inner.inert, false);
});
