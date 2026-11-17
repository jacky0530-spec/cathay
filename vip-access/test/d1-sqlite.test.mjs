import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {hmacHex} from '../worker/crypto.mjs';
import worker from '../worker/index.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const db=new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));

// This adapter sends unmodified Worker SQL through actual SQLite statements,
// unlike the purely mocked unit tests. D1 is based on SQLite.
function wrapper(db){
 return {prepare(sql){
   return {
    bind(...values){
      const statement=db.prepare(sql);
      return {first:async()=>statement.get(...values)||null,
        all:async()=>({results:statement.all(...values)}),
        run:async()=>statement.run(...values)};
    },
    first:async()=>db.prepare(sql).get()||null,
    all:async()=>({results:db.prepare(sql).all()}),
    run:async()=>db.prepare(sql).run()
   };
 }};
}
const env={DB:wrapper(db),SITE_ORIGIN:'https://jacky0530-spec.github.io',
 CODE_PEPPER:'local-test-pepper-not-real-0123456789-abcdefghijk',
 SESSION_SECRET:'local-test-session-not-real-0123456789-abcdefghijk',
 ADMIN_UIDS:'local-firebase-admin',FIREBASE_PROJECT_ID:'cathay-app-5889a'};
function call(method,route,body,ip='198.51.100.8'){
 const headers={Origin:env.SITE_ORIGIN,'CF-Connecting-IP':ip};
 if(body!==undefined)headers['Content-Type']='application/json';
 return worker.fetch(new Request('https://worker.example'+route,{
   method,headers,body:body===undefined?undefined:JSON.stringify(body)
 }),env);
}
test('D1 schema creates required indexed tables with useful constraints',()=>{
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(x=>x.name);
 for(const name of ['vip_codes','rate_limits','admin_audit'])assert(tables.includes(name));
 assert.throws(()=>db.prepare("INSERT INTO vip_codes(id,label,code_hash,code_hint,created_at,updated_at) VALUES('a','','hash','...4','now','now')").run());
 assert.throws(()=>db.prepare("INSERT INTO vip_codes(id,label,code_hash,code_hint,active,created_at,updated_at) VALUES('a','OK','hash','...4',3,'now','now')").run());
});
test('Real SQLite SQL: one valid VIP, failed guesses, session revocation and reactivation',async()=>{
 const code='VIP-TEST-EXAMPLE-001';
 const hash=await hmacHex(env.CODE_PEPPER,'vip:'+code);
 db.prepare('INSERT INTO vip_codes(id,label,code_hash,code_hint,active,version,created_at,updated_at) VALUES(?,?,?,?,1,1,?,?)')
  .run('account-1','合成資料',hash,'…0001','2026-11-17','2026-11-17');
 let response=await call('POST','/api/v1/login',{code});
 assert.equal(response.status,200);
 const issued=await response.json();
 assert(issued.ok&&typeof issued.token==='string');
 const sessionRequest=()=>worker.fetch(new Request('https://worker.example/api/v1/session',{
  method:'GET',headers:{Origin:env.SITE_ORIGIN,Authorization:'Bearer '+issued.token}
 }),env);
 response=await sessionRequest();assert.equal(response.status,200);
 assert((await response.json()).ok);
 assert.equal(db.prepare("SELECT last_used_at FROM vip_codes WHERE id='account-1'").get().last_used_at.length>0,true);
 response=await call('POST','/api/v1/login',{code:'NONEXISTENT1'});
 assert.equal(response.status,401);
 assert.equal(db.prepare('SELECT attempts FROM rate_limits').get().attempts,2);
 // A disabled code must invalidate an existing token immediately.
 db.prepare('UPDATE vip_codes SET active=0,version=version+1 WHERE id=?').run('account-1');
 response=await sessionRequest();assert.equal(response.status,401);
 response=await call('POST','/api/v1/login',{code});assert.equal(response.status,401);
 // Re-enabling does not make the old JWT session valid again.
 db.prepare('UPDATE vip_codes SET active=1,version=version+1 WHERE id=?').run('account-1');
 response=await sessionRequest();assert.equal(response.status,401);
 response=await call('POST','/api/v1/login',{code});
 assert.equal(response.status,200);
});
test('Real SQLite rate-limit upsert rejects repeated guesses and keeps raw IP out of D1',async()=>{
 for(let i=0;i<21;i++){
  const response=await call('POST','/api/v1/login',{code:'NOPE-EXAMPLE'},'198.51.100.39');
  assert.equal(response.status,i<20?401:429);
 }
 const values=db.prepare('SELECT ip_hash, attempts FROM rate_limits').all();
 assert(values.some(x=>x.attempts===21));
 assert(values.every(x=>/^[a-f0-9]{64}$/.test(x.ip_hash)),'Raw client IP must not be stored');
});
test('Database never stores raw VIP credentials',()=>{
 const entries=db.prepare('SELECT code_hash,code_hint FROM vip_codes').all();
 assert.equal(entries.length,1);
 assert(entries[0].code_hash.length===64);
 assert(!JSON.stringify(entries).includes('VIP-TEST-EXAMPLE-001'));
});
test.after(()=>db.close());
