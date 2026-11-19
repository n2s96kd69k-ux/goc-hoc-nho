const {test,before,after,beforeEach}=require('node:test');
const assert = require("node:assert/strict");
const fs=require('node:fs'),path=require('node:path');
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,runTransaction,Timestamp}=require('firebase/firestore');
let env;
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-goc-hoc-nho',firestore:{rules:fs.readFileSync(path.join(__dirname,'../firestore.rules'),'utf8')}});});
after(async()=>{await env?.cleanup();});
beforeEach(async()=>{
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const [id,data] of Object.entries({admin:{role:'admin'},owner:{role:'admin',owner:true},student:{role:'member'},banned:{role:'member',status:'banned'},bannedAdmin:{role:'admin',status:'banned'}}))await setDoc(doc(db,'users',id),{state:{wallet:{coins:50}},status:'active',...data});
  await setDoc(doc(db,'universities','schedule'),{exams:[]});
 });
});
const dbFor=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
async function audited(db,uid,patch,type='coins-add'){
 const id='operation-123456789';const batch=writeBatch(db);
 batch.update(doc(db,'users',uid),{...patch,updatedAt:serverTimestamp(),lastAdminOperation:id});
 batch.set(doc(db,'adminLogs',id),{actorUid:'admin',actorEmail:'admin@test.example',targetUid:uid,type,requestedValue:patch.adminCredits??patch.role??patch.status,before:0,after:1,reason:'Kiểm thử quản trị',createdAt:serverTimestamp()});
 return batch.commit();
}
test('guest cannot read users; member reads only own private data',async()=>{
 await assertFails(getDoc(doc(dbFor(null),'users','student')));
 await assertSucceeds(getDoc(doc(dbFor('student'),'users','student')));
 await assertFails(getDoc(doc(dbFor('student'),'users','owner')));
 await assertFails(getDocs(collection(dbFor('student'),'users')));
 await assertSucceeds(getDocs(collection(dbFor('admin'),'users')));
});
test('new user can create own profile but cannot bootstrap admin role',async()=>{
 await assertSucceeds(getDoc(doc(dbFor('new'),'users','new')));
 await assertFails(setDoc(doc(dbFor('new'),'users','new'),{role:'admin',state:{}}));
 await assertSucceeds(setDoc(doc(dbFor('new'),'users','new'),{state:{},email:'new@test.example'}));
});
test('member can save study state but not elevate role, unlock account or grant admin credits',async()=>{
 const db=dbFor('student'),ref=doc(db,'users','student');
 await assertSucceeds(updateDoc(ref,{state:{tasks:[],wallet:{coins:55}}}));
 for(const patch of [{role:'admin'},{owner:true},{status:'banned'},{adminCredits:100},{roleBook:{members:{student:{role:'admin'}}}}])await assertFails(updateDoc(ref,patch));
});
test('banned account cannot read or write private state; banned admin has no admin access',async()=>{
 await assertFails(getDoc(doc(dbFor('banned'),'users','banned')));
 await assertFails(updateDoc(doc(dbFor('banned'),'users','banned'),{state:{}}));
 await assertFails(updateDoc(doc(dbFor('banned'),'users','banned'),{status:'active'}));
 await assertFails(getDocs(collection(dbFor('bannedAdmin'),'users')));
});
test('only active admin can change shared school/exam data',async()=>{
 await assertSucceeds(getDoc(doc(dbFor(null),'universities','schedule')));
 await assertFails(setDoc(doc(dbFor('student'),'universities','new'),{name:'School'}));
 await assertFails(deleteDoc(doc(dbFor('student'),'universities','schedule')));
 await assertSucceeds(setDoc(doc(dbFor('admin'),'universities','new'),{name:'School'}));
 await assertSucceeds(deleteDoc(doc(dbFor('admin'),'universities','new')));
});
test('privileged user changes require atomic audit entry',async()=>{
 const db=dbFor('admin');await assertFails(updateDoc(doc(db,'users','student'),{adminCredits:10}));
 await assertSucceeds(audited(db,'student',{adminCredits:10}));
});
test('admin can ban a member, but cannot demote self or ban owner',async()=>{
 await assertSucceeds(audited(dbFor('admin'),'student',{status:'banned'},'status'));
 await env.clearFirestore();
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'users','admin'),{role:'admin'});await setDoc(doc(ctx.firestore(),'users','owner'),{role:'admin',owner:true});});
 await assertFails(audited(dbFor('admin'),'admin',{role:'member'},'role'));
 await assertFails(audited(dbFor('admin'),'owner',{status:'banned'},'status'));
});
test('audit history cannot be forged by member, edited or deleted even by admin',async()=>{
 const db=dbFor('admin');await assertSucceeds(audited(db,'student',{adminCredits:10}));
 const ref=doc(db,'adminLogs','operation-123456789');
 await assertFails(updateDoc(ref,{reason:'rewritten'}));await assertFails(deleteDoc(ref));
 await assertFails(getDocs(collection(dbFor('student'),'adminLogs')));
 await assertFails(setDoc(doc(dbFor('student'),'adminLogs','fake'),{actorUid:'student'}));
});

