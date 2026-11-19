const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('worker health exposes configuration flags only and rejects unauthenticated writes',async()=>{const {default:worker}=await import('../worker/index.mjs');const env={FIREBASE_PROJECT_ID:'project',FIREBASE_SERVICE_ACCOUNT:'secret-json',FIREBASE_WEB_API_KEY:'public-key'};const r=await worker.fetch(new Request('https://worker/health'),env);const text=await r.text();assert.ok(!text.includes('secret-json'));assert.equal(JSON.parse(text).configured,true);assert.equal((await worker.fetch(new Request('https://worker/api/economy',{method:'POST',body:'{}'}),env)).status,401);assert.equal((await worker.fetch(new Request('https://worker/health',{headers:{Origin:'https://evil.example'}}),env)).status,403);});
test('Firestore REST values round trip and reject unsupported values',async()=>{const {encode,decode}=await import('../worker/transport.mjs');const data={balance:50,active:true,items:['a',null],nested:{quantity:2}};assert.deepEqual(decode(encode(data)),data);assert.throws(()=>encode(undefined));});
test('Firebase authentication uses token lookup, rejects disabled users',async()=>{const {verifiedUid}=await import('../worker/transport.mjs');const original=global.fetch;try{global.fetch=async(url,opts)=>{assert.ok(url.startsWith('https://identitytoolkit.googleapis.com/'));assert.equal(JSON.parse(opts.body).idToken,'test-token');return Response.json({users:[{localId:'a'}]});};assert.equal(await verifiedUid(new Request('https://worker',{headers:{Authorization:'Bearer test-token'}}),{FIREBASE_WEB_API_KEY:'key'}),'a');global.fetch=async()=>Response.json({users:[{localId:'a',disabled:true}]});await assert.rejects(verifiedUid(new Request('https://worker',{headers:{Authorization:'Bearer test-token'}}),{FIREBASE_WEB_API_KEY:'key'}),/unauthenticated/);}finally{global.fetch=original;}});
test('single-file dashboard bundle is current',()=>{const before=fs.readFileSync(__dirname+'/../worker/worker.js','utf8');require('../worker/build.cjs');assert.equal(fs.readFileSync(__dirname+'/../worker/worker.js','utf8'),before);});
test('authenticated admin diagnostic reads Firestore without creating a wallet; members are rejected',async()=>{
 const {default:worker}=await import('../worker/index.mjs');
 const {privateKey}=require('node:crypto').generateKeyPairSync('rsa',{modulusLength:2048});
 const env={FIREBASE_PROJECT_ID:'project',FIREBASE_WEB_API_KEY:'key',FIREBASE_SERVICE_ACCOUNT:JSON.stringify({project_id:'project',client_email:'worker@test',private_key:privateKey.export({type:'pkcs8',format:'pem'})})};
 const original=global.fetch;let role='admin', reads=0;
 try{
  global.fetch=async(url,opts={})=>{
   if(String(url).includes('identitytoolkit'))return Response.json({users:[{localId:'admin'}]});
   if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'fake-service-token',expires_in:3600});
   assert.equal(opts.method,undefined);assert.equal(opts.headers.Authorization,'Bearer fake-service-token');reads++;
   if(String(url).endsWith('/economy/wallet'))return Response.json({error:{}},{status:404});
   return Response.json({fields:{role:{stringValue:role}}});
  };
  const req=()=>new Request('https://worker/api/status',{headers:{Authorization:'Bearer id-token',Origin:'https://gochocnho.id.vn'}});
  const response=await worker.fetch(req(),env),data=await response.json();assert.equal(response.status,200);assert.equal(data.firestoreConnected,true);assert.equal(data.canonicalWalletExists,false);assert.equal(reads,2);
  role='member';assert.equal((await worker.fetch(req(),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://worker/api/status'),env)).status,401);
 }finally{global.fetch=original;}
});
