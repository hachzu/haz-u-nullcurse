// Local scheduling/lifecycle checks; no browser or audio device required.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../js/intro.js'), 'utf8');

function harness({ reduced = false, failSong = false, deferSong = false, assetsReady = true, noAudio = false, latency = .1 } = {}) {
    const listeners = {};
    const frames = new Map();
    const contexts = [];
    const logs = [];
    let nextFrame = 0;
    let wallNow = 0;
    let releaseAudio;
    const assetState = { ready: assetsReady, progress: assetsReady ? 1 : .2, error: false };
    async function flush() { for (let i = 0; i < 40; i++) await Promise.resolve(); }
    class Element {
        constructor() {
            this.dataset = {}; this.attributes = {}; this.children = []; this.offsetWidth = 440;
            this.style = { setProperty(name, value) { this[name] = value; } };
            const classes = new Set();
            this.classList = { add: name => classes.add(name), remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name) };
        }
        addEventListener() {}
        append(...nodes) { this.children.push(...nodes); }
        replaceChildren() { this.children = []; }
        remove() { this.removed = true; }
        removeAttribute() {}
        setAttribute(key, value) { this.attributes[key] = value; }
        focus() {}
        getAnimations() { return []; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 440, height: 147, bottom: 147 }; }
        querySelector(name) { return elements[name] ||= new Element(); }
        querySelectorAll(name) { return name === 'li' ? tags : []; }
    }
    const elements = {};
    const tags = Array.from({ length: 5 }, () => new Element());
    const image = elements.animatedLogo = new Element();
    image.src = 'assets/branding/Nullscape.png';
    image.decode = () => Promise.resolve();
    const param = () => ({ value: 0, events: [],
        setValueAtTime(v, t) { this.events.push(['set', v, t]); },
        linearRampToValueAtTime(v, t) { this.events.push(['linear', v, t]); },
        exponentialRampToValueAtTime(v, t) { this.events.push(['exponential', v, t]); },
        setValueCurveAtTime(v, t, duration) { this.events.push(['curve', Array.from(v), t, duration]); } });
    class Context {
        constructor() {
            this.currentTime = 0; this.state = 'running'; this.sampleRate = 48000;
            this.baseLatency = .02; this.outputLatency = Math.max(0, latency - .02); this.destination = {};
            this.nodes = []; contexts.push(this);
        }
        node(kind) {
            const node = { kind, gain: param(), frequency: param(), detune: param(), Q: param(),
                threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), delayTime: param(),
                frequencyBinCount: 1024,
                connect(target) { return target; }, disconnect() {},
                start(...args) { this.started = args; }, stop() { this.stopped = true; },
                getFloatFrequencyData(data) { data.fill(this.db ?? -80); } };
            this.nodes.push(node); return node;
        }
        createGain() { return this.node('gain'); }
        createOscillator() { return this.node('oscillator'); }
        createBufferSource() { return this.node('source'); }
        createAnalyser() { return this.node('analyser'); }
        createBiquadFilter() { return this.node('filter'); }
        createDynamicsCompressor() { return this.node('compressor'); }
        createConvolver() { return this.node('convolver'); }
        createDelay() { return this.node('delay'); }
        createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
        resume() { return Promise.resolve(); }
        close() { this.state = 'closed'; return Promise.resolve(); }
    }
    const sandbox = {
        console: { debug: (...args) => logs.push(args), table() {} }, Float32Array, Math, URLSearchParams,
        AbortController, setTimeout, clearTimeout, localStorage: { getItem: () => null },
        location: { hash: '', search: '?introdebug' }, innerWidth: 1000,
        performance: { now: () => wallNow }, getComputedStyle: () => ({ transform: 'none' }),
        matchMedia: () => ({ matches: reduced, addEventListener() {} }),
        requestAnimationFrame: fn => { frames.set(++nextFrame, fn); return nextFrame; },
        cancelAnimationFrame: id => frames.delete(id),
        fetch: async (_, { signal } = {}) => ({ ok: !failSong, arrayBuffer: async () => {
            if (!deferSong) return new ArrayBuffer(1);
            return new Promise((resolve, reject) => {
                releaseAudio = () => resolve(new ArrayBuffer(1));
                signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
            });
        } }),
        document: { getElementById: name => elements[name] ||= new Element(), createElement: () => new Element(),
            documentElement: new Element(), fonts: { ready: Promise.resolve() }, addEventListener() {} },
        window: { AudioContext: noAudio ? undefined : Context,
            NullscapeAssets: { getState: () => ({ ...assetState }) },
            OfflineAudioContext: class { decodeAudioData() { return Promise.resolve({ duration: 150.360816 }); } },
            addEventListener: (name, handler) => { (listeners[name] ||= []).push(handler); } }
    };
    let code = source.replace('window.NullscapeIntro = Object.freeze({ finish });',
        'window.NullscapeIntro = Object.freeze({ finish, start, config: CONFIG });');
    vm.runInNewContext(code, sandbox);
    return { elements, contexts, logs, frames, assets: assetState,
        intro: sandbox.window.NullscapeIntro,
        async start() { sandbox.window.NullscapeIntro.start(); await flush(); this.advance(0); },
        async releaseSong() { releaseAudio?.(); await flush(); },
        advance(elapsed) {
            const context = contexts[0];
            if (context) context.currentTime = elapsed + .05 + context.baseLatency + context.outputLatency;
            else wallNow = (elapsed + .05) * 1000;
            const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn());
        },
        dispatch(name, event = {}) { (listeners[name] || []).forEach(fn => fn(event)); }
    };
}

