// Staging-only Cloudflare Worker: VIP input stays unchanged; verification happens server-side.
// All endpoints are disabled until D1, admin UID allowlist and cryptographic secrets are configured.
import {canonicalizeCode,hmacHex,signSession,verifySession,generateVipCode,verifyFirebaseJwt} from './crypto.mjs';

const now=()=>Math.floor(Date.now()/1000);
const iso=()=>new Date().toISOString();
const safeJson=(data,status=200,headers={})=>new Response(JSON.stringify(data),{
  status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',
    'x-content-type-options':'nosniff',...headers}
});
class HTTPError extends Error{
  constructor(status,code){super(code);this.status=status;this.code=code;}
}
function cors(request,env){
  const origin=request.headers.get('Origin');
  if(!env.SITE_ORIGIN||origin!==env.SITE_ORIGIN)throw new HTTPError(403,'origin_denied');
  return {'access-control-allow-origin':origin,'vary':'Origin',
    'access-control-allow-methods':'GET, POST, OPTIONS',
    'access-control-allow-headers':'Authorization, Content-Type',
    'access-control-max-age':'600'};
}
function requireEnv(env){
  if(!env.DB||typeof env.CODE_PEPPER!=='string'||env.CODE_PEPPER.length<32||
    typeof env.SESSION_SECRET!=='string'||env.SESSION_SECRET.length<32||
    env.SESSION_SECRET===env.CODE_PEPPER||
    typeof env.ADMIN_UIDS!=='string'||!env.ADMIN_UIDS.trim()||
    env.FIREBASE_PROJECT_ID!=='cathay-app-5889a')
    throw new HTTPError(503,'not_configured');
}
async function bodyJson(request){
  const size=Number(request.headers.get('content-length')||0);
  if(size>4096)throw new HTTPError(413,'body_too_large');
  const raw=await request.text();
  if(raw.length>4096)throw new HTTPError(413,'body_too_large');
  let body;
  try{body=JSON.parse(raw);}catch(_){throw new HTTPError(400,'invalid_json');}
  if(body===null||typeof body!=='object'||Array.isArray(body))throw new HTTPError(400,'invalid_json');
  return body;
}
async function accessCount(db,ipHash,at){
  // Atomic per-IP 15-minute admission counter. Never store raw IP.
  const row=await db.prepare(
    'INSERT INTO rate_limits(ip_hash,window_expires,attempts) VALUES(?,?,1) '+
    'ON CONFLICT(ip_hash) DO UPDATE SET attempts = CASE WHEN window_expires <= ? THEN 1 ELSE attempts+1 END, '+
    'window_expires = CASE WHEN window_expires <= ? THEN ? ELSE window_expires END '+
    'RETURNING attempts'
  ).bind(ipHash,at+900,at,at,at+900).first();
  return Number(row?.attempts||999);
}
async function logAudit(db,uid,action,id=null){
  // Never log credentials or access tokens.
  await db.prepare('INSERT INTO admin_audit(id,actor_uid,action,target_id,created_at) VALUES(?,?,?,?,?)')
    .bind(crypto.randomUUID(),uid,action,id,iso()).run();
}
function codePublic(row){
  return {id:row.id,label:row.label,active:row.active===1,
    hint:row.code_hint,createdAt:row.created_at,updatedAt:row.updated_at,
    lastUsedAt:row.last_used_at||null};
}
function bearer(request){
  const header=request.headers.get('Authorization')||'';
  if(!header.startsWith('Bearer '))throw new HTTPError(401,'authentication_required');
  return header.slice(7);
}
async function requireAdmin(request,env){
  const token=bearer(request);
  let uid;
  try{uid=await verifyFirebaseJwt(token,env.FIREBASE_PROJECT_ID);}catch(_){
    throw new HTTPError(401,'admin_authentication_failed');
  }
  if(!env.ADMIN_UIDS.split(',').map(x=>x.trim()).includes(uid))
    throw new HTTPError(403,'admin_role_required');
  return uid;
}
async function requireVip(request,env){
  let claims;
  try{claims=await verifySession(env.SESSION_SECRET,bearer(request));}
  catch(_){throw new HTTPError(401,'invalid_session');}
  const account=await env.DB.prepare(
    'SELECT id,label,active,version FROM vip_codes WHERE id=?'
  ).bind(claims.sub).first();
  if(!account||account.active!==1||account.version!==claims.ver)
    throw new HTTPError(401,'expired_or_revoked_session');
  return account;
}
async function vipLogin(request,env){
  const input=await bodyJson(request);
  const address=request.headers.get('CF-Connecting-IP')||'no-address';
  const ipHash=await hmacHex(env.CODE_PEPPER,'ip:'+address);
  const attempts=await accessCount(env.DB,ipHash,now());
  if(attempts>20)throw new HTTPError(429,'retry_later');
  let key;
  try{key=canonicalizeCode(input.code);}catch(_){throw new HTTPError(401,'invalid_credentials');}
  const codeHash=await hmacHex(env.CODE_PEPPER,'vip:'+key);
  const row=await env.DB.prepare(
    'SELECT id,label,active,version FROM vip_codes WHERE code_hash=?'
  ).bind(codeHash).first();
  if(!row||row.active!==1)throw new HTTPError(401,'invalid_credentials');
  const session=await signSession(env.SESSION_SECRET,row);
  await env.DB.prepare('UPDATE vip_codes SET last_used_at=? WHERE id=?').bind(iso(),row.id).run();
  return {ok:true,token:session.token,expiresAt:session.expiresAt,label:row.label};
}
async function createCode(request,env,adminUid){
  const body=await bodyJson(request);
  const label=typeof body.label==='string'?body.label.trim():'';
  if(!label||label.length>80)throw new HTTPError(400,'invalid_label');
  // Import an existing VIP code only at the administrator's explicit request.
  const importing=body.existingCode!==undefined;
  let code;
  try{code=importing?canonicalizeCode(body.existingCode):generateVipCode();}
  catch(_){throw new HTTPError(400,'invalid_vip_code');}
  const hashed=await hmacHex(env.CODE_PEPPER,'vip:'+code);
  const id=crypto.randomUUID(),stamp=iso();
  try{
    await env.DB.prepare(
      'INSERT INTO vip_codes(id,label,code_hash,code_hint,active,version,created_at,updated_at) '+
      'VALUES(?,?,?,?,1,1,?,?)'
    ).bind(id,label,hashed,'…'+code.slice(-4),stamp,stamp).run();
  }catch(_){throw new HTTPError(409,'code_already_registered_or_db_error');}
  await logAudit(env.DB,adminUid,importing?'import_existing':'create_new',id);
  // Generated or imported code displayed once ONLY in this immediate response.
  return {ok:true,account:{id,label,active:true,hint:'…'+code.slice(-4)},code};
}
async function setCodeStatus(request,env,uid,id){
  const body=await bodyJson(request);
  if(typeof body.active!=='boolean')throw new HTTPError(400,'invalid_status');
  const result=await env.DB.prepare(
    'UPDATE vip_codes SET active=?, version=version+1, updated_at=? WHERE id=? RETURNING id,label,active,code_hint,created_at,updated_at,last_used_at'
  ).bind(body.active?1:0,iso(),id).first();
  if(!result)throw new HTTPError(404,'code_not_found');
  await logAudit(env.DB,uid,body.active?'enable':'disable',id);
  return {ok:true,account:codePublic(result)};
}
async function route(request,env,pathname){
  if(pathname==='/api/health'&&request.method==='GET')
    return {ok:true,name:'cathay-vip-auth-staging'};
  if(pathname==='/api/v1/login'&&request.method==='POST')
    return vipLogin(request,env);
  if(pathname==='/api/v1/session'&&request.method==='GET'){
    const row=await requireVip(request,env);
    return {ok:true,account:{id:row.id,label:row.label}};
  }
  if(pathname.startsWith('/api/admin/')){
    const uid=await requireAdmin(request,env);
    if(pathname==='/api/admin/vip'&&request.method==='GET'){
      const query=await env.DB.prepare(
        'SELECT id,label,active,code_hint,created_at,updated_at,last_used_at FROM vip_codes ORDER BY created_at DESC LIMIT 500'
      ).all();
      return {ok:true,accounts:(query.results||[]).map(codePublic)};
    }
    if(pathname==='/api/admin/vip'&&request.method==='POST')return createCode(request,env,uid);
    const match=pathname.match(/^\/api\/admin\/vip\/([0-9a-f-]{36})\/status$/);
    if(match&&request.method==='POST')return setCodeStatus(request,env,uid,match[1]);
    if(pathname==='/api/admin/audit'&&request.method==='GET'){
      const query=await env.DB.prepare(
        'SELECT actor_uid,action,target_id,created_at FROM admin_audit ORDER BY created_at DESC LIMIT 50'
      ).all();
      return {ok:true,events:query.results||[]};
    }
  }
  throw new HTTPError(404,'not_found');
}
export default {
  async fetch(request,env){
    let headers={};
    try{
      const url=new URL(request.url);
      headers=cors(request,env);
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
      requireEnv(env);
      const result=await route(request,env,url.pathname);
      return safeJson(await result,200,headers);
    }catch(error){
      const status=error instanceof HTTPError?error.status:500;
      const message=error instanceof HTTPError?error.code:'internal_error';
      return safeJson({ok:false,error:message},status,headers);
    }
  }
};
