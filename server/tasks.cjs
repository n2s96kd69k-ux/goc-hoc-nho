const {studyRewards, studyDate} = require('./study-rewards.cjs');
// Server-owned task reward state; never trust completion flags in legacy state.
const taskActions = new Set(['task-create', 'task-edit', 'task-delete', 'task-complete', 'task-undo', 'task-move', 'task-subject-delete']);
const taskFields = ['title', 'date', 'subjectId', 'minutes', 'pomodoros', 'priority', 'note', 'order'];

function validTaskDate(value) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const date = new Date(value + 'T00:00:00Z');
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseTaskFields(value, creating) {
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('invalid-task-fields');
 const keys = Object.keys(value);
 if (!keys.length || keys.some(key => !taskFields.includes(key))) throw Error('invalid-task-fields');
 const task = {};
 for (const field of taskFields) {
  if (Object.hasOwn(value, field)) task[field] = value[field];
 }
 if (creating) {
  for (const [field, fallback] of Object.entries({subjectId: null, minutes: 30, pomodoros: 1, priority: 'medium', note: ''})) {
   if (!Object.hasOwn(task, field)) task[field] = fallback;
  }
 }
 const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
 const validators = {
  title: v => typeof v === 'string' && v.trim().length > 0 && v.length <= 80,
  date: validTaskDate,
  subjectId: v => v === null || (typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v)),
  minutes: v => integer(v, 5, 600),
  pomodoros: v => integer(v, 0, 20),
  priority: v => ['low', 'medium', 'high'].includes(v),
  note: v => typeof v === 'string' && v.length <= 300,
  order: v => integer(v, 0, 1000000000),
 };
 if ((creating && (!Object.hasOwn(task, 'title') || !Object.hasOwn(task, 'date')))
  || Object.entries(task).some(([field, v]) => !validators[field](v))) throw Error('invalid-task-fields');
 if (task.title !== undefined) task.title = task.title.trim();
 return task;
}

function guard(ok, code) {
 if (!ok) throw Error(code);
}
const id = (value, minimum = 1) => typeof value === 'string' && value.length >= minimum
 && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const bulkLimit = 350;

async function findTasks(tx, ref, field, value) {
 const found = await tx.find(ref('rewardTasks'), field, value, bulkLimit + 1);
 guard(found.length <= bulkLimit, 'too-many-tasks');
 return found.filter(({data}) => data.deletedAt === undefined);
}

