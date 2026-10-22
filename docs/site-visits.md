# Enable the shared visit counter

The landing page uses the existing `nullscape-tracker` Firebase Realtime Database,
at `siteStats/visits`. The first stored count is **600**. Each subsequent page
visit adds one atomically. Switching tools does not add visits, and local previews
are excluded.

The database currently returns **Permission denied** for this path. In the Firebase
console, open **Realtime Database → Rules** and merge this `siteStats` entry into
the existing top-level `rules` object, then publish the rules. Preserve all existing
rules, including the presence rules; do not replace the entire rules document.

```json
"siteStats": {
  "visits": {
    ".read": true,
    ".write": "(!data.exists() && newData.val() === 600) || (data.isNumber() && newData.val() === data.val() + 1)",
    ".validate": "newData.isNumber() && newData.val() >= 600 && newData.val() % 1 === 0"
  }
}
```

The counter seeds itself on the first successful visit. No manual database value
is needed. If the database is unavailable, the UI shows a dash or the last known
shared value rather than fabricating a browser-local count.