test('concurrent grants both persist and retrying the same operation is a no-op',async()=>{
 const db=dbFor('admin');
 async function grant(id) { return runTransaction(db,async tx=>{
  const log=doc(db,'adminLogs',id);if((await tx.get(log)).exists())return;
  const ref=doc(db,'users','student');const data=(await tx.get(ref)).data();
  const before=data.adminCredits||0;
  tx.update(ref,{adminCredits:before+10,updatedAt:serverTimestamp(),lastAdminOperation:id});
  tx.set(log,{actorUid:'admin',actorEmail:'admin@test.example',targetUid:'student',type:'coins-add',requestedValue:10,before,after:before+10,reason:'Concurrent reward',createdAt:serverTimestamp()});
 }); }
 await Promise.all([grant('concurrent-one'),grant('concurrent-two')]);await grant('concurrent-one');
 const snapshot=await getDoc(doc(db,'users','student'));
 require('node:assert/strict').equal(snapshot.data().adminCredits,20);
});

test('existing primary owner keeps admin access without role or owner fields',async()=>{
 const uid='Vyd1sYXrKARaTujn0ucX0XFe0gp2';
 await env.withSecurityRulesDisabled(async ctx=>{await setDoc(doc(ctx.firestore(),'users',uid),{state:{wallet:{coins:0}}});});
 await assertSucceeds(getDocs(collection(dbFor(uid),'users')));
 await assertSucceeds(getDocs(collection(dbFor(uid),'adminLogs')));
 await assertSucceeds(setDoc(doc(dbFor(uid),'universities','owner-test'),{name:'School'}));
 await assertFails(audited(dbFor('admin'),uid,{status:'banned'},'status'));
});

test('study presence is visible to others but only its owner can write/delete',async()=>{
 const data={uid:'student',updatedAt:serverTimestamp(),expiresAt:Timestamp.fromMillis(Date.now()+90000),focusEndsAt:Timestamp.fromMillis(Date.now()+1500000)};
 await assertSucceeds(setDoc(doc(dbFor('student'),'studyPresence','session-a'),data));
 await assertSucceeds(getDocs(collection(dbFor('admin'),'studyPresence')));
 await assertSucceeds(getDocs(collection(dbFor(null),'studyPresence')));
 await assertFails(setDoc(doc(dbFor('admin'),'studyPresence','session-a'),{...data,uid:'admin'}));
 await assertFails(deleteDoc(doc(dbFor('admin'),'studyPresence','session-a')));
 await assertFails(setDoc(doc(dbFor('student'),'studyPresence','fake-user'),{...data,uid:'owner'}));
 await assertFails(setDoc(doc(dbFor(null),'studyPresence','anonymous'),data));
 await assertFails(setDoc(doc(dbFor('banned'),'studyPresence','banned'),{...data,uid:'banned'}));
 await assertFails(setDoc(doc(dbFor('student'),'studyPresence','permanent'),{...data,expiresAt:Timestamp.fromMillis(Date.now()+3600000)}));
 await assertSucceeds(deleteDoc(doc(dbFor('student'),'studyPresence','session-a')));
});

