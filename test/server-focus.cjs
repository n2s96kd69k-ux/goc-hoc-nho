const {test}=require('node:test'),assert=require('node:assert/strict');
const {transactFocus}=require('../server/focus.cjs');
function fixture(start=100000){let now=start,queue=Promise.resolve();const rows=new Map([['users/a',{status:'active'}],['users/a/economy/wallet',{version:1,balance:50,totalEarned:50}]]);const db={doc:p=>p,runTransaction:fn=>{const job=queue.then(async()=>{const writes=[];const result=await fn({get:async p=>({exists:rows.has(p),data:()=>structuredClone(rows.get(p))}),set:(p,v)=>writes.push(()=>rows.set(p,v)),update:(p,v)=>writes.push(()=>rows.set(p,{...rows.get(p),...v})),create:(p,v)=>{assert.ok(!rows.has(p));writes.push(()=>rows.set(p,v));}});writes.forEach(f=>f());return result;});queue=job.catch(()=>{});return job;}};let op=0;return {rows,advance:ms=>now+=ms,call:(type,extra={})=>transactFocus(db,'a',{type,operationId:'operation-'+String(++op).padStart(16,'0'),sessionId:'session-1234567890',...extra},()=>now)};}
test('server elapsed time gates reward, client supplied amount is ignored and completion is idempotent',async()=>{const f=fixture();await f.call('focus-start',{minutes:1});await assert.rejects(f.call('focus-complete',{amount:999}),/focus-too-early/);f.advance(60000);const r=await f.call('focus-complete',{amount:999});assert.equal(r.reward,1);assert.deepEqual(await f.call('focus-complete'),r);assert.equal(f.rows.get('users/a/economy/wallet').balance,51);assert.equal([...f.rows].find(([k])=>k.includes('/studyDays/'))[1].pomodoros,1);});
test('paused time is excluded and only one session is active',async()=>{const f=fixture();await f.call('focus-start',{minutes:1});await assert.rejects(f.call('focus-start',{sessionId:'session-2222222222',minutes:1}),/active-session-exists/);f.advance(30000);await f.call('focus-pause');f.advance(600000);await f.call('focus-resume');await assert.rejects(f.call('focus-complete'),/focus-too-early/);f.advance(30000);await f.call('focus-complete');assert.equal(f.rows.get('users/a/economy/wallet').balance,51);});
test('two concurrent completion requests credit exactly once',async()=>{const f=fixture();await f.call('focus-start',{minutes:1});f.advance(60000);await Promise.all([f.call('focus-complete'),f.call('focus-complete')]);assert.equal(f.rows.get('users/a/economy/wallet').balance,51);});
test('cancel releases account lock without reward; invalid duration and banned account fail',async()=>{const f=fixture();await assert.rejects(f.call('focus-start',{minutes:0}),/invalid-duration/);await f.call('focus-start',{minutes:25});await f.call('focus-cancel');assert.equal(f.rows.get('users/a/economy/wallet').activeSessionId,null);assert.equal(f.rows.get('users/a/economy/wallet').balance,50);f.rows.set('users/a',{status:'banned'});await assert.rejects(f.call('focus-start',{minutes:25}),/access-denied/);});


test('fourteen eligible days pay both milestones once across retries and midnight', async () => {
 const now = Date.UTC(2026, 10, 19, 15);
 const f = fixture(now);
 for (let i = 0; i < 14; i++) {
  const day = new Date(now - i * 86400000).toISOString().slice(0, 10);
  f.rows.set('users/a/studyDays/' + day, {focusMinutes: i === 0 ? 44 : 45, tasksDone: 3, tasksTotal: 3});
 }
 await f.call('focus-start', {minutes: 1});
 f.advance(60000);
 const completed = await f.call('focus-complete');
 assert.deepEqual(completed.streak, {current: 14, events: [{milestone: 7, coins: 50}, {milestone: 14, coins: 100}]});
 assert.equal(completed.balance, 201);
 assert.deepEqual(await f.call('focus-complete'), completed);

 f.advance(2 * 3600000);
 const next = {sessionId: 'session-2222222222'};
 await f.call('focus-start', {...next, minutes: 1});
 f.advance(60000);
 const afterMidnight = await f.call('focus-complete', next);
 assert.deepEqual(afterMidnight.streak, {current: 14, events: []});
 assert.equal(afterMidnight.balance, 202);
});

test('starting a new session releases an expired session without awarding coins', async () => {
 const f = fixture();
 await f.call('focus-start', {minutes: 25});
 f.advance(86400001);
 const sessionId = 'session-2222222222';
 await f.call('focus-start', {minutes: 25, sessionId});
 assert.equal(f.rows.get('users/a/focusSessions/session-1234567890').cancellationReason, 'expired');
 assert.equal(f.rows.get('users/a/economy/wallet').activeSessionId, sessionId);
 await assert.rejects(f.call('focus-complete'), /session-not-active/);
 assert.equal(f.rows.get('users/a/economy/wallet').balance, 50);
});

test('stale pause cannot interrupt a session that was paused and resumed on another device', async () => {
 const f = fixture();
 await f.call('focus-start', {minutes: 25, taskId: 'task-math'});
 await f.call('focus-pause', {expectedRevision: 0});
 await f.call('focus-resume', {expectedRevision: 1});
 await assert.rejects(f.call('focus-pause', {expectedRevision: 0}), /focus-version-conflict/);
 const session = f.rows.get('users/a/focusSessions/session-1234567890');
 assert.equal(session.status, 'running');
 assert.equal(session.revision, 2);
 assert.equal(session.taskId, 'task-math');
});
