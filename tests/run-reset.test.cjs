const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('resetting a run keeps its settings while clearing run progress', () => {
    const tracker = fs.readFileSync(path.join(__dirname, '../js/tracker.js'), 'utf8');
    const upgrades = fs.readFileSync(path.join(__dirname, '../js/upgrades.js'), 'utf8');
    const resetHandler = tracker.slice(tracker.indexOf('attachHoldAction(document.getElementById("resetButton")'), tracker.indexOf('attachHoldAction(document.getElementById("removeAllCursesButton")'));
    const shopStart = upgrades.indexOf('function resetUpgradeShopState(');
    const shopReset = upgrades.slice(shopStart, upgrades.indexOf('\n}', shopStart) + 2);

    for (const mode of ['solo', 'duo', 'party', 'partyplus']) {
        const elements = { levelInput: {}, playerCountInput: {}, resetButton: {} };
        const context = vm.createContext({
            document: { getElementById: id => elements[id] },
            runState: { level: 20, difficulty: 'Extreme', chaosMode: true, chaosPlusMode: true,
                activeEnemies: new Map([['enemy', 1]]), activeCurses: new Set(['curse']), activeDelusions: new Set(['delusion']),
                curseStacks: new Map([['curse', 1]]), temporaryCurseExpiries: new Map([['curse', 25]]),
                medalCurseValues: new Map([['curse', 1]]), medalPurified: new Set(['curse']) },
            upgradeState: { mode, pending: new Set(['upgrade']), owned: new Map([['upgrade', 1]]), goldenGifts: 10 },
            temporaryCurseDuration: {}, activeCurseSearchInput: null,
            setTemporaryCurseMode() {}, saveUpgradeState() {}, refreshUpgradePanel() {}, render() {},
            attachHoldAction: (_button, callback) => callback()
        });
        vm.runInContext(shopReset + resetHandler, context);
        assert.equal(context.runState.difficulty, 'Extreme');
        assert.equal(context.runState.chaosMode, true);
        assert.equal(context.runState.chaosPlusMode, true);
        assert.equal(context.upgradeState.mode, mode);
        assert.equal(context.runState.level, 1);
        assert.equal(context.runState.activeCurses.size, 0);
        assert.equal(context.runState.activeEnemies.size, 0);
        assert.equal(context.upgradeState.owned.size, 0);
        assert.equal(context.upgradeState.goldenGifts, 0);
    }
});
