import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getDatabase, ref, runTransaction, onValue } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

async function startVisitCounter() {
    const counter = document.getElementById('siteVisits');
    const value = document.getElementById('siteVisitsCount');
    if (!counter || !value || window.NullscapeMoved || window.NullscapeVisitCounterStarted) return;
    // Local previews must not inflate the shared production total.
    if (location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return;
    window.NullscapeVisitCounterStarted = true;
    let knownCount = false;
    const valid = count => Number.isSafeInteger(count) && count >= 600;
    function show(count) {
        if (!valid(count)) return;
        knownCount = true;
        value.textContent = count.toLocaleString('en-US');
        counter.dataset.state = 'ready';
        counter.title = 'Site visits';
    }
    function unavailable() {
        if (!knownCount) value.textContent = '—';
        counter.dataset.state = 'unavailable';
        counter.title = knownCount ? 'Last available visit count' : 'Visit count temporarily unavailable';
    }
    try {
        const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp(firebaseConfig);
        const visits = ref(getDatabase(app), 'siteStats/visits');
        // Atomic updates keep simultaneous visitors from overwriting each other.
        // The first stored total is 600; subsequent page visits add one.
        const result = await runTransaction(visits, current => {
            if (current === null) return 600;
            if (valid(current) && current < Number.MAX_SAFE_INTEGER) return current + 1;
            return undefined;
        }, { applyLocally: false });
        if (!result.committed) { unavailable(); return; }
        show(result.snapshot.val());
        const unsubscribe = onValue(visits, snapshot => show(snapshot.val()), unavailable);
        window.addEventListener('pagehide', unsubscribe, { once: true });
    } catch (_) {
        unavailable();
    }
}

startVisitCounter();
