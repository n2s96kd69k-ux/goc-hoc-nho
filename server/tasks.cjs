// Server-owned task reward state; never trust completion flags in legacy state.
async function transactTask(db, authUid, input, clock=Date.now) {
 const guard=(ok,code)=>{if(!ok)throw Error(code);};
 const id=(v,min=1)=>typeof v==='string'&&new RegExp(`^[A-Za-z0-9_-]{${min},128}$`).test(v);
 guard(id(authUid),'unauthenticated');
 guard(input&&['task-complete','task-undo'].includes(input.type),'invalid-type');
 guard(id(input.operationId,16)&&id(input.taskId),'invalid-operation');
 guard(Number.isSafeInteger(input.expectedVersion)&&input.expectedVersion>=0,'invalid-version');
 const fingerprint=JSON.stringify({type:input.type,taskId:input.taskId,expectedVersion:input.expectedVersion});
 const ref=suffix=>db.doc(`users/${authUid}/${suffix}`);
 return db.runTransaction(async tx=>{
  const u=await tx.get(db.doc(`users/${authUid}`));guard(u.exists&&u.data().status!=='banned','access-denied');
  const receipt=ref(`economyOperations/${authUid}_${input.operationId}`),prior=await tx.get(receipt);
  if(prior.exists){guard(prior.data().fingerprint===fingerprint,'operation-conflict');return prior.data().result;}
  const walletRef=ref('economy/wallet'),taskRef=ref(`rewardTasks/${input.taskId}`);
  const ws=await tx.get(walletRef),ts=await tx.get(taskRef);
  guard(ws.exists&&ws.data().version===1,'migration-required');guard(ts.exists,'task-not-found');
  const wallet=ws.data(),task=ts.data();
  guard(Number.isSafeInteger(wallet.balance)&&wallet.balance>=0&&Number.isSafeInteger(wallet.totalEarned)&&wallet.totalEarned>=0,'invalid-wallet');
  guard(Number.isSafeInteger(task.version)&&task.version>=0&&typeof task.done==='boolean'&&typeof task.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(task.date),'invalid-task');
  guard(task.version===input.expectedVersion,'task-version-conflict');
  const now=clock(),today=new Date(now+7*3600000).toISOString().slice(0,10);
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
   next.done=done;next.version++;next.updatedAt=now;
  }
  const after=wallet.balance+delta,earned=wallet.totalEarned+Math.max(0,delta);
  guard(after<=1000000000&&earned<=1000000000,'balance-limit');
  const result={taskId:input.taskId,done:next.done,version:next.version,delta,balance:after};
  if(done!==task.done){tx.set(taskRef,next);if(dayRef)tx.set(dayRef,day);tx.update(walletRef,{balance:after,totalEarned:earned,updatedAt:now});}
  tx.create(receipt,{fingerprint,result,createdAt:now});return result;
 });
}
module.exports={transactTask};
