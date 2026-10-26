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
    assert.equal(migrated.size, 5);
    assert.equal(migrated.get('Altar Boons'), 2);
    assert.equal(migrated.get('Final Stand'), 1);
    assert.equal(migrated.get('Tria Orbs'), 1);
    assert.equal(migrated.get('Larger Grapple Points'), 1);
    assert.equal(migrated.get('Radar Module: Altars'), 1);
});
test('synced catalog has prices for every upgrade and retains protection for future unknown prices', () => {
    const h = harness();
    h.run(`upgradeState.progressive = false; upgradeState.progressiveHideLocked = true; upgradeState.goldenGifts = 1000000;`);
    assert.equal(h.run('upgradesList.filter(x => x.pricePending).length'), 0);
    h.run(`upgradesList.push({ name: 'Unknown test upgrade', price: null, pricePending: true, maxStack: 1, level: 1 })`);
    assert.equal(h.run(`upgradesList.filter(x => x.pricePending).every(item => {
        setStackTarget(item,1); adjustOwnedStackWithShortcut(item);
        return isUpgradeUnavailable(item) && !isUpgradeHiddenByLockedFilter(item) && getUpgradePendingCost(item) === 0;
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
    assert.equal(h.run(`isUpgradeUnavailable(item('Star Marts'))`), false);
    assert.equal(h.run(`isEnemyUpgradeDependencyPresent({type:'enemy',name:'Mart'})`), false);
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
    assert.equal(h.run(`getIncrementalCost(item('Business License'),0,2)`), 235);
    assert.equal(h.run(`computeStackPrice(item('Star Marts'),1)`), 400);
    assert.equal(h.run(`isUpgradeContextHidden(item('Final Stand'))`), true);
    h.run(`upgradeState.mode = 'party'`);
    assert.equal(h.run(`computeStackPrice(item('Star Marts'),1)`), 900);
    assert.equal(h.run(`isUpgradeContextHidden(item('Final Stand'))`), false);
    assert.equal(h.run(`isUpgradeContextHidden(item('Adrenaline'))`), true);
});

test('reference prices select the correct Solo and difficulty variants', () => {
    const h = harness();
    h.run(`globalThis.item = name => upgradesList.find(x => x.name === name)`);
    for (const [difficulty, mode, name, tier, expected] of [
        ['Standard', 'solo', 'Altar Boons', 2, 1000],
        ['Casual', 'solo', 'Altar Boons', 2, 900],
        ['Extreme', 'solo', 'Altar Boons', 2, 1200],
        ['Casual', 'solo', 'Radar', 1, 100],
        ['Extreme', 'solo', 'Radar', 1, 150],
        ['Casual', 'solo', 'Gift Magnet', 2, 2000],
        ['Extreme', 'solo', 'Shield', 1, 2000],
        ['Extreme', 'party', 'Shield', 1, 8000],
        ['Standard', 'solo', 'Jet Boosters', 1, 6750],
        ['Standard', 'solo', 'Transient Pennon', 1, 30000],
        ['Standard', 'solo', 'Quixotic Wing', 1, 30000]
    ]) {
        h.run(`runState.difficulty = ${JSON.stringify(difficulty)}; upgradeState.mode = ${JSON.stringify(mode)}`);
        assert.equal(h.run(`computeStackPrice(item(${JSON.stringify(name)}),${tier})`), expected, `${difficulty} ${mode} ${name}`);
    }
});

test('rounds each stack separately and applies Party+ and Nothing before rounding', () => {
    const h = harness();
    h.run(`globalThis.item = name => upgradesList.find(x => x.name === name);
        getPlayerCount = () => 2; upgradeState.mode = 'duo';`);
    assert.equal(h.run(`getIncrementalCost(item('Swiftness Ring'),0,3)`), 342);
    assert.equal(h.run(`getIncrementalCost(item('Swiftness Ring'),1,2)`), 114);
    h.run(`upgradeState.mode = 'partyplus'; hasCurse = name => name === 'Nothing'`);
    assert.equal(h.run(`computeStackPrice(item('Swiftness Ring'),1)`), 86);
    h.run(`getPlayerCount = () => 9; upgradeState.mode = 'party'; hasCurse = () => false`);
    assert.equal(h.run(`computeStackPrice(item('Swiftness Ring'),1)`), 214);
    h.run(`getPlayerCount = () => 1; upgradeState.mode = 'partyplus'`);
    assert.equal(h.run(`computeStackPrice(item('Swiftness Ring'),1)`), 80);
});

test('available upgrades precede locked upgrades while each group keeps ascending level order', () => {
    const h = harness();
    vm.runInContext(source.slice(source.indexOf('function compareUpgradesByLevel('), source.indexOf('function renderUpgradeGrid(')), h.context);
    h.run(`runState.level = 15;
        globalThis.entries = ['Radar Module: Enemies', 'Swiftness Ring', 'Shield', 'Grapple Points', 'Panic Necklace']
            .map(name => ({ item: upgradesList.find(item => item.name === name), row: name }));`);
    assert.deepEqual(Array.from(h.run('sortAvailableUpgradeEntries(entries).map(entry => entry.item.name)')),
        ['Swiftness Ring', 'Grapple Points', 'Shield', 'Radar Module: Enemies', 'Panic Necklace']);
    h.run(`upgradeState.owned.set('Radar', 1)`);
    assert.deepEqual(Array.from(h.run('sortAvailableUpgradeEntries(entries).map(entry => entry.item.name)')),
        ['Swiftness Ring', 'Grapple Points', 'Radar Module: Enemies', 'Shield', 'Panic Necklace']);
    assert.deepEqual(Array.from(h.run('sortUpgradeEntriesByLevel(entries).map(entry => entry.item.name)')),
        ['Swiftness Ring', 'Grapple Points', 'Radar Module: Enemies', 'Shield', 'Panic Necklace']);
});

test('Hide Locked follows purchase locks while enemy dependencies stay informational and updates as requirements are met', () => {
    const h = harness();
    h.run(`globalThis.item = name => upgradesList.find(x => x.name === name);
        upgradeState.progressiveHideLocked = true; runState.level = 8;`);
    for (const name of ['Shield', 'Radar Module: Enemies']) {
        assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item(${JSON.stringify(name)}))`), true, name);
    }
    assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item('Star Marts'))`), false);
    assert.equal(h.run(`isEnemyUpgradeDependencyPresent({type:'enemy',name:'Mart'})`), false);
    h.enemies.set('Mart', 1);
    assert.equal(h.run(`isEnemyUpgradeDependencyPresent({type:'enemy',name:'Mart'})`), true);
    h.run(`upgradeState.owned.set('Radar', 1)`);
    for (const name of ['Star Marts', 'Radar Module: Enemies', 'Double Jump']) {
        assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item(${JSON.stringify(name)}))`), false, name);
    }
    h.run('runState.level = 15');
    assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item('Shield'))`), false);
    assert.equal(h.run(`isUpgradeHiddenByLockedFilter({ pricePending: true })`), true);
    h.run(`upgradeState.owned.clear(); upgradeState.progressiveHideLocked = false`);
    assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item('Radar Module: Enemies'))`), false);
    h.run(`upgradeState.progressiveHideLocked = true; upgradeState.progressive = false`);
    assert.equal(h.run(`isUpgradeHiddenByLockedFilter(item('Radar Module: Enemies'))`), false);
});