test('canonical economy is private and client read-only, including admin browsers',async()=>{
 const buckets=['economy','economyOperations','ownedItems','focusSessions','studyDays'];
 await env.withSecurityRulesDisabled(async ctx=>{for(const b of buckets)await setDoc(doc(ctx.firestore(),'users','student',b,'test'),{value:1});});
 for(const b of buckets){
  await assertSucceeds(getDoc(doc(dbFor('student'),'users','student',b,'test')));
  await assertSucceeds(getDoc(doc(dbFor('admin'),'users','student',b,'test')));
  for(const uid of [null,'owner','banned']){
   if(uid==='owner')continue; // owner fixture has admin role
   await assertFails(getDoc(doc(dbFor(uid),'users','student',b,'test')));
  }
  await assertFails(getDoc(doc(dbFor('student'),'users','admin',b,'test')));
  for(const uid of ['student','admin']){
   await assertFails(setDoc(doc(dbFor(uid),'users','student',b,'new'),{value:2}));
   await assertFails(updateDoc(doc(dbFor(uid),'users','student',b,'test'),{value:2}));
   await assertFails(deleteDoc(doc(dbFor(uid),'users','student',b,'test')));
  }
 }
 await assertSucceeds(getDocs(collection(dbFor('student'),'users','student','ownedItems')));
});
test('migration locks legacy economy paths without affecting unmigrated users',async()=>{
 const ref=doc(dbFor('student'),'users','student');
 await assertSucceeds(updateDoc(ref,{state:{wallet:{coins:60}}}));
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'users','student','economy','wallet'),{version:1,balance:60,totalEarned:60}));
 await assertFails(updateDoc(ref,{state:{wallet:{coins:999999},room:{owned:{desk:100}}}}));
 await assertSucceeds(updateDoc(ref,{displayName:'Student'}));
 await assertFails(audited(dbFor('admin'),'student',{adminCredits:100}));
 await assertFails(deleteDoc(doc(dbFor('student'),'users','student','economy','wallet')));
});
test('catalog is readable but cannot be repriced by client accounts',async()=>{
 await env.withSecurityRulesDisabled(ctx=>setDoc(doc(ctx.firestore(),'catalog','desk'),{price:60}));
 await assertSucceeds(getDoc(doc(dbFor(null),'catalog','desk')));
 for(const uid of ['student','admin'])await assertFails(setDoc(doc(dbFor(uid),'catalog','desk'),{price:0}));
});

function emulatedCloudApp(db, baseline) {
 const vm = require('node:vm');
 // The browser functions use the real Firebase SDK pointed at the emulator.
 const source = file => fs.readFileSync(path.join(__dirname, '../js', file), 'utf8')
   .replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/export /g, '');
 const app = vm.createContext({
  initializeApp: () => ({}), getAuth: () => ({}), getFirestore: () => db,
  onAuthStateChanged: () => () => {}, doc, getDoc, console,
  localStorage: {getItem: () => JSON.stringify(baseline), setItem() {}},
 });
 vm.runInContext(source('sync.js') + '\n' + source('cloud.js'), app);
 // Firestore requires plain objects in its own realm.
 app.runTransaction = (database, fn) => runTransaction(database, tx => fn({
  get: reference => tx.get(reference),
  set: (reference, data, options) => tx.set(reference, JSON.parse(JSON.stringify(data)), options),
 }));
 return app;
}

