/* Music stays behind a user gesture; the maintenance message also works without JS. */
(() => {
    'use strict';
    if (!document.documentElement.classList.contains('maintenance-active')) return;
    const scriptURL = document.currentScript.src;
    const screen = document.getElementById('maintenanceScreen');
    const gate = screen.querySelector('.maintenance-gate');
    const player = screen.querySelector('.maintenance-player');
    const status = screen.querySelector('.maintenance-audio-status');
    const canvas = screen.querySelector('canvas');
    const paint = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const audio = new Audio(new URL('../assets/audio/subspace-lucidity-b-side.mp3', scriptURL).href);
    audio.loop = true;
    audio.preload = 'none';
    audio.volume = .65;
    let context, analyser, bins, frame, lastTime = 0;
    const levels = new Float32Array(96);
    screen.classList.add('awaiting-entry');
    gate.hidden = false;
    function stopDrawing() {
        cancelAnimationFrame(frame);
        frame = null;
        paint?.clearRect(0, 0, canvas.width, canvas.height);
    }
    function draw(now = performance.now()) {
        if (!paint || !analyser || audio.paused || document.hidden || reduced.matches) return;
        const width = canvas.clientWidth, height = canvas.clientHeight;
        const ratio = Math.min(devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
            canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        }
        paint.setTransform(ratio, 0, 0, ratio, 0, 0);
        paint.clearRect(0, 0, width, height);
        analyser.getByteFrequencyData(bins);
        const count = Math.min(96, Math.floor(width / 5)), step = width / count;
        const dt = Math.min((now - lastTime) / 1000 || 1 / 60, .1);
        lastTime = now;
        paint.fillStyle = '#93d9bd';
        for (let i = 0; i < count; i++) {
            const position = Math.abs((i + .5) / count * 2 - 1);
            const bin = Math.floor(2 + Math.pow(position, 1.7) * (bins.length * .7 - 2));
            const target = Math.pow(bins[bin] / 255, 1.5) * (1 - position * .5);
            levels[i] += (target - levels[i]) * (1 - Math.exp(-dt * (target > levels[i] ? 18 : 6)));
            const bar = Math.max(1, levels[i] * height);
            paint.fillRect(i * step + (step - 1.5) / 2, height - bar, 1.5, bar);
        }
        frame = requestAnimationFrame(draw);
    }
    function startDrawing() { stopDrawing(); draw(); }
    function prepareAudio() {
        if (context) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = .85;
        bins = new Uint8Array(analyser.frequencyBinCount);
        context.createMediaElementSource(audio).connect(analyser);
        analyser.connect(context.destination);
    }
    async function play() {
        status.textContent = '';
        try { prepareAudio(); } catch (_) { /* Native playback remains available. */ }
        try {
            // Both calls happen directly in the click gesture for mobile browsers.
            const resume = context?.resume();
            const playback = audio.play();
            await Promise.all([resume, playback]);
        } catch (_) {
            status.textContent = 'Music could not start. Click anywhere to retry.';
        }
    }
    let entered = false;
    function enter() {
        if (entered) { if (audio.paused) play(); return; }
        entered = true;
        screen.classList.remove('awaiting-entry');
        screen.classList.add('has-entered');
        gate.hidden = true;
        player.hidden = false;
        screen.tabIndex = -1;
        screen.focus({ preventScroll: true });
        play();
    }
    screen.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        enter();
    });
    gate.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); enter(); }
    });
    audio.addEventListener('playing', () => {
        screen.classList.add('music-playing');
        startDrawing();
    });
    audio.addEventListener('pause', () => {
        screen.classList.remove('music-playing'); stopDrawing();
    });
    audio.addEventListener('error', () => {
        status.textContent = 'Music is unavailable. Click anywhere to retry.';
        screen.classList.remove('music-playing'); stopDrawing();
    });
    document.addEventListener('visibilitychange', startDrawing);
    window.addEventListener('nullscape-route-change', event => {
        if (event.detail.route !== 'home') audio.pause();
    });
    reduced.addEventListener('change', startDrawing);
    window.addEventListener('pagehide', () => { audio.pause(); context?.suspend(); });
})();
