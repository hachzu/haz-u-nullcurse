(function () {
    'use strict';
    const section = document.getElementById('toolkitLink');
    if (!section) return;
    const core = window.NullscapeLinkCore, adapter = window.NullscapeLinkState;
    const el = id => document.getElementById(id);
    const codeInput = el('linkCode'), createButton = el('linkCreate'), joinButton = el('linkJoin');
    const leaveButton = el('linkLeave'), copyButton = el('linkCopy');
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const normalize = text => text.toUpperCase().replace(/[\s-]/g, '');
    const format = code => code.match(/.{1,4}/g)?.join('-') || '';
    let transport = null, merge = null, writing = false, applying = false, connected = false;
    let busy = false, closed = false, flushTimer = null, captureTimer = null, renderTimer = null;
    let pendingRoots = {}, operation = 0, lastWriteAt = 0, composing = false;
    let inFlight = Promise.resolve();
    function status(state, text) {
        const badge = el('linkBadge');
        badge.dataset.state = state;
        badge.textContent = ({ offline: 'LOCAL', live: 'LINKED', syncing: 'SYNCING', reconnecting: 'RECONNECTING', error: 'OFFLINE' })[state] || 'CONNECTING';
        el('linkStatus').textContent = text;
    }
    function controls() {
        createButton.hidden = joinButton.hidden = Boolean(transport);
        leaveButton.hidden = !transport && !busy;
        copyButton.hidden = !transport;
        leaveButton.textContent = busy ? 'CANCEL' : 'LEAVE LINK';
        createButton.disabled = joinButton.disabled = busy;
        codeInput.readOnly = Boolean(transport) || busy;
        section.setAttribute('aria-busy', String(busy));
    }
    function collect() {
        if (!merge || applying || closed) return;
        const next = adapter.capture();
        core.validateFields(next);
        merge.local(next);
    }
    function scheduleFlush() {
        if (!transport || closed || !Object.keys(merge.pending).length || flushTimer !== null) return;
        // At most two batches per second, including while dragging or typing.
        flushTimer = setTimeout(() => { flushTimer = null; flush(); }, Math.max(350, 500 - (Date.now() - lastWriteAt)));
    }
    async function flush() {
        if (!transport || writing || !connected || closed || composing) return;
        try { collect(); }
        catch (error) { leave(error.message, 'error'); return; }
        const patch = merge.take();
        if (!Object.keys(patch).length) return;
        const active = transport, activeMerge = merge;
        writing = true; lastWriteAt = Date.now();
        status('syncing', 'Sharing changes…');
        try {
            inFlight = active.send(patch);
            await inFlight;
            if (transport === active) status(connected ? 'live' : 'reconnecting', connected ? 'Linked · changes shared. The creator keeps this code online.' : 'Connection lost. Changes will sync if this Link is still online.');
        } catch (_) {
            if (transport === active) {
                activeMerge.retry(patch);
                // Stop this room rather than queue writes against denied rules.
                leave('Could not share changes. Your edits are saved locally. Check your connection or Link permissions.', 'error');
            }
        } finally {
            if (transport === active) { writing = false; scheduleFlush(); }
        }
    }
    function changed(event) {
        if (!transport || applying || event?.target?.closest?.('#toolkitLink')) return;
        clearTimeout(captureTimer);
        captureTimer = setTimeout(() => {
            captureTimer = null;
            try { collect(); scheduleFlush(); }
            catch (error) { leave(error.message, 'error'); }
        }, 0);
    }
    function renderRemote() {
        renderTimer = null;
        if (!merge || composing) return;
        try {
            // Capture local interactions that happened before their event timer fired.
            collect();
            applying = true;
            adapter.apply(core.expand(merge.fields), pendingRoots);
            pendingRoots = {};
            merge.rendered(adapter.capture());
        } catch (_) {
            leave('Could not read this shared toolkit. Your local changes are saved.', 'error');
        } finally { applying = false; }
        scheduleFlush();
    }
    function receive(patch) {
        if (!merge || closed) return;
        collect();
        Object.assign(pendingRoots, merge.remote(patch));
        if (renderTimer === null && !composing) renderTimer = setTimeout(renderRemote, 40);
    }
    function leave(message = 'Link left. Your current toolkit is saved locally.', state = 'offline') {
        operation++;
        closed = true;
        clearTimeout(flushTimer); clearTimeout(captureTimer); clearTimeout(renderTimer);
        flushTimer = captureTimer = renderTimer = null;
        transport?.close();
        transport = merge = null;
        pendingRoots = {};
        writing = busy = connected = false;
        status(state, message); controls();
    }
    async function start(create) {
        if (busy || transport) return;
        const bytes = new Uint8Array(20);
        let code = normalize(codeInput.value);
        if (create) {
            crypto.getRandomValues(bytes);
            code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
        } else if (!/^[A-HJ-NP-Z2-9]{20}$/.test(code)) {
            status('error', 'Enter the full 20-character code from the other toolkit.'); codeInput.focus(); return;
        }
        if (!navigator.onLine) { status('error', 'You’re offline. Connect to the internet to use Link.'); return; }
        const token = ++operation;
        busy = true; closed = false; controls();
        status('connecting', create ? 'Generating a Link…' : 'Joining this Link…');
        let incoming = [], networkState = 'reconnecting';
        let connectTimeout;
        try {
            const initial = adapter.capture();
            core.validateFields(initial);
            const factory = window.NullscapeLinkTransportFactory || (await import('./link-firebase.js?v=20261027-link1')).connect;
            if (operation !== token) return;
            const connecting = factory({ code, create, fields: initial,
                onPatch: patch => { if (operation === token) { if (merge) receive(patch); else incoming.push(patch); } },
                onStatus: state => {
                    if (operation !== token) return;
                    networkState = state; connected = state === 'live';
                    if (transport) {
                        status(state, connected ? 'Linked · changes shared. The creator keeps this code online.' : 'Connection lost. Changes will sync if this Link is still online.');
                        if (connected) scheduleFlush();
                    }
                },
                onEnd: message => { if (operation === token) leave(message, 'error'); }
            });
            connecting.then(active => { if (operation !== token) active.close(); }, () => {});
            const active = await Promise.race([connecting, new Promise((_, reject) => {
                connectTimeout = setTimeout(() => reject(new Error('Link took too long to connect. Check your connection and try again.')), 15000);
            })]);
            clearTimeout(connectTimeout);
            if (operation !== token) { active.close(); return; }
            transport = active;
            merge = new core.FieldMerge(active.fields);
            codeInput.value = format(code);
            if (!create) {
                applying = true;
                // Joining adopts this room's toolkit; do not publish the joiner's old run.
                adapter.apply(core.expand(active.fields), active.fields);
                applying = false;
            } else {
                // Capture edits made while the initial server write was in progress.
                merge.rendered(initial);
                merge.local(adapter.capture());
            }
            if (!create) merge.rendered(adapter.capture());
            incoming.forEach(receive); incoming = [];
            busy = false; controls(); codeInput.focus();
            status(networkState, connected ? 'Linked · changes shared. The creator keeps this code online.' : 'Connecting. Your changes will sync when connected.');
            scheduleFlush();
        } catch (error) {
            clearTimeout(connectTimeout);
            if (operation !== token) return;
            applying = false;
            const denied = /permission|denied/i.test(`${error.code} ${error.message}`);
            leave(denied ? 'Link is unavailable: Firebase needs permission for toolkitLinks. Your toolkit stays local.'
                : error.message || 'Could not connect. Your toolkit stays local.', 'error');
        }
    }
    createButton.addEventListener('click', () => start(true));
    joinButton.addEventListener('click', () => start(false));
    codeInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); start(false); } });
    leaveButton.addEventListener('click', async () => {
        if (busy) { leave('Link cancelled. Your toolkit stays local.'); return; }
        leaveButton.disabled = true;
        try {
            collect();
            // Attempt to commit pending edits before detaching. Never hang Leave offline.
            if (connected) await Promise.race([
                (async () => { await inFlight.catch(() => {}); await flush(); })(),
                new Promise(resolve => setTimeout(resolve, 1500))
            ]);
        } finally { leave(); leaveButton.disabled = false; }
    });
    copyButton.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(codeInput.value); status('live', 'Code copied. Send it to the person joining your toolkit.'); }
        catch (_) { codeInput.focus(); codeInput.select(); status('live', 'Copy the selected code to share your toolkit.'); }
    });
    for (const name of ['input', 'change', 'click', 'pointerup', 'keyup', 'toggle']) document.addEventListener(name, changed, true);
    for (const name of ['nullscape-sound-change', 'nullscape-low-detail-change']) window.addEventListener(name, changed);
    document.addEventListener('compositionstart', () => { composing = true; });
    document.addEventListener('compositionend', event => { composing = false; changed(event); if (Object.keys(pendingRoots).length && renderTimer === null) renderTimer = setTimeout(renderRemote, 0); });
    window.addEventListener('pagehide', () => leave());
    controls();
}());
