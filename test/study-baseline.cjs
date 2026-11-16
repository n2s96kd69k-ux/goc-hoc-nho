const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function client(){const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/studyBaseline.js','utf8').replace('export ',''),c);return c;}
test('accounts share a bounded baseline for the same absolute time',()=>{const a=client(),b=client();for(let at=0;at<86400000;at+=12000){assert.equal(a.studyBaseline(at),b.studyBaseline(at));assert.ok(a.studyBaseline(at)>=6&&a.studyBaseline(at)<=240);}});
test('daily curve retains quiet dawn and busy evening; same slot is stable',()=>{const a=client(),day=Date.UTC(2026,10,16);assert.ok(a.studyBaseline(day+13.5*3600000)>a.studyBaseline(day-1.5*3600000));assert.equal(a.studyBaseline(day),a.studyBaseline(day+11999));});
