// Trusted runtime only. authUid and clock must never come from request JSON.
async function transactFocus(db, authUid, input, clock = Date.now) {
 const requireValue=(ok,code)=>{if(!ok)throw Error(code);};
 const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(v);
 requireValue(typeof authUid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(authUid),'unauthenticated');
 requireValue(input&&['focus-start','focus-pause','focus-resume','focus-complete','focus-cancel'].includes(input.type),'invalid-type');
 requireValue(id(input.operationId)&&id(input.sessionId),'invalid-operation');
 const type=input.type, minutes=type==='focus-start'?input.minutes:null;
 if(type==='focus-start')requireValue(Number.isInteger(minutes)&&minutes>=1&&minutes<=180,'invalid-duration');
 const subjectId=type==='focus-start'?(input.subjectId??null):null;
 requireValue(subjectId===null||(typeof subjectId==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(subjectId)),'invalid-subject');
 const fingerprint=JSON.stringify({type,sessionId:input.sessionId,minutes,subjectId});
 const user=db.doc(`users/${authUid}`),wallet=db.doc(`users/${authUid}/economy/wallet`),session=db.doc(`users/${authUid}/focusSessions/${input.sessionId}`),receipt=db.doc(`users/${authUid}/economyOperations/${authUid}_${input.operationId}`);
 return db.runTransaction(async tx=>{
  const now=clock(),u=await tx.get(user);requireValue(u.exists&&u.data().status!=='banned','access-denied');
  const prior=await tx.get(receipt);if(prior.exists){requireValue(prior.data().fingerprint===fingerprint,'operation-conflict');return prior.data().result;}
  const w=await tx.get(wallet),s=await tx.get(session);requireValue(w.exists&&w.data().version===1,'migration-required');
  const balance=w.data().balance,earned=w.data().totalEarned;
  requireValue(Number.isSafeInteger(balance)&&balance>=0&&Number.isSafeInteger(earned)&&earned>=0,'invalid-wallet');
  let next,result,dayRef,day;
  if(type==='focus-start'){
   requireValue(!s.exists,'session-exists');requireValue(!w.data().activeSessionId,'active-session-exists');
   next={status:'running',durationMs:minutes*60000,elapsedMs:0,resumedAt:now,createdAt:now,expiresAt:now+86400000,subjectId,date:new Date(now+7*3600000).toISOString().slice(0,10)};
   result={sessionId:input.sessionId,status:'running',remainingSeconds:minutes*60};
  }else{
   requireValue(s.exists,'session-not-found');next={...s.data()};
   // Finishing twice with different operation IDs returns the persisted result.
   if(type==='focus-complete'&&next.status==='completed'){
    result=next.result;tx.create(receipt,{fingerprint,result,createdAt:now});return result;
   }
   requireValue(w.data().activeSessionId===input.sessionId,'session-not-active');
   requireValue(['running','paused'].includes(next.status),'session-closed');
   if(type!=='focus-cancel')requireValue(now<=next.expiresAt,'session-expired');
   const elapsed=next.elapsedMs+(next.status==='running'?Math.max(0,now-next.resumedAt):0);
   if(type==='focus-complete'){
    requireValue(elapsed>=next.durationMs,'focus-too-early');
    const reward=next.durationMs/60000;
    requireValue(balance+reward<=1000000000&&earned+reward<=1000000000,'balance-limit');
    dayRef=db.doc(`users/${authUid}/studyDays/${next.date}`);const ds=await tx.get(dayRef);day=ds.exists?ds.data():{};
    for(const field of ['focusMinutes','pomodoros'])requireValue(day[field]===undefined||(Number.isSafeInteger(day[field])&&day[field]>=0),'invalid-study-day');
    day={...day,focusMinutes:(day.focusMinutes||0)+reward,pomodoros:(day.pomodoros||0)+1};
    result={sessionId:input.sessionId,status:'completed',reward,balance:balance+reward};next={...next,status:'completed',elapsedMs:next.durationMs,result,completedAt:now};
   }else if(type==='focus-cancel'){next.status='cancelled';next.elapsedMs=elapsed;result={sessionId:input.sessionId,status:'cancelled'};}
   else{
    requireValue(type==='focus-pause'?next.status==='running':next.status==='paused','invalid-transition');
    next.elapsedMs=elapsed;next.status=type==='focus-pause'?'paused':'running';next.resumedAt=now;
    result={sessionId:input.sessionId,status:next.status,remainingSeconds:Math.max(0,Math.ceil((next.durationMs-elapsed)/1000))};
   }
  }
  tx.set(session,next);
  const closed=['completed','cancelled'].includes(next.status);
  const patch={activeSessionId:closed?null:input.sessionId,updatedAt:now};
  if(next.status==='completed'){Object.assign(patch,{balance:result.balance,totalEarned:earned+result.reward});tx.set(dayRef,day);}
  tx.update(wallet,patch);tx.create(receipt,{fingerprint,result,createdAt:now});return result;
 });
}
module.exports={transactFocus};
