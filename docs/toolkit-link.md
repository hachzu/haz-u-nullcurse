# Toolkit Link

Generate Code publishes the current toolkit. Join adopts the creator's current toolkit. Both browsers can then change the run, player count, game mode/difficulty, enemies/curses, upgrade ownership/queue/balance and calculator options, death players/log, altar inputs/selections, lobby content/styles, and toolkit display/audio/particle settings. Routes, focused controls, text selections, usernames, feedback and tutorial dismissals stay local.

The code is a bearer editing key: anyone receiving it can read/edit this room. Twenty cryptographically random base-32 characters provide 100 bits of entropy. No room directory is readable. Share codes privately. This is shared state, with the latest server write winning for the same field. Separate fields merge; lobby text plus letter styles is one field so styles remain aligned. It does not implement Google Docs character-level concurrent text merging.

The creator hosts the code. Leaving, closing or losing the creator's Firebase connection deletes the room using server-side `onDisconnect`; peers keep their current local toolkit. A joining user can leave without ending the creator's Link. A Link also expires after 24 hours. There is no automatic rejoin after refresh. Local edits remain saved through the toolkit's existing save functions.

## Disconnect panel and Relink

An unexpected lost connection, denied access, write failure, expiry, or ended room opens a native modal dialog near the top of the viewport. The browser's modal top layer puts it above ordinary overlays regardless of their z-index. It traps focus and pauses shared writes until the user chooses Relink or Continue Locally. An intentional Leave does not warn the leaving user; other editors see the ended-room panel. Escape chooses Continue Locally.

Relink uses the previous code and the same participant ID. A guest rejoins an existing room. The creator can restore a room that was deleted on disconnect, publishing their current local toolkit under the same code. Guests need to retry after the creator restores it. Unsent local field changes are merged with the latest room data after reconnecting. The pending recovery patch survives failed attempts. There is no automatic retry polling. Successful Relink dismisses the panel; failed attempts leave the panel open and show a stable error code:

| Code | Meaning |
|---|---|
| `LINK_CONNECTION_LOST` | Firebase connection was interrupted. |
| `LINK_OFFLINE` | Browser has no connection / network is unavailable. |
| `LINK_ROOM_ENDED` | The creator is offline or the room was removed. |
| `LINK_EXPIRED` | The room's lifetime has elapsed. |
| `LINK_ACCESS_DENIED` | Database rules denied access; check the updated members rules. |
| `LINK_TIMEOUT` | Connection attempt took longer than 15 seconds. |
| `LINK_WRITE_FAILED` | An update could not be sent. |
| `LINK_INVALID_DATA` | Shared data is unsupported or exceeds the snapshot limits. |
| `LINK_RELINK_FAILED` | Other connection failure; retry later. |

The Link section lists live participant aliases, a YOU indicator for this browser, and a CREATOR label. Names come from the existing `nullscape_username` alias, with Anonymous as fallback. These are display names and roles, not verified accounts or owner-only permissions. During a disconnect the last known roster is dimmed and its dots turn amber. Names are inserted with `textContent`, not HTML.

## Firebase setup

For connected names, republish the updated rules: `toolkitLinks/$code/members` is now allowed with bounded name/role/timestamp records. The previous rules reject this new child, so deploying only the website is insufficient.

The complete rules in `docs/firebase-link-rules.json` include the user's existing `presence` and `siteStats` rules plus the new `toolkitLinks` branch. Paste them into Realtime Database → Rules in project `nullscape-tracker` and publish. If production rules have since changed, merge only `toolkitLinks` instead. Root-level `.read: true` / `.write: true` grants override child restrictions, so those must not grant public access to the whole database. This feature uses unpredictable room codes instead of requiring a user account or enabling anonymous authentication.

No Firebase administration credentials or deployed database rules are present in this repository. These scoped rules must be deployed by a project administrator before Link can operate against a database that denies unknown paths. Permission errors remain visible in the Link section and leave the toolkit local. This change does not deploy rules or change the production database.

## Traffic and storage

- Firebase Link code is imported only on Generate / Join. Unlinked use has no Link database reads, writes, timers or polling.
- One initial room read (join) or transaction (create), listeners scoped to that room's `state` and `members`, and one connection-status listener. Existing Firebase app/connection is reused.
- Writes contain only changed fields, batched every 350–500 ms; no full-run write for every click. At most two batches per second per editor. There are no cursors, user presence heartbeats, global listeners or retained edit history.
- Idle rooms generate no application writes. Each editor still receives other editors' updates and normal Firebase connection traffic. Usage is small for a few people, but cannot be zero or guaranteed against abuse without a server-enforced quota/App Check.
- Each participant writes one member record on joining and registers a disconnect removal. Leaving removes that member. The creator additionally registers room cleanup and deletes the room on leaving. Presence adds only join/leave/disconnect events, not a periodic heartbeat. A client-side snapshot guard limits normal room payloads to 256 KiB / 2,048 fields / 16 KiB per field. Server rules cap each field's string length, reject unexpected room/metadata children, and enforce expiry. The aggregate payload and field-count limits are client checks; Realtime Database rules do not support `numChildren()`. No scheduled function or paid backend is required.
- In the narrow case of a creator losing its connection between the creation transaction and disconnect registration, an expired record can remain. Expiry blocks reads/edits; remove such records manually if needed. RTDB does not provide automatic TTL deletion.

## Verification

Core and controller tests run against an in-memory room server; they never write to production Firebase. Browser integration tests should also inject `window.NullscapeLinkTransportFactory` before loading the toolkit. The private preview blocks the live transport module as a second protection against production writes.