async function placeTask(tx, ref, task, move, now, rewards) {
 const others = (await findTasks(tx, ref, 'date', move.date)).filter(({data}) => data.id !== task.id);
 const ranked = others.some(({data}) => Number.isSafeInteger(data.order));
 const order = row => ranked ? (row.order ?? Infinity) : Number(row.done);
 others.sort(({data:a}, {data:b}) => order(a) - order(b) || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
 const index = move.beforeId ? others.findIndex(({data}) => data.id === move.beforeId) : others.length;
 guard(index !== -1, 'task-version-conflict');
 const uncheck = task.done && move.date > studyDate(now);
 const moved = {...task, date:move.date, order:index, version:task.version + 1, updatedAt:now};
 if (uncheck) Object.assign(moved, {done:false, completedAt:null, coinGain:0});
 await rewards.recordTask(task, moved);
 rewards.write(now);
 others.splice(index, 0, {data:moved, name:ref('rewardTasks/' + task.id)});
 others.forEach(({data, name}, rank) => {
  if (data.id === task.id) tx.set(name, moved);
  else if (data.order !== rank) tx.update(name, {order:rank, version:data.version + 1, updatedAt:now});
 });
 return moved;
}

async function removeSubject(tx, ref, profileRef, profile, subjectId, now) {
 const planner = profile.planner;
 guard(Array.isArray(planner?.subjects) && planner.subjects.some(subject => subject?.id === subjectId), 'subject-not-found');
 const subjects = planner.subjects.filter(subject => subject?.id !== subjectId);
 const replacement = subjects[0]?.id ?? null;
 guard(replacement === null || id(replacement), 'invalid-task-fields');
 const affected = await findTasks(tx, ref, 'subjectId', subjectId);
 for (const {data, name} of affected) {
  tx.update(name, {subjectId:replacement, version:data.version + 1, updatedAt:now});
 }
 const retiredSubjectIds = [...new Set([...(profile.retiredSubjectIds || []), subjectId])];
 tx.update(profileRef, {planner:{...planner, subjects}, retiredSubjectIds});
 return {subjectId, replacement, count:affected.length};
}

async function transactTask(db, authUid, input, clock=Date.now) {
 guard(id(authUid),'unauthenticated');
 guard(input&&taskActions.has(input.type),'invalid-type');
 const {type, taskId, expectedVersion} = input;
 const creating = type === 'task-create';
 const removingSubject = type === 'task-subject-delete';
 const moving = type === 'task-move';
 guard(id(input.operationId,16) && (removingSubject ? id(input.fields?.subjectId) : id(taskId)), 'invalid-operation');
 if (!creating && !removingSubject) guard(Number.isSafeInteger(expectedVersion)&&expectedVersion>=0,'invalid-version');
 const move = moving ? {date: input.fields?.date, beforeId: input.fields?.beforeId ?? null} : null;
 if (moving) guard(validTaskDate(move.date) && (move.beforeId === null || (id(move.beforeId) && move.beforeId !== taskId)), 'invalid-task-fields');
 const fields = creating || type === 'task-edit' ? parseTaskFields(input.fields, creating) : null;
 const fingerprint = fields
  ? JSON.stringify({type, taskId, expectedVersion: creating ? undefined : expectedVersion, fields})
  : JSON.stringify({type, taskId, expectedVersion, move: move || undefined,
   subjectId: removingSubject ? input.fields.subjectId : undefined});
 const ref=suffix=>db.doc(`users/${authUid}/${suffix}`);
 return db.runTransaction(async tx=>{
  const profileRef = db.doc(`users/${authUid}`);
  const u=await tx.get(profileRef);guard(u.exists&&u.data().status!=='banned','access-denied');
  const receipt=ref(`economyOperations/${authUid}_${input.operationId}`),prior=await tx.get(receipt);
  if(prior.exists){guard(prior.data().fingerprint===fingerprint,'operation-conflict');return prior.data().result;}
  const walletRef=ref('economy/wallet');
  const ws=await tx.get(walletRef);
  guard(ws.exists&&ws.data().version===1,'migration-required');
  const wallet=ws.data(), now=clock();
  guard(Number.isSafeInteger(wallet.balance)&&wallet.balance>=0&&Number.isSafeInteger(wallet.totalEarned)&&wallet.totalEarned>=0,'invalid-wallet');
  if (removingSubject) {
   const result = await removeSubject(tx, ref, profileRef, u.data(), input.fields.subjectId, now);
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  const taskRef=ref(`rewardTasks/${taskId}`);
  const ts=await tx.get(taskRef), task=ts.data();
  if (fields?.subjectId) {
   guard(!(u.data().retiredSubjectIds || []).includes(fields.subjectId), 'subject-not-found');
  }
  const rewards = studyRewards(tx, ref);
  if (creating) {
   guard(!ts.exists, 'task-id-in-use');
   const next = {id: taskId, ...fields, done: false, coinGain: 0, version: 0, createdAt: now, updatedAt: now, completedAt: null};
   const result = {task: next, balance: wallet.balance};
   await rewards.recordTask(null, next);
   rewards.write(now);
   tx.create(taskRef, next);
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  guard(ts.exists && task.deletedAt === undefined, 'task-not-found');
  guard(Number.isSafeInteger(task.version)&&task.version>=0&&typeof task.done==='boolean'&&typeof task.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(task.date),'invalid-task');
  guard(task.version===input.expectedVersion,'task-version-conflict');
  if (moving) {
   const result = {task:await placeTask(tx, ref, task, move, now, rewards), balance:wallet.balance};
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  if (type === 'task-edit' || type === 'task-delete') {
   const version = task.version + 1;
   const next = type === 'task-delete'
    ? {id: taskId, version, deletedAt: now}
    : {...task, ...fields, id: taskId, version, updatedAt: now};
   const result = {task: next, balance: wallet.balance};
   await rewards.recordTask(task, type === 'task-delete' ? null : next);
   rewards.write(now);
   tx.set(taskRef, next);
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  const today = studyDate(now);
  const done = type === 'task-complete';
  const changed = done !== task.done;
  const next = {...task};
  let delta = 0, weekBonus = 0, streak = null;
  if (changed) {
   if (done) {
    const usage = await rewards.recordDay(today, {taskCoinsIssued: 0});
    const issued = usage.taskCoinsIssued;
    guard(issued <= 25, 'invalid-study-day');
    delta = Math.min(5, 25 - issued);
    await rewards.recordDay(today, {taskCoinsIssued: delta});
    next.coinGain = delta;
    next.rewardDate = today;
   } else {
    guard(Number.isSafeInteger(task.coinGain)&&task.coinGain>=0&&task.coinGain<=5,'invalid-task');
    guard(wallet.balance>=task.coinGain,'undo-insufficient-funds');
    delta = -task.coinGain;
    next.coinGain = 0;
   }
   Object.assign(next, {done, completedAt: done ? now : null, version: next.version + 1, updatedAt: now});
   await rewards.recordTask(task, next);
   if (done) weekBonus = await rewards.weekly(next.date);
   streak = await rewards.streak(today);
  }
  const bonuses = weekBonus + (streak?.events || []).reduce((sum, event) => sum + event.coins, 0);
  const after = wallet.balance + delta + bonuses;
  const earned = wallet.totalEarned + Math.max(0, delta) + bonuses;
  guard(after <= 1000000000 && earned <= 1000000000, 'balance-limit');
  const result = {task: next, taskId, done: next.done, version: next.version, delta, weekBonus, streak, balance: after};
  if (changed) {
   rewards.write(now);
   tx.set(taskRef, next);
   tx.update(walletRef, {balance: after, totalEarned: earned, updatedAt: now});
  }
  tx.create(receipt,{fingerprint,result,createdAt:now});return result;
 });
}
module.exports={transactTask,parseTaskFields};
