const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(d);});});
const fixtureCloud=role=>`
 let access={uid:'admin',role:'${role}',status:'active',ready:true,owner:true,adminCredits:0};let listener;
 const user={uid:'admin',email:'admin@example.test',displayName:'Admin'};
 export const OWNER_UID='admin';export const OWNER_ID='GHN-776J9W';export const firebaseDb=()=>({});export const getCurrentUser=()=>user;
 export const accountId=()=> 'GHN-ADMIN1';export const isCurrentAdmin=()=>access.role==='admin';export const getAccountAccess=()=>access;
 export const requireAdmin=async()=>isCurrentAdmin()?user:null;
 export function onAccountAccessChange(fn){listener=fn;setTimeout(()=>fn(access),0);return ()=>{};}
 window.__testRevoke=()=>{access={...access,role:'member'};listener(access);};
 export function onCloudAuthChange(fn){setTimeout(()=>fn(user),0);return ()=>{};}
 export const loadCloudState=async()=>null;export const saveCloudState=async()=>{if(window.__failCloud)throw Error('offline');return true;};
 export const loginWithGoogle=async()=>user;export const loginWithEmail=async()=>user;export const registerWithEmail=async()=>user;export const logoutCloud=async()=>{};export const friendlyAuthError=e=>e.message;
`;

(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.route('**/js/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:fixtureCloud('member')}));
  for(const [file,body] of Object.entries({'studyPresence.js':'export const startStudyPresence=fn=>{fn(0);return ()=>{};};','notifications/data.js':'export const startNotifications=()=>{};'})){
   await page.route('**/js/'+file,r=>r.fulfill({contentType:'application/javascript',body}));
  }
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({contentType:'application/javascript',body:'export const collection=()=>({}),doc=()=>({}),getDoc=async()=>({exists:()=>false}),getDocFromServer=async()=>({exists:()=>false}),deleteDoc=async()=>{},query=x=>x,where=()=>({}),orderBy=()=>({}),limit=()=>({}),documentId=()=>({}),startAfter=()=>({}),runTransaction=async()=>{},serverTimestamp=()=>({}),getDocs=async()=>({docs:[]}),setDoc=async()=>{},onSnapshot=()=>()=>{};'}));
  const url='http://127.0.0.1:'+server.address().port;
  await page.route('https://fonts.**/**',r=>r.abort());
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForSelector('#settings-btn');
  await page.evaluate(async()=>{const {getState}=await import('/js/state.js');const {parseImportFile}=await import('/js/storage.js');parseImportFile(JSON.stringify({app:'goc-hoc-nho',data:getState()}));});
  await page.evaluate(async()=>{const {openModal}=await import('/js/components/modal.js');document.querySelector('#settings-btn').focus();window.testModal=openModal({title:'Kiểm tra',content:'<input aria-label="Test"><button id="last">Cuối</button>'});});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('modal-close'));
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('modal-close')),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'last');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('modal-close')),true);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-btn');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k==='goc-hoc-nho:v1')throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});
  await page.evaluate(async()=>{const {update}=await import('/js/state.js');update(s=>{s.settings.userName='Test';},{silent:true});});
  await page.waitForSelector('.save-feedback:not([hidden])');assert.match(await page.locator('.save-feedback').innerText(),/Chưa lưu/);
  await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'Thử lưu lại'}).click();await page.waitForTimeout(1500);
  assert.equal(await page.locator('.save-feedback').isVisible(),false);
  await page.evaluate(async()=>{window.__failCloud=true;const {update}=await import('/js/state.js');update(s=>{s.settings.userName='Cloud retry';},{silent:true});});
  await page.waitForTimeout(1600);assert.match(await page.locator('.save-feedback').innerText(),/chưa đồng bộ/);
  await page.evaluate(()=>window.__failCloud=false);await page.getByRole('button',{name:'Thử lưu lại'}).click();await page.waitForTimeout(1600);
  assert.equal(await page.locator('.save-feedback').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: modal focus, keyboard loop, Escape, focus return, storage quota/cloud failure feedback and retries');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
