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
