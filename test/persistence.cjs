// Run: node --test test/persistence.cjs (no dependencies or Firebase access).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8').replace(/^import .*;\n/gm, '').replace(/export /g, '');
const plain = v => JSON.parse(JSON.stringify(v));
const mergeContext = vm.createContext({});
vm.runInContext(source('sync.js'), mergeContext);
const merge = (b,l,r) => plain(mergeContext.mergeState(b,l,r));
test('offline edits and independent remote additions both survive', () => {
 const base={tasks:[{id:'a',title:'old'}]};
 assert.deepEqual(merge(base,{tasks:[{id:'a',title:'offline'}]},{tasks:[{id:'a',title:'old'},{id:'b',title:'remote'}]}),{tasks:[{id:'a',title:'offline'},{id:'b',title:'remote'}]});
});
test('local deletion is not resurrected; remote deletion of unchanged item survives',()=>{
 const base={tasks:[{id:'a'},{id:'b'}]};
 assert.deepEqual(merge(base,{tasks:[{id:'b'}]},{tasks:[{id:'a'}]}),{tasks:[]});
});
test('different fields on the same task merge; local wins same-field conflict',()=>{
 assert.deepEqual(merge({title:'old',done:false},{title:'local',done:false},{title:'remote',done:true}),{title:'local',done:true});
});
function timerHarness(state, clock={now:100000}) {
 const context=vm.createContext({
  getState:()=>state,update:f=>f(state),subscribe:()=>{},
  dayRecord:k=>state.days[k] ||= {minutes:0,pomodoros:0},todayKey:()=> '2026-11-16',
  pomodoroReward:m=>m,recomputeStreak:()=>{},sounds:{ting(){}},mascot:{setState(){},react(){}},
  Date:{now:()=>clock.now},globalThis:{crypto:{randomUUID:()=>String(clock.now)}},
  setInterval:()=>1,clearInterval:()=>{},document:{dispatchEvent(){}},CustomEvent:class{},
 });
 vm.runInContext(source('timer.js'),context);
 return context;
}
const initial=()=>({settings:{focusMinutes:25,breakMinutes:5},timer:{},wallet:{coins:0,totalEarned:0},days:{}});
test('running timer survives reload with elapsed time and task association',()=>{
 const state=initial(),clock={now:100000};let t=timerHarness(state,clock);
 t.attachTask('task','math');t.start();clock.now+=600000;
 t=timerHarness(state,clock);t.restoreTimer();
 assert.equal(t.getTimer().status,'running');assert.equal(t.getTimer().remaining,900);assert.equal(t.getTimer().taskId,'task');assert.equal(t.getTimer().subjectId,'math');
});
test('paused timer stays paused across reload, then resumes',()=>{
 const state=initial(),clock={now:100000};let t=timerHarness(state,clock);t.start();clock.now+=600000;t.pause();clock.now+=900000;
 t=timerHarness(state,clock);t.restoreTimer();assert.equal(t.getTimer().status,'paused');assert.equal(t.getTimer().remaining,900);t.start();assert.equal(t.getTimer().endAt,clock.now+900000);
});
test('expired session records study totals and coins once across repeated reloads',()=>{
 const state=initial(),clock={now:100000};let t=timerHarness(state,clock);t.attachTask('a','math');t.start();clock.now+=1600000;
 for(let i=0;i<3;i++){t=timerHarness(state,clock);t.restoreTimer();}
 assert.equal(state.days['2026-11-16'].pomodoros,1);assert.equal(state.timer.totalFocusMinutes,25);assert.equal(state.timer.bySubject.math,25);assert.equal(state.wallet.coins,25);assert.equal(t.getTimer().mode,'break');
});
test('reset session does not resume after reload',()=>{
 const state=initial();let t=timerHarness(state);t.start();t.reset();t=timerHarness(state);t.restoreTimer();assert.equal(t.getTimer().status,'idle');
});
test('break timer resumes without earning study rewards',()=>{
 const state=initial(),clock={now:100000};let t=timerHarness(state,clock);t.setMode('break');t.start();clock.now+=400000;t=timerHarness(state,clock);t.restoreTimer();assert.equal(t.getTimer().mode,'focus');assert.equal(state.wallet.coins,0);
});
function stateHarness(saved, load) {
 const bases=new Map([['user',plain(saved)]]),writes=[];
 const defaults=()=>({...initial(),ui:{},subjects:[],tasks:[],settings:{...initial().settings,seeded:false},room:{}});
 const context=vm.createContext({
  mergeState:mergeContext.mergeState,applyAdminCredits:mergeContext.applyAdminCredits,readSyncBase:uid=>bases.get(uid),writeSyncBase:(uid,s)=>bases.set(uid,plain(s)),
  loadState:()=>saved,saveState:()=>true,createInitialState:defaults,isSampleTask:()=>false,SIDEBAR_DEFAULT:{},
  debounce:f=>()=>{},todayKey:()=> '2026-11-16',startOfWeek:x=>x,toKey:x=>x,migrateRoom:s=>s.room||{},
  getCurrentUser:()=>({uid:'user'}),loadCloudState:load,saveCloudState:async(uid,s)=>{writes.push(plain(s));return true;},
  localStorage:{setItem(){}},console,
 });
 vm.runInContext(source('state.js'),context);context.initState();return {context,writes,bases};
}
test('login preserves edits made offline and edits made while remote request is in flight',async()=>{
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'base'}],_syncUid:'user'};
 let resolve;const h=stateHarness(saved,()=>new Promise(r=>{resolve=r;}));
 h.context.update(s=>s.tasks[0].title='offline');const job=h.context.syncCloudForUser({uid:'user'});
 h.context.update(s=>s.tasks.push({id:'c',title:'during load'}));
 resolve({...saved,tasks:[{id:'a',title:'base'},{id:'b',title:'remote'}]});await job;
 const tasks=plain(h.context.getState().tasks);assert.equal(tasks.find(t=>t.id==='a').title,'offline');assert.equal(tasks.length,3);assert.equal(h.writes.length,1);
});
test('failed remote load leaves offline data intact and does not upload over unknown remote',async()=>{
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'offline'}],_syncUid:'user'};
 const h=stateHarness(saved,async()=>{throw Error('offline');});
 await assert.rejects(h.context.syncCloudForUser({uid:'user'}));assert.equal(h.context.getState().tasks[0].title,'offline');assert.equal(h.writes.length,0);
});
function cloudHarness(remote, baseline, fail=false) {
 let base=baseline,stored;
 const code=fs.readFileSync(path.join(__dirname,'../js/cloud.js'),'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm,'').replace(/export /g,'');
 const context=vm.createContext({
  initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),doc:()=>({}),onAuthStateChanged:()=>()=>{},
  mergeState:mergeContext.mergeState,applyAdminCredits:mergeContext.applyAdminCredits,readSyncBase:()=>base,writeSyncBase:(uid,s)=>base=plain(s),
  runTransaction:async(db,fn)=>{if(fail)throw Error('offline');await fn({get:async()=>({exists:()=>!!remote,data:()=>({state:remote})}),set:(ref,p)=>stored=plain(p.state)});},console,
 });
 vm.runInContext(code,context);return {context,getBase:()=>base,getStored:()=>stored};
}
test('cloud transaction retains changes written by another device',async()=>{
 const base={tasks:[{id:'a',title:'old'}]};const h=cloudHarness({tasks:[{id:'a',title:'old'},{id:'b',title:'remote'}]},base);
 await h.context.saveCloudState('user',{tasks:[{id:'a',title:'offline'}]});
 assert.deepEqual(h.getStored().tasks,[{id:'a',title:'offline'},{id:'b',title:'remote'}]);
});
test('failed transaction keeps baseline so next retry can preserve offline edits',async()=>{
 const base={tasks:[{id:'a',title:'old'}]};const h=cloudHarness(base,base,true);
 await assert.rejects(h.context.saveCloudState('user',{tasks:[{id:'a',title:'offline'}]}));assert.deepEqual(h.getBase(),base);
});
test('cloud refuses to overwrite an existing account without a known baseline',async()=>{
 const h=cloudHarness({tasks:[{id:'remote'}]},null);
 await assert.rejects(h.context.saveCloudState('user',{tasks:[]}));assert.equal(h.getStored(),undefined);
});
