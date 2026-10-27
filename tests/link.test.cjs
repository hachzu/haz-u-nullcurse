const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../js/link-core.js');

test('field encoding preserves special names and rejects prototype paths', () => {
    const value = { run: { curses: { 'Stairs... Stairs...': true, 'a/#$[]': 2 }, level: 5 }, lobby: { content: [{ text: 'hi', letters: [] }] } };
    const fields = core.flatten(value);
    for (const key of Object.keys(fields)) assert.doesNotMatch(key, /[.#$\[\]/]/);
    assert.deepEqual(JSON.parse(JSON.stringify(core.expand(fields))), value);
    const bad = { [encodeURIComponent('["__proto__","polluted"]')]: 'true' };
    assert.deepEqual(Object.keys(core.expand(bad)), []);
    assert.equal({}.polluted, undefined);
});

test('independent simultaneous edits and map removals merge without replacing a run', () => {
    const start = core.flatten({ run: { level: 1, curses: { Bell: true } }, upgrades: { gifts: 10 } });
    const a = new core.FieldMerge(start), b = new core.FieldMerge(start);
    a.local(core.flatten({ run: { level: 2, curses: {} }, upgrades: { gifts: 10 } }));
    b.local(core.flatten({ run: { level: 1, curses: { Bell: true } }, upgrades: { gifts: 20 } }));
    const ap = a.take(), bp = b.take(); a.remote(bp); b.remote(ap);
    assert.deepEqual(a.fields, b.fields);
    assert.deepEqual(JSON.parse(JSON.stringify(core.expand(a.fields))), { run: { level: 2 }, upgrades: { gifts: 20 } });
});

test('unsent local edits survive stale remote data and failed writes preserve newer edits', () => {
    const start = core.flatten({ run: { level: 1 } }), merge = new core.FieldMerge(start);
    merge.local(core.flatten({ run: { level: 2 } }));
    merge.remote(start);
    assert.equal(core.expand(merge.fields).run.level, 2);
    const sent = merge.take();
    merge.local(core.flatten({ run: { level: 3 } }));
    merge.retry(sent);
    assert.equal(core.expand(merge.pending).run.level, 3);
});

test('room size guard blocks excessive snapshots', () => {
    assert.throws(() => core.validateFields({ x: 'a'.repeat(16385) }), /too large/);
    assert.throws(() => core.validateFields(Object.fromEntries(Array.from({ length: 2049 }, (_, i) => [String(i), '1']))), /too large/);
});

function roomServer() {
    const rooms = new Map(); let writes = 0, connects = 0;
    return { rooms, get writes() { return writes; }, get connects() { return connects; },
        async connect({ code, create, restore, fields, identity, onPatch, onStatus, onEnd, onMembers = () => {} }) {
            connects++;
            if (create && !(restore && rooms.has(code))) rooms.set(code, { fields: { ...fields }, clients: new Set() });
            const room = rooms.get(code);
            if (!room) throw Object.assign(new Error('Link not found'), { code: 'LINK_ROOM_ENDED' });
            const client = { onPatch, onEnd, onStatus, onMembers, identity, creator: create }; room.clients.add(client); onStatus('live');
            const broadcast = () => room.clients.forEach(peer => peer.onMembers([...room.clients].map(p => ({ ...p.identity, creator: p.creator }))));
            broadcast();
            return { fields: { ...room.fields }, async send(patch) {
                writes++; core.patchFields(room.fields, patch);
                room.clients.forEach(peer => peer.onPatch(patch));
            }, close({ preserveRoom = false } = {}) {
                room.clients.delete(client);
                broadcast();
                if (create && !preserveRoom) { rooms.delete(code); room.clients.forEach(peer => peer.onEnd('This Link has ended.', 'LINK_ROOM_ENDED')); }
            } };
        }
    };
}

function controller(server, initial) {
    let state = structuredClone(initial), now = 0, nextTimer = 1;
    const timers = new Map(), events = new Map(), elements = new Map();
    function element(id) {
        if (elements.has(id)) return elements.get(id);
        const handlers = {};
        const value = { value: '', hidden: false, disabled: false, dataset: {}, textContent: '', children: [], open: false,
            append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; },
            showModal() { this.open = true; }, close() { this.open = false; },
            setAttribute() {}, closest: () => null, focus() {}, select() {},
            addEventListener(name, callback) { handlers[name] = callback; },
            fire(name, extra = {}) { return handlers[name]?.({ target: value, ...extra }); } };
        elements.set(id, value); return value;
    }
    const window = { NullscapeLinkCore: core,
        NullscapeLinkState: { capture: () => core.flatten(state), apply: data => { state = JSON.parse(JSON.stringify(data)); } },
        NullscapeLinkTransportFactory: args => server.connect(args),
        addEventListener(name, fn) { events.set(name, fn); } };
    const sandbox = { window, document: { getElementById: element, createElement: () => element(`anonymous-${elements.size}`),
        body: { append() {} }, addEventListener(name, fn) { events.set(name, fn); } },
        navigator: { onLine: true, clipboard: { writeText: async () => {} } },
        crypto: require('node:crypto').webcrypto, Uint8Array,
        Date: { now: () => now },
        setTimeout(fn, delay) { const id = nextTimer++; timers.set(id, { fn, at: now + delay }); return id; },
        clearTimeout(id) { timers.delete(id); } };
    vm.runInNewContext(fs.readFileSync(require.resolve('../js/link.js'), 'utf8'), sandbox);
    return { el: element, get state() { return state; }, timers,
        edit(next) { state = next; events.get('input')({ target: { closest: () => null } }); },
        async tick(ms) {
            const end = now + ms;
            for (;;) {
                const pending = [...timers].filter(([,t]) => t.at <= end).sort((a,b) => a[1].at - b[1].at)[0];
                if (!pending) break;
                timers.delete(pending[0]); now = pending[1].at;
                await pending[1].fn(); await Promise.resolve();
            }
            now = end; await Promise.resolve();
        }
    };
}

test('unlinked stays silent; create/join share edits, batch input, and leave detaches', async () => {
    const server = roomServer();
    const host = controller(server, { run: { level: 1 }, upgrades: { gifts: 0 } });
    const guest = controller(server, { run: { level: 99 }, upgrades: { gifts: 99 } });
    host.edit({ run: { level: 2 }, upgrades: { gifts: 0 } }); await host.tick(5000);
    assert.equal(server.connects, 0); assert.equal(host.timers.size, 0);
    await host.el('linkCreate').fire('click');
    guest.el('linkCode').value = host.el('linkCode').value;
    await guest.el('linkJoin').fire('click');
    assert.equal(guest.state.run.level, 2);
    assert.equal(server.writes, 0);
    host.edit({ run: { level: 3 }, upgrades: { gifts: 0 } }); await host.tick(0);
    host.edit({ run: { level: 4 }, upgrades: { gifts: 0 } }); await host.tick(0);
    guest.edit({ run: { level: 2 }, upgrades: { gifts: 70 } }); await guest.tick(0);
    await host.tick(500); await guest.tick(500); await host.tick(100);
    assert.equal(host.state.upgrades.gifts, 70); assert.equal(guest.state.run.level, 4);
    assert.equal(server.writes, 2);
    await host.tick(5000); await guest.tick(5000);
    assert.equal(server.writes, 2, 'remote render does not echo and idle rooms do not write');
    await guest.el('linkLeave').fire('click');
    host.edit({ run: { level: 5 }, upgrades: { gifts: 70 } }); await host.tick(600);
    assert.equal(guest.state.run.level, 4);
    await host.el('linkLeave').fire('click');
    assert.equal(server.rooms.size, 0);
});

test('invalid codes never connect; creator leaving opens the guest disconnect panel', async () => {
    const server = roomServer(), host = controller(server, { run: { level: 1 } });
    const guest = controller(server, { run: { level: 8 } });
    guest.el('linkCode').value = 'BAD'; await guest.el('linkJoin').fire('click');
    assert.equal(server.connects, 0);
    await host.el('linkCreate').fire('click'); guest.el('linkCode').value = host.el('linkCode').value;
    await guest.el('linkJoin').fire('click'); await host.el('linkLeave').fire('click');
    assert.equal(guest.el('linkBadge').dataset.state, 'reconnecting');
    assert.equal(guest.el('linkDisconnectDialog').open, true);
    assert.match(guest.el('linkDisconnectError').textContent, /LINK_ROOM_ENDED/);
    assert.equal(guest.state.run.level, 1);
    await guest.el('linkDisconnectLocal').fire('click');
    assert.equal(guest.el('linkCreate').hidden, false);
    assert.equal(guest.el('linkDisconnectDialog').open, false);
});

test('sudden disconnect pauses writes and Relink recovers unsent edits without an idle loop', async () => {
    const server = roomServer(), host = controller(server, { run: { level: 1 } });
    const guest = controller(server, { run: { level: 8 } });
    await host.el('linkCreate').fire('click'); guest.el('linkCode').value = host.el('linkCode').value;
    await guest.el('linkJoin').fire('click');
    const room = [...server.rooms.values()][0], peer = [...room.clients][1];
    guest.edit({ run: { level: 9 } }); await guest.tick(5000);
    const before = server.writes;
    guest.edit({ run: { level: 10 } }); await guest.tick(0);
    peer.onStatus('reconnecting'); await guest.tick(5000);
    assert.equal(server.writes, before); assert.equal(guest.timers.size, 0);
    assert.equal(guest.el('linkDisconnectDialog').open, true);
    await guest.el('linkDisconnectRetry').fire('click');
    await guest.tick(600); await host.tick(100);
    assert.equal(host.state.run.level, 10); assert.equal(server.writes, before + 1);
    assert.equal(guest.el('linkDisconnectDialog').open, false);
    await host.el('linkLeave').fire('click');
});

test('failed relink keeps the panel and error code; creator restoration lets guests retry', async () => {
    const server = roomServer(), host = controller(server, { run: { level: 42 } }), guest = controller(server, { run: { level: 1 } });
    await host.el('linkCreate').fire('click'); guest.el('linkCode').value = host.el('linkCode').value;
    await guest.el('linkJoin').fire('click');
    const room = [...server.rooms.values()][0];
    assert.equal(guest.el('linkMembers').children.length, 2);
    assert.equal(guest.el('linkMembers').children[0].children.at(-1).textContent, 'CREATOR');
    server.rooms.clear();
    room.clients.forEach(peer => peer.onEnd('The room has ended.', 'LINK_ROOM_ENDED'));
    await guest.el('linkDisconnectRetry').fire('click');
    assert.equal(guest.el('linkDisconnectDialog').open, true);
    assert.match(guest.el('linkDisconnectError').textContent, /LINK_ROOM_ENDED/);
    assert.equal(guest.el('linkDisconnectRetry').disabled, false);
    await host.el('linkDisconnectRetry').fire('click');
    assert.equal(host.el('linkDisconnectDialog').open, false);
    await guest.el('linkDisconnectRetry').fire('click');
    assert.equal(guest.el('linkDisconnectDialog').open, false);
    assert.equal(guest.state.run.level, 42);
    assert.equal(guest.el('linkMembers').children.length, 2);
});

test('cancelling an in-progress create closes its late connection', async () => {
    const server = roomServer(); let release;
    const delayed = { connect: async options => {
        const active = await server.connect(options);
        await new Promise(resolve => { release = resolve; }); return active;
    } };
    const host = controller(delayed, { run: { level: 1 } });
    const starting = host.el('linkCreate').fire('click'); await Promise.resolve(); await Promise.resolve();
    await host.el('linkLeave').fire('click'); release(); await starting;
    assert.equal(server.rooms.size, 0); assert.equal(host.el('linkCreate').hidden, false);
});

function firebaseHarness({ denied = false } = {}) {
    let stored = null, cleaned = 0, removes = 0;
    const listeners = new Map(), timers = new Map();
    const sandbox = {
        window: { NullscapeLinkCore: core }, firebaseConfig: {}, getApps: () => [{ name: '[DEFAULT]' }], getDatabase: () => ({}), ref: (_, path) => path,
        serverTimestamp: () => Date.now(),
        async runTransaction(_, fn) {
            if (denied) throw new Error('PERMISSION_DENIED');
            const value = fn(stored); if (value === undefined) return { committed: false, snapshot: { val: () => stored } };
            stored = value; return { committed: true, snapshot: { val: () => stored } };
        },
        get: async () => ({ val: () => stored }),
        set: async (path, value) => { stored.members ||= {}; stored.members[path.split('/').at(-1)] = value; },
        onDisconnect: () => ({ remove: async () => { cleaned++; }, cancel: async () => {} }),
        remove: async path => { removes++; if (!path.includes('/members/')) stored = null; else if (stored?.members) delete stored.members[path.split('/').at(-1)]; },
        onValue(path, callback, error) { listeners.set(path, { callback, error }); return () => listeners.delete(path); },
        update: async (_, patch) => { stored.state = { ...stored.state }; core.patchFields(stored.state, patch); },
        setTimeout: (fn, delay) => { timers.set(1, { fn, delay }); return 1; }, clearTimeout: id => timers.delete(id)
    };
    const source = fs.readFileSync(require.resolve('../js/link-firebase.js'), 'utf8')
        .replace(/^import .*;\r?\n/gm, '').replace('export async function connect', 'async function connect');
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    return { connect: options => sandbox.connect(options), listeners, timers,
        get cleaned() { return cleaned; }, get removes() { return removes; }, get stored() { return stored; } };
}

test('Firebase transport scopes listeners and cleans up hosted rooms', async () => {
    const h = firebaseHarness(), patches = [], statuses = [];
    const options = { code: 'A'.repeat(20), create: true, fields: core.flatten({ run: { level: 1 } }),
        identity: { id: 'a'.repeat(32), name: 'Creator' },
        onPatch: patch => patches.push(patch), onStatus: value => statuses.push(value), onEnd() {} };
    const transport = await h.connect(options);
    assert.equal(h.cleaned, 2);
    assert.deepEqual([...h.listeners.keys()], [`toolkitLinks/${options.code}/state`, `toolkitLinks/${options.code}/members`, '.info/connected']);
    const next = core.flatten({ run: { level: 2 } }); await transport.send(next);
    h.listeners.get(`toolkitLinks/${options.code}/state`).callback({ val: () => next });
    assert.equal(core.expand(patches[0]).run.level, 2);
    h.listeners.get('.info/connected').callback({ val: () => true }); assert.deepEqual(statuses, ['live']);
    await transport.close();
    assert.equal(h.removes, 1); assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0);
    transport.close(); assert.equal(h.removes, 1);
});

