(function () {
    'use strict';
    const section = document.getElementById('toolkitLink');
    if (!section) return;
    const core = window.NullscapeLinkCore, adapter = window.NullscapeLinkState;
    const el = id => document.getElementById(id);
    const codeInput = el('linkCode'), createButton = el('linkCreate'), joinButton = el('linkJoin');
    const leaveButton = el('linkLeave'), copyButton = el('linkCopy');
    const dialog = el('linkDisconnectDialog'), retryButton = el('linkDisconnectRetry');
    const relinkButton = el('linkRelink');
    document.body.append(dialog);
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const normalize = text => text.toUpperCase().replace(/[\s-]/g, '');
    const format = code => code.match(/.{1,4}/g)?.join('-') || '';
    let transport = null, merge = null, writing = false, applying = false, connected = false;
    let busy = false, closed = false, flushTimer = null, captureTimer = null, renderTimer = null;
    let pendingRoots = {}, operation = 0, lastWriteAt = 0, composing = false;
    let inFlight = Promise.resolve();
    let session = null, sendingPatch = {};
    function identity() {
        const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
        let name;
        try { name = localStorage.getItem('nullscape_username'); } catch (_) {}
        return { id: Array.from(bytes, n => n.toString(16).padStart(2, '0')).join(''),
            name: (typeof name === 'string' ? name.trim() : '').slice(0, 40) || 'Anonymous' };
    }
    function people(members = []) {
        const list = el('linkMembers');
        list.replaceChildren(); list.hidden = !members.length;
        list.dataset.paused = String(Boolean(session?.paused));
        members.slice().sort((a,b) => Number(b.creator) - Number(a.creator) || a.name.localeCompare(b.name)).forEach(person => {
            const row = document.createElement('div'), name = document.createElement('span');
            row.className = 'link-member'; name.className = 'link-member-name';
            name.textContent = person.name; row.append(name);
            if (person.id === session?.identity.id) {
                const you = document.createElement('span'); you.className = 'link-member-label'; you.textContent = 'YOU'; row.append(you);
            }
            if (person.creator) {
                const label = document.createElement('span'); label.className = 'link-member-label link-member-label--creator';
                label.textContent = 'CREATOR'; row.append(label);
            }
            list.append(row);
        });
    }
    function disconnect(message, code = 'LINK_CONNECTION_LOST') {
        if (!session) return;
        session.paused = true;
        clearTimeout(flushTimer); clearTimeout(captureTimer); clearTimeout(renderTimer);
        flushTimer = captureTimer = renderTimer = null;
        status('reconnecting', 'Disconnected. Relink to resume sharing.');
        el('linkMembers').dataset.paused = 'true';
        el('linkDisconnectTitle').textContent = 'Link disconnected';
        el('linkDisconnectMessage').textContent = message;
        el('linkDisconnectError').textContent = `Error code: ${code}`;
        controls();
        if (!dialog.open) dialog.showModal();
    }
    function connectionError(error) {
        const code = String(error?.code || '');
        if (code.startsWith('LINK_')) return { code, message: error.message };
        if (/permission|denied/i.test(`${code} ${error?.message}`)) return {
            code: 'LINK_ACCESS_DENIED', message: 'Link access was denied. Check the updated Firebase rules, then try again.' };
        if (!navigator.onLine || /network|offline|unavailable/i.test(`${code} ${error?.message}`)) return {
            code: 'LINK_OFFLINE', message: 'You’re offline. Check your connection, then try Relink again.' };
        return { code: 'LINK_RELINK_FAILED', message: 'Could not reconnect to this Link. Your current toolkit is still here. Try again shortly.' };
    }
    function status(state, text) {
        const badge = el('linkBadge');
        badge.dataset.state = state;
        badge.textContent = ({ offline: 'LOCAL', live: 'LINKED', syncing: 'SYNCING', reconnecting: 'RECONNECTING', error: 'OFFLINE' })[state] || 'CONNECTING';
        el('linkStatus').textContent = text;
    }
    function controls() {
        createButton.hidden = joinButton.hidden = Boolean(transport || session);
        leaveButton.hidden = !transport && !busy && !session;
        copyButton.hidden = !session;
        copyButton.disabled = busy;
        relinkButton.hidden = !session?.paused;
        relinkButton.disabled = retryButton.disabled = busy;
        retryButton.textContent = busy ? 'RELINKING…' : 'RELINK';
        leaveButton.textContent = busy ? 'CANCEL' : 'LEAVE LINK';
        createButton.disabled = joinButton.disabled = busy;
        codeInput.readOnly = Boolean(session) || busy;
        section.setAttribute('aria-busy', String(busy));
    }
    function collect() {
        if (!merge || applying || closed) return;
        const next = adapter.capture();
        core.validateFields(next);
        merge.local(next);
    }
    function scheduleFlush() {
        if (!transport || session?.paused || closed || !Object.keys(merge.pending).length || flushTimer !== null) return;
        // At most two batches per second, including while dragging or typing.
        flushTimer = setTimeout(() => { flushTimer = null; flush(); }, Math.max(350, 500 - (Date.now() - lastWriteAt)));
    }
    async function flush() {
        if (!transport || session?.paused || writing || !connected || closed || composing) return;
        try { collect(); }
        catch (error) { disconnect(error.message, 'LINK_INVALID_DATA'); return; }
        const patch = merge.take();
        if (!Object.keys(patch).length) return;
        const active = transport, activeMerge = merge;
        writing = true; lastWriteAt = Date.now();
        sendingPatch = patch;
        status('syncing', 'Sharing changes…');
        try {
            inFlight = active.send(patch);
            await inFlight;
            if (transport === active && !session?.paused) {
                sendingPatch = {};
                status('live', 'Linked · changes shared. The creator keeps this code online.');
            }
        } catch (error) {
            if (transport === active) {
                activeMerge.retry(patch);
                const reason = connectionError(error);
                disconnect(reason.message, reason.code === 'LINK_RELINK_FAILED' ? 'LINK_WRITE_FAILED' : reason.code);
            }
        } finally {
            if (transport === active) { writing = false; scheduleFlush(); }
        }
    }
    function changed(event) {
        if (!transport || session?.paused || applying || event?.target?.closest?.('#toolkitLink, #linkDisconnectDialog')) return;
        clearTimeout(captureTimer);
        captureTimer = setTimeout(() => {
            captureTimer = null;
            try { collect(); scheduleFlush(); }
            catch (error) { disconnect(error.message, 'LINK_INVALID_DATA'); }
        }, 0);
    }
    function renderRemote() {
        renderTimer = null;
        if (!merge || session?.paused || composing) return;
        try {
            // Capture local interactions that happened before their event timer fired.
            collect();
            applying = true;
            adapter.apply(core.expand(merge.fields), pendingRoots);
            pendingRoots = {};
            merge.rendered(adapter.capture());
        } catch (_) {
            disconnect('Could not read this shared toolkit. Your local changes are saved.', 'LINK_INVALID_DATA');
        } finally { applying = false; }
        scheduleFlush();
    }
    function receive(patch) {
        if (!merge || session?.paused || closed) return;
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
        if (session?.previousTransport !== transport) session?.previousTransport?.close();
        transport = merge = null;
        session = null; sendingPatch = {};
        if (dialog.open) dialog.close();
        people();
        pendingRoots = {};
        writing = busy = connected = false;
        status(state, message); controls();
    }
    async function start(create, resume = false) {
        if (busy || (transport && !resume) || (resume && !session)) return;
        const bytes = new Uint8Array(20);
        let code = resume ? session.code : normalize(codeInput.value);
        if (create && !resume) {
            crypto.getRandomValues(bytes);
            code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
        } else if (!/^[A-HJ-NP-Z2-9]{20}$/.test(code)) {
            status('error', 'Enter the full 20-character code from the other toolkit.'); codeInput.focus(); return;
        }
        if (!navigator.onLine) {
            if (resume) disconnect('You’re offline. Check your connection, then try Relink again.', 'LINK_OFFLINE');
            else status('error', 'You’re offline. Connect to the internet to use Link.');
            return;
        }
        let recovery = resume ? { ...session.recovery } : {};
        const previousTransport = transport || (resume ? session.previousTransport : null);
        if (resume && merge) {
            try { collect(); }
            catch (error) { disconnect(error.message, 'LINK_INVALID_DATA'); return; }
            recovery = { ...recovery, ...sendingPatch, ...merge.pending };
        }
        if (!resume) session = { code, creator: create, identity: identity(), paused: false };
        if (resume) create = session.creator;
        if (resume) session.recovery = recovery;
        const token = ++operation;
        if (resume) {
            if (previousTransport) session.previousTransport = previousTransport;
            clearTimeout(flushTimer); clearTimeout(captureTimer); clearTimeout(renderTimer);
            flushTimer = captureTimer = renderTimer = null;
            transport = merge = null; writing = false; pendingRoots = {};
        }
        busy = true; closed = false; controls();
        status('connecting', resume ? 'Relinking…' : create ? 'Generating a Link…' : 'Joining this Link…');
        let incoming = [], networkState = 'reconnecting';
        let connectTimeout, ended = null;
        try {
            const initial = adapter.capture();
            core.validateFields(initial);
            const connecting = (async () => {
                const factory = window.NullscapeLinkTransportFactory || (await import('./link-firebase.js?v=20261028-link2')).connect;
                if (resume) await previousTransport?.close({ preserveRoom: true });
                if (operation !== token) throw Object.assign(new Error('Link cancelled.'), { code: 'LINK_CANCELLED' });
                return factory({ code, create, restore: resume && create, fields: initial, identity: session.identity,
                onPatch: patch => { if (operation === token) { if (merge) receive(patch); else incoming.push(patch); } },
                onMembers: members => { if (operation === token) people(members); },
                onStatus: state => {
                    if (operation !== token) return;
                    networkState = state; connected = state === 'live';
                    if (transport) {
                        if (!connected) disconnect('Your connection to Link was interrupted. Relink to resume sharing. Your current toolkit is still here.');
                        else if (!session.paused) { status('live', 'Linked · changes shared. The creator keeps this code online.'); scheduleFlush(); }
                    }
                },
                onEnd: (message, code = 'LINK_ROOM_ENDED') => {
                    if (operation !== token) return;
                    if (transport) disconnect(message, code);
                    else ended = Object.assign(new Error(message), { code });
                }
                });
            })();
            const discard = active => active.close({ preserveRoom: resume && session?.code === code });
            connecting.then(active => { if (operation !== token) discard(active); }, () => {});
            const active = await Promise.race([connecting, new Promise((_, reject) => {
                connectTimeout = setTimeout(() => reject(Object.assign(new Error('Link took too long to connect. Check your connection and try again.'), { code: 'LINK_TIMEOUT' })), 15000);
            })]);
            clearTimeout(connectTimeout);
            if (operation !== token) { discard(active); return; }
            if (ended) { active.close(); throw ended; }
            transport = active;
            merge = new core.FieldMerge(active.fields);
            codeInput.value = format(code);
            if (resume) {
                core.patchFields(merge.fields, recovery);
                merge.pending = core.diff(active.fields, merge.fields);
                applying = true;
                adapter.apply(core.expand(merge.fields), merge.fields);
                applying = false;
                merge.rendered(adapter.capture());
            } else if (!create) {
                applying = true;
                // Joining adopts this room's toolkit; do not publish the joiner's old run.
                adapter.apply(core.expand(active.fields), active.fields);
                applying = false;
            } else {
                // Capture edits made while the initial server write was in progress.
                merge.rendered(initial);
                merge.local(adapter.capture());
            }
            if (!create && !resume) merge.rendered(adapter.capture());
            session.paused = false; session.recovery = {}; session.previousTransport = null; sendingPatch = {}; writing = false;
            el('linkMembers').dataset.paused = 'false';
            if (dialog.open) dialog.close();
            incoming.forEach(receive); incoming = [];
            busy = false; controls(); codeInput.focus();
            status(networkState, connected ? 'Linked · changes shared. The creator keeps this code online.' : 'Connecting. Your changes will sync when connected.');
            scheduleFlush();
        } catch (error) {
            clearTimeout(connectTimeout);
            if (operation !== token) return;
            applying = false;
            busy = false;
            const reason = connectionError(error);
            if (resume) {
                operation++;
                transport?.close({ preserveRoom: true }); transport = null;
                disconnect(reason.message, reason.code);
                el('linkDisconnectTitle').textContent = 'Unable to relink';
            } else leave(`${reason.message} (${reason.code})`, 'error');
        }
    }
    createButton.addEventListener('click', () => start(true));
    joinButton.addEventListener('click', () => start(false));
    const relink = () => start(session?.creator === true, true);
    retryButton.addEventListener('click', relink);
    relinkButton.addEventListener('click', relink);
    el('linkDisconnectLocal').addEventListener('click', () => leave());
    dialog.addEventListener('cancel', event => { event.preventDefault(); leave(); });
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
    window.addEventListener('offline', () => { if (transport && !busy) disconnect('Your internet connection was lost. Your current toolkit is still here.', 'LINK_OFFLINE'); });
    controls();
}());
