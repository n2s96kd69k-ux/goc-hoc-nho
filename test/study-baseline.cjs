const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client(){const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/studyBaseline.js','utf8').replace('export ',''),c);return c;}
const midnight=Date.UTC(2026,10,15,17);
test('accounts and reloads replay identical bounded counts, including out-of-order reads',()=>{
 const a=client(),b=client();
 for(let at=midnight;at<midnight+86400000;at+=8000){const n=a.studyBaseline(at);assert.equal(n,b.studyBaseline(at));assert.ok(n>=10&&n<=280);}
 for(const at of [midnight+3*86400000,midnight-8000,midnight+123456])assert.equal(a.studyBaseline(at),client().studyBaseline(at));
});
test('requested time bands, fixed eight-second slots and smooth midnight boundary',()=>{
 const a=client();
 for(const [start,end,lo,hi] of [[5,8,20,45],[13,17.5,60,120],[18.5,23,150,280],[0,4.5,10,50],[23.5,24,10,50]]){
  for(let h=start;h<end;h+=8/3600){const n=a.studyBaseline(midnight+h*3600000);assert.ok(n>=lo&&n<=hi,`${h}: ${n}`);}
 }
 assert.equal(a.studyBaseline(midnight),a.studyBaseline(midnight+7999));
 assert.ok(Math.abs(a.studyBaseline(midnight-1)-a.studyBaseline(midnight))<=1);
});
test('walk includes gradual movements and multi-beat surges/drops',()=>{
 const a=client();let gentle=0,surge=0,drop=0;
 for(let t=midnight+19*3600000;t<midnight+22*3600000;t+=8000){const delta=a.studyBaseline(t)-a.studyBaseline(t-8000);if(delta>=-3&&delta<=4)gentle++;if(delta>=5)surge++;if(delta<=-4)drop++;}
 assert.ok(gentle>100);assert.ok(surge>10);assert.ok(drop>10);
});
