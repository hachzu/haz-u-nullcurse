/* Loaded only by Generate / Join; reuse the site's existing Firebase app. */
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getDatabase, ref, get, onValue, update, remove, onDisconnect, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

export async function connect({ code, create, fields, onPatch, onStatus, onEnd }) {
    const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const room = ref(db, `toolkitLinks/${code}`);
    const state = ref(db, `toolkitLinks/${code}/state`);
    let cleanup = null;
    let value;
    if (create) {
        const result = await runTransaction(room, current => current === null ? {
            meta: { version: 1, createdAt: serverTimestamp(), expiresAt: Date.now() + 86400000 }, state: fields
        } : undefined, { applyLocally: false });
        if (!result.committed) throw new Error('That code is already in use. Generate another code.');
        value = result.snapshot.val();
        // Hosted, ephemeral rooms: the creator keeps the code online. Firebase
        // deletes it on tab/socket loss, without polling or a scheduled cleanup job.
        cleanup = onDisconnect(room);
        try { await cleanup.remove(); }
        catch (error) { await remove(room).catch(() => {}); throw error; }
    } else {
        value = (await get(room)).val();
    }
    if (!value || value.meta?.version !== 1 || value.meta.expiresAt <= Date.now() || !value.state) {
        throw new Error('Link not found or expired. Check the code, or generate a new one.');
    }
    const core = window.NullscapeLinkCore;
    core.validateFields(value.state);
    let previous = value.state;
    let closed = false;
    const unsubscribers = [];
    const finish = message => { if (!closed) { close(); onEnd(message); } };
    function close() {
        if (closed) return;
        closed = true;
        clearTimeout(expiry);
        unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
        if (cleanup) remove(room).then(() => cleanup.cancel()).catch(() => {});
    }
    const expiry = setTimeout(() => finish('Link expired. Your toolkit is still saved here.'), Math.max(1, value.meta.expiresAt - Date.now()));
    // The SDK receives server deltas; this callback compares its local snapshot.
    // Listen only to this room, never the room list or a global state feed.
    unsubscribers.push(onValue(state, snapshot => {
        if (closed) return;
        const next = snapshot.val();
        if (!next) { finish('This Link has ended. Your toolkit is still saved here.'); return; }
        try {
            core.validateFields(next);
            const patch = core.diff(previous, next);
            previous = next;
            if (Object.keys(patch).length) onPatch(patch);
        } catch (error) { finish(error.message); }
    }, () => finish('Link access was denied or expired. Your toolkit is still saved here.')));
    unsubscribers.push(onValue(ref(db, '.info/connected'), snapshot => {
        if (!closed) onStatus(snapshot.val() === true ? 'live' : 'reconnecting');
    }));
    return {
        fields: value.state,
        async send(patch) {
            if (closed) throw new Error('This Link has ended.');
            await update(state, patch);
        },
        close
    };
}
