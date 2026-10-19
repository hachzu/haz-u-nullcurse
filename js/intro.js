/* Landing intro: one audio clock, latency-compensated visuals. ?introdebug logs timing.
   All seconds below are relative to begin(), unless documented otherwise. */
(() => {
    'use strict';
    if (window.NullscapeMoved) return;
    const CONFIG = {
        notes: [ // Original 128 BPM motif, without the extra hold before note 5.
            { midi: 62, at: .5 }, { midi: 77, at: 1.203125 },
            { midi: 76, at: 1.90625 }, { midi: 70, at: 2.375 },
            { midi: 69, at: 3.078125 }
        ],
        timing: {
            sliceLead: .55, assembledHold: .45, dropHold: 2, uiDuration: 1.5,
            scheduleLead: .05, // Audio scheduling headroom; begin() is this far in the future.
            visualOffset: 0, // Positive values delay visuals further; device calibration.
            gateFade: .7, loadTimeout: 20
        },
        loading: { minimumLoad: 3.4, assetPortion: .85, fallbackCountdown: .8, exit: .55, exitHold: .2 },
        song: {
            url: 'assets/adelightfulnewdeath-cut.mp3?v=20261018-new-cut1',
            title: 'A Delightful New Death', artist: 'Digital Descendant',
            creditDelay: 3, creditFade: .7, // Credit appears this long after audible playback begins.
            offset: 0, volume: .5, fadeIn: 1.4,
            dropFileTime: 4.835, // Measured first sustained bass entry in the replacement cut.
            kicks: [4.0895, 4.2795, 4.4645, 4.6495, 4.835, 4.9795, 5.1095, 5.6045, 5.7995],
            fftSize: 2048, lowHz: 30, highHz: 130, threshold: 1.5,
            energyFloor: .015, rearmRatio: 1.08, refractory: .15,
            energyAverage: .65, // Seconds of smoothing for the adaptive detector.
            detectorOffset: 0 // Extra correction for analyser window/onset bias.
        },
        synth: {
            transpose: -7, noteDuration: .75, finalDuration: 2.8,
            attack: .012, settle: .08, hold: .24, finalHold: .9,
            glide: .035, vibratoFade: .22, releasePad: .02,
            reverb: 4.8, echo: .31, compressorAttack: .003, compressorRelease: .25
        },
        fx: {
            flash: .1, rgb: .2, glitch: .15, punch: .52, ring: 1.1,
            ringDelay: .10, spark: .85, background: 1.5,
            preDropGlint: .85, preDropGlintLead: 1,
            backgroundAttack: .012, backgroundRelease: .38, backgroundWindow: 1.4,
            backgroundScale: .032, backgroundTravel: 9, backgroundLight: .22,
            assemblyStartScale: 1.08, assemblyPeakScale: 1.25, assemblySettle: 1,
            toolkitWipe: .7
        }
    };
    const DEBUG = new URLSearchParams(location.search).has('introdebug');
    const MOTIF = { notes: CONFIG.notes };
    const CUT = CONFIG.song;
    const home = document.getElementById('landingView');
    const brand = home.querySelector('.landing-brand');
    const content = home.querySelector('.landing-content');
    const background = home.querySelector('.landing-background');
    const image = document.getElementById('animatedLogo');
    const stage = document.getElementById('logoStage');
    const logoFace = home.querySelector('.ns-logo-face');
    const logoBuild = home.querySelector('.ns-logo-build');
    const slices = document.getElementById('logoSlices');
    const features = home.querySelector('.landing-features-viewport');
    const enter = document.getElementById('enterToolkit');
    const nowPlaying = document.createElement('div');
    nowPlaying.className = 'ns-now-playing';
    nowPlaying.hidden = true;
    nowPlaying.setAttribute('role', 'status');
    nowPlaying.setAttribute('aria-label', `Now playing: ${CUT.title} by ${CUT.artist}`);
    const songTitle = document.createElement('span');
    songTitle.className = 'ns-now-playing-title';
    songTitle.textContent = CUT.title;
    const songArtist = document.createElement('span');
    songArtist.className = 'ns-now-playing-artist';
    songArtist.textContent = `by ${CUT.artist}`;
    nowPlaying.append(songTitle, songArtist);
    nowPlaying.style.setProperty('--ns-credit-fade', `${CUT.creditFade}s`);
    home.append(nowPlaying);
    const startupLoad = document.createElement('div');
    startupLoad.className = 'ns-startup-load';
    startupLoad.hidden = true;
    startupLoad.setAttribute('role', 'progressbar');
    startupLoad.setAttribute('aria-label', 'Toolkit startup');
    startupLoad.setAttribute('aria-valuemin', '0');
    startupLoad.setAttribute('aria-valuemax', '100');
    startupLoad.setAttribute('aria-valuenow', '0');
    const loadRow = document.createElement('span');
    loadRow.className = 'ns-startup-row';
    const loadLabel = document.createElement('span');
    loadLabel.textContent = 'Loading toolkit';
    const loadPercent = document.createElement('span');
    loadPercent.textContent = '0%';
    loadRow.append(loadLabel, loadPercent);
    const loadRail = document.createElement('span');
    loadRail.className = 'ns-startup-rail';
    const loadFill = document.createElement('span');
    loadFill.className = 'ns-startup-fill';
    loadRail.append(loadFill);
    startupLoad.append(loadRow, loadRail);
    home.append(startupLoad);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const lastIndex = MOTIF.notes.length - 1;
    const noteTimes = CONFIG.notes.map(note => note.at);
    const impactAt = noteTimes.at(-1);
    const assembledAt = impactAt + CONFIG.timing.assembledHold;
    const motifTailEnd = impactAt + CONFIG.synth.finalDuration + CONFIG.synth.reverb;
    const songOffset = CUT.offset;
    const loadingAt = noteTimes[0];
    const earliestSongAt = assembledAt + CONFIG.loading.minimumLoad;
    // Assigned only when required resources have finished loading.
    let songAt = Infinity, dropAt = Infinity, revealAt = Infinity, doneAt = Infinity;
    const tiles = [];
    const oscillators = new Set();
    const fxLayer = document.createElement('div');
    fxLayer.className = 'logo-fx';
    let frame;
    let cutPromise;
    let cutBufferReady = null;
    let cutSettled = false;
    let cutProgress = 0;
    let cutAbort;
    let audio;
    let graph;
    let songPlaying = false;
    let songEnded = false;
    let analyser;
    let spectrum;
    let pendingKicks = [];
    let detector;
    let backgroundKicks = [];
    let gate;
    let finished = false;
    let started = false;
    let generation = 0;

    const LEAD = CONFIG.timing.sliceLead;
    const burst = document.createElement('div');
    burst.className = 'logo-burst';
    const shine = document.createElement('div');
    shine.className = 'logo-shine';
    shine.addEventListener('animationend', event => {
        if (event.target === shine && event.animationName === 'logo-shine') {
            shine.classList.remove('ns-pre-drop-glint');
        }
    });
    // Each slat glides in along its own slanted cut, alternating direction.
    const FROM = [
        { x: 40, y: -70, r: 0, s: .97 },
        { x: -40, y: 70, r: 0, s: .97 },
        { x: 40, y: -70, r: 0, s: .97 },
        { x: -40, y: 70, r: 0, s: .97 },
        { x: 40, y: -70, r: 0, s: .97 }
    ];
    const SLANT = 5; // how far each cut leans, in % of the logo width

    features.querySelectorAll('li').forEach((tag, index) => tag.style.setProperty('--tag-index', index));
    for (let index = 0; index < 5; index++) {
        const tile = document.createElement('span');
        tile.className = 'intro-piece';
        const first = index === 0, last = index === 4;
        const a = first ? -2 * SLANT : index * 20;
        const b = last ? 100 + 2 * SLANT : (index + 1) * 20 + .6; // tiny overlap hides hairline seams
        tile.style.clipPath = `polygon(${a + SLANT}% 0, ${b + SLANT}% 0, ${b - SLANT}% 100%, ${a - SLANT}% 100%)`;
        tile.dataset.fixOnBeat = String(index + 1);
        const artwork = document.createElement('span');
        artwork.className = 'ns-logo-art';
        tile.append(artwork);
        slices.append(tile);
        tiles.push(tile);
    }
    function restart(element, name, late = 0) {
        element.classList.remove(name);
        element.style.setProperty('--ns-late', `${-Math.max(0, late)}s`);
        void element.offsetWidth;
        element.classList.add(name);
    }
    function logTiming(label, scheduled, fired) {
        if (DEBUG) console.debug('[intro]', { event: label, scheduled: +scheduled.toFixed(6),
            fired: +fired.toFixed(6), differenceMs: +((fired - scheduled) * 1000).toFixed(2) });
    }
    stage.addEventListener('animationend', event => {
        if (event.target !== stage) return;
        if (event.animationName === 'logo-thump') stage.classList.remove('thump');
        if (event.animationName === 'logo-slam') stage.classList.remove('slam');
        if (event.animationName === 'ns-assembly-impact') stage.classList.remove('ns-assembly-impact');
        if (event.animationName === 'ns-kick') stage.classList.remove('ns-kick');
    });
    content.addEventListener('animationend', event => {
        if (event.target === content && event.animationName === 'impact-shake') content.classList.remove('impact-shake');
        if (event.target === content && event.animationName === 'ns-camera') content.classList.remove('ns-camera');
    });
    home.querySelector('.landing-background').addEventListener('animationend', event => {
        if (event.animationName === 'ns-background') event.target.classList.remove('ns-background');
    });
    function placeTiles(flying) {
        tiles.forEach((tile, index) => {
            const on = Number(tile.dataset.fixOnBeat) <= flying;
            const from = FROM[index];
            tile.style.setProperty('--piece-x', on ? '0px' : `${from.x}px`);
            tile.style.setProperty('--piece-y', on ? '0px' : `${from.y}px`);
            tile.style.setProperty('--piece-r', on ? '0deg' : `${from.r}deg`);
            tile.style.setProperty('--piece-s', on ? '1' : String(from.s));
            tile.style.setProperty('--piece-blur', on ? '0px' : '10px');
            tile.style.opacity = on ? '1' : '0';
            if (!on) tile.classList.remove('landed');
        });
    }
    // Small helper for the one-shot effects layered over the page.
    function fx(className, x, y, vars = {}, late = 0) {
        const node = document.createElement('i');
        node.className = className;
        node.style.setProperty('--fx-x', `${x}px`);
        node.style.setProperty('--fx-y', `${y}px`);
        for (const [key, value] of Object.entries(vars)) node.style.setProperty(key, value);
        node.style.animationDelay = `${(Number.parseFloat(vars['--delay']) || 0) - Math.max(0, late)}s`;
        node.addEventListener('animationend', () => node.remove(), { once: true });
        fxLayer.append(node);
        return node;
    }
    // Fires exactly on a note: flash the piece, burst of light, and a thump.
    function hit(beat, late = 0) {
        home.dataset.introBeat = String(beat);
        if (!beat) return;
        const final = beat === tiles.length;
        restart(tiles[beat - 1], 'landed', late);
        burst.classList.toggle('final', final);
        burst.style.left = final ? '50%' : `${(beat - 1) * 20 + 10}%`;
        restart(burst, 'hit', late);
        if (final && late < .65) {
            const rect = logoFace.getBoundingClientRect();
            const homeRect = home.getBoundingClientRect();
            fx('ns-assembly-ring', rect.left + rect.width / 2 - homeRect.left,
                rect.top + rect.height / 2 - homeRect.top, {}, late);
            restart(stage, 'ns-assembly-impact', late);
        } else if (!final) {
            restart(stage, 'thump', late);
        }
    }
    function setControlsEnabled(enabled) {
        features.inert = !enabled;
        if (enabled) enter.removeAttribute('tabindex');
        else enter.setAttribute('tabindex', '-1');
    }
    function updateLift() {
        if (finished) return;
        const rect = logoFace.getBoundingClientRect();
        const transform = getComputedStyle(brand).transform;
        const currentShift = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
        const logoCenter = (rect.top + rect.bottom) / 2 - currentShift;
        const screenCenter = home.getBoundingClientRect().top + home.clientHeight / 2;
        brand.style.setProperty('--intro-lift', `${screenCenter - logoCenter}px`);
    }
    function stopSound() {
        for (const oscillator of oscillators) { try { oscillator.stop(); } catch (_) {} }
        oscillators.clear();
        if (audio && audio.state !== 'closed') audio.close().catch(() => {});
        audio = null;
        graph = null;
        songPlaying = false;
        nowPlaying.hidden = true;
        startupLoad.hidden = true;
        cutAbort?.abort();
        analyser = null;
        pendingKicks = [];
        backgroundKicks = [];
        updateBackground(Infinity);
        logoBuild.style.setProperty('--ns-build-scale', '1');
        stage.style.setProperty('--ns-toolkit-wipe', '102%');
        stage.style.setProperty('--ns-toolkit-visible', '1');
    }
    function removeGate() {
        gate?.remove();
        gate = null;
    }
    function finish() {
        generation++;
        finished = true;
        cancelAnimationFrame(frame);
        removeGate();
        home.dataset.introState = 'done';
        home.dataset.introBeat = '5';
        home.dataset.introCharge = '0';
        document.documentElement.classList.remove('intro-pending');
        setControlsEnabled(true);
        slices.replaceChildren();
        fxLayer.replaceChildren();
        content.classList.remove('impact-shake');
        stage.classList.remove('slam', 'thump', 'ns-assembly-impact');
        stage.classList.remove('ns-kick');
        shine.classList.remove('ns-pre-drop-glint');
        stage.querySelectorAll('.ns-chroma, .ns-glitch').forEach(node => node.remove());
        content.classList.remove('ns-camera');
        home.querySelector('.landing-background')?.classList.remove('ns-background');
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
        limiter.attack.value = CONFIG.synth.compressorAttack;
        limiter.release.value = CONFIG.synth.compressorRelease;
        const master = context.createGain();
        output.connect(limiter).connect(master).connect(context.destination);
        const convolver = context.createConvolver();
        const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * CONFIG.synth.reverb), context.sampleRate);
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
        roomTone.frequency.value = 4200;
        convolver.connect(roomTone).connect(wet).connect(output);
        const delay = context.createDelay(1);
        delay.delayTime.value = CONFIG.synth.echo;
        const feedback = context.createGain();
        feedback.gain.value = .28;
        const echo = context.createGain();
        echo.gain.value = .23;
        delay.connect(feedback).connect(delay);
        delay.connect(echo).connect(output);
        return { output, convolver, delay, master };
    }
    function scheduleNotes(context, origin, playFinal = true) {
        graph ||= createGraph(context);
        MOTIF.notes.forEach((note, index) => {
            const at = origin + noteTimes[index];
            const final = index === lastIndex;
            if (final && !playFinal) return;
            const duration = final ? CONFIG.synth.finalDuration : CONFIG.synth.noteDuration;
            const frequency = 440 * 2 ** ((note.midi + CONFIG.synth.transpose - 69) / 12);
            const envelope = context.createGain();
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(final ? .38 : .3, at + CONFIG.synth.attack);
            envelope.gain.linearRampToValueAtTime(final ? .28 : .22, at + CONFIG.synth.settle);
            envelope.gain.setValueAtTime(final ? .28 : .22, at + (final ? CONFIG.synth.finalHold : CONFIG.synth.hold));
            envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
            const lowpass = context.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.Q.value = .55;
            lowpass.frequency.setValueAtTime(final ? 5800 : 4800, at);
            lowpass.frequency.exponentialRampToValueAtTime(2600, at + duration);
            envelope.connect(lowpass).connect(graph.output);
            const roomSend = context.createGain();
            roomSend.gain.value = final ? 1.1 : .6;
            lowpass.connect(roomSend).connect(graph.convolver);
            if (final) lowpass.connect(graph.delay);
            // A bright saw edge over a clear core keeps the sci-fi glide and room tail.
            const voices = [
                { type: 'triangle', ratio: 1, detune: 0, level: .58 },
                { type: 'sawtooth', ratio: 1, detune: 3, level: .22 },
                { type: 'sine', ratio: 2, detune: 0, level: .16 }
            ];
            if (final) voices.push({ type: 'sine', ratio: .5, detune: 0, level: .08 });
            const previousFrequency = index ? 440 * 2 ** ((MOTIF.notes[index - 1].midi + CONFIG.synth.transpose - 69) / 12) : frequency * .985;
            const vibrato = context.createOscillator();
            vibrato.type = 'sine';
            vibrato.frequency.value = 5.3;
            const vibratoDepth = context.createGain();
            vibratoDepth.gain.setValueAtTime(0, at);
            vibratoDepth.gain.linearRampToValueAtTime(13, at + CONFIG.synth.vibratoFade);
            vibrato.connect(vibratoDepth);
            oscillators.add(vibrato);
            vibrato.onended = () => {
                oscillators.delete(vibrato);
                vibrato.disconnect();
                vibratoDepth.disconnect();
            };
            vibrato.start(at);
            vibrato.stop(at + duration + CONFIG.synth.releasePad);
            let remaining = voices.length;
            voices.forEach(voice => {
                const oscillator = context.createOscillator();
                oscillator.type = voice.type;
                oscillator.frequency.setValueAtTime(previousFrequency * voice.ratio, at);
                oscillator.frequency.exponentialRampToValueAtTime(frequency * voice.ratio, at + CONFIG.synth.glide);
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
                oscillator.stop(at + duration + CONFIG.synth.releasePad);
            });
        });
    }
    // Fetched and decoded as soon as the page loads, so clicking in doesn't wait on a 2+ minute song.
    function prepareCut() {
        cutPromise ||= (async () => {
            const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            if (!Offline) return null;
            const controller = new AbortController();
            cutAbort = controller;
            let timeout;
            const load = (async () => {
                const response = await fetch(CUT.url, { signal: controller.signal });
                if (!response.ok) throw new Error('Cut unavailable');
                cutProgress = .1;
                let data;
                if (response.body?.getReader) {
                    const reader = response.body.getReader();
                    const total = Number(response.headers?.get('content-length')) || 0;
                    const chunks = [];
                    let bytes = 0;
                    for (;;) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        chunks.push(value);
                        bytes += value.byteLength;
                        if (total) cutProgress = .1 + .75 * Math.min(1, bytes / total);
                    }
                    const combined = new Uint8Array(bytes);
                    let cursor = 0;
                    for (const chunk of chunks) { combined.set(chunk, cursor); cursor += chunk.byteLength; }
                    data = combined.buffer;
                } else data = await response.arrayBuffer();
                cutProgress = .9;
                return new Offline(2, 1, 44100).decodeAudioData(data);
            })();
            // A loading watchdog only: no synchronized audio/visual event uses a timer.
            const bounded = new Promise(resolve => {
                timeout = setTimeout(() => { controller.abort(); resolve(null); }, CONFIG.timing.loadTimeout * 1000);
            });
            try { return await Promise.race([load, bounded]); }
            finally { clearTimeout(timeout); cutAbort = null; }
        })().catch(() => null).then(buffer => {
            cutBufferReady = buffer && buffer.duration > CUT.dropFileTime ? buffer : null;
            cutSettled = true;
            cutProgress = 1;
            return cutBufferReady;
        });
        return cutPromise;
    }
    function scheduleMotifTail(context, origin) {
        // Retain the room tail without a heartbeat build or pre-note mute.
        const master = graph.master.gain;
        master.setValueAtTime(1, origin);
        master.setValueAtTime(1, origin + motifTailEnd - .01);
        master.linearRampToValueAtTime(0, origin + motifTailEnd);
    }
    function scheduleCut(context, origin, buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        const volume = context.createGain();
        const at = origin + songAt;
        volume.gain.value = 0;
        const curve = Float32Array.from({ length: 65 }, (_, i) => CUT.volume * (1 - Math.cos(Math.PI * i / 64)) / 2);
        volume.gain.setValueCurveAtTime(curve, at, CUT.fadeIn);
        analyser = context.createAnalyser();
        analyser.fftSize = CUT.fftSize;
        analyser.smoothingTimeConstant = 0;
        spectrum = new Float32Array(analyser.frequencyBinCount);
        source.connect(volume).connect(analyser).connect(context.destination);
        songPlaying = true;
        songEnded = false;
        detector = { mean: 0, previous: null, last: -Infinity, armed: true };
        oscillators.add(source);
        source.onended = () => {
            oscillators.delete(source);
            source.disconnect();
            volume.disconnect();
            analyser?.disconnect();
            songPlaying = false;
            songEnded = true;
            // tick closes the context only after both the audible tail and intro end.
        };
        source.start(at, songOffset);
    }
    function backgroundKick(at) {
        if (!reducedMotion.matches) backgroundKicks.push(at);
    }
    function updateLogoBuild(elapsed) {
        const f = CONFIG.fx;
        const clamp = value => Math.min(1, Math.max(0, value));
        const ease = value => value * value * (3 - 2 * value);
        // Fill the available screen without cutting the enlarged logo off on phones.
        const peak = Math.max(1, Math.min(f.assemblyPeakScale,
            ((home.clientWidth || innerWidth) - 32) / (stage.offsetWidth || 440)));
        const start = Math.min(f.assemblyStartScale, 1 + (peak - 1) * .35);
        let scale = 1;
        if (!reducedMotion.matches && elapsed < revealAt + f.assemblySettle) {
            if (elapsed < impactAt) {
                const progress = clamp((elapsed - (noteTimes[0] - LEAD)) / (impactAt - noteTimes[0] + LEAD));
                scale = start + (peak - start) * ease(progress);
            } else if (elapsed < revealAt) {
                scale = peak;
            } else {
                scale = 1 + (peak - 1) * (1 - ease(clamp((elapsed - revealAt) / f.assemblySettle)));
            }
        }
        // A separate wrapper composes with the slice motion, slam and idle float.
        logoBuild.style.setProperty('--ns-build-scale', String(scale));
        const label = reducedMotion.matches ? 1 : ease(clamp(
            (elapsed - revealAt - f.assemblySettle) / f.toolkitWipe));
        stage.style.setProperty('--ns-toolkit-wipe', `${102 * label}%`);
        stage.style.setProperty('--ns-toolkit-visible', label > 0 ? '1' : '0');
    }
    function updateBackground(elapsed) {
        backgroundKicks = backgroundKicks.filter(at => elapsed - at < CONFIG.fx.backgroundWindow);
        // Audio-clock envelopes overlap by their maximum, never by addition.
        // New kicks do not restart a CSS animation or touch the logo's idle float.
        let envelope = 0;
        for (const at of backgroundKicks) {
            const age = Math.max(0, elapsed - at);
            const value = (1 - Math.exp(-age / CONFIG.fx.backgroundAttack)) *
                Math.exp(-age / CONFIG.fx.backgroundRelease);
            envelope = Math.max(envelope, value);
        }
        background.style.setProperty('--ns-beat-scale', String(1 + envelope * CONFIG.fx.backgroundScale));
        background.style.setProperty('--ns-beat-y', `${-envelope * CONFIG.fx.backgroundTravel}px`);
        background.style.setProperty('--ns-beat-light', String(1 + envelope * CONFIG.fx.backgroundLight));
    }
    function dropFx(late) {
        home.dataset.introDrop = '1';
        if (reducedMotion.matches || late > CONFIG.fx.background) return;
        const homeRect = home.getBoundingClientRect();
        const rect = logoFace.getBoundingClientRect();
        const x = rect.left + rect.width / 2 - homeRect.left;
        const y = rect.top + rect.height / 2 - homeRect.top;
        fx('ns-drop-flash', x, y, {}, late);
        fx('ns-drop-ring', x, y, {}, late);
        fx('ns-drop-ring', x, y, { '--delay': `${CONFIG.fx.ringDelay}s` }, late);
        for (let i = 0; i < 40; i++) {
            const angle = i / 40 * Math.PI * 2;
            const reach = Math.min(innerWidth / 800, 1) * (180 + Math.random() * 330);
            fx('ns-drop-spark', x, y, { '--dx': `${Math.cos(angle) * reach}px`,
                '--dy': `${Math.sin(angle) * reach * .7}px` }, late);
        }
        for (const className of ['ns-chroma', 'ns-glitch']) {
            const node = document.createElement('span');
            node.className = className;
            node.setAttribute('aria-hidden', 'true');
            const artwork = document.createElement('span');
            artwork.className = 'ns-logo-art';
            artwork.style.backgroundImage = `url("${image.currentSrc || image.src}")`;
            node.append(artwork);
            node.style.animationDelay = `${-late}s`;
            node.addEventListener('animationend', () => node.remove(), { once: true });
            logoFace.append(node);
        }
        restart(content, 'ns-camera', late);
        restart(home.querySelector('.landing-background'), 'ns-background', late);
    }
    function detectKick(context, rendered) {
        const knownEnd = songAt + CUT.kicks.at(-1) - songOffset;
        if (!analyser || rendered < knownEnd || !songPlaying) return;
        analyser.getFloatFrequencyData(spectrum);
        const hz = context.sampleRate / analyser.fftSize;
        const first = Math.max(1, Math.ceil(CUT.lowHz / hz));
        const last = Math.min(spectrum.length - 1, Math.floor(CUT.highHz / hz));
        let power = 0;
        for (let bin = first; bin <= last; bin++) power += 10 ** (spectrum[bin] / 10);
        const energy = Math.sqrt(power / Math.max(1, last - first + 1));
        const step = detector.previous === null ? 0 : Math.max(0, rendered - detector.previous);
        const baseline = detector.mean;
        if (detector.previous !== null && detector.armed && energy > CUT.energyFloor &&
            energy > baseline * CUT.threshold && rendered - detector.last >= CUT.refractory) {
            // FFT reports recently rendered samples, not what has reached the speakers.
            const onset = rendered - analyser.fftSize / (2 * context.sampleRate) + CUT.detectorOffset;
            pendingKicks.push(onset);
            detector.last = rendered;
            detector.armed = false;
        }
        if (energy < baseline * CUT.rearmRatio) detector.armed = true;
        const blend = 1 - Math.exp(-step / CUT.energyAverage);
        detector.mean = detector.previous === null ? energy : baseline + (energy - baseline) * blend;
        detector.previous = rendered;
    }
    function seekTransitions(element, late) {
        if (late <= 0) return;
        void element.offsetWidth;
        element.getAnimations().forEach(animation => {
            if ('transitionProperty' in animation) animation.currentTime = late * 1000;
        });
    }
    function begin(withAudio) {
        const run = ++generation;
        cancelAnimationFrame(frame);
        home.dataset.introState = 'waiting';
        home.dataset.introCharge = '0';
        placeTiles(0);
        setControlsEnabled(false);
        const context = withAudio ? audio : null;
        const wallOrigin = performance.now() + CONFIG.timing.scheduleLead * 1000;
        const audioOrigin = context ? context.currentTime + CONFIG.timing.scheduleLead : 0;
        songAt = dropAt = revealAt = doneAt = Infinity;
        let hasCut = false;
        let finalScheduled = false;
        let songEndAt = 0;
        let shownPercent = -1;
        for (const [key, value] of Object.entries(CONFIG.fx)) {
            if (key.startsWith('background') && key !== 'background') continue;
            if (key.startsWith('assembly')) continue;
            home.style.setProperty(`--ns-${key}`, `${value}s`);
        }
        if (context) {
            scheduleNotes(context, audioOrigin);
            scheduleMotifTail(context, audioOrigin);
        }
        home.dataset.introAudio = context ? 'playing' : 'unavailable';
        const events = [
            ...noteTimes.map((at, index) => ({ at, fire: late => hit(index + 1, late), label: `note-${index + 1}` }))
        ].sort((a, b) => a.at - b.at);
        let eventIndex = 0;
        let flyIndex = 0;
        let uiComplete = false;
        let lastState = 'waiting';
        function requiredAssets() {
            return window.NullscapeAssets?.getState() || { ready: false, progress: 0, error: false };
        }
        function scheduleFinalPhase(rendered, assets) {
            if (finalScheduled || !assets.ready || assets.error || (context && !cutSettled)) return;
            // Never schedule in the past: slow loading extends the first phase.
            songAt = Math.max(earliestSongAt, rendered + CONFIG.timing.scheduleLead);
            hasCut = Boolean(context && cutBufferReady);
            if (hasCut) {
                try { scheduleCut(context, audioOrigin, cutBufferReady); }
                catch (_) { hasCut = false; songPlaying = false; songEnded = true; }
            }
            dropAt = songAt + (hasCut ? CUT.dropFileTime - songOffset : CONFIG.loading.fallbackCountdown);
            revealAt = dropAt + (hasCut ? CONFIG.timing.dropHold : 0);
            doneAt = revealAt + CONFIG.timing.uiDuration;
            songEndAt = hasCut ? songAt + cutBufferReady.duration - songOffset : 0;
            if (hasCut) {
                events.push({ at: dropAt - CONFIG.fx.preDropGlintLead,
                    fire: late => { if (late < CONFIG.fx.preDropGlint) restart(shine, 'ns-pre-drop-glint', late); },
                    label: 'pre-drop-glint' }, { at: dropAt, fire: dropFx, label: 'drop' },
                    ...CUT.kicks.filter(at => at >= songOffset).map(at => ({ at: songAt + at - songOffset,
                        fire: () => backgroundKick(songAt + at - songOffset) })));
            } else {
                events.push({ at: dropAt, fire: () => { home.dataset.introDrop = '1'; }, label: 'startup-ready' });
            }
            events.sort((a, b) => a.at - b.at);
            finalScheduled = true;
            if (DEBUG) console.table({ noteFive: impactAt, loadingAt, songAt, dropAt, revealAt, doneAt, hasCut });
        }
        function updateLoading(elapsed, assets) {
            const l = CONFIG.loading;
            const timeFraction = Math.min(1, Math.max(0, (elapsed - loadingAt) / (earliestSongAt - loadingAt)));
            const resources = (Math.min(1, Math.max(0, assets.progress || 0)) + (context ? cutProgress : 1)) / 2;
            let progress = l.assetPortion * Math.min(timeFraction, resources);
            let label = !assets.ready ? 'Loading toolkit' : context && !cutSettled ? 'Loading music' : 'Preparing';
            if (finalScheduled && elapsed >= songAt) {
                const fraction = Math.min(1, Math.max(0, (elapsed - songAt) / (dropAt - songAt)));
                progress = l.assetPortion + (1 - l.assetPortion) * (1 - (1 - fraction) ** 1.4);
                label = hasCut ? 'Starting' : 'Preparing';
            }
            if (elapsed >= dropAt) { progress = 1; label = 'Ready'; }
            const percent = elapsed >= dropAt ? 100 : Math.min(99, Math.floor(progress * 100));
            if (percent !== shownPercent) {
                shownPercent = percent;
                loadPercent.textContent = `${percent}%`;
                startupLoad.setAttribute('aria-valuenow', String(percent));
            }
            loadLabel.textContent = label;
            startupLoad.setAttribute('aria-valuetext', `${label}, ${percent}%`);
            startupLoad.style.setProperty('--ns-load-progress', String(progress));
            startupLoad.hidden = elapsed < loadingAt || elapsed >= dropAt + l.exitHold + l.exit;
            if (!startupLoad.hidden) {
                const logoBottom = logoFace.getBoundingClientRect().bottom - home.getBoundingClientRect().top;
                startupLoad.style.setProperty('--ns-load-top', `${logoBottom + 24}px`);
            }
            const entrance = Math.min(1, Math.max(0, (elapsed - loadingAt) / .18));
            startupLoad.style.setProperty('--ns-load-rise', `${(1 - entrance) * 6}px`);
            startupLoad.style.opacity = String(elapsed < dropAt ? entrance : Math.max(0, 1 - Math.max(0, elapsed - dropAt - l.exitHold) / l.exit));
        }
        scheduleFinalPhase(context ? context.currentTime - audioOrigin : -CONFIG.timing.scheduleLead, requiredAssets());
        function tick() {
            if (run !== generation) return;
            const latency = context ? Math.max(0, (context.baseLatency || 0) + (context.outputLatency || 0)) : 0;
            const rendered = context ? context.currentTime - audioOrigin : (performance.now() - wallOrigin) / 1000;
            const elapsed = rendered - latency - CONFIG.timing.visualOffset;
            const assets = requiredAssets();
            scheduleFinalPhase(rendered, assets);
            updateLogoBuild(elapsed);
            updateLoading(elapsed, assets);
            const showCredit = hasCut && songPlaying && elapsed >= songAt + CUT.creditDelay && elapsed < songEndAt;
            if (showCredit && nowPlaying.hidden) {
                nowPlaying.style.setProperty('--ns-credit-late', `${-Math.max(0, elapsed - songAt - CUT.creditDelay)}s`);
                nowPlaying.hidden = false;
            } else if (!showCredit) nowPlaying.hidden = true;
            if (gate && elapsed >= CONFIG.timing.gateFade) removeGate();
            while (flyIndex < noteTimes.length && elapsed >= noteTimes[flyIndex] - LEAD) {
                placeTiles(++flyIndex);
                seekTransitions(tiles[flyIndex - 1], elapsed - (noteTimes[flyIndex - 1] - LEAD));
            }
            while (eventIndex < events.length && elapsed >= events[eventIndex].at) {
                const event = events[eventIndex++];
                const fired = context ? context.currentTime - audioOrigin - latency - CONFIG.timing.visualOffset :
                    (performance.now() - wallOrigin) / 1000 - CONFIG.timing.visualOffset;
                event.fire(fired - event.at);
                if (event.label) logTiming(event.label, event.at, fired);
            }
            if (context && hasCut) detectKick(context, rendered);
            while (pendingKicks.length && pendingKicks[0] <= elapsed) backgroundKick(pendingKicks.shift());
            updateBackground(elapsed);
            if (!uiComplete) {
                const state = elapsed >= doneAt ? 'done' : elapsed >= revealAt ? 'revealing' :
                    elapsed >= assembledAt ? 'assembled' : flyIndex ? 'playing' : 'waiting';
                if (state !== lastState) {
                    home.style.setProperty('--ns-reveal-late', `${-Math.max(0, elapsed - revealAt)}s`);
                    home.style.setProperty('--ns-assembled-late', `${-Math.max(0, elapsed - assembledAt)}s`);
                    home.dataset.introState = state;
                    lastState = state;
                }
                if (elapsed >= revealAt) setControlsEnabled(true);
                if (elapsed >= doneAt) {
                    uiComplete = true;
                    finished = true;
                    slices.replaceChildren();
                    burst.remove();
                }
            }
            if (uiComplete && (!hasCut || songEnded) && elapsed >= Math.max(motifTailEnd, songEndAt)) {
                stopSound();
                return;
            }
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
        // Gate removal is cosmetic; its fade is driven by the audio-clock tick.
        const context = createAudio();
        prepareCut();
        // resume() is called synchronously inside the click.
        const ready = context ? context.resume().catch(() => {}) : Promise.resolve();
        Promise.all([ready, decoded]).then(() => {
            if (finished) return;
            updateLift();
            begin(Boolean(context) && context.state === 'running');
        }).catch(finish);
    }

    window.addEventListener('resize', updateLift);
    window.addEventListener('nullscape-route-change', event => {
        if (event.detail.route !== 'home') {
            finish();
        }
    });
    reducedMotion.addEventListener('change', event => { if (event.matches) finish(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && started && !finished) finish(); });
    window.addEventListener('pagehide', finish);
    window.addEventListener('nullscape-low-detail-change', event => { if (event.detail.enabled) finish(); });
    let savedLowDetail = false;
    try { savedLowDetail = localStorage.getItem('nullscapeLowDetailMode') === 'true'; } catch (_) {}
    if (reducedMotion.matches || savedLowDetail || document.documentElement.classList.contains('low-detail-mode') ||
        /^#\/?(curses|upgrades|deaths|altars|lobby)\/?$/.test(location.hash)) {
        finish();
        return;
    }
    home.dataset.introState = 'waiting';
    home.dataset.introCharge = '0';
    setControlsEnabled(false);
    logoFace.append(burst, shine);
    home.append(fxLayer);
    placeTiles(0);
    updateLift();
    prepareCut();
    document.documentElement.classList.remove('intro-pending');
    const decoded = image.decode();
    decoded.catch(finish);
    createGate();
    document.fonts.ready.then(updateLift);
})();
