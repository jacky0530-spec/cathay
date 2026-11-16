import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync('client.html','utf8');
const start=html.indexOf('    function getClientRecords() {');
const end=html.indexOf('    async function uploadCloudBackup() {',start);
assert(start>0&&end>start,'CRM merge helpers not found');
const helpers=html.slice(start,end);
const db=new Map();
let renders=0;
const notices=[];
const context=vm.createContext({
  localStorage:{
    getItem(key){return db.has(key)?db.get(key):null;},
    setItem(key,value){db.set(key,String(value));}
  },
  loadData(){renders++},
  alert(message){notices.push(String(message))},
  Date,Set,Number,String,Math,Array,JSON
});
vm.runInContext(helpers,context,{filename:'client-merge-helpers.js'});
const get=()=>JSON.parse(db.get('contactRecords'));
const old={id:100,recordDate:'2026-11-17',name:'測試甲',phone:'0900000000',lineId:'abc',address:'高雄',experience:'',notes:'初訪'};
const duplicate={...old};
const sameIdDifferent={...old,id:100,notes:'二次訪談'};
const malformed={id:55,phone:'0900000001'};
db.set('contactRecords',JSON.stringify([old]));
context.mergeClientRecords([duplicate,sameIdDifferent,malformed]);
let rows=get();
assert.equal(rows.length,2,'Merge should add only changed record');
assert.deepEqual(rows[0],old,'Original record must remain unchanged');
assert.equal(rows[1].notes,'二次訪談');
assert(Number.isSafeInteger(rows[1].id)&&rows[1].id!==old.id,'Colliding record IDs must be unique');
assert.equal(new Set(rows.map(x=>x.id)).size,2);
assert.equal(renders,1,'Merge should reload table after success');

context.mergeClientRecords([duplicate,sameIdDifferent]);
assert.equal(get().length,2,'Re-import must be idempotent');
assert.throws(()=>context.mergeClientRecords({records:[]}),/備份格式不符/);
assert.equal(get().length,2,'Invalid import must preserve existing data');

db.set('contactRecords','invalid-json');
assert.throws(()=>context.mergeClientRecords([old]));
assert.equal(db.get('contactRecords'),'invalid-json','Do not overwrite malformed storage');
console.log('V1.0 CRM merge regression: PASS');
