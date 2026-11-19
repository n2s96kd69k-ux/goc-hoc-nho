const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(__dirname+'/../js/storage.js','utf8').replace(/export /g,''),c);
const valid=()=>({version:2,tasks:[{id:'task-1',title:'Ôn Toán',date:'2026-11-17',done:false,minutes:25}],subjects:[{id:'math',name:'Toán',icon:'📐',color:'#C8DDEE',chapters:[],scores:[]}],days:{},wallet:{coins:50,totalEarned:50},settings:{focusMinutes:25,breakMinutes:5}});
test('current backup and legacy raw data import successfully',()=>{assert.equal(c.parseImportFile(JSON.stringify(valid())).wallet.coins,50);assert.equal(c.parseImportFile(JSON.stringify({app:'goc-hoc-nho',data:valid()})).subjects[0].name,'Toán');});
test('rejects HTML, wrong types, prototype keys and oversized backups',()=>{
 for(const mutate of [v=>v.wallet.coins='<img src=x onerror=alert(1)>',v=>v.tasks.push(null),v=>v.wallet.coins=-1,v=>v.subjects[0].color='red;position:fixed',v=>v.tasks[0].title='<svg onload=alert(1)>',v=>v.settings.focusMinutes=999,v=>v.days=null]){
  const v=valid();mutate(v);assert.throws(()=>c.parseImportFile(JSON.stringify(v)));
 }
 assert.throws(()=>c.parseImportFile(JSON.stringify(valid()).replace('"version":2','"__proto__":{},"version":2')));
 assert.throws(()=>c.parseImportFile(' '.repeat(5*1024*1024+1)));
});
test('canonical reference backups cannot replace a legacy wallet through the import parser', () => {
 const reference = JSON.stringify({app:'goc-hoc-nho',kind:'server-wallet-reference',data:valid()});
 assert.throws(() => c.parseImportFile(reference), /chỉ dùng để đối chiếu/);
 assert.equal(c.parseImportFile(reference, {allowReference:true}).settings.focusMinutes, 25);
});
