import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const html=readFileSync('backup-verify.html','utf8');
assert(html.includes("connect-src 'none'"),'Verifier must block network requests');
assert(!/https?:\/\/\S+/.test(html),'Verifier must contain no external URLs');
const code=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert(code,'Backup validation JS missing');
class Element {
  constructor(){this.children=[];this.listeners={};this.textContent='';this.className='';this.files=[];this.value='';}
  addEventListener(name,fn){this.listeners[name]=fn;}
  append(...items){this.children.push(...items);}
  replaceChildren(){this.children=[];}
}
async function validate(payload,localRecords=null){
  const elems=Object.fromEntries(['file','state','results'].map(id=>[id,new Element()]));
  const dom={getElementById(id){return elems[id];},createElement(){return new Element();}};
  const context=vm.createContext({document:dom,TextDecoder,Uint8Array,crypto:webcrypto,
    localStorage:{getItem(key){return key==='contactRecords' && localRecords!==null?JSON.stringify(localRecords):null;}}});
  vm.runInContext(code,context,{filename:'backup-verify.html'});
  const bytes=new TextEncoder().encode(payload);
  elems.file.files=[{size:bytes.length,arrayBuffer:async()=>bytes.buffer}];
  await elems.file.listeners.change();
  return {state:elems.state.className,rows:Object.fromEntries(elems.results.children.map(tr=>[tr.children[0].textContent,tr.children[1].textContent]))};
}
const records=[{id:1,recordDate:'2026-11-17',name:'測試資料',phone:'0000000000',notes:'安全測試'}];
const original={schemaVersion:1,exportedAt:'2026-11-17T00:00:00.000Z',source:'cathay-localStorage',records};
const ok=await validate(JSON.stringify(original),records);
assert(ok.state.includes('ok'),'Valid JSON must pass');
assert.equal(ok.rows['客戶紀錄筆數'],'1');
assert(ok.rows['與目前瀏覽器比較'].includes('逐項相符'));
assert(/^[a-f0-9]{64}$/.test(ok.rows['SHA-256（完整檔案）']),'Checksum must be SHA-256');
const tampered=await validate(JSON.stringify({...original,records:[{...records[0],notes:'其他備註'}]}),records);
assert(tampered.state.includes('ok'),'Valid but changed content should parse');
assert.notEqual(ok.rows['SHA-256（完整檔案）'],tampered.rows['SHA-256（完整檔案）']);
const missing=await validate(JSON.stringify({...original,records:[{id:1,name:'',phone:''}]}));
assert(missing.state.includes('warn'),'Missing important fields must warn');
assert.equal(missing.rows['缺姓名或電話'],'1');
const duplicate=await validate(JSON.stringify({...original,records:[records[0],records[0]]}));
assert(duplicate.state.includes('warn'),'Duplicate ID must warn');
assert.equal(duplicate.rows['重複的 ID'],'1');
const empty=await validate(JSON.stringify({...original,records:[]}));
assert(empty.state.includes('warn'),'Empty backup must not silently pass');
const broken=await validate('{"schemaVersion":1,');
assert(broken.state.includes('bad'),'Broken JSON must fail');
const wrong=await validate(JSON.stringify({...original,schemaVersion:2}));
assert(wrong.state.includes('bad'),'Unknown schema must fail');
const invalidDate=await validate(JSON.stringify({...original,exportedAt:'nonsense'}));
assert(invalidDate.state.includes('bad'),'Invalid exportedAt must fail');
console.log('V1.0 local-only JSON backup verifier: PASS');
