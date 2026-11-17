// Google OAuth2 service-account credentials and Firebase Realtime Database REST client.
// Credentials must be kept only in encrypted Worker Secrets; NEVER in GitHub or webpages.
import {toBase64Url} from '../worker/crypto.mjs';

const encoder=new TextEncoder();
let cache=null;
function serviceCredentials(env){
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new Error('service_account_missing');
  let account;
  try{account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);}
  catch(_){throw new Error('service_account_invalid');}
  if(account.type!=='service_account'||typeof account.private_key!=='string'||
     !account.private_key.includes('BEGIN PRIVATE KEY')||
     typeof account.client_email!=='string'||
     !account.client_email.endsWith('.gserviceaccount.com')||
     account.project_id!=='cathay-app-5889a')throw new Error('service_account_invalid');
  return account;
}
function pemToBuffer(pem){
  const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
  const binary=atob(body);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function getOAuthToken(env,requestFetch=fetch){
  if(cache&&cache.source===env.FIREBASE_SERVICE_ACCOUNT_JSON&&cache.validUntil>Date.now()+90000)
    return cache.token;
  const account=serviceCredentials(env);
  const key=await crypto.subtle.importKey('pkcs8',pemToBuffer(account.private_key),
    {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const iat=Math.floor(Date.now()/1000);
  const header=toBase64Url(encoder.encode(JSON.stringify({alg:'RS256',typ:'JWT'})));
  const payload=toBase64Url(encoder.encode(JSON.stringify({
    iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email',
    aud:'https://oauth2.googleapis.com/token',iat,exp:iat+3600
  })));
  const data=header+'.'+payload;
  const signature=toBase64Url(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(data)));
  const response=await requestFetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:data+'.'+signature}),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('oauth_token_request_failed');
  const tokens=await response.json();
  if(typeof tokens.access_token!=='string'||!Number.isFinite(Number(tokens.expires_in)))
    throw new Error('oauth_token_invalid_response');
  cache={source:env.FIREBASE_SERVICE_ACCOUNT_JSON,token:tokens.access_token,
    validUntil:Date.now()+Math.min(Number(tokens.expires_in),3600)*1000};
  return tokens.access_token;
}
function validateDbPath(path){
  if(typeof path!=='string'||path.length>255||!/^\/[A-Za-z0-9_:/-]+$/.test(path))
    throw new Error('invalid_database_path');
}
export function createFirebaseDB(env,requestFetch=fetch,tokenGetter=getOAuthToken){
  // Hard-pin the exact authorized project; never allow arbitrary DB URLs from clients.
  const endpoint='https://cathay-app-5889a-default-rtdb.firebaseio.com';
  async function request(method,path,{data,etag=false,ifMatch}={}){
    validateDbPath(path);
    const bearer=await tokenGetter(env,requestFetch);
    const headers={Authorization:'Bearer '+bearer,'Cache-Control':'no-store'};
    if(etag)headers['X-Firebase-ETag']='true';
    if(ifMatch!==undefined)headers['if-match']=ifMatch;
    if(data!==undefined)headers['content-type']='application/json';
    const response=await requestFetch(endpoint+path+'.json',{
      method,headers,body:data===undefined?undefined:JSON.stringify(data),
      signal:AbortSignal.timeout(12000)
    });
    if(response.status===412)return {conflict:true,etag:response.headers.get('etag')};
    if(!response.ok)throw new Error('firebase_backend_error_'+response.status);
    return {value:await response.json(),etag:response.headers.get('etag'),conflict:false};
  }
  return {
    async get(path){return (await request('GET',path)).value;},
    async getVersioned(path){return request('GET',path,{etag:true});},
    async put(path,value,ifMatch){return request('PUT',path,{data:value,ifMatch});},
    async patch(path,value){return request('PATCH',path,{data:value});}
  };
}
export async function counterIncrement(db,path,nowSec,maxAttempts=20){
  // Firebase ETags provide compare-and-swap semantics; no lost-update bypass on concurrent requests.
  for(let attempt=0;attempt<6;attempt++){
    const {value,etag}=await db.getVersioned(path);
    if(!etag)throw new Error('etag_missing');
    const current=value&&value.expiresAt>nowSec?Number(value.count)||0:0;
    // Already blocked; don't generate unbounded writes.
    if(current>=maxAttempts)return false;
    const newValue={count:current+1,expiresAt:
      value&&value.expiresAt>nowSec?value.expiresAt:nowSec+900};
    const result=await db.put(path,newValue,etag);
    if(!result.conflict)return true;
  }
  throw new Error('rate_limit_conflict');
}
export async function createIfAbsent(db,path,value){
  const found=await db.getVersioned(path);
  if(found.value!==null)return false;
  if(!found.etag)throw new Error('etag_missing');
  const written=await db.put(path,value,found.etag);
  return !written.conflict;
}
export async function changeStatus(db,path,active){
  // Concurrent status updates will not silently overwrite one another.
  for(let attempt=0;attempt<4;attempt++){
    const found=await db.getVersioned(path);
    if(!found.value)return null;
    const next={...found.value,active,version:found.value.version+1,
      updatedAt:new Date().toISOString()};
    const response=await db.put(path,next,found.etag);
    if(!response.conflict)return next;
  }
  throw new Error('status_conflict');
}
