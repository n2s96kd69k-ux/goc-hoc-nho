// Trusted-server module. Never import this module into the browser.
const OWNER_UID = 'Vyd1sYXrKARaTujn0ucX0XFe0gp2';
const MAX = 1000000000;
function check(ok, message) { if (!ok) throw new Error(message); }
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const balance = n => Number.isSafeInteger(n) && n >= 0 && n <= MAX;

/** db is an Admin SDK Firestore instance. authUid MUST come from verified auth. */
async function transactEconomy(db, authUid, input, serverTimestamp) {
  check(validId(authUid), 'unauthenticated');
  check(input && ['buy', 'admin-add', 'admin-set'].includes(input.type), 'invalid-type');
  check(validId(input.operationId) && input.operationId.length >= 16, 'invalid-operation');
  const type = input.type;
  const uid = type === 'buy' ? authUid : input.targetUid;
  check(validId(uid), 'invalid-target');
  const itemId = type === 'buy' ? input.itemId : null;
  if (type === 'buy') check(validId(itemId), 'invalid-item');
  else {
    check(balance(input.amount), 'invalid-amount');
    check(type !== 'admin-add' || input.amount > 0, 'invalid-amount');
    check(typeof input.reason === 'string' && input.reason.trim().length >= 3 && input.reason.length <= 300, 'invalid-reason');
  }
  const request = {type, uid, itemId, amount:type === 'buy' ? null : input.amount, reason:type === 'buy' ? '' : input.reason.trim()};
  const fingerprint = JSON.stringify(request);
  const user = db.doc(`users/${uid}`), actor = db.doc(`users/${authUid}`);
  const wallet = db.doc(`users/${uid}/economy/wallet`);
  // Actor-scoped key prevents one administrator colliding with another's retry ID.
  const receiptId = `${authUid}_${input.operationId}`;
  const receipt = db.doc(`users/${uid}/economyOperations/${receiptId}`);
  return db.runTransaction(async tx => {
    const actorSnap = await tx.get(actor);
    const actorData = actorSnap.data() || {};
    check(actorSnap.exists && actorData.status !== 'banned', 'access-denied');
    if(type !== 'buy') check(authUid === OWNER_UID || actorData.role === 'admin', 'admin-required');
    const prior = await tx.get(receipt);
    if(prior.exists) {
      check(prior.data().fingerprint === fingerprint, 'operation-conflict');
      return prior.data().result;
    }
    const userSnap = await tx.get(user), walletSnap = await tx.get(wallet);
    check(userSnap.exists && userSnap.data().status !== 'banned', 'target-unavailable');
    check(walletSnap.exists && walletSnap.data().version === 1, 'migration-required');
    const old = walletSnap.data();
    check(balance(old.balance) && balance(old.totalEarned), 'invalid-wallet');
    let after, ownedRef, quantity, def;
    if(type === 'buy') {
      const catalog = await tx.get(db.doc(`catalog/${itemId}`));
      check(catalog.exists, 'item-unavailable');def = catalog.data();
      check(def.active === true && balance(def.price) && Number.isSafeInteger(def.maxQty) && def.maxQty > 0, 'invalid-catalog');
      ownedRef = db.doc(`users/${uid}/ownedItems/${itemId}`);
      const owned = await tx.get(ownedRef);quantity = owned.exists ? owned.data().quantity : 0;
      check(Number.isSafeInteger(quantity) && quantity >= 0 && quantity < def.maxQty, 'quantity-limit');
      check(old.balance >= def.price, 'insufficient-funds');after = old.balance - def.price;
    } else after = type === 'admin-set' ? input.amount : old.balance + input.amount;
    check(balance(after), 'balance-limit');
    const earned = old.totalEarned + Math.max(0, after-old.balance);
    check(balance(earned), 'earned-limit');
    const result = {balance:after,delta:after-old.balance,...(type==='buy'?{itemId,quantity:quantity+1}:{})};
    const createdAt = serverTimestamp();
    tx.update(wallet, {balance:after,totalEarned:earned,updatedAt:createdAt});
    if(ownedRef)tx.set(ownedRef,{quantity:quantity+1,updatedAt:createdAt});
    tx.create(receipt,{actorUid:authUid,fingerprint,request,result,createdAt});
    if(type !== 'buy') {
      tx.create(db.doc(`adminLogs/${receiptId}`),{actorUid:authUid,targetUid:uid,type,requestedValue:input.amount,before:old.balance,after,reason:request.reason,createdAt});
      tx.create(db.doc(`users/${uid}/notifications/${receiptId}`),{type:'personal',content:`Số dư được quản trị viên điều chỉnh thành ${after} xu. ${request.reason}`,createdAt});
    }
    return result;
  });
}


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


