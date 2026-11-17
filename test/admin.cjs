const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8').replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/export /g, '');
const policy = vm.createContext({}); vm.runInContext(code('admin/policy.js'), policy);
const sync = vm.createContext({}); vm.runInContext(code('sync.js'), sync);
const plain = value => JSON.parse(JSON.stringify(value));
test('coin actions validate integers, limits, negative balances and required reasons', () => {
  assert.deepEqual(plain(policy.coinChange(50, 20, 'add')), {before:50,after:70,delta:20});
  assert.deepEqual(plain(policy.coinChange(50, 0, 'set')), {before:50,after:0,delta:-50});
  for (const amount of [-1, 0.5, NaN, Infinity, 1000001]) assert.throws(() => policy.coinChange(50, amount, 'add'));
  assert.throws(() => policy.validateReason(' '));
});
test('administrator cannot lock/demote self or protected owner', () => {
  assert.equal(policy.canChangeAccess('a','a',{}),false);
  assert.equal(policy.canChangeAccess('a','b',{owner:true}),false);
  assert.equal(policy.canChangeAccess('a','b',{}),true);
});
test('admin grant survives offline study rewards and repeated application without duplication', () => {
  const base={wallet:{coins:50}},local={wallet:{coins:55}},remote={wallet:{coins:50}};
  const adjust=s=>sync.applyAdminCredits(s,100);
  const result=sync.mergeState(adjust(base),adjust(local),adjust(remote));
  assert.equal(result.wallet.coins,155);
  assert.equal(adjust(result).wallet.coins,155);
  assert.equal(sync.applyAdminCredits(result,90).wallet.coins,145);
});
function cloud(role, status='active', fail=false) {
  let authCallback, user = {uid:'uid-admin'};
  const ctx=vm.createContext({
    mergeState:sync.mergeState,applyAdminCredits:sync.applyAdminCredits,
    initializeApp:()=>({}),getAuth:()=>({}),getFirestore:()=>({}),doc:()=>({}),
    onAuthStateChanged:(a,fn)=>{authCallback=fn;return ()=>{};},
    onSnapshot:()=>()=>{},getDocFromServer:async()=>{if(fail)throw Error('offline');return {exists:()=>true,data:()=>({role,status})};},console,
  });
  vm.runInContext(code('cloud.js'),ctx);
  return {ctx,login:()=>authCallback(user),logout:()=>authCallback(null)};
}
test('route guard waits for Firebase auth before checking role',async()=>{
  const h=cloud('admin');let resolved=false;const p=h.ctx.requireAdmin().then(user=>{resolved=true;return user;});
  await Promise.resolve();assert.equal(resolved,false);h.login();assert.equal((await p).uid,'uid-admin');
});
test('route guard fails closed for guests, members, banned admin and network failure',async()=>{
  const guest=cloud('admin');guest.logout();assert.equal(await guest.ctx.requireAdmin(),null);
  for(const [role,status,fail] of [['member','active',false],['admin','banned',false],['admin','active',true]]){
    const h=cloud(role,status,fail);h.login();assert.equal(await h.ctx.requireAdmin(),null);
  }
});
function serviceHarness() {
  const database = { user: {state:{wallet:{coins:50}},adminCredits:0}, logs:new Map(), notifications:new Map() };
  const context = vm.createContext({
    OWNER_UID:'Vyd1sYXrKARaTujn0ucX0XFe0gp2',firebaseDb:()=>({}),requireAdmin:async()=>({uid:'admin',email:'admin@example.test'}),
    applyAdminCredits:sync.applyAdminCredits,...Object.fromEntries(['coinChange','validateReason','canChangeAccess'].map(k=>[k,policy[k]])),
    doc:(db,...parts)=>({collection:parts.length === 2 ? parts[0] : parts[2],id:parts.at(-1)}),serverTimestamp:()=>new Date(0),
    runTransaction:async(db,fn)=>fn({
      get:async ref=>({exists:()=>ref.collection==='users'||database.logs.has(ref.id),data:()=>ref.collection==='users'?database.user:database.logs.get(ref.id)}),
      update:(ref,patch)=>Object.assign(database.user,patch),set:(ref,data)=>(ref.collection==='adminLogs'?database.logs:database.notifications).set(ref.id,data),
    }),
  });
  vm.runInContext(code('admin/service.js'),context);return {context,database};
}
test('coin transaction is idempotent and rejects reuse for a different request',async()=>{
  const h=serviceHarness();const request={uid:'student',type:'coins-add',value:20,reason:'event reward',operationId:'11111111-1111-1111-1111-111111111111'};
  await h.context.changeUser(request);await h.context.changeUser(request);
  assert.equal(h.database.user.adminCredits,20);assert.equal(h.database.logs.size,1);assert.equal(h.database.notifications.size,1);
  await assert.rejects(h.context.changeUser({...request,value:30}));
});
