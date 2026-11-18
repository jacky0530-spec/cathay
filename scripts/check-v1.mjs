import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
// Some untouched legacy product pages are UTF-16LE with BOM. Preserve source files and decode for tests.
const read=(p)=>{
  const raw=readFileSync(p);
  if(raw.length>=2 && raw[0]===0xff && raw[1]===0xfe)
    return raw.subarray(2).toString('utf16le');
  if(raw.length>=2 && raw[0]===0xfe && raw[1]===0xff){
    const copy=Buffer.from(raw.subarray(2));
    if(copy.length%2!==0)throw new Error(p+' has invalid UTF-16BE byte length');
    copy.swap16();
    return copy.toString('utf16le');
  }
  return raw.toString('utf8').replace(/^\uFEFF/,'');
};
const pageFiles=readdirSync('.').filter(f=>f.endsWith('.html'));
const required=['index.html','client.html','products.html','calc.html','tools.html','system.html','admin.html','sw.js','auth.js','manifest.json','firebase.database.rules.json'];
for(const name of required)assert(existsSync(name),'missing '+name);
const product=read('products.html'),client=read('client.html'),auth=read('auth.js'),admin=read('admin.html');
const sparkRules=JSON.parse(read('firebase.spark-admin.rules.candidate.json')).rules;
const managerJs=read('vip-access/spark/manager.mjs');
assert(sparkRules.whitelist['.read']===true,'Spark compatibility must keep legacy VIP reads');
assert(sparkRules.users['.write']===true,'Spark compatibility must preserve legacy telemetry writes');
assert(sparkRules.whitelist['$code']['.write'].includes("role').val() === 'admin'"),'VIP writes must be server-rule admin-only');
assert(sparkRules.vipProfiles['.read'].includes("role').val() === 'admin'"),'Employee labels must be admin-only');
assert(managerJs.includes('signInWithEmailAndPassword'),'Manager must use tested Firebase Auth');
assert(managerJs.includes("readFirebaseRest('members/'+encodeURIComponent(uid))"),'Manager must verify own membership using authenticated Firebase REST');
assert(managerJs.includes('runTransaction'),'Account creation and toggles must avoid blind overwrites');
assert(!managerJs.includes('getFunctions(') && !managerJs.includes('workers.dev'),'No paid Firebase Functions or Cloudflare');

const transition=JSON.parse(read('firebase.transition.rules.json')).rules;
assert(transition.whitelist['.read']===true && transition.whitelist['.write']===false,'Transitional whitelist must stay compatible');
assert(transition.users['.write']===true,'Transitional users writes must keep legacy site working until final switch');
assert(transition.users['.read']===JSON.parse(read('firebase.database.rules.json')).rules.users['.read'],'Admin report read must mirror final rules');
assert(transition.members['$uid']['.read']===JSON.parse(read('firebase.database.rules.json')).rules.members['$uid']['.read'],'Membership read differs from production target');
assert(transition.clientBackups['$uid']['$backupId']['.write']===JSON.parse(read('firebase.database.rules.json')).rules.clientBackups['$uid']['$backupId']['.write'],'Private backup write differs from production target');

// The file-only verifier is deliberately public; its CSP prohibits network exfiltration.
const protectedPages = pageFiles.filter(p=>!['404.html','backup-verify.html','vip-admin-spark.html'].includes(p) && !/^firebase-login-test(?:-v\d+)?\.html$/.test(p));
if(pageFiles.includes('vip-admin-spark.html')) {
  const page=read('vip-admin-spark.html');
  const code=read('vip-admin-spark.js');
  assert(page.includes('vip-admin-spark.js'),'Standalone Spark admin must import its own authentication script');
  assert(code.includes('signInWithEmailAndPassword') && code.includes("readFirebaseRest('members/'+encodeURIComponent(uid))"),'Standalone Spark admin must authenticate and verify administrator membership');
  assert(!code.includes('localStorage.clear('),'Spark admin must never clear customer localStorage');
}
// Standalone login diagnostics must never be treated as authenticated website pages.
for(const p of pageFiles.filter(p=>/^firebase-login-test(?:-v\d+)?\.html$/.test(p))){
  const code=read(p);
  assert(!code.includes('localStorage.getItem'),p+' must not read customer localStorage');
  assert(code.includes('Content-Security-Policy'),p+' must have a restrictive CSP');
}
for(const p of protectedPages){
  const code=read(p);
  assert(code.includes('auth.js'),p+' lacks Firebase member validation import (chars='+code.length+', utf8First='+code.charCodeAt(0)+', sample='+JSON.stringify(code.slice(160,255))+')');
}
const previouslyUngated=['calc_business.html','cardshow.html','portfolio.html','topsales.html','backup-export.html'];
for(const p of previouslyUngated){
  assert(read(p).includes('id="cathay-preauth"'),p+' must hide sensitive UI until Firebase completes');
}
assert(read('backup-export.html').includes('await window.cathayAuthReady'),'Protected JSON backup requires verified membership');
const verifier=read('backup-verify.html');
assert(verifier.includes("connect-src 'none'"),'Local backup verifier must disable network requests');
assert(!/\b(?:fetch|XMLHttpRequest|sendBeacon)\s*\(/.test(verifier),'Local verifier must not send backup data');
assert(verifier.includes("crypto.subtle.digest('SHA-256'"),'Verifier checksum not implemented');
assert(read('client.html').includes('id="cathay-preauth"'),'Customer data page must hide until login');
assert(read('admin.html').includes('id="cathay-preauth"'),'Admin page must hide until login');
assert(auth.includes("getElementById('cathay-preauth')?.remove()"),'Authorized login must reveal page content');
assert(product.includes('已停售商品區'));
assert(product.indexOf('href="prod_accident.html"') < product.indexOf('已停售商品區'));
for(const file of ['prod_invest_forever.html','prod_invest_full.html','prod_overflow_love.html']){
 assert(product.indexOf('href="'+file+'"') > product.indexOf('已停售商品區'),file+' must be grouped below active products');
}
assert(!product.includes('href="prod_overflow_love.html" class="highlight-pink"'));
assert(!product.includes('class="prod-btn invest-btn"'));
for(const page of ['index.html','products.html','client.html','admin.html','event.html','calc_plan.html','calc_combo.html','tools.html','system.html','calc_business.html','cardshow.html','portfolio.html','topsales.html','backup-export.html']){
  const html=read(page);
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)){
    if(m[1].includes('src='))continue;
    const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:m[2],encoding:'utf8'});
    assert.equal(syntax.status,0,page+' inline script syntax: '+syntax.stderr);
  }
}
console.log('V1.0 static checks passed; Firebase Rules and live runtime still need emulator/manual tests.');