test('app sync removes deleted nested data, retains remote edits and keeps account permissions', async () => {
 const db = dbFor('student');
 const ref = doc(db, 'users', 'student');
 const baseline = {wallet: {coins: 50}, days: {old: {minutes: 20}, kept: {minutes: 10}}};
 await updateDoc(ref, {state: {...baseline, days: {...baseline.days, added: {minutes: 30}}}});
 const app = emulatedCloudApp(db, baseline);
 await app.saveCloudState('student', {wallet: {coins: 50}, days: {kept: {minutes: 10}}});
 const saved = (await getDoc(ref)).data();
 assert.deepEqual(saved.state.days, {kept: {minutes: 10}, added: {minutes: 30}});
 assert.equal(saved.role, 'member');
 assert.equal(saved.status, 'active');
});

test('migrated planner sync reconciles layout and notes while legacy state stays frozen', async () => {
 const db = dbFor('student');
 const ref = doc(db, 'users', 'student');
 const baseline = {
  settings: {userName: 'Trước đổi', sound: true},
  room: {version: 2, theme: 'cream', owned: {desk: 1}, placed: []},
  wallet: {coins: 50},
  days: {'2026-11-19': {minutes: 20, note: 'Bản cũ'}},
 };
 await assertFails(updateDoc(ref, {planner: {}}));
 await assertFails(updateDoc(ref, {economyVersion: 1}));
 await env.withSecurityRulesDisabled(async context => {
  const privileged = context.firestore();
  await updateDoc(doc(privileged, ref.path), {
   state: baseline, economyVersion: 1,
   planner: {settings: {userName: 'Trước đổi', sound: false}, room: {theme: 'cream'}, dayNotes: {}},
  });
  await setDoc(doc(privileged, ref.path, 'economy', 'wallet'), {version: 1, balance: 90});
 });
 const app = emulatedCloudApp(db, baseline);
 await app.saveCloudState('student', {
  ...baseline, settings: {...baseline.settings, userName: 'Sau đổi'},
  room: {...baseline.room, theme: 'mint', owned: {desk: 99}},
  wallet: {coins: 999}, tasks: [{id: 'edited'}],
  days: {'2026-11-19': {minutes: 999, note: 'Bản mới'}},
 });
 const saved = (await getDoc(ref)).data();
 assert.deepEqual(saved.state, baseline);
 assert.deepEqual(saved.planner.settings, {userName: 'Sau đổi', sound: false});
 assert.equal(saved.planner.room.theme, 'mint');
 assert.equal(saved.planner.room.owned, undefined);
 assert.equal(saved.planner.tasks, undefined);
 assert.deepEqual(saved.planner.dayNotes['2026-11-19'], {note: 'Bản mới'});
 const loaded = await app.loadCloudState('student');
 assert.equal(loaded.days['2026-11-19'].minutes, 20);
 assert.equal(loaded.days['2026-11-19'].note, 'Bản mới');
 assert.equal(loaded.room.owned.desk, 1);
 assert.equal((await getDoc(doc(db, ref.path, 'economy', 'wallet'))).data().balance, 90);
 await assertFails(updateDoc(ref, {'planner.room.owned': {desk: 99}}));
 await assertFails(updateDoc(ref, {'planner.wallet': {coins: 999}}));
 await assertFails(updateDoc(ref, {state: {wallet: {coins: 999}}}));
 await assertFails(updateDoc(doc(dbFor('owner'), ref.path), {'planner.settings': {userName: 'Người khác'}}));
});