test('down action cancels queued stacks before removing owned stacks and remembers removal of free Paycheck', () => {
    const h = harness();
    h.run(`globalThis.paycheck = upgradesList.find(item => item.name === 'Paycheck');
        upgradeState.pending.set('Paycheck', 2);`);
    h.run('decreaseUpgradeStack(paycheck)');
    assert.equal(h.run(`getOwnedStack('Paycheck')`), 1);
    assert.equal(h.run('upgradeState.paycheckAutoOwnedDisabled'), false);
    assert.equal(h.run('upgradeState.pending.size'), 0);
    h.run('decreaseUpgradeStack(paycheck)');
    assert.equal(h.run(`getOwnedStack('Paycheck')`), 0);
    assert.equal(h.run('upgradeState.paycheckAutoOwnedDisabled'), true);
    h.run(`globalThis.saved = ''; localStorage = {setItem(key, value) { saved = value; }, getItem() { return saved; }};
        saveUpgradeState(); upgradeState.paycheckAutoOwnedDisabled = false; loadUpgradeState();`);
    assert.equal(h.run(`getOwnedStack('Paycheck')`), 0);
    h.run(`globalThis.ring = upgradesList.find(item => item.name === 'Swiftness Ring');
        upgradeState.owned.set('Swiftness Ring', 2); upgradeState.pending.set('Swiftness Ring', 3);
        decreaseUpgradeStack(ring);`);
    assert.equal(h.run(`getOwnedStack('Swiftness Ring')`), 2);
    h.run('decreaseUpgradeStack(ring)');
    assert.equal(h.run(`getOwnedStack('Swiftness Ring')`), 1);
    h.run('resetUpgradeShopState()');
    assert.equal(h.run(`getOwnedStack('Paycheck')`), 1);
});

test('Jet Boosters shows Scrapmaw as an informational enemy dependency', () => {
    const h = harness();
    assert.equal(h.run(`upgradesList.find(item => item.name === 'Jet Boosters').requires.name`), 'Scrapmaw');
    assert.equal(h.run(`isUpgradeRequirementMet(upgradesList.find(item => item.name === 'Jet Boosters'))`), true);
});
