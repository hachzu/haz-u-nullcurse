/* Explicit shared toolkit data. Routes, focus, usernames and feedback stay local. */
(function () {
    'use strict';
    const core = window.NullscapeLinkCore;
    const clone = value => JSON.parse(JSON.stringify(value));
    const byId = id => document.getElementById(id);
    const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const entries = value => Object.entries(object(value));
    const bounded = (n, min, max, fallback = min) => Number.isFinite(Number(n)) ? Math.min(max, Math.max(min, Number(n))) : fallback;
    const mapObject = map => Object.fromEntries(map);
    const setObject = set => Object.fromEntries([...set].map(key => [key, true]));
    function capture() {
        return {
            run: { ...runState, level: getLevel(), playerCount: getPlayerCount(),
                activeEnemies: mapObject(runState.activeEnemies), activeCurses: setObject(runState.activeCurses),
                curseStacks: mapObject(runState.curseStacks), medalCurseValues: mapObject(runState.medalCurseValues),
                medalPurified: setObject(runState.medalPurified) },
            upgrades: { ...upgradeState, owned: mapObject(upgradeState.owned), pending: mapObject(upgradeState.pending) },
            deaths: { startLevel: deathState.startLevel, currentLevel: deathState.currentLevel,
                unlimitedDeaths: deathState.unlimitedDeaths,
                players: Object.fromEntries(deathState.players.map(p => [p.id, { id: p.id, name: p.name }])),
                log: Object.fromEntries(deathState.log.map(p => [p.id, p])) },
            altars: { gifts: protectionAltarGiftsInput?.value || '0', level: selectedProtectionAltarLevel,
                selected: selectedPurificationAltarCurse, pending: pendingPurificationAltarCurse,
                curses: setObject(purificationAltarCurses) },
            // Text and its letter styles travel as a single field to keep them aligned.
            lobby: { content: [lobbySnapshot()], typingStyle: clone(lobbyEditor.typingStyle),
                editingOutline: lobbyEditor.editingOutline },
            lobbyPicker: window.NullscapeLobbyPicker?.capture() || {},
            settings: { curses: { ...curseVisibilityState }, enemies: { ...enemyVisibilityState },
                medals: clone(medalDisplayState), search: byId('activeCurseSearch')?.value || '',
                gameSettingsOpen: document.querySelector('.game-settings-disclosure').open,
                lowDetail: window.NullscapeLowDetail.isEnabled(), muted: window.NullscapeSound.isMuted(),
                particles: window.NullscapeParticles?.getConfig() || {} }
        };
    }
    // Copy only existing primitive settings, never methods or arbitrary properties.
    function primitives(target, source, omit = []) {
        for (const key of Object.keys(target)) {
            if (omit.includes(key) || !Object.hasOwn(object(source), key)) continue;
            const value = source[key];
            if (['string', 'number', 'boolean'].includes(typeof target[key]) && typeof value === typeof target[key]
                && (typeof value !== 'number' || Number.isFinite(value))) target[key] = value;
        }
    }
    function style(source) {
        const value = object(source), result = blankTypingStyle();
        for (const key of ['bold', 'italic', 'underline', 'strikethrough', 'ring']) result[key] = value[key] === true;
        for (const key of ['color', 'ringColor']) if (/^#[\da-f]{6}$/i.test(value[key])) result[key] = value[key];
        for (const key of ['fade', 'ringFade']) result[key] = bounded(value[key], 0, 1, 0);
        if (['round', 'miter', 'bevel'].includes(value.ringJoin)) result.ringJoin = value.ringJoin;
        const font = LOBBY_FONT_CATALOG.find(font => font.face === value.font?.face);
        if (font) result.font = { ...font };
        return result;
    }
    function preserveFocus(action) {
        const active = document.activeElement;
        const id = active?.id;
        const index = active?.classList.contains('death-player-name-input')
            ? [...document.querySelectorAll('.death-player-name-input')].indexOf(active) : -1;
        let start, end;
        try { start = active?.selectionStart; end = active?.selectionEnd; } catch (_) {}
        action();
        const next = id ? byId(id) : index >= 0 ? document.querySelectorAll('.death-player-name-input')[index] : null;
        if (next && (next !== active || document.activeElement !== next)) next.focus({ preventScroll: true });
        if (next && typeof start === 'number') {
            try { next.setSelectionRange(start, end); } catch (_) {}
        }
    }
    function apply(snapshot, changed) {
        const roots = new Set(Object.keys(changed).map(key => {
            try { return JSON.parse(decodeURIComponent(key))[0]; } catch (_) { return ''; }
        }));
        const s = snapshot;
        preserveFocus(() => {
            if (roots.has('run')) {
                const data = object(s.run);
                runState.level = Math.floor(bounded(data.level, 1, 100000));
                if (['Casual', 'Standard', 'Extreme'].includes(data.difficulty)) runState.difficulty = data.difficulty;
                runState.chaosMode = data.chaosMode === true;
                runState.chaosPlusMode = runState.chaosMode && data.chaosPlusMode === true;
                const enemyNames = new Set(enemies.map(x => x.name));
                const validCurse = name => Boolean(findCurseByName(name));
                runState.activeEnemies = new Map(entries(data.activeEnemies).filter(([n]) => enemyNames.has(n)).map(([n,v]) => [n, Math.floor(bounded(v, 1, 1000))]));
                runState.activeCurses = new Set(entries(data.activeCurses).filter(([n,v]) => v === true && validCurse(n)).map(([n]) => n));
                for (const name of ['curseStacks', 'medalCurseValues']) {
                    runState[name] = new Map(entries(data[name]).filter(([n]) => validCurse(n)).map(([n,v]) => [n, bounded(v, 0, 1000000)]));
                }
                runState.medalPurified = new Set(entries(data.medalPurified).filter(([n,v]) => v === true && validCurse(n)).map(([n]) => n));
                byId('levelInput').value = runState.level;
                byId('playerCountInput').value = Math.floor(bounded(data.playerCount, 1, 100));
            }
            if (roots.has('upgrades')) {
                const data = object(s.upgrades);
                primitives(upgradeState, data, ['mode']);
                if (['solo', 'duo', 'party', 'partyplus'].includes(data.mode)) upgradeState.mode = data.mode;
                upgradeState.goldenGifts = bounded(data.goldenGifts, -1000000000, 1000000000, 0);
                upgradeState.owned = migrateUpgradeEntries(entries(data.owned));
                upgradeState.pending = migrateUpgradeEntries(entries(data.pending));
                saveUpgradeState();
            }
            if (roots.has('deaths')) {
                const data = object(s.deaths);
                deathState.startLevel = Math.floor(bounded(data.startLevel, 1, 100000));
                deathState.currentLevel = Math.floor(bounded(data.currentLevel, 1, 100000));
                deathState.unlimitedDeaths = data.unlimitedDeaths === true;
                deathState.players = entries(data.players).slice(0, 50).sort(([a], [b]) => a.localeCompare(b)).map(([id, p]) => ({
                    id, name: String(p.name || '').slice(0, 100), deaths: bounded(p.deaths, 0, 1000000),
                    levelDeaths: {}
                }));
                const playerIds = new Set(deathState.players.map(p => p.id));
                deathState.log = entries(data.log).filter(([,p]) => p && playerIds.has(p.playerId)).map(([id,p]) => ({
                    id, playerId: p.playerId, playerName: String(p.playerName || '').slice(0, 100),
                    level: bounded(p.level, 1, 100000), timestamp: bounded(p.timestamp, 0, Number.MAX_SAFE_INTEGER)
                })).sort((a,b) => a.timestamp - b.timestamp);
                // Log IDs merge independently, so simultaneous deaths are both counted.
                deathState.players.forEach(player => {
                    player.deaths = 0;
                    deathState.log.filter(entry => entry.playerId === player.id).forEach(entry => {
                        player.deaths++;
                        player.levelDeaths[entry.level] = (player.levelDeaths[entry.level] || 0) + 1;
                    });
                });
                saveDeathState();
                renderDeathTracker();
            }
            if (roots.has('altars')) {
                const data = object(s.altars);
                if (protectionAltarGiftsInput) protectionAltarGiftsInput.value = bounded(data.gifts, 0, 1000000000, 0);
                selectedProtectionAltarLevel = data.level === null ? null : bounded(data.level, 1, 100000);
                selectedPurificationAltarCurse = findCurseByName(data.selected) ? data.selected : null;
                pendingPurificationAltarCurse = findCurseByName(data.pending) ? data.pending : null;
                purificationAltarCurses.clear();
                entries(data.curses).forEach(([n,v]) => { if (v === true && findCurseByName(n)) purificationAltarCurses.add(n); });
                renderProtectionAltarCalculator();
                renderPurificationAltarCalculator();
            }
            if (roots.has('lobby')) {
                const data = object(s.lobby);
                const content = data.content?.[0];
                if (content && typeof content.text === 'string' && Array.isArray(content.letters)) {
                    const text = content.text.slice(0, LOBBY_TITLE_MAX_LENGTH);
                    restoreLobbySnapshot({ text, letters: Array.from({ length: text.length }, (_, i) => content.letters[i] ? style(content.letters[i]) : null) });
                    previousLobbyText = text;
                    pushLobbySnapshot();
                }
                lobbyEditor.typingStyle = style(data.typingStyle);
                lobbyEditor.editingOutline = data.editingOutline === true;
                syncLobbyToolbar();
                lobbySelectionSyncCallbacks.forEach(fn => fn());
            }
            if (roots.has('lobbyPicker') || roots.has('lobby')) {
                window.NullscapeLobbyPicker?.apply(object(s.lobbyPicker));
            }
            if (roots.has('settings')) {
                const data = object(s.settings);
                primitives(curseVisibilityState, data.curses);
                primitives(enemyVisibilityState, data.enemies);
                primitives(medalDisplayState, data.medals);
                medalDisplayState.collapsedLevels = Array.isArray(data.medals?.collapsedLevels)
                    ? data.medals.collapsedLevels.filter(x => typeof x === 'string').slice(0, 1000) : [];
                byId('activeCurseSearch').value = String(data.search || '').slice(0, 200);
                document.querySelector('.game-settings-disclosure').open = data.gameSettingsOpen !== false;
                if (typeof data.lowDetail === 'boolean' && data.lowDetail !== window.NullscapeLowDetail.isEnabled()) window.NullscapeLowDetail.setEnabled(data.lowDetail);
                if (typeof data.muted === 'boolean' && data.muted !== window.NullscapeSound.isMuted()) window.NullscapeSound.setMuted(data.muted);
                if (window.NullscapeParticles) {
                    const config = window.NullscapeParticles.getConfig();
                    primitives(config, data.particles);
                    if (JSON.stringify(config) !== JSON.stringify(window.NullscapeParticles.getConfig())) window.NullscapeParticles.setConfig(config);
                }
                saveCurseVisibilityState(); saveEnemyVisibilityState(); saveMedalDisplayState();
                updateCurseVisibilityToggleUI(); updateEnemyVisibilityToggleUI();
                updateMedalDisplayToggleUI(); updateDelusionsDisplay(); updateCurseListModeUI();
                updateSearchClearVisibility();
            }
            if (roots.has('upgrades') || roots.has('run') || roots.has('settings')) {
                render();
                refreshUpgradePanel();
            }
        });
    }
    window.NullscapeLinkState = { capture: () => core.flatten(capture()), apply };
}());
