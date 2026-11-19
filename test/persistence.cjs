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
  getState:()=>state,update:f=>f(state),subscribe:()=>{},walletMode:()=> 'legacy',getCurrentUser:()=>null,
  dayRecord:k=>state.days[k] ||= {minutes:0,pomodoros:0},todayKey:()=>clock.day || '2026-11-16',
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
function stateHarness(saved, load, save = null) {
 const bases=new Map([['user',plain(saved)]]),writes=[];
 const disk = new Map([['goc-hoc-nho:v1',JSON.stringify(saved)]]);
 let user = {uid:'user'};
 const defaults=()=>({...initial(),ui:{},subjects:[],tasks:[],settings:{...initial().settings,seeded:false},room:{}});
 const context=vm.createContext({
  mergeState:mergeContext.mergeState,applyAdminCredits:mergeContext.applyAdminCredits,readSyncBase:uid=>bases.get(uid),writeSyncBase:(uid,s)=>bases.set(uid,plain(s)),
  createInitialState:defaults,isSampleTask:()=>false,SIDEBAR_DEFAULT:{},
  debounce:f=>()=>{},todayKey:()=> '2026-11-16',startOfWeek:x=>x,toKey:x=>x,migrateRoom:s=>s.room||{},
  getCurrentUser:()=>user,loadCloudState:load,saveCloudState:async(uid,s)=>{writes.push(plain(s));return save ? await save(uid,s) : true;},
  localStorage:{getItem:key=>disk.get(key) ?? null,setItem:(key,value)=>disk.set(key,value)},console,
 });
 vm.runInContext(source('storage.js') + '\n' + source('state.js'),context);
 context.initState();
 const switchUser = (uid, banned = false) => {
  user = uid ? {uid} : null;
  context.selectAccountState(user, banned);
 };
 return {context,writes,bases,disk,switchUser};
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

test('committed totals reach the UI without discarding edits made during save',async()=>{
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'old'}],_syncUid:'user'};
 let finish;const h=stateHarness(saved,async()=>plain(saved),async()=>new Promise(resolve=>{finish=resolve;}));
 const job=h.context.syncCloudForUser({uid:'user'});await new Promise(resolve=>setImmediate(resolve));
 h.context.update(s=>{s.tasks[0].title='edited while saving';});
 finish({...plain(saved),wallet:{coins:75,totalEarned:75},timer:{totalFocusMinutes:25}});await job;
 assert.equal(h.context.getState().wallet.coins,75);assert.equal(h.context.getState().tasks[0].title,'edited while saving');
});

test('restored focus crossing midnight keeps the same accounting day',()=>{
 const state=initial(),clock={now:100000,day:'2026-11-16'};let t=timerHarness(state,clock);t.start();clock.now+=1600000;clock.day='2026-11-17';t=timerHarness(state,clock);t.restoreTimer();
 assert.equal(state.days['2026-11-16'].pomodoros,1);assert.equal(state.days['2026-11-17'],undefined);assert.equal(Object.keys(state.studyEvents).length,1);
});

test('a new cloud profile does not inherit a different account’s local data', async () => {
 const saved = {...initial(), _syncUid: 'previous-user', tasks: [{id: 'private-task'}], ui: {}, subjects: []};
 const h = stateHarness(saved, async () => null);
 await h.context.syncCloudForUser({uid: 'user'});
 assert.deepEqual(h.writes[0].tasks, []);
 assert.equal(h.writes[0]._syncUid, 'user');
});


test('logout and account switching preserve a legacy account draft but do not show it to guests or other users', () => {
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'private'}],_syncUid:'user'};
 const h=stateHarness(saved,async()=>null);
 h.switchUser(null);
 assert.deepEqual(plain(h.context.getState().tasks), []);
 h.context.update(s=>s.tasks.push({id:'guest-task',title:'guest'}));
 assert.equal(JSON.parse(h.disk.get('goc-hoc-nho:v1:user')).tasks[0].title,'private');
 h.switchUser('other');
 assert.equal(h.context.getState().tasks.some(task => task.title === 'private'), false);
 h.switchUser('user');
 assert.equal(h.context.getState().tasks[0].title,'private');
 h.switchUser('user', true);
 assert.equal(h.context.getState().tasks.some(task => task.title === 'private'), false);
 assert.equal(h.context.update(s=>s.tasks.push({id:'no'})),false);
 h.switchUser('user');
 assert.equal(h.context.getState().tasks[0].title,'private');
});

test('a cloud load finishing after logout and re-login does not replace the current account draft', async () => {
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'private draft'}],_syncUid:'user'};
 let finish;
 const h=stateHarness(saved,()=>new Promise(resolve=>{finish=resolve;}));
 const original=h.context.syncCloudForUser({uid:'user'});
 h.switchUser(null);
 h.switchUser('user');
 h.context.update(s=>{s.tasks[0].title='mon thay doi';});
 finish({...saved,tasks:[{id:'a',title:'old response'}]});
 assert.equal(await original,null);
 assert.equal(h.context.getState().tasks[0].title,'mon thay doi');
 assert.equal(h.writes.length,0);
});


test('failed storage keeps the unsaved draft on the original account in this tab', () => {
 const saved={...initial(),ui:{},subjects:[],tasks:[{id:'a',title:'old disk'}],_syncUid:'user'};
 const h=stateHarness(saved,async()=>null);
 const setItem=h.context.localStorage.setItem;
 h.context.localStorage.setItem=()=>{throw new Error('quota');};
 const warn=h.context.console.warn;
 h.context.console={...h.context.console,warn(){}};
 assert.equal(h.context.update(s=>{s.tasks[0].title='memory only';}),false);
 h.switchUser('other');
 assert.equal(h.context.getState().tasks.length,0);
 h.switchUser('user');
 assert.equal(h.context.getState().tasks[0].title,'memory only');
 h.context.localStorage.setItem=setItem;
 h.context.retrySave();
 assert.equal(JSON.parse(h.disk.get('goc-hoc-nho:v1:user')).tasks[0].title,'memory only');
 h.context.console.warn=warn;
});
