const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(d);});});
const fixtureCloud=role=>`
 let access={uid:'admin',role:'${role}',status:'active',ready:true,owner:true,adminCredits:0};const listeners=new Set();
 const user={uid:'admin',email:'admin@example.test',displayName:'Admin',getIdToken:async()=> 'student-test-token'};
 export const OWNER_UID='admin';export const OWNER_ID='GHN-776J9W';export const firebaseDb=()=>({});export const getCurrentUser=()=>user;
 export const accountId=()=> 'GHN-ADMIN1';export const isCurrentAdmin=()=>access.role==='admin';export const getAccountAccess=()=>access;
 export const requireAdmin=async()=>isCurrentAdmin()?user:null;
 export function onAccountAccessChange(fn){listeners.add(fn);setTimeout(()=>fn(access),0);return ()=>listeners.delete(fn);}
 window.__useServerWallet=()=>{access={...access,economyVersion:1};listeners.forEach(fn=>fn(access));};
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
  await page.route('https://www.gstatic.com/firebasejs/**',r=>r.fulfill({contentType:'application/javascript',body:`
    export const collection=(db,...parts)=>parts.join('/'),doc=collection;
    export const getDoc=async()=>({exists:()=>false}),getDocFromServer=getDoc,deleteDoc=async()=>{},query=x=>x,
      where=()=>({}),orderBy=()=>({}),limit=()=>({}),documentId=()=>({}),startAfter=()=>({}),runTransaction=async()=>{},
      serverTimestamp=()=>({}),getDocs=async()=>({docs:[]}),setDoc=async()=>{};
    export function onSnapshot(ref,fn){
      const rows=window.__walletRows;
      if(rows&&Object.hasOwn(rows,ref))queueMicrotask(()=>fn(rows[ref]()));
      return ()=>{};
    }
  `}));
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
  console.log('PASS: modal focus, keyboard loop, Escape, focus return, storage quota/cloud failure feedback and retries');
  const openServerShop = async hadPurchase => {
    await page.evaluate(hadPurchase => {
      const docs = items => ({docs:Object.entries(items).map(([id,row])=>({id,data:()=>row}))});
      window.__walletRows = {
        'users/admin/economy/wallet': () => ({data:()=>({version:1,balance:hadPurchase?40:100})}),
        'users/admin/ownedItems': () => docs(hadPurchase?{plant_small:{quantity:1}}:{}),
        'catalog': () => docs({plant_small:{price:60,maxQty:1,active:true}}),
      };
      window.__useServerWallet();
      location.hash = '/room';
    },hadPurchase);
    await page.locator('[data-panel="shop"]').click();
    await page.locator('[data-cat="plant"]').click();
  };
  const purchaseCalls = [];
  await page.route('https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy',async route=>{
    const request = route.request();
    assert.equal(request.headers().authorization,'Bearer student-test-token');
    purchaseCalls.push(request.postDataJSON());
    if(purchaseCalls.length <= 2) return route.abort();
    return route.fulfill({json:{ok:true,result:{balance:40,delta:-60,itemId:'plant_small',quantity:1}}});
  });
  await openServerShop(false);
  const plant = page.locator('[data-buy="plant_small"]');
  assert.match(await plant.innerText(),/60/);
  await plant.click();
  await plant.filter({hasText:'Kiểm tra lượt mua'}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#settings-btn');
  await openServerShop(true);
  await plant.filter({hasText:'Kiểm tra lượt mua'}).click();
  await page.locator('.shop-item').filter({hasText:'Chậu cây nhỏ'}).getByText('Đã sở hữu').waitFor();
  assert.equal(purchaseCalls.length,3);
  assert.deepEqual(purchaseCalls[0],purchaseCalls[2]);
  assert.equal(purchaseCalls[2].itemId,'plant_small');
  assert.equal('price' in purchaseCalls[2],false);
  await page.locator('.header-coins').filter({hasText:'40 xu'}).waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: server catalog and balance, lost response, retry after reload with the same operation');
  const taskCalls = [];
  await page.unroute('https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy');
  await page.route('https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy', async route => {
    const command = route.request().postDataJSON();
    taskCalls.push(command);
    if (taskCalls.length <= 2) return route.abort();
    const task = command.type === 'task-create'
      ? { id:command.taskId, ...command.fields, done:false, version:0, coinGain:0 }
      : { id:command.taskId, ...taskCalls[2].fields, done:true, version:1, coinGain:5 };
    return route.fulfill({json:{ok:true,result:{task,delta:5}}});
  });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#settings-btn');
  const openTask = async () => {
    await page.evaluate(() => {
      window.__walletRows = {'users/admin/rewardTasks': () => ({docs:[]})};
      window.__useServerWallet();
      location.hash = '/';
    });
    await page.locator('#add-task-btn').click();
    await page.getByRole('textbox',{name:'Tên nhiệm vụ'}).fill('Ôn Toán trên máy chủ');
  };
  await openTask();
  await page.locator('#task-form button[type=submit]').click();
  await page.getByText('Không nhận được phản hồi từ máy chủ ví.', {exact:false}).waitFor();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#settings-btn');
  await openTask();
  await page.locator('#task-form button[type=submit]').click();
  const taskRow = page.locator('.task').filter({hasText:'Ôn Toán trên máy chủ'});
  await taskRow.waitFor();
  assert.deepEqual(taskCalls[0], taskCalls[2]);
  await taskRow.locator('[data-toggle]').click();
  await page.locator('.task.done').filter({hasText:'Ôn Toán trên máy chủ'}).waitFor();
  assert.equal(taskCalls[3].type, 'task-complete');
  assert.equal(taskCalls[3].expectedVersion, 0);
  assert.deepEqual(errors, []);
  console.log('PASS: task creation after lost response and reload, completion from confirmed server row');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
