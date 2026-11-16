import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const read=(p)=>readFileSync(p,'utf8');
const pageFiles=readdirSync('.').filter(f=>f.endsWith('.html'));
const required=['index.html','client.html','products.html','calc.html','tools.html','system.html','admin.html','sw.js','auth.js','manifest.json','firebase.database.rules.json'];
for(const name of required)assert(existsSync(name),'missing '+name);
const product=read('products.html'),client=read('client.html'),auth=read('auth.js'),admin=read('admin.html');
assert(product.includes('停售商品區'));
assert(product.indexOf('href="prod_cancer_protect.html"') < product.indexOf('停售商品區'));
assert(product.indexOf('停售商品區') < product.indexOf('href="prod_accident.html"'));

for(const [name,file] of [['月月(永)溢','prod_invest_forever.html'],['月月(滿)溢','prod_invest_full.html'],['滿溢康愛','prod_overflow_love.html']]){
  assert(product.includes('href="'+file+'"><span class="stop-icon"'),name+' missing from stopped section');
}
assert(!product.includes('href="prod_overflow_love.html" class="highlight-pink"'));
assert(!product.includes('class="prod-btn invest-btn"'));
assert(!/VIP888|CATHAY2025|admin888/.test(auth+admin),'shared password in active code');
assert(auth.includes('signInWithEmailAndPassword')&&admin.includes("member.role!=='admin'"));
assert(client.includes('function exportBackupJSON')&&client.includes('function mergeClientRecords'));
assert(client.includes('localStorage.getItem(\'contactRecords\')'));
const manifest=JSON.parse(read('manifest.json'));
assert.equal(manifest.display,'standalone');
assert(!('5display' in manifest));
const rules=JSON.parse(read('firebase.database.rules.json'));
assert.equal(rules.rules['.read'],false);
assert.equal(rules.rules.whitelist['.read'],false);
assert(rules.rules.clientBackups);
assert(rules.rules.clientBackups['$uid']['$backupId']['.write'].includes('!data.exists()'),'Backup history must be append-only');
assert(auth.includes('push(ref(db,\'clientBackups/\'') && auth.includes('listBackups()'),'Backup version APIs missing');
assert(!client.includes('原備份將被取代。'),'Old overwrite warning still present');

for(const page of pageFiles){
  const html=read(page);
  for(const m of html.matchAll(/(?:href|src)=["']([^"'#]+)["']/g)){
    const uri=m[1];
    if(/^(https?:|data:|mailto:|tel:|\/\/|javascript:)/i.test(uri))continue;
    const path=uri.split(/[?#]/)[0];
    if(!path||path.startsWith('/'))continue;
    assert(existsSync(path),page+' missing asset '+path);
  }
}
const toCheck=['auth.js','sw.js'];
for(const filename of toCheck){
  const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:read(filename),encoding:'utf8'});
  assert.equal(syntax.status,0,filename+' JavaScript syntax: '+syntax.stderr);
}
for(const page of ['index.html','products.html','client.html','admin.html','event.html','calc_plan.html','calc_combo.html','tools.html','system.html']){
  const html=read(page);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(m[1].includes('src='))continue;
    const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:m[2],encoding:'utf8'});
    assert.equal(syntax.status,0,page+' inline script syntax: '+syntax.stderr);
  }
}
console.log('V1.0 static checks passed; Firebase Rules and live runtime still need emulator/manual tests.');