const LOADING = .5;
const SONG = 5.928125;
const DROP = 10.763125;
const bar = h => h.elements.landingView.children.find(node => node.className === 'ns-startup-load');
const percent = h => Number(bar(h).attributes['aria-valuenow']);
const songSource = h => h.contexts[0]?.nodes.find(node => node.kind === 'source');

test('drop, 100% and background share one cue; the full-size logo holds two seconds before controls', async () => {
    const h = harness(); await h.start();
    const context = h.contexts[0], song = songSource(h);
    assert.equal(h.contexts.length, 1);
    assert.ok(song);
    assert.equal(song.started[1], 0, 'play the supplied opening without the old trim');
    assert.ok(Math.abs(song.started[0] - .05 - SONG) < 1e-9);
    assert.ok(Math.abs(song.started[0] - .05 + 4.835 - DROP) < 1e-9);
    const fade = context.nodes.flatMap(n => n.gain.events).find(e => e[0] === 'curve');
    assert.equal(fade[1][0], 0);
    assert.equal(fade[1].at(-1), .5);
    assert.equal(fade[3], 1.4);
    assert.ok(fade[1].every((v, i, a) => !i || v >= a[i - 1]));
    h.advance(LOADING - .01);
    assert.equal(bar(h).hidden, true);
    h.advance(.509);
    assert.equal(h.logs.find(e => e[1].event === 'note-1')[1].differenceMs, 9);
    assert.equal(bar(h).hidden, false, 'show the bar on the first note');
    assert.equal(bar(h).style['--ns-load-top'], '171px', 'anchor 24px beneath the visible logo');
    h.advance(LOADING + .1);
    assert.equal(bar(h).hidden, false);
    assert.ok(percent(h) > 0 && percent(h) < 10);
    h.advance(3.08);
    assert.equal(h.logs.find(e => e[1].event === 'note-5')[1].scheduled, 3.078125);
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    assert.ok(context.nodes.some(n => n.kind === 'oscillator' && n.type === 'sawtooth'));
    h.advance(SONG + .001);
    assert.equal(percent(h), 85);
    h.advance(DROP - .001);
    assert.equal(percent(h), 99);
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    assert.notEqual(h.elements.landingView.dataset.introDrop, '1');
    h.advance(DROP + .012);
    assert.equal(percent(h), 100);
    assert.equal(h.elements.landingView.dataset.introDrop, '1');
    assert.equal(h.elements.landingView.dataset.introState, 'assembled');
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    assert.equal(Number(h.elements['.ns-logo-build'].style['--ns-build-scale']), 1.25);
    assert.equal(h.elements['.landing-background'].classList.contains('ns-background'), true);
    const drop = h.logs.find(e => e[1].event === 'drop')[1];
    assert.ok(Math.abs(drop.scheduled - DROP) < 1e-6);
    assert.equal(drop.differenceMs, 12);
    h.advance(DROP + 1.6);
    assert.equal(bar(h).hidden, true);
    assert.equal(h.elements.landingView.dataset.introState, 'assembled');
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    assert.equal(Number(h.elements['.ns-logo-build'].style['--ns-build-scale']), 1.25);
    h.advance(DROP + 1.999);
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    h.advance(DROP + 2.01);
    assert.equal(h.elements.landingView.dataset.introState, 'revealing');
    assert.equal(h.elements['.landing-features-viewport'].inert, false);
    h.advance(DROP + 3.6);
    assert.equal(h.elements.landingView.dataset.introState, 'done');
    assert.equal(context.state, 'running', 'finishing the bar must not stop the music');
    song.onended();
    h.advance(SONG + 150.360816 - .02);
    assert.equal(context.state, 'running', 'keep the audible output tail alive');
    h.advance(SONG + 150.360816 + .01);
    assert.equal(context.state, 'closed');
});

