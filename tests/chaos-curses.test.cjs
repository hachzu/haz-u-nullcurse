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
