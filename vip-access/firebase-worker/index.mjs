// Firebase-backed VIP authorization Worker; staging only.
// Does not change the website login UI, existing whitelist, users or members nodes.
// Credentials and signing secrets must exist ONLY as Cloudflare Worker Secrets.
import {hmacHex,signSession,verifySession,generateVipCode,verifyFirebaseJwt} from '../worker/crypto.mjs';
import {createFirebaseDB,counterIncrement,createIfAbsent,changeStatus} from './database.mjs';

const now=()=>Math.floor(Date.now()/1000);
const iso=()=>new Date().toISOString();
class HTTPError extends Error {
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff',...headers}
});
function verifiedOrigin(request,env){
  const origin=request.headers.get('Origin');
  if(!origin||origin!==env.SITE_ORIGIN)throw new HTTPError(403,'origin_denied');
  return {'access-control-allow-origin':origin,'vary':'Origin',
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'Authorization, Content-Type',
    'access-control-max-age':'300'};
}
function requireConfigured(env){
  if(!env.FIREBASE_SERVICE_ACCOUNT_JSON||!env.CODE_PEPPER||env.CODE_PEPPER.length<32||
    !env.SESSION_SECRET||env.SESSION_SECRET.length<32||
    env.CODE_PEPPER===env.SESSION_SECRET||
    env.SITE_ORIGIN!=='https://jacky0530-spec.github.io'||
    env.FIREBASE_PROJECT_ID!=='cathay-app-5889a')throw new HTTPError(503,'not_configured');
}
function normalizeCode(value){
  if(typeof value!=='string')throw new HTTPError(401,'invalid_credentials');
  const code=value.trim().toUpperCase();
  // Legacy codes may be short. Rate limiting is mandatory while this is supported.
  if(!/^[A-Z0-9_-]{1,64}$/.test(code))throw new HTTPError(401,'invalid_credentials');
  return code;
}
async function bodyJson(request){
  const length=Number(request.headers.get('content-length')||0);
  if(length>4096)throw new HTTPError(413,'body_too_large');
  const text=await request.text();
  if(text.length>4096)throw new HTTPError(413,'body_too_large');
  let value;try{value=JSON.parse(text);}catch(_){throw new HTTPError(400,'invalid_json');}
  if(!value||Array.isArray(value)||typeof value!=='object')throw new HTTPError(400,'invalid_json');
  return value;
}
function bearer(request){
  const header=request.headers.get('Authorization')||'';
  if(!header.startsWith('Bearer '))throw new HTTPError(401,'authentication_required');
  return header.slice(7);
}
function codeId(prefix,hash){return prefix+'-'+hash;}
function parseCodeId(id){
  const match=typeof id==='string'?id.match(/^([nl])-([a-f0-9]{64})$/):null;
  if(!match)throw new HTTPError(404,'not_found');
  return {kind:match[1],hash:match[2],
    path:(match[1]==='n'?'/vipAccess/codes/':'/vipAccess/legacy/')+match[2]};
}
function codePublic(row,id){
  return {id,label:row.label,active:row.active===true,
    hint:row.hint,createdAt:row.createdAt,updatedAt:row.updatedAt,
    lastUsedAt:row.lastUsedAt||null};
}
async function hashCode(env,code){return hmacHex(env.CODE_PEPPER,'vip:'+code);}
async function audit(db,uid,action,id=null){
  const key=crypto.randomUUID();
  await db.put('/vipAccess/audit/'+key,{actorUid:uid,action,targetId:id,createdAt:iso()});
}
function isLegacyFallback(code,env){
  // Legacy hard-coded bypass codes can be temporarily migrated as an encrypted secret
  // instead of keeping backdoors inside publicly downloadable JavaScript.
  // Do not set this secret until the existing codes and risk have been reviewed.
  return typeof env.LEGACY_COMPAT_CODES==='string' &&
    env.LEGACY_COMPAT_CODES.split(',').some(x=>x.trim().toUpperCase()===code);
}
async function checkOldCode(db,code,env){
  return await db.get('/whitelist/'+code)===true||isLegacyFallback(code,env);
}
async function accessAdmin(request,env,db){
  let uid;try{uid=await verifyFirebaseJwt(bearer(request),env.FIREBASE_PROJECT_ID);}
  catch(_){throw new HTTPError(401,'admin_authentication_failed');}
  const member=await db.get('/members/'+uid);
  if(!member||member.active!==true||member.role!=='admin')
    throw new HTTPError(403,'admin_role_required');
  return uid;
}
async function accessVip(request,env,db){
  let claims;
  try{claims=await verifySession(env.SESSION_SECRET,bearer(request));}
  catch(_){throw new HTTPError(401,'invalid_session');}
  const {path}=parseCodeId(claims.sub);
  const account=await db.get(path);
  if(!account||account.active!==true||account.version!==claims.ver)
    throw new HTTPError(401,'expired_or_revoked_session');
  return account;
}
async function login(request,env,db){
  const body=await bodyJson(request);
  // Throttle BEFORE parsing or looking up a VIP credential.
  const rawIp=request.headers.get('CF-Connecting-IP')||'unknown-client';
  const ipHash=await hmacHex(env.CODE_PEPPER,'ip:'+rawIp);
  const window=Math.floor(now()/900);
  if(!await counterIncrement(db,'/vipAccess/rate/'+ipHash+'/'+window,now(),20))
    throw new HTTPError(429,'retry_later');
  const code=normalizeCode(body.code),hash=await hashCode(env,code);
  const newPath='/vipAccess/codes/'+hash;
  let record=await db.get(newPath),id=codeId('n',hash);
  if(!record){
    const oldPath='/vipAccess/legacy/'+hash;
    record=await db.get(oldPath);id=codeId('l',hash);
    if(!record){
      if(!await checkOldCode(db,code,env))throw new HTTPError(401,'invalid_credentials');
      const created=iso();
      const entry={label:'既有授權碼 …'+code.slice(-4),hint:'…'+code.slice(-4),
        active:true,version:1,createdAt:created,updatedAt:created,lastUsedAt:null};
      await createIfAbsent(db,oldPath,entry);
      record=await db.get(oldPath);
    }else if(record.active===true){
      // Never accept a code removed from the old whitelist unless it was authorized
      // through the explicit temporary secret for the built-in legacy bypass.
      if(!await checkOldCode(db,code,env))throw new HTTPError(401,'invalid_credentials');
    }
  }
  if(!record||record.active!==true)throw new HTTPError(401,'invalid_credentials');
  const signed=await signSession(env.SESSION_SECRET,{id,version:record.version});
  const path='/vipAccess/'+(id.startsWith('n-')?'codes/':'legacy/')+hash;
  await db.patch(path,{lastUsedAt:iso()});
  return {ok:true,token:signed.token,expiresAt:signed.expiresAt,label:record.label};
}
async function createCode(request,env,db,uid){
  const body=await bodyJson(request),label=typeof body.label==='string'?body.label.trim():'';
  if(!label||label.length>80)throw new HTTPError(400,'invalid_label');
  const importing=body.existingCode!==undefined;
  const code=importing?normalizeCode(body.existingCode):generateVipCode();
  const hash=await hashCode(env,code);
  if(await db.get('/vipAccess/legacy/'+hash)||await db.get('/vipAccess/codes/'+hash))
    throw new HTTPError(409,'code_already_registered');
  const legacy=importing&&await checkOldCode(db,code,env);
  const prefix=legacy?'l':'n',id=codeId(prefix,hash);
  const timestamp=iso();
  const entry={label,hint:'…'+code.slice(-4),active:true,version:1,
    createdAt:timestamp,updatedAt:timestamp,lastUsedAt:null};
  const path='/vipAccess/'+(legacy?'legacy/':'codes/')+hash;
  if(!await createIfAbsent(db,path,entry))
    throw new HTTPError(409,'code_already_registered');
  await audit(db,uid,importing?'register_existing':'create_new',id);
  // The full VIP credential is only returned to the administrator in this response.
  return {ok:true,account:codePublic(entry,id),code};
}
async function listCodes(db){
  const [issued,legacy]=await Promise.all([
    db.get('/vipAccess/codes'),db.get('/vipAccess/legacy')
  ]);
  const entries=[
    ...Object.entries(issued||{}).map(([hash,row])=>codePublic(row,codeId('n',hash))),
    ...Object.entries(legacy||{}).map(([hash,row])=>codePublic(row,codeId('l',hash)))
  ];
  entries.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return {ok:true,accounts:entries.slice(0,500)};
}
async function statusChange(request,db,uid,id){
  const body=await bodyJson(request);
  if(typeof body.active!=='boolean')throw new HTTPError(400,'invalid_status');
  const record=await changeStatus(db,parseCodeId(id).path,body.active);
  if(!record)throw new HTTPError(404,'code_not_found');
  await audit(db,uid,body.active?'enable':'disable',id);
  return {ok:true,account:codePublic(record,id)};
}
async function syncLegacy(db,env,uid){
  // Read-only access to old whitelist; import *only* into a separate private index.
  // Never delete or overwrite original whitelist values.
  const old=await db.get('/whitelist');
  const valid=Object.entries(old||{}).filter(([code,enabled])=>
    enabled===true&&/^[A-Z0-9_-]{1,64}$/.test(code));
  if(valid.length>500)throw new HTTPError(409,'too_many_legacy_codes');
  let added=0;
  for(const [code] of valid){
    const hash=await hashCode(env,code),created=iso();
    const entry={label:'既有授權碼 …'+code.slice(-4),hint:'…'+code.slice(-4),
      active:true,version:1,createdAt:created,updatedAt:created,lastUsedAt:null};
    if(await createIfAbsent(db,'/vipAccess/legacy/'+hash,entry))added++;
  }
  await audit(db,uid,'sync_legacy_whitelist');
  return {ok:true,recognized:valid.length,added,
    note:'原 whitelist 未修改；前端尚未切換，新管理員停權目前不會影響舊網站'};
}
async function route(request,env,db,path){
  if(path==='/api/health'&&request.method==='GET')
    return {ok:true,name:'cathay-vip-firebase-staging',database:'firebase'};
  if(path==='/api/v1/login'&&request.method==='POST')return login(request,env,db);
  if(path==='/api/v1/session'&&request.method==='GET'){
    const record=await accessVip(request,env,db);
    return {ok:true,account:{label:record.label}};
  }
  if(path.startsWith('/api/admin/')){
    const uid=await accessAdmin(request,env,db);
    if(path==='/api/admin/vip'&&request.method==='GET')return listCodes(db);
    if(path==='/api/admin/vip'&&request.method==='POST')return createCode(request,env,db,uid);
    if(path==='/api/admin/legacy/sync'&&request.method==='POST')return syncLegacy(db,env,uid);
    if(path==='/api/admin/audit'&&request.method==='GET'){
      const all=await db.get('/vipAccess/audit');
      const events=Object.values(all||{}).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      return {ok:true,events:events.slice(0,50)};
    }
    const m=path.match(/^\/api\/admin\/vip\/([nl]-[a-f0-9]{64})\/status$/);
    if(m&&request.method==='POST')return statusChange(request,db,uid,m[1]);
  }
  throw new HTTPError(404,'not_found');
}
export function createHandler(databaseFactory=createFirebaseDB){
  return {async fetch(request,env){
    let headers={};
    try{
      headers=verifiedOrigin(request,env);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      requireConfigured(env);
      const db=databaseFactory(env);
      const response=await route(request,env,db,new URL(request.url).pathname);
      return json(await response,200,headers);
    }catch(error){
      const status=error instanceof HTTPError?error.status:500;
      return json({ok:false,error:error instanceof HTTPError?error.code:'internal_error'},status,headers);
    }
  }};
}
export default createHandler();
