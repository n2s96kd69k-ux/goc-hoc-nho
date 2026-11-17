import {verifiedUid,firestore} from './transport.mjs';
import {transactEconomy} from './economy.mjs';
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
  if(path!=='/api/economy'||request.method!=='POST')return reply({error:'not-found'},404);
  try{
    const uid=await verifiedUid(request,env);
    const text=await request.text();if(text.length>8192)return reply({error:'request-too-large'},413);
    const command=JSON.parse(text);
    const result=await transactEconomy(firestore(env),uid,command,()=>new Date());return reply({ok:true,result});
  }catch(error){
    const message=error.message;
    const status=message==='unauthenticated'?401:['access-denied','admin-required','target-unavailable'].includes(message)?403:['configuration-error','service-auth-failed','database-error'].includes(message)?503:400;
    const known=['unauthenticated','access-denied','admin-required','target-unavailable','migration-required','operation-conflict','insufficient-funds','quantity-limit','balance-limit','earned-limit','item-unavailable','invalid-wallet','invalid-catalog','configuration-error','service-auth-failed','database-error','invalid-type','invalid-operation','invalid-target','invalid-item','invalid-amount','invalid-reason'];
    return reply({ok:false,error:known.includes(message)?message:'invalid-request'},status);
  }
}};
