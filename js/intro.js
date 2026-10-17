/* Five-note logo intro. All note onsets and visual steps use the same clock.
   Reference: https://www.youtube.com/watch?v=k5uD12p0rEs (opening piano roll).
   Pitches: D4, F5, E5, Bb4, A4. Rhythm: 0, 1.5, 3, 4, 5.5 quarter notes.
   Tempo is isolated here so the arrangement can be tuned without changing motion. */
(() => {
    'use strict';
    const MOTIF = Object.freeze({
        bpm: 160,
        initialSilence: .5,
        notes: Object.freeze([
            { midi: 62, beat: 0 },
            { midi: 77, beat: 1.5 },
            { midi: 76, beat: 3 },
            { midi: 70, beat: 4 },
            { midi: 69, beat: 5.5 }
        ])
    });
    const home = document.getElementById('landingView');
    const brand = home.querySelector('.landing-brand');
    const image = document.getElementById('animatedLogo');
    const stage = document.getElementById('logoStage');
    const slices = document.getElementById('logoSlices');
    const features = home.querySelector('.landing-features-viewport');
    const enter = document.getElementById('enterToolkit');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const lowDetail = () => document.documentElement.classList.contains('low-detail-mode');
    const noteTimes = MOTIF.notes.map(note => MOTIF.initialSilence + note.beat * 60 / MOTIF.bpm);
    const assembledAt = noteTimes.at(-1) + .35;
    const revealAt = assembledAt + .32;
    const doneAt = revealAt + 1.25;
    const tiles = [];
    const oscillators = new Set();
    let frame;
    let audio;
    let graph;
    let audioCleanup;
    let safetyTimer;
    let gate;
    let finished = false;
    let started = false;
    let generation = 0;

    const LEAD = .4; // tiles start flying this long before their note, so they land ON the beat
    const burst = document.createElement('div');
    burst.className = 'logo-burst';
    const shine = document.createElement('div');
    shine.className = 'logo-shine';
    // Each piece has its own entrance: direction, spin and size.
    const FROM = [
        { x: -26, y: -38, r: -5, s: 1.08 },
        { x: 22, y: 36, r: 4, s: .93 },
        { x: -14, y: -42, r: -3, s: 1.06 },
        { x: 28, y: 34, r: 5, s: .94 },
        { x: -20, y: -36, r: -4, s: 1.07 }
    ];

    features.querySelectorAll('li').forEach((tag, index) => tag.style.setProperty('--tag-index', index));
    for (let index = 0; index < 5; index++) {
        const tile = document.createElement('span');
        tile.className = 'intro-piece';
        tile.style.left = `${index * 20}%`;
        tile.style.backgroundPosition = `${index * 25}% 50%`;
        tile.dataset.fixOnBeat = String(index + 1);
        slices.append(tile);
        tiles.push(tile);
    }
    function restart(element, name) {
        element.classList.remove(name);
        void element.offsetWidth;
        element.classList.add(name);
    }
    stage.addEventListener('animationend', event => {
        if (event.animationName === 'logo-thump') stage.classList.remove('thump');
    });
    function placeTiles(flying) {
        tiles.forEach((tile, index) => {
            const on = Number(tile.dataset.fixOnBeat) <= flying;
            const from = FROM[index];
            tile.style.setProperty('--piece-x', on ? '0px' : `${from.x}px`);
            tile.style.setProperty('--piece-y', on ? '0px' : `${from.y}px`);
            tile.style.setProperty('--piece-r', on ? '0deg' : `${from.r}deg`);
            tile.style.setProperty('--piece-s', on ? '1' : String(from.s));
            tile.style.setProperty('--piece-blur', on ? '0px' : '4px');
            tile.style.opacity = on ? '1' : '0';
            if (!on) tile.classList.remove('landed');
        });
    }
    // Fires exactly on a note: flash the piece, burst of light, and a thump.
    function hit(beat) {
        home.dataset.introBeat = String(beat);
        if (!beat) return;
        const final = beat === tiles.length;
        restart(tiles[beat - 1], 'landed');
        burst.classList.toggle('final', final);
        burst.style.left = final ? '50%' : `${(beat - 1) * 20 + 10}%`;
        restart(burst, 'hit');
        restart(stage, 'thump');
    }
    function setControlsEnabled(enabled) {
        features.inert = !enabled;
        if (enabled) enter.removeAttribute('tabindex');
        else enter.setAttribute('tabindex', '-1');
    }
    function updateLift() {
        if (finished) return;
        const rect = stage.getBoundingClientRect();
        const transform = getComputedStyle(brand).transform;
        const currentShift = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
        const logoCenter = (rect.top + rect.bottom) / 2 - currentShift;
        const screenCenter = home.getBoundingClientRect().top + home.clientHeight / 2;
        brand.style.setProperty('--intro-lift', `${screenCenter - logoCenter}px`);
    }
    function stopSound() {
        clearTimeout(audioCleanup);
        for (const oscillator of oscillators) { try { oscillator.stop(); } catch (_) {} }
        oscillators.clear();
        if (audio && audio.state !== 'closed') audio.close().catch(() => {});
        audio = null;
        graph = null;
    }
    function removeGate() {
        gate?.remove();
        gate = null;
    }
    function finish() {
        generation++;
        finished = true;
        cancelAnimationFrame(frame);
        clearTimeout(safetyTimer);
        removeGate();
        home.dataset.introState = 'done';
        home.dataset.introBeat = '5';
        document.documentElement.classList.remove('intro-pending');
        setControlsEnabled(true);
        slices.replaceChildren();
        burst.remove();
        stopSound();
    }
    window.NullscapeIntro = Object.freeze({ finish });

    function createAudio() {
        if (audio) return audio;
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return null;
        try { audio = new Audio({ latencyHint: 'interactive' }); }
        catch (_) { return null; }
        return audio;
    }
    function createGraph(context) {
        const output = context.createGain();
        output.gain.value = .7;
        // Gentle limiter so the louder mix never clips.
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -10;
        limiter.knee.value = 12;
        limiter.ratio.value = 8;
        limiter.attack.value = .003;
        limiter.release.value = .25;
        output.connect(limiter).connect(context.destination);
        const convolver = context.createConvolver();
        const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.4), context.sampleRate);
        // Deterministic room impulse, with a gentle, diffuse decay.
        let seed = 1729;
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                data[i] = (seed / 4294967296 * 2 - 1) * Math.pow(1 - i / data.length, 3);
            }
        }
        convolver.buffer = impulse;
        const wet = context.createGain();
        wet.gain.value = .3;
        convolver.connect(wet).connect(output);
        const delay = context.createDelay(1);
        delay.delayTime.value = .31;
        const feedback = context.createGain();
        feedback.gain.value = .28;
        const echo = context.createGain();
        echo.gain.value = .23;
        delay.connect(feedback).connect(delay);
        delay.connect(echo).connect(output);
        return { output, convolver, delay };
    }
    function scheduleNotes(context, origin) {
        graph ||= createGraph(context);
        MOTIF.notes.forEach((note, index) => {
            const at = origin + noteTimes[index];
            const final = index === MOTIF.notes.length - 1;
            const duration = final ? 1.8 : .65;
            const frequency = 440 * 2 ** ((note.midi - 12 - 69) / 12);
            const envelope = context.createGain();
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(.3, at + .018);
            envelope.gain.linearRampToValueAtTime(.22, at + .1);
            envelope.gain.setValueAtTime(.22, at + (final ? .6 : .2));
            envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
            const lowpass = context.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.Q.value = .45;
            lowpass.frequency.setValueAtTime(1100, at);
            lowpass.frequency.exponentialRampToValueAtTime(final ? 750 : 550, at + duration);
            envelope.connect(lowpass).connect(graph.output);
            const roomSend = context.createGain();
            roomSend.gain.value = final ? .65 : .18;
            lowpass.connect(roomSend).connect(graph.convolver);
            if (final) lowpass.connect(graph.delay);
            // A lower register, rounded core and quiet sub keep the synth deep and warm.
            const voices = [
                { type: 'triangle', ratio: 1, detune: 0, level: .48 },
                { type: 'sawtooth', ratio: 1, detune: -6, level: .18 },
                { type: 'sawtooth', ratio: 1, detune: 6, level: .18 },
                { type: 'sine', ratio: .5, detune: 0, level: .16 }
            ];
            let remaining = voices.length;
            voices.forEach(voice => {
                const oscillator = context.createOscillator();
                oscillator.type = voice.type;
                oscillator.frequency.value = frequency * voice.ratio;
                oscillator.detune.value = voice.detune;
                const level = context.createGain();
                level.gain.value = voice.level;
                oscillator.connect(level).connect(envelope);
                oscillators.add(oscillator);
                oscillator.onended = () => {
                    oscillators.delete(oscillator);
                    oscillator.disconnect();
                    level.disconnect();
                    if (--remaining === 0) { envelope.disconnect(); lowpass.disconnect(); roomSend.disconnect(); }
                };
                oscillator.start(at);
                oscillator.stop(at + duration + .02);
            });
        });
    }
    function begin(withAudio) {
        const run = ++generation;
        cancelAnimationFrame(frame);
        home.dataset.introState = 'waiting';
        placeTiles(0);
        setControlsEnabled(false);
        const wallOrigin = performance.now();
        const context = withAudio ? audio : null;
        const audioOrigin = context?.currentTime;
        if (context) scheduleNotes(context, audioOrigin);
        home.dataset.introAudio = context ? 'playing' : (audio ? 'blocked' : 'unavailable');
        let lastBeat = 0;
        let lastFly = 0;
        function tick() {
            if (finished || run !== generation) return;
            const elapsed = context ? context.currentTime - audioOrigin : (performance.now() - wallOrigin) / 1000;
            const fly = noteTimes.filter(time => elapsed >= time - LEAD).length;
            const beat = noteTimes.filter(time => elapsed >= time).length;
            if (fly !== lastFly) { placeTiles(fly); lastFly = fly; }
            if (beat !== lastBeat) { hit(beat); lastBeat = beat; }
            if (elapsed >= doneAt) {
                finished = true;
                home.dataset.introState = 'done';
                setControlsEnabled(true);
                slices.replaceChildren();
                burst.remove();
                clearTimeout(safetyTimer);
                // Let the final echo finish, then release the audio context.
                audioCleanup = setTimeout(stopSound, 3200);
                return;
            }
            home.dataset.introState = elapsed >= revealAt ? 'revealing' : elapsed >= assembledAt ? 'assembled' : fly ? 'playing' : 'waiting';
            if (elapsed >= revealAt) setControlsEnabled(true);
            frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
    }

    // Click-to-enter gate: a real user gesture guarantees the audio can play.
    function createGate() {
        gate = document.createElement('button');
        gate.type = 'button';
        gate.className = 'intro-gate';
        gate.innerHTML = '<span>click to enter</span>';
        gate.addEventListener('click', start);
        home.append(gate);
        gate.focus({ preventScroll: true });
    }
    function start() {
        if (started || finished) return;
        started = true;
        const leaving = gate;
        leaving.classList.add('is-leaving');
        setTimeout(() => { if (gate === leaving) removeGate(); else leaving.remove(); }, 700);
        const context = createAudio();
        // resume() is called synchronously inside the click.
        const ready = context ? context.resume().catch(() => {}) : Promise.resolve();
        safetyTimer = setTimeout(finish, 12000);
        Promise.all([ready, decoded]).then(() => {
            if (finished) return;
            updateLift();
            begin(Boolean(context) && context.state === 'running');
        }).catch(() => {});
    }

    window.addEventListener('resize', updateLift);
    window.addEventListener('nullscape-route-change', event => { if (event.detail.route !== 'home') finish(); });
    window.addEventListener('nullscape-low-detail-change', event => { if (event.detail.enabled) finish(); });
    reducedMotion.addEventListener('change', event => { if (event.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && started && !finished) finish(); });
    window.addEventListener('pagehide', finish);
    let savedLowDetail = false;
    try { savedLowDetail = localStorage.getItem('nullscapeLowDetailMode') === 'true'; } catch (_) {}
    if (reducedMotion.matches || lowDetail() || savedLowDetail || /^#\/?(curses|upgrades|deaths|altars|lobby)\/?$/.test(location.hash)) {
        finish();
        return;
    }
    home.dataset.introState = 'waiting';
    setControlsEnabled(false);
    stage.append(burst, shine);
    placeTiles(0);
    updateLift();
    document.documentElement.classList.remove('intro-pending');
    const decoded = image.decode();
    decoded.catch(finish);
    createGate();
    document.fonts.ready.then(updateLift);
})();