test('Worker REST transactions serialize purchases, keep receipts and enforce account access', async () => {
 const {generateKeyPairSync} = require('node:crypto');
 const {default: worker} = await import('../worker/worker.js');
 const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
 const projectId = 'demo-goc-hoc-nho';
 const workerEnv = {
  FIREBASE_PROJECT_ID: projectId, FIREBASE_WEB_API_KEY: 'emulator-test',
  FIREBASE_SERVICE_ACCOUNT: JSON.stringify({
   project_id: projectId,
   client_email: 'worker-test@example.test',
   private_key: privateKey.export({type: 'pkcs8', format: 'pem'}),
  }),
 };
 const host = process.env.FIRESTORE_EMULATOR_HOST;
 assert.match(host || '', /^(127\.0\.0\.1|localhost):\d+$/);
 const db = dbFor('student');
 const wallet = doc(db, 'users/student/economy/wallet');
 const inventory = doc(db, 'users/student/ownedItems/desk');
 await env.withSecurityRulesDisabled(async context => {
  const privileged = context.firestore();
  await setDoc(doc(privileged, wallet.path), {version: 1, balance: 100, totalEarned: 100});
  await setDoc(doc(privileged, 'catalog/desk'), {active: true, price: 60, maxQty: 2});
 });

 // Stub Google identity and OAuth only. The bundled Worker's Firestore calls
 // execute against the emulator with its special server credential.
 const originalFetch = global.fetch;
 global.fetch = async (input, options) => {
  const url = new URL(input);
  if (url.hostname === 'identitytoolkit.googleapis.com') {
   const {idToken} = JSON.parse(options.body);
   const uid = {'student-test-token': 'student', 'admin-test-token': 'admin'}[idToken];
   return uid ? Response.json({users: [{localId: uid}]}) : Response.json({}, {status: 401});
  }
  if (url.hostname === 'oauth2.googleapis.com') {
   return Response.json({access_token: 'owner', expires_in: 3600});
  }
  assert.equal(url.hostname, 'firestore.googleapis.com');
  assert.ok(url.pathname.startsWith('/v1/projects/' + projectId + '/'));
  return originalFetch('http://' + host + url.pathname + url.search, options);
 };
 const call = async (command, token = 'student-test-token') => {
  const response = await worker.fetch(new Request('https://worker.test/api/economy', {
   method: 'POST',
   headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
   body: JSON.stringify(command),
  }), workerEnv);
  return {operationId: command.operationId, status: response.status, body: await response.json()};
 };
 const buy = operationId => call({type: 'buy', itemId: 'desk', operationId});
 try {
  const outcomes = await Promise.all([buy('worker-purchase-0001'), buy('worker-purchase-0002')]);
  assert.deepEqual(outcomes.map(outcome => outcome.status).sort(), [200, 400], JSON.stringify(outcomes));
  assert.equal(outcomes.find(outcome => outcome.status === 400).body.error, 'insufficient-funds');
  const accepted = outcomes.find(outcome => outcome.status === 200);
  assert.deepEqual(await buy(accepted.operationId), accepted);
  assert.equal((await getDoc(wallet)).data().balance, 40);
  assert.equal((await getDoc(inventory)).data().quantity, 1);
  assert.equal((await getDocs(collection(db, 'users/student/economyOperations'))).size, 1);

  const grant = {
   type: 'admin-add', targetUid: 'student', amount: 10,
   reason: 'Emulator test', operationId: 'worker-admin-grant-0001',
  };
  assert.equal((await call(grant)).status, 403);
  assert.equal((await call(grant, 'invalid-token')).status, 401);
  const granted = await call(grant, 'admin-test-token');
  assert.equal(granted.status, 200, JSON.stringify(granted));
  assert.deepEqual(await call(grant, 'admin-test-token'), granted);

  const taskId = 'worker-task-1';
  const create = {
   type: 'task-create', taskId, operationId: 'worker-task-create-0001',
   fields: {title: 'Ôn Toán', date: '2026-11-19'},
  };
  const created = await call(create);
  assert.equal(created.status, 200, JSON.stringify(created));
  assert.equal(created.body.result.task.done, false);
  assert.deepEqual(await call(create), created);
  const edit = {
   type: 'task-edit', taskId, expectedVersion: 0, operationId: 'worker-task-edit-0001',
   fields: {title: 'Ôn Hình học', date: '2026-11-20'},
  };
  assert.equal((await call({...edit, fields: {...edit.fields, coinGain: 50}})).body.error, 'invalid-task-fields');
  assert.equal((await call(edit)).body.result.task.version, 1);
  assert.equal((await call({...edit, operationId: 'worker-task-edit-0002'})).body.error, 'task-version-conflict');
  const complete = {type: 'task-complete', taskId, expectedVersion: 1, operationId: 'worker-task-complete-0001'};
  assert.equal((await call(complete)).body.result.balance, 55);
  for (let i = 1; i <= 4; i++) {
   const additionalId = taskId + '-' + i;
   const added = await call({...create, taskId: additionalId, operationId: create.operationId + '-' + i});
   assert.equal(added.status, 200, JSON.stringify(added));
   const done = await call({...complete, taskId: additionalId, operationId: complete.operationId + '-' + i, expectedVersion: 0});
   assert.equal(done.status, 200, JSON.stringify(done));
   assert.equal(done.body.result.weekBonus, i === 4 ? 100 : 0);
  }
  const remove = {type: 'task-delete', taskId, expectedVersion: 2, operationId: 'worker-task-delete-0001'};
  const removed = await call(remove);
  assert.equal(removed.status, 200, JSON.stringify(removed));
  assert.equal(removed.body.result.task.title, undefined);
  assert.deepEqual(await call(remove), removed);
  assert.equal((await call({...create, operationId: 'worker-task-create-0002'})).body.error, 'task-id-in-use');
  const taskRef = doc(db, 'users/student/rewardTasks', taskId);
  assert.equal((await assertSucceeds(getDoc(taskRef))).data().version, 3);
  await assertFails(updateDoc(taskRef, {done: true}));
  await assertFails(getDoc(doc(dbFor('other-student'), 'users/student/rewardTasks', taskId)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/student/rewardTasks', taskId)));

  const sessionId = 'focus-emulator-session-0001';
  const session = doc(db, 'users/student/focusSessions', sessionId);
  const beginFocus = {type: 'focus-start', sessionId, minutes: 1, operationId: 'focus-emulator-start-0001'};
  assert.equal((await call(beginFocus)).status, 200);
  const finishFocus = {type: 'focus-complete', sessionId, operationId: 'focus-emulator-complete-0001'};
  assert.equal((await call(finishFocus)).body.error, 'focus-too-early');
  await assertFails(updateDoc(session, {elapsedMs: 60000}));
  await env.withSecurityRulesDisabled(async context => {
   await updateDoc(doc(context.firestore(), session.path), {resumedAt: Date.now() - 61000});
  });
  const finishes = await Promise.all([
   call(finishFocus),
   call({...finishFocus, operationId: 'focus-emulator-complete-0002'}),
  ]);
  assert.deepEqual(finishes.map(outcome => outcome.status), [200, 200], JSON.stringify(finishes));
  assert.deepEqual(finishes[0].body.result, finishes[1].body.result);
  assert.equal(finishes[0].body.result.reward, 1);
  assert.equal((await getDoc(wallet)).data().activeSessionId, null);
  assert.equal((await getDoc(session)).data().status, 'completed');

  await env.withSecurityRulesDisabled(async context => {
   const privileged = context.firestore();
   await updateDoc(doc(privileged, 'users', 'admin'), {role: 'member'});
   await updateDoc(doc(privileged, 'users', 'student'), {status: 'banned'});
  });
  assert.equal((await call(grant, 'admin-test-token')).status, 403);
  assert.equal((await buy(accepted.operationId)).status, 403);
 } finally {
  global.fetch = originalFetch;
 }
 await env.withSecurityRulesDisabled(async context => {
  const privileged = context.firestore();
  assert.equal((await getDoc(doc(privileged, wallet.path))).data().balance, 176);
  assert.equal((await getDocs(collection(privileged, 'users/student/rewardMilestones'))).size, 1);
  const log = (await getDocs(collection(privileged, 'adminLogs'))).docs;
  assert.equal(log.length, 1);
  assert.equal(log[0].data().type, 'coins-add');
  assert.equal(log[0].data().actorUid, 'admin');
 });
});
