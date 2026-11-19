// Server-owned task reward state; never trust completion flags in legacy state.
const taskActions = new Set(['task-create', 'task-edit', 'task-delete', 'task-complete', 'task-undo']);
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

async function transactTask(db, authUid, input, clock=Date.now) {
 const guard=(ok,code)=>{if(!ok)throw Error(code);};
 const id=(v,min=1)=>typeof v==='string'&&new RegExp(`^[A-Za-z0-9_-]{${min},128}$`).test(v);
 guard(id(authUid),'unauthenticated');
 guard(input&&taskActions.has(input.type),'invalid-type');
 guard(id(input.operationId,16)&&id(input.taskId),'invalid-operation');
 const {type, taskId, expectedVersion} = input;
 const creating = type === 'task-create';
 if (!creating) guard(Number.isSafeInteger(expectedVersion)&&expectedVersion>=0,'invalid-version');
 const fields = creating || type === 'task-edit' ? parseTaskFields(input.fields, creating) : null;
 const fingerprint = fields
  ? JSON.stringify({type, taskId, expectedVersion: creating ? undefined : expectedVersion, fields})
  : JSON.stringify({type, taskId, expectedVersion});
 const ref=suffix=>db.doc(`users/${authUid}/${suffix}`);
 return db.runTransaction(async tx=>{
  const u=await tx.get(db.doc(`users/${authUid}`));guard(u.exists&&u.data().status!=='banned','access-denied');
  const receipt=ref(`economyOperations/${authUid}_${input.operationId}`),prior=await tx.get(receipt);
  if(prior.exists){guard(prior.data().fingerprint===fingerprint,'operation-conflict');return prior.data().result;}
  const walletRef=ref('economy/wallet'),taskRef=ref(`rewardTasks/${input.taskId}`);
  const ws=await tx.get(walletRef),ts=await tx.get(taskRef);
  guard(ws.exists&&ws.data().version===1,'migration-required');
  const wallet=ws.data(), task=ts.data(), now=clock();
  guard(Number.isSafeInteger(wallet.balance)&&wallet.balance>=0&&Number.isSafeInteger(wallet.totalEarned)&&wallet.totalEarned>=0,'invalid-wallet');
  if (creating) {
   guard(!ts.exists, 'task-id-in-use');
   const next = {id: taskId, ...fields, done: false, coinGain: 0, version: 0, createdAt: now, updatedAt: now, completedAt: null};
   const result = {task: next, balance: wallet.balance};
   tx.create(taskRef, next);
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  guard(ts.exists && task.deletedAt === undefined, 'task-not-found');
  guard(Number.isSafeInteger(task.version)&&task.version>=0&&typeof task.done==='boolean'&&typeof task.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(task.date),'invalid-task');
  guard(task.version===input.expectedVersion,'task-version-conflict');
  if (type === 'task-edit' || type === 'task-delete') {
   const version = task.version + 1;
   const next = type === 'task-delete'
    ? {id: taskId, version, deletedAt: now}
    : {...task, ...fields, id: taskId, version, updatedAt: now};
   const result = {task: next, balance: wallet.balance};
   tx.set(taskRef, next);
   tx.create(receipt, {fingerprint, result, createdAt: now});
   return result;
  }
  const today=new Date(now+7*3600000).toISOString().slice(0,10);
  const done=input.type==='task-complete';
  let delta=0,dayRef,day,next={...task};
  if(done!==task.done){
   if(done){
    // Rewards are issued on today's quota; historical task dates cannot bypass it.
    dayRef=ref(`studyDays/${today}`);const ds=await tx.get(dayRef);day=ds.exists?ds.data():{};
    const issued=day.taskCoinsIssued||0;
    guard(Number.isSafeInteger(issued)&&issued>=0&&issued<=25,'invalid-study-day');
    delta=Math.min(5,25-issued);
    day={...day,taskCoinsIssued:issued+delta};next.coinGain=delta;next.rewardDate=today;
   }else{
    guard(Number.isSafeInteger(task.coinGain)&&task.coinGain>=0&&task.coinGain<=5,'invalid-task');
    guard(wallet.balance>=task.coinGain,'undo-insufficient-funds');delta=-task.coinGain;next.coinGain=0;
   }
   next.done=done;next.completedAt=done?now:null;next.version++;next.updatedAt=now;
  }
  const after=wallet.balance+delta,earned=wallet.totalEarned+Math.max(0,delta);
  guard(after<=1000000000&&earned<=1000000000,'balance-limit');
  const result={taskId:input.taskId,done:next.done,version:next.version,delta,balance:after};
  if(done!==task.done){tx.set(taskRef,next);if(dayRef)tx.set(dayRef,day);tx.update(walletRef,{balance:after,totalEarned:earned,updatedAt:now});}
  tx.create(receipt,{fingerprint,result,createdAt:now});return result;
 });
}
module.exports={transactTask};
