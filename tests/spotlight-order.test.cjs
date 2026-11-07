const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

test('Settings waits for Tools to close and releases clicks immediately on dismissal', () => {
    const source = fs.readFileSync(path.join(__dirname, '../js/tools.js'), 'utf8');
    const marker = source.indexOf('const STORAGE_KEY  = "nullscapeHideSettingsSpotlight"');
    const start = source.lastIndexOf('(function () {', marker);
    const end = source.indexOf('})();', marker) + 5;
    const timers = [];
    const listeners = new Map();
    const appended = [];
    let toolsOpen = true;
    class Element {
        constructor() {
            this.style = {};
            this.classList = { add() {}, remove() {}, toggle() {} };
            this.handlers = {};
        }
        append() {}
        addEventListener(type, fn) { this.handlers[type] = fn; }
        querySelector() { return this.button ||= new Element(); }
        getBoundingClientRect() { return { top: 10, left: 10, right: 50, bottom: 50 }; }
        remove() { this.removed = true; }
    }
    const document = {
        readyState: 'complete',
        getElementById: () => new Element(),
        querySelector: () => toolsOpen ? {} : null,
        createElement: () => new Element(),
        body: { appendChild: node => appended.push(node) },
        addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: name => listeners.delete(name)
    };
    vm.runInNewContext(source.slice(start, end), {
        document,
        window: { innerWidth: 1200, innerHeight: 800, addEventListener() {}, removeEventListener() {} },
        localStorage: { getItem: () => null, setItem() {} },
        setTimeout: fn => timers.push(fn),
        requestAnimationFrame: fn => fn(), console
    });
    timers.shift()();
    assert.equal(appended.length, 0, 'must not stack a Settings overlay over Tools');
    toolsOpen = false;
    listeners.get('nullscape-tools-spotlight-closed')();
    assert.equal(appended.length, 1);
    listeners.get('keydown')({ key: 'Escape' });
    assert.equal(appended[0].inert, true, 'fading overlay must immediately release clicks');
    timers.shift()();
    assert.equal(appended[0].removed, true);
});