const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64 = v => b64(enc.encode(JSON.stringify(v)));
let cachedToken;
async function credentials(env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if(account.project_id !== env.FIREBASE_PROJECT_ID || !account.private_key || !account.client_email) throw Error('configuration-error');
  return account;
}
async function accessToken(env) {
  const account=await credentials(env), now=Math.floor(Date.now()/1000);
  if(cachedToken?.email===account.client_email && cachedToken.exp>now+60)return cachedToken.token;
  const unsigned=json64({alg:'RS256',typ:'JWT'})+'.'+json64({iss:account.client_email,scope:'https://www.googleapis.com/auth/datastore',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const pem=account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,'');
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,enc.encode(unsigned));
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(new Uint8Array(signature))})});
  const result=await response.json();if(!response.ok || !result.access_token)throw Error('service-auth-failed');
  cachedToken={email:account.client_email,exp:now+result.expires_in,token:result.access_token};return result.access_token;
}
async function verifiedUid(request,env) {
  const match=/^Bearer ([^\s]+)$/.exec(request.headers.get('Authorization')||'');
  if(!match || match[1].length>16000)throw Error('unauthenticated');
  if(!env.FIREBASE_WEB_API_KEY)throw Error('configuration-error');
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:match[1]})});
  const data=await response.json();
  if(!response.ok || !data.users?.[0]?.localId || data.users[0].disabled)throw Error('unauthenticated');
  return data.users[0].localId;
}
function encode(value) {
  if(value===null)return {nullValue:null};
  if(value instanceof Date)return {timestampValue:value.toISOString()};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number'&&Number.isFinite(value))return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  if(value && typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
  throw Error('invalid-value');
}
function decode(value) {
  if('nullValue'in value)return null;
  for(const key of ['stringValue','booleanValue','timestampValue'])if(key in value)return value[key];
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return value.doubleValue;
  if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);
  return Object.fromEntries(Object.entries(value.mapValue?.fields||{}).map(([k,v])=>[k,decode(v)]));
}
function firestore(env) {
  const base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)`;
  const prefix=`projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/`;
  async function api(path,body) {
    const response=await fetch(base+path,{method:'POST',headers:{Authorization:'Bearer '+await accessToken(env),'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok){throw Object.assign(new Error('database-error'), {retry:data.error?.status==='ABORTED'});}return data;
  }
  return {doc:path=>prefix+path,async runTransaction(fn){
    for(let attempt=0;attempt<4;attempt++){
      const {transaction}=await api('/documents:beginTransaction',{options:{readWrite:{}}});const writes=[];
      try{
        const result=await fn({
          get:async name=>{const rows=await api('/documents:batchGet',{documents:[name],transaction});const found=rows.find(r=>r.found)?.found;return {exists:!!found,data:()=>found?decode({mapValue:{fields:found.fields}}):undefined};},
          set:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields}}),
          create:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields},currentDocument:{exists:false}}),
          update:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields},updateMask:{fieldPaths:Object.keys(value)},currentDocument:{exists:true}}),
        });
        await api('/documents:commit',{transaction,writes});return result;
      }catch(error){await api('/documents:rollback',{transaction}).catch(()=>{});if(!error.retry||attempt===3)throw error;}
    }
  }};
}

async function readDocument(env, path) {
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response=await fetch(url,{headers:{Authorization:'Bearer '+await accessToken(env)}});
  if(response.status===404)return null;
  if(!response.ok)throw Error('database-error');
  const doc=await response.json();return decode({mapValue:{fields:doc.fields}});
}

export default {async fetch(request,env){
  const origin=request.headers.get('Origin');
  const allowed=['https://gochocnho.id.vn','https://www.gochocnho.id.vn'];
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(allowed.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowed.includes(origin))return reply({error:'origin-denied'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return reply({ok:true,service:'goc-hoc-nho-api',configured:!!(env.FIREBASE_PROJECT_ID&&env.FIREBASE_SERVICE_ACCOUNT&&env.FIREBASE_WEB_API_KEY),walletMigrationEnabled:false});
  const diagnostic=path==='/api/status'&&request.method==='GET';
  if(!diagnostic&&(path!=='/api/economy'||request.method!=='POST'))return reply({error:'not-found'},404);
  try{
    const uid=await verifiedUid(request,env);
    if(diagnostic){
      const account=await readDocument(env,`users/${uid}`);
      if(!account || account.status==='banned')throw Error('access-denied');
      if(uid!=='Vyd1sYXrKARaTujn0ucX0XFe0gp2' && account.role!=='admin')throw Error('admin-required');
      const wallet=await readDocument(env,`users/${uid}/economy/wallet`);
      return reply({ok:true,authenticated:true,firestoreConnected:true,canonicalWalletExists:wallet!==null,walletMigrationEnabled:false});
    }
    const text=await request.text();if(text.length>8192)return reply({error:'request-too-large'},413);
    const command=JSON.parse(text);
    const result=typeof command?.type==='string'&&command.type.startsWith('focus-')
      ? await transactFocus(firestore(env),uid,command)
      : typeof command?.type==='string'&&command.type.startsWith('task-')
        ? await transactTask(firestore(env),uid,command)
        : await transactEconomy(firestore(env),uid,command,()=>new Date());return reply({ok:true,result});
  }catch(error){
    const message=error.message;
    const status=message==='unauthenticated'?401:['access-denied','admin-required','target-unavailable'].includes(message)?403:['configuration-error','service-auth-failed','database-error'].includes(message)?503:400;
    const known=['invalid-version','task-not-found','invalid-task','task-version-conflict','undo-insufficient-funds','invalid-duration','invalid-subject','session-exists','active-session-exists','session-not-found','session-not-active','session-closed','session-expired','focus-too-early','invalid-transition','invalid-study-day','unauthenticated','access-denied','admin-required','target-unavailable','migration-required','operation-conflict','insufficient-funds','quantity-limit','balance-limit','earned-limit','item-unavailable','invalid-wallet','invalid-catalog','configuration-error','service-auth-failed','database-error','invalid-type','invalid-operation','invalid-target','invalid-item','invalid-amount','invalid-reason'];
    return reply({ok:false,error:known.includes(message)?message:'invalid-request'},status);
  }
}};
