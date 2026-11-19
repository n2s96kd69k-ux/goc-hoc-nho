const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+'/'))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(d);});});
const fixtureCloud=role=>`
 let access={uid:'admin',role:'${role}',status:'active',ready:true,owner:true,adminCredits:0};const listeners=new Set();const authListeners=new Set();
 let user={uid:'admin',email:'admin@example.test',displayName:'Admin',getIdToken:async()=> 'student-test-token'};
 export const OWNER_UID='admin';export const OWNER_ID='GHN-776J9W';export const firebaseDb=()=>({});export const getCurrentUser=()=>user;
 export const accountId=()=> 'GHN-ADMIN1';export const isCurrentAdmin=()=>access.role==='admin';export const getAccountAccess=()=>access;
 export const requireAdmin=async()=>isCurrentAdmin()?user:null;
 export function onAccountAccessChange(fn){listeners.add(fn);setTimeout(()=>fn(access),0);return ()=>listeners.delete(fn);}
 window.__useServerWallet=()=>{access={...access,economyVersion:1};listeners.forEach(fn=>fn(access));};
 window.__switchWalletUser=()=>{user={...user,uid:'other'};access={...access,uid:'other'};listeners.forEach(fn=>fn(access));};

 window.__changeAccount=(uid,status='active')=>{
   user=uid?{uid,email:uid+'@example.test',getIdToken:async()=> 'student-test-token'}:null;
   access={...access,uid, status, economyVersion:0};listeners.forEach(fn=>fn(access));authListeners.forEach(fn=>fn(user));
 };
 export function onCloudAuthChange(fn){authListeners.add(fn);setTimeout(()=>fn(user),0);return ()=>authListeners.delete(fn);}
 export const loadCloudState=async()=>{if(window.__failLoad)throw Error('offline');return null;};export const saveCloudState=async()=>{if(window.__failCloud)throw Error('offline');return true;};
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
      const subscriptions = window.__walletListeners ||= new Map();
      if (!subscriptions.has(ref)) subscriptions.set(ref, new Set());
      const listeners = subscriptions.get(ref);
      listeners.add(fn);
      if(rows&&Object.hasOwn(rows,ref))queueMicrotask(()=>fn(rows[ref]()));
      return ()=>listeners.delete(fn);
    }
  `}));
  const url='http://127.0.0.1:'+server.address().port;
  await page.route('https://fonts.**/**',r=>r.abort());
  const deferredPages = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/^\/js\/pages\/(admin|room|goals|stats)\.js$/.test(path)) deferredPages.push(path);
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});await page.waitForSelector('#settings-btn');
  assert.deepEqual(deferredPages, []);
  let releaseStats;
  const delayedStats = new Promise(resolve => { releaseStats = resolve; });
  await page.route('**/js/pages/stats.js', async route => {
    await delayedStats;
    return route.continue();
  });
  await page.evaluate(() => { location.hash = '/stats'; });
  await page.locator('#main[aria-busy=true]').waitFor();
  await page.evaluate(() => { location.hash = '/'; });
  await page.locator('#today-bar').waitFor();
  const statsResponse = page.waitForResponse(response => response.url().endsWith('/js/pages/stats.js'));
  releaseStats();
  await statsResponse;
  await page.waitForFunction(() => document.querySelector('#today-bar') && !document.querySelector('#main').hasAttribute('aria-busy'));
  assert.deepEqual(deferredPages, ['/js/pages/stats.js']);
  console.log('PASS: cold overview skips unused pages and a delayed import does not replace the current route');
  await page.evaluate(async () => {
    const {receiveNotifications} = await import('/js/notifications/store.js');
    receiveNotifications([{id:'global:keyboard-a', type:'global_banner', content:'Thông báo thử',createdAt:1}]);
  });
  const notificationBell = page.locator('#notification-bell');
  await notificationBell.focus();
  await page.keyboard.press('Enter');
  assert.equal(await notificationBell.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-notifications');
  await page.evaluate(async () => {
    const {receiveNotifications} = await import('/js/notifications/store.js');
    receiveNotifications([{id:'global:keyboard-a',type:'global_banner',content:'<b>Đã sửa</b>',createdAt:1}]);
  });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-notifications');
  await page.locator('.notification-banner-content').filter({hasText:'<b>Đã sửa</b>'}).waitFor();
  assert.equal(await page.locator('#notification-items b').count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await notificationBell.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'notification-bell');
  await page.locator('.notification-banner-close').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  assert.equal(await page.locator('#notification-banner').evaluate(el => el.inert), true);
  await notificationBell.click();
  await page.evaluate(() => { location.hash = '/week'; });
  await page.locator('#notification-panel').waitFor({state:'hidden'});
  await page.evaluate(() => { location.hash = '/'; });
  await page.locator('#today-bar').waitFor();
  assert.equal(await notificationBell.getAttribute('aria-expanded'), 'false');
  console.log('PASS: notification keyboard focus, live edits, escaped content and route dismissal');


  await page.evaluate(async()=>{const {getState}=await import('/js/state.js');const {parseImportFile}=await import('/js/storage.js');parseImportFile(JSON.stringify({app:'goc-hoc-nho',data:getState()}));});
  await page.evaluate(async()=>{const {openModal}=await import('/js/components/modal.js');document.querySelector('#settings-btn').focus();window.testModal=openModal({title:'Kiểm tra',content:'<input aria-label="Test"><button id="last">Cuối</button>'});});
  await page.waitForFunction(()=>document.activeElement?.classList.contains('modal-close'));
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('modal-close')),true);
  await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'last');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('modal-close')),true);
  await page.keyboard.press('Escape');await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'settings-btn');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k==='goc-hoc-nho:v1'||k.startsWith('goc-hoc-nho:v1:'))throw new DOMException('full','QuotaExceededError');return original.call(this,k,v);};});
  await page.evaluate(async()=>{const {update}=await import('/js/state.js');update(s=>{s.settings.userName='Test';},{silent:true});});
  await page.waitForSelector('.save-feedback:not([hidden])');assert.match(await page.locator('.save-feedback').innerText(),/Chưa lưu/);
  await page.evaluate(()=>window.restoreStorage());await page.getByRole('button',{name:'Thử lưu lại'}).click();await page.waitForTimeout(1500);
  assert.equal(await page.locator('.save-feedback').isVisible(),false);
  await page.evaluate(async()=>{window.__failCloud=true;const {update}=await import('/js/state.js');update(s=>{s.settings.userName='Cloud retry';},{silent:true});});
  await page.waitForTimeout(1600);assert.match(await page.locator('.save-feedback').innerText(),/chưa đồng bộ/);
  await page.evaluate(()=>window.__failCloud=false);await page.getByRole('button',{name:'Thử lưu lại'}).click();await page.waitForTimeout(1600);
  assert.equal(await page.locator('.save-feedback').isVisible(),false);
  console.log('PASS: modal focus, keyboard loop, Escape, focus return, storage quota/cloud failure feedback and retries');
  await page.setViewportSize({width:320,height:720});
  const menu = page.locator('#menu-btn');
  await page.waitForFunction(() => document.querySelector('#sidebar').inert);
  await menu.focus();
  await page.keyboard.press('Enter');
  await page.locator('#close-sidebar').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-sidebar');
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.hash), '#/settings');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'close-sidebar');
  await page.keyboard.press('Escape');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-btn');
  await page.locator('#skip-link').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  await menu.click();
  await page.locator('.side-nav a[href="#/goals"]').click();
  await page.locator('#goal-form').waitFor();
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.locator('#bottom-nav a[href="#/week"]').click();
  await page.locator('#planner').waitFor();
  const filter = page.locator('[data-filter="done"]');
  await filter.focus();
  await page.keyboard.press('Enter');
  assert.equal(await filter.getAttribute('aria-pressed'), 'true');
  assert.equal(await filter.evaluate(element => document.activeElement === element), true);
  const primaryContrast = await page.locator('#add-task-btn').evaluate(button => {
    const {color,backgroundColor} = getComputedStyle(button);
    const luminance = rgb => rgb.match(/\d+/g).slice(0,3).map(Number).map(value => value / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum,value,index) => sum + value * [0.2126,0.7152,0.0722][index], 0);
    const values = [luminance(color),luminance(backgroundColor)].sort((a,b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
  assert.ok(primaryContrast >= 4.5);

  await page.locator('[data-filter="all"]').click();
  await page.locator('#bottom-nav a[href="#/room"]').click();
  const sheet = page.locator('#side-fab');
  await sheet.focus();
  await page.keyboard.press('Enter');
  assert.equal(await sheet.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.closest('#room-side') !== null), true);
  await page.keyboard.press('Escape');
  assert.equal(await sheet.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'side-fab');
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(() => { location.hash = '/'; });
  console.log('PASS: keyboard drawer, Skip to main, responsive goals at 320px, sheet and filter focus, primary button contrast');

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
      : { id:command.taskId, ...taskCalls[2].fields, ...command.fields, done:true,
        version:command.type === 'task-move' ? 2 : 1, coinGain:5 };
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
  const source = taskRow.locator('.task-title');
  const day = await taskRow.evaluate(row => row.closest('.day-card').dataset.day);
  const targetDay = await page.locator('.day-card').filter({has:page.locator('[data-add]')}).first().getAttribute('data-day');
  const target = page.locator(`.day-card[data-day="${targetDay}"]`);
  assert.notEqual(targetDay, day);
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + 48, {steps:10});
  await page.mouse.up();
  await target.locator('.task').filter({hasText:'Ôn Toán trên máy chủ'}).waitFor();
  assert.equal(taskCalls[4].type, 'task-move');
  assert.equal(taskCalls[4].expectedVersion, 1);
  assert.equal(taskCalls[4].fields.date, targetDay);
  console.log('PASS: task retry, completion and drag confirmed through the server route');
  const focusCalls = [];
  const balanceBeforeFocus = await page.evaluate(async () => (await import('/js/state.js')).getState().wallet.coins);
  await page.unroute('https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy');
  const actor = 'users/admin';
  const walletPath = actor + '/economy/wallet';
  async function pushRow(ref, row) {
    await page.evaluate(([ref, row]) => {
      window.__walletRows[ref] = () => ({data: () => row});
      window.__walletListeners.get(ref)?.forEach(fn => fn(window.__walletRows[ref]()));
    }, [ref, row]);
  }
  await page.route('https://dark-tooth-7030.n2s96kd69k.workers.dev/api/economy', async route => {
    const command = route.request().postDataJSON();
    focusCalls.push(command);
    if (focusCalls.length <= 2) return route.abort();
    const result = command.type === 'focus-complete'
      ? {status:'completed', reward:25, streak:{events:[]}}
      : {status:'running'};
    await route.fulfill({json:{ok:true,result}});
  });
  await pushRow(walletPath, {version:1,balance:100});
  await page.evaluate(() => { location.hash = '/pomodoro'; });
  await page.locator('#pomo-start').click();
  await page.locator('#pomo-feedback').filter({hasText:'Không nhận được phản hồi'}).waitFor();
  await page.locator('#pomo-start').click();
  await page.waitForFunction(() => document.querySelector('#pomo-feedback').hidden);
  assert.deepEqual(focusCalls[0], focusCalls[2]);
  const sessionId = focusCalls[0].sessionId;
  const sessionPath = actor + '/focusSessions/' + sessionId;
  const session = {status:'running', durationMs:1500000, elapsedMs:0, resumedAt:Date.now(),
    expiresAt:Date.now() + 86400000, revision:0};
  await pushRow(walletPath, {version:1,balance:100,activeSessionId:sessionId});
  await pushRow(sessionPath, session);
  await page.locator('#pomo-state').getByText('Đang tập trung…').waitFor();
  await page.locator('#pomo-pause').click();
  await page.waitForFunction(() => document.querySelector('#pomo-feedback').hidden);
  assert.equal(focusCalls[3].type, 'focus-pause');
  assert.equal(focusCalls[3].expectedRevision, 0);
  await pushRow(sessionPath, {...session,status:'paused',elapsedMs:600000,revision:1});
  await page.locator('#pomo-time').getByText('15:00').waitFor();
  await page.evaluate(async () => {
    const {todayKey} = await import('/js/utils.js');
    const path = 'users/admin/studyDays';
    const row = {focusMinutes: 45, pomodoros: 2, tasksDone: 3, subjects: {math: {minutes:45,pomodoros:2}}};
    window.__walletListeners.get(path).forEach(fn => fn({docs:[{id:todayKey(),data:()=>row}]}));
  });
  await page.locator('.pomo-today').filter({hasText:'45 phút'}).waitFor();
  await page.locator('.header-streak').filter({hasText:'1 ngày'}).waitFor();
  const totals = await page.evaluate(async () => (await import('/js/study-account.js')).subjectStudyTotals('math'));
  assert.deepEqual(totals, {minutes:45,pomodoros:2});

  await page.locator('#pomo-start').click();
  await page.waitForFunction(() => document.querySelector('#pomo-feedback').hidden);
  assert.equal(focusCalls[4].type, 'focus-resume');
  assert.equal(focusCalls[4].expectedRevision, 1);
  await pushRow(sessionPath, {...session,resumedAt:Date.now() - 1500001,revision:2});
  await page.locator('#pomo-state').getByText('Nghỉ ngơi').waitFor();
  assert.equal(focusCalls[5].type, 'focus-complete');
  const legacyBalance = await page.evaluate(async () => (await import('/js/state.js')).getState().wallet.coins);
  assert.equal(legacyBalance, balanceBeforeFocus);
  await page.getByRole('button',{name:'Tuyệt!',exact:true}).click();
  await pushRow(walletPath, {version:1,balance:125,totalEarned:145});
  await page.evaluate(() => {
    window.__walletListeners.get('users/admin/ownedItems').forEach(fn => fn({
      docs:[{id:'plant_small',data:()=>({quantity:2})}],
    }));
    location.hash = '/settings';
  });
  const backupDownload = page.waitForEvent('download');
  await page.locator('#export-btn').click();
  const downloaded = await backupDownload;
  const backup = JSON.parse(fs.readFileSync(await downloaded.path(), 'utf8'));
  assert.equal(backup.kind, 'server-wallet-reference');
  assert.deepEqual(backup.data.wallet, {coins:125,totalEarned:145});
  assert.equal(backup.data.room.owned.plant_small, 2);
  assert.ok(backup.data.tasks.some(task => task.title === 'Ôn Toán trên máy chủ'));
  assert.equal(await page.locator('#clear-all').count(), 0);
  assert.equal(await page.locator('#clear-sample').count(), 0);
  backup.data.settings.userName = 'Mochi sao lưu';
  backup.data.wallet.coins = 999999;
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#choose-backup').focus();
  await page.keyboard.press('Enter');
  await (await chooserPromise).setFiles({
    name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole('button',{name:'Áp dụng',exact:true}).click();
  await page.locator('#settings-form input[name=userName]').waitFor();
  assert.equal(await page.locator('#settings-form input[name=userName]').inputValue(), 'Mochi sao lưu');
  await page.locator('.header-coins').filter({hasText:'125 xu'}).waitFor();
  console.log('PASS: backup contains canonical balance and inventory; keyboard import restores preferences only');
  await page.evaluate(() => { location.hash = '/pomodoro'; });

  const remoteId = 'second-device-session-0001';
  await pushRow(actor + '/focusSessions/' + remoteId, {...session,resumedAt:Date.now()});
  await pushRow(walletPath, {version:1,balance:125,activeSessionId:remoteId});
  await page.locator('#pomo-state').getByText('Đang tập trung…').waitFor();
  await page.evaluate(() => window.__switchWalletUser());
  await pushRow(actor + '/focusSessions/' + remoteId, {...session,status:'paused',elapsedMs:600000});
  await page.locator('#pomo-feedback').filter({hasText:'Chưa tải được phiên tập trung'}).waitFor();
  assert.equal(await page.locator('#pomo-pause').isDisabled(), true);

  assert.deepEqual(errors, []);
  console.log('PASS: focus retry, server snapshots for pause/resume, account switch, and completion without local wallet credit');
  await page.evaluate(async () => {
    window.__failLoad = true;
    window.__changeAccount('offline-a');
    const {update} = await import('/js/state.js');
    update(s => {s.settings.userName='Tên riêng ngoại tuyến';});
    const {openModal} = await import('/js/components/modal.js');
    openModal({title:'Ghi chú riêng',content:'Nội dung riêng của A'});
    window.__changeAccount(null);
  });
  assert.equal(await page.getByRole('dialog',{name:'Ghi chú riêng'}).count(), 0);
  const name = async () => page.evaluate(async () => (await import('/js/state.js')).getState().settings.userName);
  assert.notEqual(await name(), 'Tên riêng ngoại tuyến');
  await page.evaluate(() => window.__changeAccount('offline-b'));
  assert.notEqual(await name(), 'Tên riêng ngoại tuyến');
  await page.evaluate(() => window.__changeAccount('offline-a'));
  assert.equal(await name(), 'Tên riêng ngoại tuyến');
  await page.evaluate(() => window.__changeAccount('offline-a','banned'));
  assert.notEqual(await name(), 'Tên riêng ngoại tuyến');
  assert.deepEqual(errors, []);
  console.log('PASS: offline account switch, modal dismissal and recovery of the owner draft');


 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
