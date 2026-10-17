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
    let trackAudio;
    let trackReady;
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
    // Each slat slides in along its own slanted cut, alternating direction.
    const FROM = [
        { x: 30, y: -60, r: 0, s: 1 },
        { x: -30, y: 60, r: 0, s: 1 },
        { x: 30, y: -60, r: 0, s: 1 },
        { x: -30, y: 60, r: 0, s: 1 },
        { x: 30, y: -60, r: 0, s: 1 }
    ];
    const SLANT = 5; // how far each cut leans, in % of the logo width

    features.querySelectorAll('li').forEach((tag, index) => tag.style.setProperty('--tag-index', index));
    for (let index = 0; index < 5; index++) {
        const tile = document.createElement('span');
        tile.className = 'intro-piece';
        const first = index === 0, last = index === 4;
        const a = first ? -2 * SLANT : index * 20;
        const b = last ? 100 + 2 * SLANT : (index + 1) * 20 + .4; // tiny overlap hides hairline seams
        tile.style.clipPath = `polygon(${a + SLANT}% 0, ${b + SLANT}% 0, ${b - SLANT}% 100%, ${a - SLANT}% 100%)`;
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
            tile.style.setProperty('--piece-blur', '0px');
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
    function prepareTrack() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            // Separate from the motif so its cleanup leaves the landing track playing.
            const context = trackAudio = new AudioContext();
            const resumed = context.resume();
            trackReady = Promise.all([
                resumed,
                fetch('assets/Telefragger_TV!!!.mp3')
                    .then(response => {
                        if (!response.ok) throw new Error('Track unavailable');
                        return response.arrayBuffer();
                    })
                    .then(data => context.decodeAudioData(data))
            ]).then(([, buffer]) => buffer);
            trackReady.catch(() => {
                if (context.state !== 'closed') context.close().catch(() => {});
            });
        } catch (_) {}
    }
    function stopTrack() {
        const context = trackAudio;
        trackAudio = null;
        trackReady = null;
        if (context && context.state !== 'closed') context.close().catch(() => {});
    }
    function scheduleTrack() {
        const context = trackAudio;
        if (!context || !trackReady) return;
        const onset = context.currentTime + 3;
        trackReady.then(buffer => {
            if (trackAudio !== context || context.state === 'closed') return;
            const source = context.createBufferSource();
            source.buffer = buffer;
            const volume = context.createGain();
            const at = Math.max(onset, context.currentTime);
            volume.gain.setValueAtTime(0, at);
            volume.gain.linearRampToValueAtTime(.25, at + 2);
            source.connect(volume).connect(context.destination);
            source.onended = () => {
                source.disconnect();
                volume.disconnect();
                context.close().catch(() => {});
            };
            source.start(at);
        }).catch(() => {});
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
        const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 4.8), context.sampleRate);
        // A long, diffuse room tail gives the theremin a spacious sci-fi sound.
        let seed = 1729;
        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < data.length; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                data[i] = (seed / 4294967296 * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
            }
        }
        convolver.buffer = impulse;
        const wet = context.createGain();
        wet.gain.value = .55;
        const roomTone = context.createBiquadFilter();
        roomTone.type = 'lowpass';
        roomTone.frequency.value = 2400;
        convolver.connect(roomTone).connect(wet).connect(output);
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
            const frequency = 440 * 2 ** ((note.midi - 7 - 69) / 12);
            const envelope = context.createGain();
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(.3, at + .035);
            envelope.gain.linearRampToValueAtTime(.22, at + .1);
            envelope.gain.setValueAtTime(.22, at + (final ? .6 : .2));
            envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
            const lowpass = context.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.Q.value = .35;
            lowpass.frequency.setValueAtTime(1400, at);
            lowpass.frequency.exponentialRampToValueAtTime(900, at + duration);
            envelope.connect(lowpass).connect(graph.output);
            const roomSend = context.createGain();
            roomSend.gain.value = final ? .95 : .6;
            lowpass.connect(roomSend).connect(graph.convolver);
            if (final) lowpass.connect(graph.delay);
            // Smooth sine voices, a short pitch glide and delayed vibrato replace
            // the buzzy saws while keeping the motif in its lower register.
            const voices = [
                { type: 'sine', ratio: 1, detune: 0, level: .88 },
                { type: 'sine', ratio: 2, detune: 0, level: .09 },
                { type: 'sine', ratio: .5, detune: 0, level: .08 }
            ];
            const previousFrequency = index ? 440 * 2 ** ((MOTIF.notes[index - 1].midi - 7 - 69) / 12) : frequency * .985;
            const vibrato = context.createOscillator();
            vibrato.type = 'sine';
            vibrato.frequency.value = 5.3;
            const vibratoDepth = context.createGain();
            vibratoDepth.gain.setValueAtTime(0, at);
            vibratoDepth.gain.linearRampToValueAtTime(13, at + .22);
            vibrato.connect(vibratoDepth);
            oscillators.add(vibrato);
            vibrato.onended = () => {
                oscillators.delete(vibrato);
                vibrato.disconnect();
                vibratoDepth.disconnect();
            };
            vibrato.start(at);
            vibrato.stop(at + duration + .02);
            let remaining = voices.length;
            voices.forEach(voice => {
                const oscillator = context.createOscillator();
                oscillator.type = voice.type;
                oscillator.frequency.setValueAtTime(previousFrequency * voice.ratio, at);
                oscillator.frequency.exponentialRampToValueAtTime(frequency * voice.ratio, at + .08);
                oscillator.detune.value = voice.detune;
                vibratoDepth.connect(oscillator.detune);
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
        scheduleTrack();
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
                audioCleanup = setTimeout(stopSound, 6500);
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
        prepareTrack();
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
    window.addEventListener('nullscape-route-change', event => {
        if (event.detail.route !== 'home') {
            stopTrack();
            finish();
        }
    });
    window.addEventListener('nullscape-low-detail-change', event => { if (event.detail.enabled) finish(); });
    reducedMotion.addEventListener('change', event => { if (event.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && started && !finished) finish(); });
    window.addEventListener('pagehide', finish);
    window.addEventListener('pagehide', stopTrack);
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