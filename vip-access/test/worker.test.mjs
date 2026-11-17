import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {canonicalizeCode,hmacHex,signSession,verifySession,generateVipCode,verifyFirebaseJwt,
 toBase64Url} from '../worker/crypto.mjs';
import worker from '../worker/index.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const codePepper='test-code-pepper-0123456789abcdefghijklmnopqrstuvwxyz';
const sessionSecret='test-session-secret-abcdefghijklmnopqrstuvwxyz-987654321';
const origin='https://jacky0530-spec.github.io';
const projectId='cathay-app-5889a';
const path='https://vip-worker.example';
const encoder=new TextEncoder();
const b64=s=>toBase64Url(encoder.encode(s));
let publicJwk,adminJwt,otherJwt;
const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
publicJwk=await crypto.subtle.exportKey('jwk',publicKey);
publicJwk.kid='test-firebase-kid';
publicJwk.alg='RS256';
const now=()=>Math.floor(Date.now()/1000);
async function makeJwt(uid,overrides={},tamper=false){
 const header=b64(JSON.stringify({typ:'JWT',alg:'RS256',kid:'test-firebase-kid'}));
 const payload=b64(JSON.stringify({iss:'https://securetoken.google.com/'+projectId,aud:projectId,sub:uid,
  iat:now()-30,exp:now()+1800,auth_time:now()-100,...overrides}));
 const data=header+'.'+payload;
 const sig=toBase64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,encoder.encode(data)));
 return data+'.'+(tamper?sig.slice(0,-2)+'AA':sig);
}
adminJwt=await makeJwt('admin-uid');
otherJwt=await makeJwt('ordinary-uid');
const network=globalThis.fetch;
globalThis.fetch=async url=>{
 if(String(url).includes('service_accounts/v1/jwk'))return new Response(JSON.stringify({keys:[publicJwk]}),{status:200});
 throw Error('unexpected fetch');
};
class FakeDB{
 constructor(){this.codes=new Map();this.limits=new Map();this.events=[];}
 prepare(sql){
  const db=this;
  return {
   async all(){
     if(sql.includes('FROM vip_codes ORDER BY'))return {results:[...db.codes.values()]};
     if(sql.includes('FROM admin_audit ORDER BY'))return {results:db.events};
     throw Error('Unmocked SQL all '+sql);
   },
   bind(...args){return {
   async first(){
    if(sql.startsWith('INSERT INTO rate_limits')){
      const [key,expires,at]=args;
      let current=db.limits.get(key);
      if(!current||current.exp<=at)current={exp:expires,attempts:0};
      current.attempts++;db.limits.set(key,current);
      return {attempts:current.attempts};
    }
    if(sql.includes('FROM vip_codes WHERE code_hash=')){
      const row=[...db.codes.values()].find(c=>c.code_hash===args[0]);
      return row?{...row}:null;
    }
    if(sql.includes('FROM vip_codes WHERE id=')){
      const row=db.codes.get(args[0]);return row?{...row}:null;
    }
    if(sql.startsWith('UPDATE vip_codes SET active=')){
      const [active,stamp,id]=args;const row=db.codes.get(id);
      if(!row)return null;
      row.active=active;row.version++;row.updated_at=stamp;
      return {...row};
    }
    throw Error('Unmocked SQL first '+sql);
   },
   async run(){
    if(sql.startsWith('INSERT INTO vip_codes(')){
      const [id,label,hash,hint,created,updated]=args;
      if([...db.codes.values()].some(c=>c.code_hash===hash))throw Error('UNIQUE constraint failed');
      db.codes.set(id,{id,label,code_hash:hash,code_hint:hint,active:1,version:1,
        created_at:created,updated_at:updated,last_used_at:null});return {success:true};
    }
    if(sql.startsWith('UPDATE vip_codes SET last_used_at=')){
      const row=db.codes.get(args[1]);row.last_used_at=args[0];return {success:true};
    }
    if(sql.startsWith('INSERT INTO admin_audit(')){
      db.events.push({id:args[0],actor_uid:args[1],action:args[2],target_id:args[3],created_at:args[4]});return {success:true};
    }
    throw Error('Unmocked SQL run '+sql);
   },
   async all(){
    if(sql.includes('FROM vip_codes ORDER BY'))return {results:[...db.codes.values()]};
    if(sql.includes('FROM admin_audit ORDER BY'))return {results:db.events};
    throw Error('Unmocked SQL all '+sql);
   }
  };}
  };
 }
}
const db=new FakeDB();
const env={DB:db,CODE_PEPPER:codePepper,SESSION_SECRET:sessionSecret,ADMIN_UIDS:'admin-uid',
 SITE_ORIGIN:origin,FIREBASE_PROJECT_ID:projectId};
