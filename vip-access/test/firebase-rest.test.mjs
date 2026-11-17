import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createFirebaseDB} from '../firebase-worker/database.mjs';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const {publicKey,privateKey}=await crypto.subtle.generateKey({
  name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),
  hash:'SHA-256'},true,['sign','verify']);
const bytes=new Uint8Array(await crypto.subtle.exportKey('pkcs8',privateKey));
const pem='-----BEGIN PRIVATE KEY-----\n'+Buffer.from(bytes).toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END PRIVATE KEY-----';
const cred={type:'service_account',project_id:'cathay-app-5889a',
  client_email:'test@cathay-app-5889a.iam.gserviceaccount.com',private_key:pem};
const env={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify(cred)};
const logs=[];
let dbCalls=0,tokenCalls=0;
async function mockFetch(url,options={}){
  const uri=String(url);
  if(uri==='https://oauth2.googleapis.com/token'){
    tokenCalls++;
    assert.equal(options.method,'POST');
    const form=options.body;
    assert.equal(form.get('grant_type'),'urn:ietf:params:oauth:grant-type:jwt-bearer');
    const assertion=form.get('assertion');
    const [h,p,s]=assertion.split('.');
    const head=JSON.parse(Buffer.from(h,'base64url').toString());
    const claims=JSON.parse(Buffer.from(p,'base64url').toString());
    assert.equal(head.alg,'RS256');
    assert.equal(claims.aud,'https://oauth2.googleapis.com/token');
    assert.equal(claims.iss,cred.client_email);
    assert(claims.scope.includes('firebase.database'));
    assert(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,
      Buffer.from(s,'base64url'),encoder.encode(h+'.'+p)));
    logs.push('oauth');
    return Response.json({access_token:'test-only-access-token',expires_in:3600});
  }
  assert(uri.startsWith('https://cathay-app-5889a-default-rtdb.firebaseio.com/'));
  assert(!uri.includes('private_key'));
  assert.equal(options.headers.Authorization,'Bearer test-only-access-token');
  dbCalls++;logs.push(uri);
  if(options.method==='GET'){
    return new Response(JSON.stringify({active:true,version:2}),{
      status:200,headers:{etag:'"etag-2"','content-type':'application/json'}});
  }
  if(options.method==='PUT'){
    assert.equal(options.headers['if-match'],'"etag-2"');
    return new Response(JSON.stringify({active:false,version:3}),{
      status:200,headers:{'content-type':'application/json'}});
  }
  throw new Error('unexpected HTTP method');
}
test('Service-account OAuth JWT signature and RTDB conditional GET/PUT use only expected Google endpoints',async()=>{
 const db=createFirebaseDB(env,mockFetch);
 const found=await db.getVersioned('/members/adminuid');
 assert.equal(found.value.active,true);
 assert.equal(found.etag,'"etag-2"');
 const updated=await db.put('/members/adminuid',{active:false,version:3},found.etag);
 assert.equal(updated.value.version,3);
 assert.equal(tokenCalls,1,'OAuth access token must be cached for same Worker secret');
 assert.equal(dbCalls,2);
 assert.equal(logs[0],'oauth');
 assert(logs.every(item=>!item.includes('BEGIN PRIVATE KEY')));
});
test('Wrong project service account fails before any database request',async()=>{
 const invalid={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({...cred,project_id:'unrelated-project'})};
 const before=dbCalls;
 await assert.rejects(()=>createFirebaseDB(invalid,mockFetch).get('/members/adminuid'));
 assert.equal(dbCalls,before);
});
test('Database REST client rejects arbitrary injected paths and URLs',async()=>{
 const db=createFirebaseDB(env,mockFetch);
 await assert.rejects(()=>db.get('/whitelist/CODE.json?auth=steal'));
 await assert.rejects(()=>db.get('https://evil.example'));
});
