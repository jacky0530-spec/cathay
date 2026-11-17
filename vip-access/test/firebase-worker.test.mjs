import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createHandler} from '../firebase-worker/index.mjs';
import {counterIncrement,createIfAbsent,changeStatus,createFirebaseDB} from '../firebase-worker/database.mjs';
import {toBase64Url} from '../worker/crypto.mjs';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const encoder=new TextEncoder();
const b64=s=>toBase64Url(encoder.encode(s));
const now=()=>Math.floor(Date.now()/1000);
const origin='https://jacky0530-spec.github.io';
const records=new Map(),versions=new Map();
function clone(v){return v===undefined?null:structuredClone(v);}
class FakeFirebaseDB {
  constructor(){
    this.writes=[];
    records.set('/whitelist',{CODEEXIST:true,OLDER2:true,DISABLED:false});
    records.set('/members/admin-uid',{active:true,role:'admin'});
    records.set('/members/other-uid',{active:true,role:'user'});
  }
  async get(path){
    if(records.has(path))return clone(records.get(path));
    const split=path.lastIndexOf('/');
    if(split>0){
      const parent=path.slice(0,split),child=path.slice(split+1);
      if(records.has(parent)){
        const value=records.get(parent);
        if(value&&typeof value==='object')return clone(value[child]);
      }
    }
    // Parent-tree paths behave like RTDB.
    const entries=[...records.entries()].filter(([key])=>key.startsWith(path+'/'));
    if(entries.length===0)return null;
    const parent={};
    for(const [key,value] of entries){
      const rest=key.slice(path.length+1).split('/');
      let current=parent;
      for(let i=0;i<rest.length-1;i++){current[rest[i]]??={};current=current[rest[i]];}
      current[rest.at(-1)]=clone(value);
    }
    return parent;
  }
  async getVersioned(path){return {value:await this.get(path),etag:'"'+(versions.get(path)||0)+'"'};}
  async put(path,value,etag){
    if(etag!==undefined&&etag!=='"'+(versions.get(path)||0)+'"')return {conflict:true};
    records.set(path,clone(value));versions.set(path,(versions.get(path)||0)+1);
    this.writes.push(path);return {value:clone(value),conflict:false};
  }
  async patch(path,value){
    const old=await this.get(path);
    records.set(path,{...(old||{}),...clone(value)});versions.set(path,(versions.get(path)||0)+1);
    this.writes.push(path);return {conflict:false};
  }
}
const db=new FakeFirebaseDB();
const env={FIREBASE_PROJECT_ID:'cathay-app-5889a',FIREBASE_SERVICE_ACCOUNT_JSON:'test-nonempty-secret',
  CODE_PEPPER:'test-code-secret-abcdefghijklmnopqrstuvwxyz123456',
  SESSION_SECRET:'test-session-secret-abcdefghijklmnopqrstuvwxyz123456',
  SITE_ORIGIN:origin};
const handler=createHandler(()=>db);

const {publicKey,privateKey}=await crypto.subtle.generateKey(
 {name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},
 true,['sign','verify']);
