// Core, runtime-portable primitives for VIP authorization. Secrets never enter the browser.
const encoder=new TextEncoder();
const decoder=new TextDecoder();
export function canonicalizeCode(value){
  if(typeof value!=='string')throw new Error('invalid_code');
  const code=value.trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{5,47}$/.test(code))throw new Error('invalid_code');
  return code;
}
const toBytes=s=>encoder.encode(s);
export function toBase64Url(buffer){
  const bytes=new Uint8Array(buffer);
  let value='';
  for(let i=0;i<bytes.length;i++)value+=String.fromCharCode(bytes[i]);
  return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function fromBase64Url(str){
  if(typeof str!=='string'||!/^[A-Za-z0-9_-]+$/.test(str))throw new Error('bad_base64');
  const fixed=str.replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(fixed+'='.repeat((4-fixed.length%4)%4));
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
async function hmacKey(secret){
  if(typeof secret!=='string'||secret.length<32)throw new Error('missing_secret');
  return crypto.subtle.importKey('raw',toBytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
export async function hmacHex(secret,source){
  const key=await hmacKey(secret);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,toBytes(source)));
  return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function signSession(secret,account,now=Math.floor(Date.now()/1000)){
  const payload={type:'vip-v1',sub:account.id,ver:account.version,iat:now,exp:now+1800,
    nonce:crypto.randomUUID()};
  const data=toBase64Url(toBytes(JSON.stringify(payload)));
  const sig=await crypto.subtle.sign('HMAC',await hmacKey(secret),toBytes(data));
  return {token:data+'.'+toBase64Url(sig),expiresAt:payload.exp};
}
export async function verifySession(secret,token,now=Math.floor(Date.now()/1000)){
  if(typeof token!=='string'||token.length>4096)throw new Error('invalid_session');
  const parts=token.split('.');
  if(parts.length!==2)throw new Error('invalid_session');
  const [data,signature]=parts;
  const good=await crypto.subtle.verify('HMAC',await hmacKey(secret),fromBase64Url(signature),toBytes(data));
  if(!good)throw new Error('invalid_session');
  const value=JSON.parse(decoder.decode(fromBase64Url(data)));
  if(value.type!=='vip-v1'||typeof value.sub!=='string'||value.sub.length>80||
    !Number.isSafeInteger(value.ver)||!Number.isSafeInteger(value.iat)||
    !Number.isSafeInteger(value.exp)||value.iat>now+30||
    value.exp<=now||value.exp>value.iat+1800||now-value.iat>1800)
    throw new Error('expired_or_invalid_session');
  return value;
}
export function generateVipCode(){
  const bytes=crypto.getRandomValues(new Uint8Array(15));
  return 'VIP'+[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
}
export async function verifyFirebaseJwt(token,projectId,requestFetch=fetch,now=Math.floor(Date.now()/1000)){
  if(typeof token!=='string'||token.length>12000)throw new Error('invalid_admin_token');
  const parts=token.split('.');
  if(parts.length!==3)throw new Error('invalid_admin_token');
  const [first,second,sig]=parts;
  let header,payload;
  try{
    header=JSON.parse(decoder.decode(fromBase64Url(first)));
    payload=JSON.parse(decoder.decode(fromBase64Url(second)));
  }catch(_){throw new Error('invalid_admin_token');}
  if(header.alg!=='RS256'||typeof header.kid!=='string'||!header.kid||
    payload.aud!==projectId||payload.iss!=='https://securetoken.google.com/'+projectId||
    typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||
    !Number.isSafeInteger(payload.exp)||payload.exp<=now||
    !Number.isSafeInteger(payload.iat)||payload.iat>now||
    !Number.isSafeInteger(payload.auth_time)||payload.auth_time>now)
    throw new Error('invalid_admin_token');
  const res=await requestFetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  if(!res.ok)throw new Error('admin_jwks_unavailable');
  const json=await res.json();
  const jwk=Array.isArray(json.keys)?json.keys.find(x=>x.kid===header.kid&&x.kty==='RSA'&&x.alg==='RS256'):null;
  if(!jwk)throw new Error('unknown_admin_key');
  const pub=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const verified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pub,fromBase64Url(sig),toBytes(first+'.'+second));
  if(!verified)throw new Error('invalid_admin_signature');
  return payload.sub;
}
