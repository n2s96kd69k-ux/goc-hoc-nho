const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/studyPresence.js','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),c);
const row=(uid,expiry,end)=>({uid,expiresAt:{toMillis:()=>expiry},focusEndsAt:{toMillis:()=>end}});
test('counts accounts once across tabs and excludes expired/disconnected/finished sessions',()=>{
 assert.equal(c.countStudying([row('a',200,300),row('a',200,300),row('b',200,300),row('stale',50,300),row('done',200,50)],100),2);
 assert.equal(c.countStudying([],100),0);
});
function sharedClients() {
 const records=new Map(),feeds=new Set();let id=0;
 const notify=()=>{for(const f of feeds)f({metadata:{fromCache:false},docs:[...records.values()].map(data=>({data:()=>data}))});};
 function client(uid) {
  const timer={status:'idle',mode:'focus',endAt:Date.now()+1500000},counts=[];let timerListener;
  const context=vm.createContext({
   Date,Promise,Set,console,crypto:{randomUUID:()=>String(++id)},
   firebaseDb:()=>({}),onCloudAuthChange:f=>{f({uid});return ()=>{};},getTimer:()=>timer,onTimer:f=>{timerListener=f;return ()=>{};},
   collection:()=>({}),doc:(db,col,id)=>id,query:x=>x,where:()=>({}),Timestamp:{now:()=>({}),fromMillis:n=>({toMillis:()=>n})},serverTimestamp:()=>({}),
   setDoc:async(ref,data)=>{records.set(ref,data);notify();},deleteDoc:async ref=>{records.delete(ref);notify();},
   onSnapshot:(q,opts,f)=>{feeds.add(f);notify();return ()=>feeds.delete(f);},
   setInterval:()=>1,clearInterval:()=>{},window:{addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},
  });
  vm.runInContext(fs.readFileSync(__dirname+'/../js/studyPresence.js','utf8').replace(/^import .*;\n/gm,'').replace(/export /g,''),context);
  context.startStudyPresence(n=>counts.push(n));
  return {counts,set(on){timer.status=on?'running':'paused';timerListener(timer,on?'start':'pause');}};
 }
 return client;
}
test('start/stop in one account updates every listener; multiple tabs count once',async()=>{
 const client=sharedClients(),a=client('a'),b=client('b');const flush=()=>new Promise(resolve=>setImmediate(resolve));
 await flush();a.set(true);await flush();assert.equal(a.counts.at(-1),1);assert.equal(b.counts.at(-1),1);
 b.set(true);await flush();assert.equal(a.counts.at(-1),2);assert.equal(b.counts.at(-1),2);
 const bTab=client('b');bTab.set(true);await flush();assert.equal(a.counts.at(-1),2);
 a.set(false);b.set(false);await flush();assert.equal(a.counts.at(-1),1);
 bTab.set(false);await flush();assert.equal(a.counts.at(-1),0);assert.equal(b.counts.at(-1),0);
});