test('slow required assets extend loading; no fake completion or early audio', async () => {
    const h = harness({ assetsReady: false }); await h.start();
    h.advance(10);
    assert.equal(songSource(h), undefined);
    assert.ok(percent(h) < 85);
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    h.assets.ready = true; h.assets.progress = 1;
    h.advance(10.1);
    const song = songSource(h);
    assert.ok(song.started[0] >= h.contexts[0].currentTime + .049);
    const drop = song.started[0] - .05 + 4.835;
    h.advance(drop - .001);
    assert.equal(percent(h), 99);
    h.advance(drop + .01);
    assert.equal(percent(h), 100);
    assert.equal(h.elements['.landing-features-viewport'].inert, true);
    h.advance(drop + 2.01);
    assert.equal(h.elements['.landing-features-viewport'].inert, false);
    h.intro.finish();
});

test('audio download can finish late without stalling the five-note logo or desynchronizing the drop', async () => {
    const h = harness({ deferSong: true }); await h.start();
    h.advance(4.2);
    assert.equal(h.logs.filter(e => /^note-/.test(e[1].event)).length, 5);
    h.advance(8);
    assert.equal(songSource(h), undefined);
    assert.ok(percent(h) < 85);
    await h.releaseSong();
    h.advance(8.1);
    const song = songSource(h);
    assert.ok(song.started[0] >= h.contexts[0].currentTime + .049);
    const drop = song.started[0] - .05 + 4.835;
    h.advance(drop + .01);
    assert.equal(percent(h), 100);
    assert.equal(h.logs.filter(e => e[1].event === 'drop').length, 1);
    h.intro.finish();
});

test('leaving the landing cancels scheduled audio, loading UI and future drop cues', async () => {
    const h = harness(); await h.start();
    h.advance(LOADING + .2);
    assert.equal(bar(h).hidden, false);
    h.dispatch('nullscape-route-change', { detail: { route: 'curses' } });
    assert.equal(h.contexts[0].state, 'closed');
    assert.equal(h.frames.size, 0);
    assert.equal(bar(h).hidden, true);
    assert.ok(h.contexts[0].nodes.filter(n => n.started).every(n => n.stopped));
});

test('one glint precedes the drop and the clean Toolkits wipe follows button reveal', async () => {
    const h = harness(); await h.start();
    h.advance(DROP - 1.01);
    assert.ok(!h.logs.some(e => e[1].event === 'pre-drop-glint'));
    h.advance(DROP - .99);
    const shine = h.elements['.ns-logo-face'].children.find(n => n.className === 'logo-shine');
    assert.equal(shine.classList.contains('ns-pre-drop-glint'), true);
    h.advance(DROP + .5);
    assert.equal(h.elements.logoStage.style['--ns-toolkit-visible'], '0');
    assert.equal(Number(h.elements['.ns-logo-build'].style['--ns-build-scale']), 1.25);
    h.advance(DROP + 3.3);
    const wipe = Number.parseFloat(h.elements.logoStage.style['--ns-toolkit-wipe']);
    assert.ok(wipe > 0 && wipe < 102);
    h.advance(DROP + 3.8);
    assert.equal(h.elements.logoStage.style['--ns-toolkit-wipe'], '102%');
    assert.equal(h.logs.filter(e => e[1].event === 'pre-drop-glint').length, 1);
    assert.equal(Number(h.elements['.ns-logo-build'].style['--ns-build-scale']), 1);
    h.intro.finish();
});

