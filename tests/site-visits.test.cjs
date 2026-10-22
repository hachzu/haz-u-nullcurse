const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../js/site-visits.js'), 'utf8').replace(/^import .*;\r?\n/gm, '');

async function harness({ stored = null, denied = false, hostname = 'nullkits.pages.dev', moved = false, retry = undefined } = {}) {
    const counter = { dataset: {} }, value = { textContent: '600' }, writes = [], handlers = {};
    let watcher, disconnected = false;
    const sandbox = {
        document: { getElementById: id => id === 'siteVisits' ? counter : value },
        window: { NullscapeMoved: moved, addEventListener: (name, fn) => { handlers[name] = fn; } },
        location: { hostname, protocol: 'https:' }, firebaseConfig: {},
        getApps: () => [{ name: '[DEFAULT]' }], initializeApp() { throw Error('should reuse the shared app'); },
        getDatabase: () => ({}), ref: (_, key) => { assert.equal(key, 'siteStats/visits'); return key; },
        runTransaction: async (_, update, options) => {
            assert.equal(options.applyLocally, false);
            if (denied) throw Error('permission denied');
            let next = update(stored);
            if (retry !== undefined) next = update(retry);
            if (next === undefined) return { committed: false };
            writes.push(next); stored = next;
            return { committed: true, snapshot: { val: () => next } };
        },
        onValue: (_, callback) => { watcher = callback; return () => { disconnected = true; }; }
    };
    vm.createContext(sandbox); vm.runInContext(code, sandbox);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    return { counter, value, writes, sandbox, handlers, update: count => watcher({ val: () => count }), disconnected: () => disconnected };
}

test('shared visits seed at 600 and increment existing totals', async () => {
    const first = await harness(); assert.deepEqual(first.writes, [600]); assert.equal(first.value.textContent, '600');
    const next = await harness({ stored: 600 }); assert.deepEqual(next.writes, [601]);
    await next.sandbox.startVisitCounter(); assert.deepEqual(next.writes, [601], 'count each page only once');
});

test('transaction retries use the latest shared value and live totals update without extra writes', async () => {
    const h = await harness({ stored: 600, retry: 607 });
    assert.deepEqual(h.writes, [608]);
    h.update(1001); assert.equal(h.value.textContent, '1,001'); assert.deepEqual(h.writes, [608]);
    h.handlers.pagehide(); assert.equal(h.disconnected(), true);
});

test('local previews and the retired address never add visits', async () => {
    for (const settings of [{ hostname: 'localhost' }, { hostname: '127.0.0.1' }, { moved: true }]) {
        const h = await harness(settings); assert.deepEqual(h.writes, []);
    }
});

test('denied access or invalid stored data never invents a total', async () => {
    for (const settings of [{ denied: true }, { stored: 'invalid' }]) {
        const h = await harness(settings);
        assert.deepEqual(h.writes, []); assert.equal(h.value.textContent, '—');
        assert.equal(h.counter.dataset.state, 'unavailable');
    }
});
