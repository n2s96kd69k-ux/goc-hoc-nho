const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname, '..');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));
 if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
});
const fixtureCloud=role=>`
 let access={uid:'admin',role:'${role}',status:'active',ready:true,owner:true,adminCredits:0};let listener;
 const user={uid:'admin',email:'admin@example.test',displayName:'Admin'};
 export const OWNER_ID='GHN-776J9W';export const firebaseDb=()=>({});export const getCurrentUser=()=>user;
 export const accountId=()=> 'GHN-ADMIN1';export const isCurrentAdmin=()=>access.role==='admin';export const getAccountAccess=()=>access;
 export const requireAdmin=async()=>isCurrentAdmin()?user:null;
 export function onAccountAccessChange(fn){listener=fn;setTimeout(()=>fn(access),0);return ()=>{};}
 window.__testRevoke=()=>{access={...access,role:'member'};listener(access);};
 export function onCloudAuthChange(fn){setTimeout(()=>fn(user),0);return ()=>{};}
 export const loadCloudState=async()=>null;export const saveCloudState=async()=>true;
 export const loginWithGoogle=async()=>user;export const loginWithEmail=async()=>user;export const registerWithEmail=async()=>user;export const logoutCloud=async()=>{};export const friendlyAuthError=e=>e.message;
`;
const fixtureService=`
 const rows=[{uid:'admin',displayName:'Người quản trị',email:'admin@example.test',photoURL:'',coins:200,role:'admin',status:'active',owner:true},{uid:'student',displayName:'Nguyễn Minh Anh',email:'student@example.test',publicId:'GHN-STUDENT',photoURL:'',coins:50,role:'member',status:'active',owner:false}];const logs=[];
 export const listUsers=async()=>({rows:rows.map(r=>({...r})),hasMore:false,cursor:null});
 export const resolveUser=async()=>({...rows[1]});export const listActivity=async()=>logs;
 export async function changeUser(p){const r=rows.find(r=>r.uid===p.uid);const before=r.coins;if(p.type==='coins-set')r.coins=p.value;else if(p.type==='coins-add')r.coins+=p.value;else r[p.type]=p.value;logs.unshift({...p,targetUid:p.uid,actorEmail:'admin@example.test',before,after:r.coins,createdAt:{toDate:()=>new Date()}});}
 export const adminError=e=>e.message;
`;
(async()=>{
 await new Promise(r=>server.listen(4319,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']});
 try{
  for(const role of ['admin','member']){
   const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/js/studyPresence.js',r=>r.fulfill({contentType:'application/javascript',body:'export const startStudyPresence=fn=>{fn(0);return ()=>{};};'}));
   await page.route('**/js/cloud.js',r=>r.fulfill({contentType:'application/javascript',body:fixtureCloud(role)}));
   await page.route('**/js/admin/announcements.js',r=>r.fulfill({contentType:'application/javascript',body:`const items=[];export const listAnnouncements=async()=>items;export const publishAnnouncement=async(id,content)=>{items.push({id,content,createdAt:{toDate:()=>new Date()}})};export const deleteAnnouncement=async(id)=>{items.splice(items.findIndex(i=>i.id===id),1)};`}));
   await page.route('**/js/admin/service.js',r=>r.fulfill({contentType:'application/javascript',body:fixtureService}));
   await page.route('https://www.gstatic.com/**',r=>r.fulfill({contentType:'application/javascript',body:`export const query=x=>x,orderBy=()=>({}),limit=()=>({});export const collection=()=>({}),doc=()=>({}),getDocs=async()=>({docs:[]}),getDocFromServer=async()=>({exists:()=>false}),setDoc=async()=>{},deleteDoc=async()=>{},onSnapshot=()=>()=>{};`}));
   await page.route('https://fonts.**',r=>r.abort());
   await page.goto('http://127.0.0.1:4319/#/admin');
   if(role==='member'){
    await page.waitForURL('**/#/');assert.equal(await page.locator('.nav-admin').count(),0);assert.equal(await page.locator('.admin-shell').count(),0);console.log('PASS: member direct route redirects and management menu stays hidden');
   }else{
    await page.locator('.admin-table tbody tr').first().waitFor();assert.equal(await page.locator('.nav-admin').innerText(),'Quản Lý');
    await page.locator('.admin-nav a[href="#/admin?tab=announcements"]').click();
    await page.locator('#announcement-form textarea').fill('Chúc mọi người học tốt <b>nhé</b>!');
    await page.locator('#announcement-form [type="submit"]').click();
    await page.locator('#announcement-list td').filter({hasText:'Chúc mọi người học tốt'}).waitFor();
    assert.equal(await page.locator('#announcement-list b').count(),0);
    await page.locator('[data-delete-announcement]').click();
    await page.locator('.modal [data-act="ok"]').click();
    await page.locator('#announcement-list .admin-empty').filter({hasText:'Chưa có thông báo'}).waitFor();
    console.log('PASS: publish announcement, safely render content and confirm deletion');
    await page.locator('.admin-nav a[href="#/admin?tab=users"]').click();
    await page.locator('.admin-table tbody tr').first().waitFor();
    await page.locator('[data-index="1"][data-action="coins"]').click();await page.locator('#admin-change [name="amount"]').fill('80');await page.locator('#admin-change [name="reason"]').fill('Điều chỉnh kiểm thử');await page.locator('#admin-change [type="submit"]').click();await page.locator('.admin-table .admin-number').filter({hasText:'80'}).waitFor();
    await page.locator('.admin-nav a[href="#/admin?tab=coins"]').click();await page.locator('#admin-grant [name="target"]').fill('student@example.test');await page.locator('#admin-grant [name="amount"]').fill('20');await page.locator('#admin-grant [name="reason"]').fill('Thưởng sự kiện');await page.locator('#admin-grant [type="submit"]').click();await page.locator('#admin-change [type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#admin-change'));
    await page.locator('.admin-nav a[href="#/admin?tab=activity"]').click();await page.locator('.admin-table tbody tr').first().waitFor();assert.equal(await page.locator('.admin-table tbody tr').count(),2);

    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await page.evaluate(()=>window.__testRevoke());await page.waitForURL('**/#/');console.log('PASS: admin menu, edit coins, event grant confirmation, audit display, mobile layout, revocation redirect');
   }
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