test('song credit still appears three seconds after audible playback', async () => {
    const h = harness(); await h.start();
    const credit = h.elements.landingView.children.find(n => n.className === 'ns-now-playing');
    assert.equal(credit.children[0].textContent, 'A Delightful New Death');
    assert.equal(credit.children[1].textContent, 'by Digital Descendant');
    h.advance(SONG + 2.99);
    assert.equal(credit.hidden, true);
    h.advance(SONG + 3.01);
    assert.equal(credit.hidden, false);
    h.dispatch('pagehide');
    assert.equal(credit.hidden, true);
    assert.equal(h.contexts[0].state, 'closed');
});

test('missing MP3 completes the startup safely without a fake music drop', async () => {
    const h = harness({ failSong: true }); await h.start();
    assert.ok(h.contexts[0].nodes.some(n => n.kind === 'oscillator'));
    assert.equal(songSource(h), undefined);
    h.advance(12);
    assert.equal(percent(h), 100);
    assert.equal(h.elements.landingView.dataset.introState, 'done');
    assert.equal(h.elements['.landing-features-viewport'].inert, false);
    assert.ok(!h.logs.some(e => e[1].event === 'drop'));
    assert.equal(h.contexts[0].state, 'closed');
});

test('no AudioContext still reaches usable controls; reduced motion skips everything', async () => {
    const h = harness({ noAudio: true }); await h.start(); h.advance(12);
    assert.equal(h.elements.landingView.dataset.introState, 'done');
    assert.equal(h.elements['.landing-features-viewport'].inert, false);
    const skipped = harness({ reduced: true });
    assert.equal(skipped.elements.landingView.dataset.introState, 'done');
    assert.equal(skipped.contexts.length, 0);
    assert.equal(skipped.frames.size, 0);
    assert.equal(bar(skipped).hidden, true);
});

test('detected music kicks compensate speaker latency and leave logo float untouched', async () => {
    const h = harness(); await h.start();
    h.advance(21.2);
    h.contexts[0].nodes.find(n => n.kind === 'analyser').db = -10;
    h.advance(21.22);
    assert.equal(Number(h.elements['.landing-background'].style['--ns-beat-scale']), 1);
    h.advance(21.31);
    assert.ok(Number(h.elements['.landing-background'].style['--ns-beat-scale']) > 1);
    assert.equal(h.elements.logoStage.classList.contains('ns-kick'), false);
    h.advance(23);
    assert.equal(Number(h.elements['.landing-background'].style['--ns-beat-scale']), 1);
    h.intro.finish();
});

test('high output latency and a missed frame cannot finish the bar early; effects seek to the musical cue', async () => {
    const h = harness({ latency: .35 }); await h.start();
    h.advance(DROP - .02);
    assert.equal(percent(h), 99);
    assert.notEqual(h.elements.landingView.dataset.introDrop, '1');
    h.advance(DROP + .055);
    assert.equal(percent(h), 100);
    assert.equal(h.logs.find(e => e[1].event === 'drop')[1].differenceMs, 55);
    assert.ok(Math.abs(Number.parseFloat(h.elements['.landing-content'].style['--ns-late']) + .055) < 1e-6);
    h.intro.finish();
});

test('exiting while the replacement MP3 downloads never starts playback later', async () => {
    const h = harness({ deferSong: true }); await h.start();
    h.advance(5);
    h.dispatch('pagehide');
    await h.releaseSong();
    h.advance(20);
    assert.equal(songSource(h), undefined);
    assert.equal(h.frames.size, 0);
    assert.equal(bar(h).hidden, true);
    assert.equal(h.contexts[0].state, 'closed');
});