test('Firebase denial leaves no claimed room or listeners', async () => {
    const h = firebaseHarness({ denied: true });
    await assert.rejects(h.connect({ code: 'A'.repeat(20), create: true, fields: {}, identity: { id: 'a'.repeat(32), name: 'Creator' } }), /PERMISSION_DENIED/);
    assert.equal(h.stored, null); assert.equal(h.listeners.size, 0); assert.equal(h.cleaned, 0);
});

test('Relink preserves an existing room; guest departure removes only that guest', async () => {
    const h = firebaseHarness();
    const options = { code: 'A'.repeat(20), create: true, fields: core.flatten({ run: { level: 5 } }),
        identity: { id: 'a'.repeat(32), name: '<Creator>' }, onPatch() {}, onStatus() {}, onEnd() {} };
    const first = await h.connect(options);
    await first.close({ preserveRoom: true });
    assert.equal(core.expand(h.stored.state).run.level, 5);
    const restored = await h.connect({ ...options, restore: true, fields: core.flatten({ run: { level: 1 } }) });
    assert.equal(core.expand(restored.fields).run.level, 5, 'restore never overwrites an existing room with a stale snapshot');
    const guest = await h.connect({ ...options, create: false, identity: { id: 'b'.repeat(32), name: 'Guest' } });
    assert.equal(Object.keys(h.stored.members).length, 2);
    await guest.close();
    assert.equal(Object.keys(h.stored.members).length, 1);
    assert.equal(h.stored.members['a'.repeat(32)].creator, true);
    await restored.close(); assert.equal(h.stored, null);
});

test('continuing locally after a preserved creator connection still ends its room', async () => {
    const h = firebaseHarness();
    const transport = await h.connect({ code: 'A'.repeat(20), create: true, fields: core.flatten({ run: { level: 5 } }),
        identity: { id: 'a'.repeat(32), name: 'Creator' }, onPatch() {}, onStatus() {}, onEnd() {} });
    await transport.close({ preserveRoom: true }); assert(h.stored);
    await transport.close(); assert.equal(h.stored, null);
});

test('published rules retain existing counters and allow bounded member records', () => {
    const rules = JSON.parse(fs.readFileSync(require.resolve('../docs/firebase-link-rules.json'), 'utf8')).rules;
    assert.equal(rules.presence['.read'], true);
    assert.match(rules.siteStats.visits['.write'], /data.val\(\) \+ 1/);
    const member = rules.toolkitLinks.$code.members.$member;
    assert.match(member['.validate'], /name.*creator.*joinedAt/);
    assert.match(member.name['.validate'], /length <= 40/);
    assert.equal(member.$other['.validate'], false);
});
