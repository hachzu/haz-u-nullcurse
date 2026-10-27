/* Loaded only by Generate / Join; reuse the site's existing Firebase app. */
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getDatabase, ref, get, set, onValue, update, remove, onDisconnect, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

export async function connect({ code, create, restore = false, fields, identity, onPatch, onStatus, onEnd, onMembers = () => {} }) {
    const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const room = ref(db, `toolkitLinks/${code}`);
    const state = ref(db, `toolkitLinks/${code}/state`);
    const members = ref(db, `toolkitLinks/${code}/members`);
    const member = ref(db, `toolkitLinks/${code}/members/${identity.id}`);
    let cleanup = null;
    let memberCleanup = null;
    let created = false;
    const failure = (message, code) => Object.assign(new Error(message), { code });
    let value;
    if (create) {
        const result = await runTransaction(room, current => current === null ? {
            meta: { version: 1, createdAt: serverTimestamp(), expiresAt: Date.now() + 86400000 }, state: fields
        } : undefined, { applyLocally: false });
        if (!result.committed && !restore) throw failure('That code is already in use. Generate another code.', 'LINK_CODE_IN_USE');
        created = result.committed;
        value = result.snapshot.val();
        // Hosted, ephemeral rooms: the creator keeps the code online. Firebase
        // deletes it on tab/socket loss, without polling or a scheduled cleanup job.
    } else {
        value = (await get(room)).val();
    }
    if (!value) throw failure('The creator is offline or this Link has ended. Ask them to relink first, then try again.', 'LINK_ROOM_ENDED');
    if (value.meta?.expiresAt <= Date.now()) throw failure('This Link has expired. Generate a new code.', 'LINK_EXPIRED');
    if (value.meta?.version !== 1 || !value.state) throw failure('This Link contains unsupported data. Generate a new code.', 'LINK_INVALID_DATA');
    const core = window.NullscapeLinkCore;
    core.validateFields(value.state);
    try {
        if (create) { cleanup = onDisconnect(room); await cleanup.remove(); }
        // Presence changes only when joining/leaving. No periodic heartbeat.
        memberCleanup = onDisconnect(member);
        await memberCleanup.remove();
        await set(member, { name: identity.name, creator: create, joinedAt: serverTimestamp() });
    } catch (error) {
        await memberCleanup?.cancel().catch(() => {});
        await cleanup?.cancel().catch(() => {});
        if (created) await remove(room).catch(() => {});
        throw error;
    }
    let previous = value.state;
    let closed = false;
    const unsubscribers = [];
    const finish = (message, code) => { if (!closed) { close(); onEnd(message, code); } };
    let closing;
    let preserved = false;
    function close({ preserveRoom = false } = {}) {
        if (closed) {
            if (cleanup && preserved && !preserveRoom) {
                preserved = false;
                closing = (closing || Promise.resolve()).then(() => remove(room)).catch(() => {});
            }
            return closing || Promise.resolve();
        }
        preserved = preserveRoom;
        closed = true;
        clearTimeout(expiry);
        unsubscribers.splice(0).forEach(unsubscribe => unsubscribe());
        // On Relink, cancel the old cleanup before reusing the same room code.
        // An intentional creator Leave still ends the room for everyone.
        closing = (async () => {
            if (cleanup && !preserveRoom) await remove(room);
            else await remove(member);
            await memberCleanup.cancel();
            if (cleanup) await cleanup.cancel();
        })().catch(() => {});
        return closing;
    }
    const expiry = setTimeout(() => finish('This Link has expired. Your toolkit is still here.', 'LINK_EXPIRED'), Math.max(1, value.meta.expiresAt - Date.now()));
    // The SDK receives server deltas; this callback compares its local snapshot.
    // Listen only to this room, never the room list or a global state feed.
    unsubscribers.push(onValue(state, snapshot => {
        if (closed) return;
        const next = snapshot.val();
        if (!next) { finish('The creator is offline or this Link has ended. Your toolkit is still here.', 'LINK_ROOM_ENDED'); return; }
        try {
            core.validateFields(next);
            const patch = core.diff(previous, next);
            previous = next;
            if (Object.keys(patch).length) onPatch(patch);
        } catch (error) { finish(error.message, 'LINK_INVALID_DATA'); }
    }, () => finish('Link access was denied or expired. Your toolkit is still here.', 'LINK_ACCESS_DENIED')));
    unsubscribers.push(onValue(members, snapshot => {
        if (closed) return;
        const people = Object.entries(snapshot.val() || {}).filter(([, person]) => person && typeof person.name === 'string')
            .map(([id, person]) => ({ id, name: person.name.slice(0, 40), creator: person.creator === true }));
        onMembers(people);
    }, () => finish('Could not load the people in this Link. Check the updated Firebase rules.', 'LINK_ACCESS_DENIED')));
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