const publicJwk=await crypto.subtle.exportKey('jwk',publicKey);
publicJwk.kid='test-firebase-kid';publicJwk.alg='RS256';
const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 if(String(url).includes('service_accounts/v1/jwk'))
   return new Response(JSON.stringify({keys:[publicJwk]}),{status:200});
 throw new Error('Unexpected network call');
};
async function makeJwt(uid,override={}){
 const a=b64(JSON.stringify({alg:'RS256',typ:'JWT',kid:'test-firebase-kid'}));
 const b=b64(JSON.stringify({iss:'https://securetoken.google.com/cathay-app-5889a',
    aud:'cathay-app-5889a',sub:uid,iat:now()-60,exp:now()+1800,auth_time:now()-120,...override}));
 const data=a+'.'+b;
 const signature=toBase64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,encoder.encode(data)));
 return data+'.'+signature;
}
const adminToken=await makeJwt('admin-uid'),userToken=await makeJwt('other-uid');
async function call(method,path,{body,token,originHeader=origin,ip='198.51.100.4'}={}){
 const headers={Origin:originHeader,'CF-Connecting-IP':ip};
 if(token)headers.Authorization='Bearer '+token;
 if(body!==undefined)headers['Content-Type']='application/json';
 const request=new Request('https://test-worker.example'+path,{
  method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const response=await handler.fetch(request,env);
 return {status:response.status,body:response.status===204?null:await response.json()};
}
test('Firebase RTDB CAS permits first insert but not overwrites',async()=>{
 assert.equal(await createIfAbsent(db,'/vipAccess/test/first',{hello:'one',version:0}),true);
 assert.equal(await createIfAbsent(db,'/vipAccess/test/first',{hello:'two'}),false);
 assert.equal((await db.get('/vipAccess/test/first')).hello,'one');
 const status=await changeStatus(db,'/vipAccess/test/first',false);assert.equal(status.active,false);assert.equal(status.version,1);
});
test('Admin permissions require Firebase JWT and live members role/active',async()=>{
 assert.equal((await call('GET','/api/admin/vip')).status,401);
 assert.equal((await call('GET','/api/admin/vip',{token:userToken})).status,403);
 assert.equal((await call('GET','/api/admin/vip',{token:adminToken,originHeader:'https://not-trusted.example'})).status,403);
 assert.equal((await call('GET','/api/admin/vip',{token:adminToken})).status,200);
 await db.patch('/members/admin-uid',{active:false});
 assert.equal((await call('GET','/api/admin/vip',{token:adminToken})).status,403);
 await db.patch('/members/admin-uid',{active:true,role:'user'});
 assert.equal((await call('GET','/api/admin/vip',{token:adminToken})).status,403);
 await db.patch('/members/admin-uid',{role:'admin'});
});
test('Legacy whitelist passes through Worker, old data remains intact, privileged sync does not overwrite whitelist',async()=>{
 const oldSnapshot=await db.get('/whitelist');
 const login=await call('POST','/api/v1/login',{body:{code:'codeexist'}});
 assert.equal(login.status,200);
 const token=login.body.token;
 assert.equal((await call('GET','/api/v1/session',{token})).status,200);
 assert.deepEqual(await db.get('/whitelist'),oldSnapshot);
 const result=await call('POST','/api/admin/legacy/sync',{token:adminToken});
 assert.equal(result.status,200);
 assert.equal(result.body.recognized,2);
 assert.deepEqual(await db.get('/whitelist'),oldSnapshot);
 const list=await call('GET','/api/admin/vip',{token:adminToken});
 assert.equal(list.status,200);
 assert.equal(list.body.accounts.length,2);
 assert(!JSON.stringify(list.body).includes('CODEEXIST'));
 assert(!JSON.stringify(list.body).includes('OLDER2'));
 const id=list.body.accounts.find(x=>x.hint==='…XIST').id;
 assert(id.startsWith('l-'));
 const revoked=await call('POST','/api/admin/vip/'+id+'/status',{
  token:adminToken,body:{active:false}});
 assert.equal(revoked.status,200);
 assert.equal((await call('GET','/api/v1/session',{token})).status,401);
 assert.equal((await call('POST','/api/v1/login',{body:{code:'CODEEXIST'}})).status,401);
 assert.deepEqual(await db.get('/whitelist'),oldSnapshot);
});
test('Manager issues new VIP, avoids plaintext, revokes and reactivates without reusing sessions',async()=>{
 const created=await call('POST','/api/admin/vip',{
  token:adminToken,body:{label:'新同事'}});
 assert.equal(created.status,200);
 const code=created.body.code;
 assert.match(code,/^VIP[A-F0-9]{30}$/);
 const id=created.body.account.id;
 assert(id.startsWith('n-'));
 const privateRecords=JSON.stringify(Object.fromEntries(records));
 assert(!privateRecords.includes(code),'New VIP plaintext should never be persisted');
 const login=await call('POST','/api/v1/login',{body:{code:code.toLowerCase()}});
 assert.equal(login.status,200);
 const accessToken=login.body.token;
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,200);
 assert.equal((await call('POST','/api/admin/vip/'+id+'/status',{
  token:userToken,body:{active:false}})).status,403);
 assert.equal((await call('POST','/api/admin/vip/'+id+'/status',{
  token:adminToken,body:{active:false}})).status,200);
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,401);
 assert.equal((await call('POST','/api/v1/login',{body:{code}})).status,401);
 assert.equal((await call('POST','/api/admin/vip/'+id+'/status',{
  token:adminToken,body:{active:true}})).status,200);
 assert.equal((await call('GET','/api/v1/session',{token:accessToken})).status,401);
 assert.equal((await call('POST','/api/v1/login',{body:{code}})).status,200);
 assert(!db.writes.some(p=>p==='/users'||p.startsWith('/whitelist/')),'Legacy nodes must not be mutated');
});
test('Unknown codes and guessing attempts reject with rate limit',async()=>{
 const unknown=await call('POST','/api/v1/login',{body:{code:'unknown'}});
 assert.equal(unknown.status,401);
 for(let i=0;i<21;i++){
  const attempt=await call('POST','/api/v1/login',{body:{code:'UNKNOWN'},ip:'203.0.113.25'});
  assert.equal(attempt.status,i<20?401:429);
 }
 const ipPaths=db.writes.filter(p=>p.includes('/rate/'));
 assert(ipPaths.every(path=>!path.includes('203.0.113.25')));
});
test('Missing Worker credentials fail closed and secrets stay outside database',async()=>{
 const old=env.FIREBASE_SERVICE_ACCOUNT_JSON;
 env.FIREBASE_SERVICE_ACCOUNT_JSON='';
 try{assert.equal((await call('GET','/api/admin/vip',{token:adminToken})).status,503);}
 finally{env.FIREBASE_SERVICE_ACCOUNT_JSON=old;}
});
test.after(()=>globalThis.fetch=oldFetch);