async function call(method,route,{body,token,originHeader=origin,ip='192.0.2.5'}={}){
 const headers={'Origin':originHeader,'CF-Connecting-IP':ip};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const request=new Request(path+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const response=await worker.fetch(request,env);
 return {status:response.status,body:JSON.parse(await response.text()),headers:response.headers};
}

test('VIP codes normalize without exposing storage credentials',async()=>{
 assert.equal(canonicalizeCode(' vip01234 '),'VIP01234');
 assert.throws(()=>canonicalizeCode('VIP123\nbad'));
 const code=generateVipCode();
 assert.match(code,/^VIP[A-F0-9]{30}$/);
 assert.equal((await hmacHex(codePepper,'vip:VIP888')).length,64);
 assert.notEqual(await hmacHex(codePepper,'vip:VIP888'),await hmacHex(codePepper,'vip:VIP889'));
});
test('Signed sessions reject forged, expired, and revoked versions',async()=>{
 const account={id:'fake-account',version:1};
 const session=await signSession(sessionSecret,account,1000);
 assert.equal((await verifySession(sessionSecret,session.token,1001)).sub,'fake-account');
 await assert.rejects(()=>verifySession(sessionSecret,session.token+'bad',1001));
 await assert.rejects(()=>verifySession(sessionSecret,session.token,3000));
});
test('Firebase admin token checks issuer, project and RS256 signature',async()=>{
 assert.equal(await verifyFirebaseJwt(adminJwt,projectId),'admin-uid');
 const wrongAudience=await makeJwt('admin-uid',{aud:'other'});
 const expired=await makeJwt('admin-uid',{exp:now()-1});
 const brokenSignature=await makeJwt('admin-uid',{},true);
 await assert.rejects(()=>verifyFirebaseJwt(wrongAudience,projectId));
 await assert.rejects(()=>verifyFirebaseJwt(expired,projectId));
 await assert.rejects(()=>verifyFirebaseJwt(brokenSignature,projectId));
});
test('Worker: account creation, existing-code login, protected audit, disabling and re-enabling',async()=>{
 assert.equal((await call('POST','/api/admin/vip',{body:{label:'專案範例'}})).status,401);
 assert.equal((await call('GET','/api/admin/vip',{token:otherJwt})).status,403);
 assert.equal((await call('GET','/api/admin/vip',{token:adminJwt,originHeader:'https://evil.example'})).status,403);
 const created=await call('POST','/api/admin/vip',{token:adminJwt,body:{label:'新人測試'}});assert.equal(created.status,200);
 const {id,active}=created.body.account,code=created.body.code;
 assert(active);
 const row=db.codes.get(id);assert(row&&!Object.values(row).includes(code),'Plain text code must not enter D1');
 const listing=await call('GET','/api/admin/vip',{token:adminJwt});
 assert.equal(listing.status,200);assert.equal(listing.body.accounts.length,1);
 assert(!JSON.stringify(listing.body).includes(code));
 assert(!JSON.stringify(listing.body).includes(row.code_hash));
 assert.equal((await call('POST','/api/v1/login',{body:{code:'VIP-UNKNOWN'}})).status,401);
 const login=await call('POST','/api/v1/login',{body:{code:code.toLowerCase()}});
 assert.equal(login.status,200);const accessToken=login.body.token;
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,200);
 const disabled=await call('POST','/api/admin/vip/'+id+'/status',{token:adminJwt,body:{active:false}});
 assert.equal(disabled.status,200);
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,401);
 assert.equal((await call('POST','/api/v1/login',{body:{code}})).status,401);
 const enabled=await call('POST','/api/admin/vip/'+id+'/status',{token:adminJwt,body:{active:true}});
 assert.equal(enabled.status,200);
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,401,'Old session must stay revoked after re-enable');
 assert.equal((await call('POST','/api/v1/login',{body:{code}})).status,200);
 const existing=await call('POST','/api/admin/vip',{token:adminJwt,body:{label:'保留既有授權碼',existingCode:'vip-example-01'}});
 assert.equal(existing.status,200);
 assert.equal((await call('POST','/api/v1/login',{body:{code:'VIP-EXAMPLE-01'}})).status,200);
 assert.equal((await call('POST','/api/admin/vip',{token:adminJwt,body:{label:'重複',existingCode:'vip-example-01'}})).status,409);
 const audit=await call('GET','/api/admin/audit',{token:adminJwt});
 assert.equal(audit.status,200);assert(audit.body.events.length>=3);
 assert(!JSON.stringify(audit.body).includes(code));
});
test('Worker limits unauthenticated guessed VIP attempts and fails closed when unconfigured',async()=>{
 for(let i=0;i<21;i++){
  const r=await call('POST','/api/v1/login',{body:{code:'INCORRECT'},ip:'192.0.2.253'});
  if(i<20)assert.equal(r.status,401);
  else assert.equal(r.status,429);
 }
 const temp=env.SESSION_SECRET;env.SESSION_SECRET='';
 try{assert.equal((await call('POST','/api/v1/login',{body:{code:'VIP12345'}})).status,503);}
 finally{env.SESSION_SECRET=temp;}
});
test.after(()=>{globalThis.fetch=network;});
