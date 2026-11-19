const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const json64 = v => b64(enc.encode(JSON.stringify(v)));
let cachedToken;
async function credentials(env) {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if(account.project_id !== env.FIREBASE_PROJECT_ID || !account.private_key || !account.client_email) throw Error('configuration-error');
  return account;
}
export async function accessToken(env) {
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
export async function verifiedUid(request,env) {
  const match=/^Bearer ([^\s]+)$/.exec(request.headers.get('Authorization')||'');
  if(!match || match[1].length>16000)throw Error('unauthenticated');
  if(!env.FIREBASE_WEB_API_KEY)throw Error('configuration-error');
  const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(env.FIREBASE_WEB_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:match[1]})});
  const data=await response.json();
  if(!response.ok || !data.users?.[0]?.localId || data.users[0].disabled)throw Error('unauthenticated');
  return data.users[0].localId;
}
export function encode(value) {
  if(value===null)return {nullValue:null};
  if(value instanceof Date)return {timestampValue:value.toISOString()};
  if(typeof value==='string')return {stringValue:value};
  if(typeof value==='boolean')return {booleanValue:value};
  if(typeof value==='number'&&Number.isFinite(value))return Number.isSafeInteger(value)?{integerValue:String(value)}:{doubleValue:value};
  if(Array.isArray(value))return {arrayValue:{values:value.map(encode)}};
  if(value && typeof value==='object')return {mapValue:{fields:Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]))}};
  throw Error('invalid-value');
}
export function decode(value) {
  if('nullValue'in value)return null;
  for(const key of ['stringValue','booleanValue','timestampValue'])if(key in value)return value[key];
  if('integerValue'in value)return Number(value.integerValue);
  if('doubleValue'in value)return value.doubleValue;
  if('arrayValue'in value)return (value.arrayValue.values||[]).map(decode);
  return Object.fromEntries(Object.entries(value.mapValue?.fields||{}).map(([k,v])=>[k,decode(v)]));
}
export function firestore(env) {
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
        const getAll = async (...names) => {
          const rows = await api('/documents:batchGet', {documents: names, transaction});
          const documents = new Map(rows.map(row => [row.found?.name || row.missing, row.found]));
          return names.map(name => {
            const document = documents.get(name);
            return {exists: !!document, data: () => document ? decode({mapValue: {fields: document.fields}}) : undefined};
          });
        };
        const result=await fn({
          get: async name => (await getAll(name))[0],
          getAll,
          set:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields}}),
          create:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields},currentDocument:{exists:false}}),
          update:(name,value)=>writes.push({update:{name,fields:encode(value).mapValue.fields},updateMask:{fieldPaths:Object.keys(value)},currentDocument:{exists:true}}),
        });
        await api('/documents:commit',{transaction,writes});return result;
      }catch(error){await api('/documents:rollback',{transaction}).catch(()=>{});if(!error.retry||attempt===3)throw error;}
    }
  }};
}

export async function readDocument(env, path) {
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/databases/(default)/documents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const response=await fetch(url,{headers:{Authorization:'Bearer '+await accessToken(env)}});
  if(response.status===404)return null;
  if(!response.ok)throw Error('database-error');
  const doc=await response.json();return decode({mapValue:{fields:doc.fields}});
}
