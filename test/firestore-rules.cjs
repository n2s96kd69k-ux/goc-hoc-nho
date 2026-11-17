const {test,before,after,beforeEach}=require('node:test');
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
