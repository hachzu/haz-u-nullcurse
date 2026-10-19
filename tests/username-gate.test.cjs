const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
// Exercise the username gate without loading Firebase or writing live presence.
const source = fs.readFileSync(path.join(__dirname, '../js/presence.js'), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";/g, '')
    .replace('startPresence();', '');

function harness({ stored = null, blocked = false } = {}) {
    const elements = {};
    const overlays = [];
    const writes = [];
    function element() {
        return {
            value: '', listeners: {}, classList: { add() {}, remove() {} },
            focus() { this.focused = true; }, remove() {},
            addEventListener(name, fn) { this.listeners[name] = fn; },
            querySelector(selector) { return elements[selector] ||= element(); }
        };
    }
    const sandbox = {
        Uint32Array, crypto: { getRandomValues: array => { array[0] = 1234567890; return array; } },
        localStorage: {
            getItem() { if (blocked) throw new Error('blocked'); return stored; },
            setItem(key, value) { if (blocked) throw new Error('blocked'); writes.push([key, value]); stored = value; }
        },
        document: { createElement: element, body: { appendChild: node => overlays.push(node) } },
        requestAnimationFrame: fn => fn()
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return { elements, overlays, writes, ensure: () => sandbox.ensureUsername() };
}

test('anonymous entry needs no input, persists its name, and is reused on later visits', async () => {
    const h = harness();
    const pending = h.ensure();
    h.elements['#usernameGateAnonymous'].listeners.click();
    assert.equal(await pending, 'Anonymous #1234567890');
    assert.deepEqual(h.writes, [['nullscape_username', 'Anonymous #1234567890']]);
    assert.equal(await h.ensure(), 'Anonymous #1234567890');
    assert.equal(h.overlays.length, 1);
    h.elements['#usernameGateSubmit'].listeners.click();
    assert.equal(h.writes.length, 1);
});

test('custom names still trim and submit with Enter; blank input stays at the gate', async () => {
    const h = harness();
    const pending = h.ensure();
    const input = h.elements['#usernameGateInput'];
    h.elements['#usernameGateSubmit'].listeners.click();
    assert.equal(h.writes.length, 0);
    input.value = '  Nullscaper  ';
    input.listeners.keydown({ key: 'Enter' });
    assert.equal(await pending, 'Nullscaper');
});

test('existing names bypass the prompt and anonymous entry tolerates blocked storage', async () => {
    const saved = harness({ stored: 'Existing alias' });
    assert.equal(await saved.ensure(), 'Existing alias');
    assert.equal(saved.overlays.length, 0);
    const blocked = harness({ blocked: true });
    const pending = blocked.ensure();
    blocked.elements['#usernameGateAnonymous'].listeners.click();
    assert.equal(await pending, 'Anonymous #1234567890');
});
