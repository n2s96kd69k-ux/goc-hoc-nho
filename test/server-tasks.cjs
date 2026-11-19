const {test}=require('node:test'),assert=require('node:assert/strict');const {transactTask}=require('../server/tasks.cjs');
function fixture(){const rows=new Map([['users/a',{status:'active'}],['users/a/economy/wallet',{version:1,balance:50,totalEarned:50}]]);let queue=Promise.resolve(),op=0;const db={doc:p=>p,runTransaction:fn=>{const job=queue.then(async()=>{const writes=[];const r=await fn({get:async p=>({exists:rows.has(p),data:()=>structuredClone(rows.get(p))}),set:(p,v)=>writes.push(()=>rows.set(p,v)),update:(p,v)=>writes.push(()=>rows.set(p,{...rows.get(p),...v})),create:(p,v)=>{assert.ok(!rows.has(p));writes.push(()=>rows.set(p,v));}});writes.forEach(f=>f());return r;});queue=job.catch(()=>{});return job;}};return {rows,task:id=>{rows.set('users/a/rewardTasks/'+id,{date:'2026-11-19',done:false,version:0,coinGain:0});const key='users/a/studyDays/2026-11-19';const day=rows.get(key)||{};rows.set(key,{...day,tasksTotal:(day.tasksTotal||0)+1});},call:(type,taskId,expectedVersion=0,extra={})=>transactTask(db,'a',{type,taskId,expectedVersion,operationId:'operation-'+String(++op).padStart(16,'0'),...extra},()=>Date.UTC(2026,10,19))};}
test('daily cap serializes across six tasks and ignores client amount',async()=>{const f=fixture();for(let i=0;i<6;i++)f.task('t'+i);const r=await Promise.all(Array.from({length:6},(_,i)=>f.call('task-complete','t'+i,0,{amount:999})));assert.equal(r.reduce((n,v)=>n+v.delta,0),25);assert.equal(r.reduce((n,v)=>n+v.weekBonus,0),100);assert.equal(f.rows.get('users/a/economy/wallet').balance,175);});
test('duplicate request is idempotent; stale version and operation reuse are rejected',async()=>{const f=fixture();f.task('t');const extra={operationId:'fixed-operation-12345'};const r=await f.call('task-complete','t',0,extra);assert.deepEqual(await f.call('task-complete','t',0,extra),r);await assert.rejects(f.call('task-undo','t',1,extra),/operation-conflict/);await assert.rejects(f.call('task-complete','t',0),/task-version-conflict/);assert.equal(f.rows.get('users/a/economy/wallet').balance,55);});
test('undo claws back coins without reopening gross daily quota',async()=>{const f=fixture();f.task('t');await f.call('task-complete','t');await f.call('task-undo','t',1);assert.equal(f.rows.get('users/a/economy/wallet').balance,50);const day=[...f.rows].find(([k])=>k.includes('/studyDays/'))[1];assert.equal(day.taskCoinsIssued,5);});
test('undo with spent reward fails atomically; unknown tasks cannot mint coins',async()=>{const f=fixture();await assert.rejects(f.call('task-complete','missing'),/task-not-found/);f.task('t');await f.call('task-complete','t');f.rows.get('users/a/economy/wallet').balance=0;await assert.rejects(f.call('task-undo','t',1),/undo-insufficient-funds/);assert.equal(f.rows.get('users/a/rewardTasks/t').done,true);});


test('moving and deleting tasks maintains both day totals without granting rewards', async () => {
 const f = fixture();
 const taskId = 'moved-task';
 await f.call('task-create', taskId, 0, {fields: {title: 'Ôn Toán', date: '2026-11-19'}});
 await f.call('task-complete', taskId);
 await f.call('task-edit', taskId, 1, {fields: {date: '2026-11-20'}});
 assert.deepEqual(f.rows.get('users/a/studyDays/2026-11-19'), {tasksTotal: 0, tasksDone: 0, taskCoinsIssued: 5});
 assert.deepEqual(f.rows.get('users/a/studyDays/2026-11-20'), {tasksTotal: 1, tasksDone: 1});
 await f.call('task-delete', taskId, 2);
 assert.deepEqual(f.rows.get('users/a/studyDays/2026-11-20'), {tasksTotal: 0, tasksDone: 0});
 assert.equal(f.rows.get('users/a/economy/wallet').balance, 55);
});

test('a week reward remains claimed after undo and re-completion', async () => {
 const f = fixture();
 for (let i = 0; i < 5; i++) f.task('week-' + i);
 for (let i = 0; i < 5; i++) await f.call('task-complete', 'week-' + i);
 await f.call('task-undo', 'week-0', 1);
 const again = await f.call('task-complete', 'week-0', 2);
 assert.equal(again.weekBonus, 0);
 assert.equal(f.rows.get('users/a/economy/wallet').balance, 170);
});
