const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/upgrades.js'), 'utf8');
function harness() {
    const enemies = new Map();
    const context = vm.createContext({
        runState: { level: 30, difficulty: 'Standard' },
        getPlayerCount: () => 4, getEnemyCount: name => enemies.get(name) || 0,
        hasEnemy: name => enemies.has(name), hasCurse: () => false,
        localStorage: { setItem() {} }, console,
        playSelectSound() {}, playRemoveSound() {}, playPurifySound() {}, refreshUpgradePanel() {}, renderUpgradeGrid() {}
    });
    vm.runInContext(source.slice(0, source.indexOf('/* Source: upgrade-calculator-view.js */')), context);
    return { context, enemies, run: code => vm.runInContext(code, context) };
}
test('current catalog includes all 15 additions and excludes Blossom and removed upgrades', () => {
    const h = harness();
    const names = Array.from(h.run('upgradesList.map(x => x.name)'));
    assert.equal(names.length, 50);
    for (const name of ['Star Marts', 'Altar Boons', 'Health Insurance', 'Spring Shoes', 'Birthday Pony', 'Soul Tracers', 'Propeller Hat', 'Debuff Magnet', 'Aggro Magnet', 'Shadow Cloak', 'Fleeting Fate', 'Jet Boosters', 'Magnified Levels', 'Transient Pennon', 'Quixotic Wing']) assert(names.includes(name), name);
    for (const name of ['Blossom', 'Real Wings', 'Orb', 'Radar Module: Players', 'Last Robloxian Standing', 'Tria Orb', 'Large Grapple Points']) assert(!names.includes(name), name);
    for (const name of names) {
        const slug = name.split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join('');
        const bytes = fs.readFileSync(path.join(__dirname, '../assets/upgrades', slug + '.png'));
        assert.equal(bytes.subarray(1, 4).toString(), 'PNG', name);
    }
});
test('renamed saved ownership and selections migrate without duplicating stacks or reviving removed entries', () => {
    const h = harness();
    const migrated = h.run(`migrateUpgradeEntries([['Last Robloxian Standing',1],['Final Stand',1],['Tria Orb',1],['Large Grapple Points',1],['Radar Module : Altars',1],['Orb',1],['Blossom',1],['Altar Boons',2]])`);
    assert.equal(migrated.size, 4);
    assert.equal(migrated.get('Final Stand'), 1);
    assert.equal(migrated.get('Tria Orbs'), 1);
    assert.equal(migrated.get('Larger Grapple Points'), 1);
    assert.equal(migrated.get('Radar Module: Altars'), 1);
});
test('unconfirmed prices remain visible, cannot be queued even in free planning, and never affect totals', () => {
    const h = harness();
    h.run(`upgradeState.progressive = false; upgradeState.progressiveHideLocked = true; upgradeState.goldenGifts = 1000000;`);
    assert.equal(h.run('upgradesList.filter(x => x.pricePending).length'), 13);
    assert.equal(h.run(`upgradesList.filter(x => x.pricePending).every(item => {
        setStackTarget(item,1); adjustOwnedStackWithShortcut(item);
        return isUpgradeUnavailable(item) && !isUpgradeHiddenByLevelFilter(item) && getUpgradePendingCost(item) === 0;
    })`), true);
    assert.equal(h.run('upgradeState.pending.size'), 0);
    assert.equal(h.run('upgradeState.owned.size'), 0);
    h.run('ownAllUpgrades()');
    assert.equal(h.run('upgradesList.filter(x => x.pricePending).some(x => upgradeState.owned.has(x.name))'), false);
});
test('wiki requirements and level thresholds govern new and existing purchases', () => {
    const h = harness();
    h.run(`globalThis.item = name => upgradesList.find(x => x.name === name); runState.level = 7;`);
    h.enemies.set('Mart', 1);
    assert.equal(h.run(`isUpgradeUnavailable(item('Star Marts'))`), true);
    h.run('runState.level = 8');
    assert.equal(h.run(`isUpgradeUnavailable(item('Star Marts'))`), false);
    h.enemies.clear();
    assert.equal(h.run(`isUpgradeUnavailable(item('Star Marts'))`), true);
    h.run('runState.level = 30');
    h.enemies.set('Cadence', 1);
    assert.equal(h.run(`isUpgradeRequirementMet(item('Radar Module: Instruments'))`), false);
    h.run(`upgradeState.owned.set('Radar',1)`);
    assert.equal(h.run(`isUpgradeRequirementMet(item('Radar Module: Instruments'))`), true);
    assert.equal(h.run(`isUpgradeRequirementMet(item('Gift Idol'))`), false);
    h.run(`upgradeState.owned.set('Gift Magnet',1)`);
    assert.equal(h.run(`isUpgradeRequirementMet(item('Gift Idol'))`), true);
    h.run(`runState.level = 10; upgradeState.owned.set('Defuse Kit',3)`);
    assert.equal(h.run(`isUpgradeUnavailable(item('Subspacial Barrier'))`), false);
    h.run(`runState.difficulty = 'Casual'; upgradeState.owned.clear()`);
    assert.equal(h.run(`isUpgradeUnavailable(item('Subspacial Barrier'))`), true);
    h.run('runState.level = 15');
    assert.equal(h.run(`isUpgradeUnavailable(item('Subspacial Barrier'))`), false);
});
test('tier pricing, solo/party scaling and exclusive upgrades retain their verified behavior', () => {
    const h = harness();
    h.run(`globalThis.item = name => upgradesList.find(x => x.name === name)`);
    assert.equal(h.run(`getIncrementalCost(item('Business License'),0,2)`), 263);
    assert.equal(h.run(`computeStackPrice(item('Star Marts'),1)`), 300);
    assert.equal(h.run(`isUpgradeContextHidden(item('Final Stand'))`), true);
    h.run(`upgradeState.mode = 'party'`);
    assert.equal(h.run(`computeStackPrice(item('Star Marts'),1)`), 600);
    assert.equal(h.run(`isUpgradeContextHidden(item('Final Stand'))`), false);
    assert.equal(h.run(`isUpgradeContextHidden(item('Adrenaline'))`), true);
});
