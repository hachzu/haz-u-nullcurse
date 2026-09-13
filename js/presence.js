import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    getDatabase,
    ref,
    push,
    set,
    onValue,
    onDisconnect
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCxx3I9XkmVLouC-5-JvJzkXRTr1bdWS1o",
    authDomain: "nullscape-tracker.firebaseapp.com",
    databaseURL: "https://nullscape-tracker-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "nullscape-tracker",
    storageBucket: "nullscape-tracker.firebasestorage.app",
    messagingSenderId: "1063992213242",
    appId: "1:1063992213242:web:ec5bd3d8efe24965449343"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const presenceRef = ref(db, "presence");
const myPresenceRef = push(presenceRef);

const connectedRef = ref(db, ".info/connected");

onValue(connectedRef, (snap) => {

    if (snap.val() === true) {

        // Auto-remove this entry the instant our connection drops -
        // tab closed, browser crashed, wifi died, whatever - no
        // manual cleanup needed on our end.
        onDisconnect(myPresenceRef).remove().then(() => {

            set(myPresenceRef, true);

        });

    }

});

// Live count of everyone currently marked present.
onValue(presenceRef, (snap) => {

    const count = snap.size ?? Object.keys(snap.val() || {}).length;
    const countEl = document.getElementById("liveViewerCount");

    if (countEl) {

        countEl.textContent = count;

    }

});