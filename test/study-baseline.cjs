const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client(){const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/studyBaseline.js','utf8').replace('export ',''),c);return c;}
const midnight=Date.UTC(2026,10,15,17);
test('accounts and reloads replay identical bounded counts, including out-of-order reads',()=>{
 const a=client(),b=client();
 for(let at=midnight;at<midnight+86400000;at+=12000){const n=a.studyBaseline(at);assert.equal(n,b.studyBaseline(at));assert.ok(n>=10&&n<=280);}
 for(const at of [midnight+3*86400000,midnight-12000,midnight+123456])assert.equal(a.studyBaseline(at),client().studyBaseline(at));
});
test('requested time bands, fixed twelve-second slots and smooth midnight boundary',()=>{
 const a=client();
 for(const [start,end,lo,hi] of [[5,8,20,45],[13,17.5,60,120],[18.5,23,150,280],[0,4.5,10,50],[23.5,24,10,50]]){
  for(let h=start+0.1;h<end;h+=12/3600){const n=a.studyBaseline(midnight+h*3600000);assert.ok(n>=lo&&n<=hi,`${h}: ${n}`);}
 }
 assert.equal(a.studyBaseline(midnight),a.studyBaseline(midnight+11999));
 assert.ok(Math.abs(a.studyBaseline(midnight-1)-a.studyBaseline(midnight))<=1);
});
test('falls by at most two per 12 seconds even at time-band transitions',()=>{
 const a=client();let gentle=0;
 for(let day=0;day<7;day++){
  for(let t=midnight+day*86400000;t<midnight+(day+1)*86400000;t+=12000){
   const delta=a.studyBaseline(t)-a.studyBaseline(t-12000);
   assert.ok(delta>=-2&&delta<=4, `${t}: ${delta}`);
   if(delta>=-1&&delta<=2)gentle++;
  }
 }
 assert.ok(gentle>40000);
});
