const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/tracker.js'),'utf8');
function harness(){
 const context=vm.createContext({console});
 vm.runInContext(source.slice(0,source.indexOf('/* Source: curse-tracker-ui.js */')),context);
 vm.runInContext('getLevel=()=>runState.level;',context);
 return code=>vm.runInContext(code,context);
}
test('Chaos catalog has 19 base and 15 plus entries with local PNG icons',()=>{
 const run=harness();
 assert.equal(run('chaosCurses.filter(c=>!c.chaosPlus).length'),19);
 assert.equal(run('chaosCurses.filter(c=>c.chaosPlus).length'),15);
 for(const asset of run('chaosCurses.map(c=>getAssetPath("curses",c.name))')) {
  const data=fs.readFileSync(path.join(__dirname,'..',asset));
  assert.equal(data.subarray(1,4).toString(),'PNG',asset);
 }
});
test('Chaos+ needs its mode and base Chaos stays available in Chaos+',()=>{
 const run=harness();
 assert.equal(run('chaosCurses.some(c=>isCurseSelectable(c))'),false);
 run('runState.chaosMode=true;');
 assert.equal(run('chaosCurses.filter(c=>!c.chaosPlus).every(c=>isCurseSelectable(c))'),true);
 assert.equal(run('chaosCurses.filter(c=>c.chaosPlus).some(c=>isCurseSelectable(c))'),false);
 run('runState.chaosPlusMode=true;');
 assert.equal(run('chaosCurses.every(c=>isCurseSelectable(c))'),true);
});

test('Unlock All lets every regular curse be selected together in every player mode', () => {
 for (const mode of ['solo', 'duo', 'party']) {
  const run = harness();
  run(`render = () => {}; var upgradeState = { mode: ${JSON.stringify(mode)} };
       runState.level = 1; runState.difficulty = 'Casual';
       curseVisibilityState.showAll = true; curseVisibilityState.unlockAll = true;`);
  const results = run(`
   [...getGlobalPool(), ...getEnemyPool(), ...getGreaterPool()].map(curse => {
    const selectable = isCurseSelectable(curse);
    selectCurse(curse);
    return { name: curse.name, selectable, selected: hasCurse(curse.name) };
   })
  `);
  for (const result of results) {
   assert.equal(result.selectable, true, `${mode}: ${result.name} must be selectable`);
   assert.equal(result.selected, true, `${mode}: ${result.name} must actually be added`);
  }
  assert.equal(results.length, run('globalCurses.length + enemyCurses.length + greaterCurses.length'));
 }
});

test('Unlock All bypasses conflicts across Chaos and regular pools while preserving stack caps', () => {
 const run = harness();
 run(`render = () => {}; curseVisibilityState.unlockAll = true;
      runState.chaosMode = true; runState.chaosPlusMode = true;
      selectCurse(findCurseByName('Mart Infection'));
      selectCurse(findCurseByName('Mart Slide'));`);
 assert.equal(run('hasCurse("Mart Infection") && hasCurse("Mart Slide")'), true);
 assert.equal(run('isCurseSelectable(findCurseByName("Mart Slide"))'), false);
 run('selectCurse(findCurseByName("Mart Slide"))');
 assert.equal(run('getCurseStackCount("Mart Slide")'), 1);
 run('removeCurse("Mart Slide")');
 assert.equal(run('isCurseSelectable(findCurseByName("Mart Slide"))'), true);
 run('curseVisibilityState.unlockAll = false');
 assert.equal(run('isCurseSelectable(findCurseByName("Mart Slide"))'), false);
});

test('Show All alone retains mode, level, dependency, and exclusive-group locks', () => {
 const run = harness();
 run(`render = () => {}; var upgradeState = { mode: 'solo' };
      curseVisibilityState.showAll = true; runState.level = 1;`);
 for (const name of ['Mart Infection', 'Deadly Melody', 'Water Planet']) {
  assert.equal(run(`isCurseSelectable(findCurseByName(${JSON.stringify(name)}))`), false, name);
 }
 run('selectCurse(findCurseByName("Lower Gravity"))');
 assert.equal(run('isCurseSelectable(findCurseByName("Higher Gravity"))'), false);
});
test('shared curse names resolve to the Chaos variant only while its mode is enabled',()=>{
 const run=harness();
 assert.equal(run('Boolean(findCurseByName("Pacifier").chaos)'),false);
 run('runState.chaosMode=true;');
 assert.equal(run('findCurseByName("Pacifier").chaos'),true);
 assert.equal(run('Boolean(findCurseByName("Fake Count").chaos)'),false);
 run('runState.chaosPlusMode=true;');
 assert.equal(run('findCurseByName("Fake Count").chaosPlus'),true);
});

test('Divine identity is independent of Chaos+ membership',()=>{
 const run=harness();
 assert.equal(run('chaosCurses.filter(c=>c.divine).length'),13);
 assert.equal(run('chaosCurses.filter(c=>c.divine && !c.chaosPlus).length'),4);
 assert.equal(run('chaosCurses.find(c=>c.name==="Aura").divine'),true);
 assert.equal(run('chaosCurses.find(c=>c.name==="Spreadshot").divine'),false);
 assert.equal(run('chaosCurses.find(c=>c.name==="Spreadshot").chaosPlus'),true);
});

test('temporary curses count for exclusivity and return to the pool on expiry', () => {
 const run = harness();
 run('render = () => {}; runState.level = 5; selectCurse(findCurseByName("High Roller"), false, false, 10)');
 assert.equal(run('getDisplayedCurseNames().includes("High Roller")'), true);
 assert.equal(run('getCurseStackCount("High Roller")'), 1);
 assert.equal(run('isCurseSelectable(findCurseByName("Tweaked Odds"))'), false);
 run('runState.level = 14; expireTemporaryCurses(runState.level)');
 assert.equal(run('hasCurse("High Roller")'), true);
 run('runState.level = 15; expireTemporaryCurses(runState.level)');
 assert.equal(run('getGlobalPool().some(curse => curse.name === "High Roller")'), true);
 assert.equal(run('isCurseSelectable(findCurseByName("Tweaked Odds"))'), true);
});

test('greater curses can be permanent but cannot be added or restored as temporary', () => {
 const run = harness();
 run('render = () => {}; runState.level = 10; selectCurse(findCurseByName("Void Implosions"), false, false, 10)');
 assert.equal(run('hasCurse("Void Implosions")'), false);
 assert.equal(run('loadTemporaryCurseExpiries([["Void Implosions", [20]]]).size'), 0);
 run('selectCurse(findCurseByName("Void Implosions"))');
 assert.equal(run('hasCurse("Void Implosions")'), true);
});

test('temporary stacks expire independently and preserve a permanent medal stack', () => {
 const run = harness();
 run(`render = () => {}; runState.level = 5; curseVisibilityState.unlockAll = true;
      selectCurse(findCurseByName("More Tripmines"), false, true);
      selectCurse(findCurseByName("More Tripmines"), false, true, 3);`);
 assert.equal(run('getCurseStackCount("More Tripmines")'), 2);
 assert.equal(run('runState.curseStacks.get("More Tripmines")'), 1);
 run('runState.level = 8; expireTemporaryCurses(runState.level)');
 assert.equal(run('getCurseStackCount("More Tripmines")'), 1);
 assert.equal(run('runState.medalCurseValues.get("More Tripmines")'), 150);
 assert.equal(run('isCurseSelectable(findCurseByName("More Tripmines"))'), true);
});

test('the requested medals retain their normal pools and sort by unlock level', () => {
 const run = harness();
 const names = [
  'Airborne Flesh', 'Barotrauma', 'Burning Bouquet', 'Minefield', 'Ambush', 'Run',
  'Mighty Gong', 'Concussion', 'Scattered Gifts', 'Beacon Imp', 'Concussive Blast',
  'Accurate Telefragger', 'Scorched Earth', 'Magic Missile', 'Incendiary Shrapnel',
  'Leo', 'Volatile Explosions', 'Beacon Mart', 'Problem Child', 'Baby Steps', 'Sagittarius',
  'Big Baby', 'Bigger Blast', 'Bigger Tripmines', 'Jumping Instruments', 'Shotgun',
  'Springloaded', 'Stronger Wings', 'Husk Express', 'Bloodier Meat', 'Blueprint: Cross Beams',
  'Blueprint: Efficient Cooling', 'Blade Carousel'
 ];
 run('curseVisibilityState.showAll = true');
 const medals = new Set(run('getMedalPool().map(curse => curse.name)'));
 const normal = new Set(run('[...getGlobalPool(), ...getEnemyPool()].map(curse => curse.name)'));
 for (const name of names) {
  assert.ok(medals.has(name), name);
  assert.ok(normal.has(name), name);
 }
 const levels = Array.from(run('getMedalPool().map(curse => getCurseUnlockLevel(curse) || 1)'));
 assert.deepEqual(levels, levels.slice().sort((a, b) => a - b));
});

test('delusions follow the current level, upcoming dependencies, and the three-pick cap', () => {
 const run = harness();
 run(source.slice(source.indexOf('function getDelusionConflict('), source.indexOf('function syncDelusionUpgradeEffects(')));
 run('getPlayerCount = () => 1; runState.level = 10; var getOwnedStack = () => 0;');
 const visible = () => Array.from(run('getVisibleDelusions().map(delusion => delusion.name)'));
 assert.deepEqual(visible(), []);
 for (const name of ['Arrogance', 'Gambling', 'Overconfidence', 'Perseverance']) {
  assert.equal(run(`DELUSION_BY_NAME.get("${name}").level`), 15);
 }
 run('curseVisibilityState.showUpcoming = true');
 assert.ok(visible().includes('Hope'));
 assert.ok(!visible().includes('Corrosion'));
 assert.ok(!visible().includes('Gambling'));
 run('curseVisibilityState.showAll = true');
 assert.equal(visible().length, 15);
 run('runState.activeDelusions = new Set(["Hope", "Arrogance", "Overconfidence"])');
 assert.deepEqual(visible(), ['Arrogance', 'Hope', 'Overconfidence']);
 assert.equal(run('getDelusionRequirementReason(DELUSION_BY_NAME.get("Hope"))'), '');
 run('runState.activeDelusions.delete("Hope")');
 assert.equal(visible().length, 15);
 assert.match(run('getDelusionRequirementReason(DELUSION_BY_NAME.get("Conceit"))'), /Cannot be picked with Arrogance/);
});
