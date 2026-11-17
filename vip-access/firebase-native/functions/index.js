// Staging-only Firebase Cloud Functions v2. DO NOT deploy before billing, rules,
// legacy VIP migration and browser integration have been approved and verified.
const crypto=require('node:crypto');
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getDatabase}=require('firebase-admin/database');
const {
 normalizeCode,vipUid,generateCode,validVipUid,publicAccount,
 isAdminMember,accountRecord,allowedLegacyCodes
}=require('./core');

const DATABASE_URL='https://cathay-app-5889a-default-rtdb.firebaseio.com';
const ORIGIN='https://jacky0530-spec.github.io';
const secret=defineSecret('CATHAY_VIP_PEPPER');
initializeApp({databaseURL:DATABASE_URL});
const db=()=>getDatabase();
const shared={region:'us-central1',cors:[ORIGIN],maxInstances:3,timeoutSeconds:30};
const withSecret={...shared,secrets:[secret]};
const stamp=()=>new Date().toISOString();

async function requireAdmin(request){
 const uid=request.auth?.uid;
 if(!uid)throw new HttpsError('unauthenticated','請先以管理員帳號登入。');
 const snap=await db().ref('/members/'+uid).get();
 if(!isAdminMember(snap.val()))throw new HttpsError('permission-denied','沒有管理權限。');
 return uid;
}
function withCode(value){
 try{return normalizeCode(value);}
 catch(_){throw new HttpsError('invalid-argument','授權碼格式不正確。');}
}
function securePepper(){
 const value=secret.value();
 if(!value||value.length<32)throw new HttpsError('failed-precondition','授權設定未完成。');
 return value;
}
async function rateLimit(request,pepper){
 // Hashed request IP is a useful supplemental limiter; it does not replace
 // App Check, API quotas or abuse protection, which must be tested before go-live.
 const ip=request.rawRequest?.ip||request.rawRequest?.socket?.remoteAddress||'unknown';
 const bucket=Math.floor(Date.now()/900000);
 const key=crypto.createHmac('sha256',pepper).update('ip:'+ip).digest('hex');
 const ref=db().ref('/vipAccess/rate/'+key+'/'+bucket);
 const result=await ref.transaction(current=>{
  const n=current?.count||0;
  if(n>=20)return; // Abort (already blocked).
  return {count:n+1,expiresAt:(bucket+1)*900};
 },undefined,false);
 if(!result.committed)throw new HttpsError('resource-exhausted','嘗試次數過多，請稍後再試。');
}
async function writeAudit(uid,action,targetUid=null){
 await db().ref('/vipAccess/audit').push({
  actorUid:uid,action,targetUid,createdAt:stamp()
 });
}
async function createEntry(uid,entry){
 const ref=db().ref('/vipAccess/accounts/'+uid);
 const result=await ref.transaction(current=>current===null?entry:undefined,undefined,false);
 return result.committed;
}

exports.vipAuthenticate=onCall(withSecret,async request=>{
 const pepper=securePepper();
 await rateLimit(request,pepper);
 const code=withCode(request.data?.code);
 const uid=vipUid(pepper,code);
 const ref=db().ref('/vipAccess/accounts/'+uid);
 const value=(await ref.get()).val();
 if(!value||value.active!==true)
  throw new HttpsError('unauthenticated','授權碼錯誤或已停用。');
 // A Firebase Custom Token signs the browser in without any extra steps.
 // Rules MUST check vipAccess/accounts/<auth.uid>/active for protected data.
 const customToken=await getAuth().createCustomToken(uid,{vip:true});
 await ref.child('lastUsedAt').set(stamp());
 return {ok:true,customToken,label:value.label};
});
exports.vipCheck=onCall(shared,async request=>{
 const uid=request.auth?.uid;
 if(!validVipUid(uid)||request.auth?.token?.vip!==true)
  throw new HttpsError('unauthenticated','請先輸入 VIP 授權碼。');
 const value=(await db().ref('/vipAccess/accounts/'+uid).get()).val();
 if(!value||value.active!==true)throw new HttpsError('permission-denied','授權已停用。');
 return {ok:true,label:value.label};
});
exports.vipCreate=onCall(withSecret,async request=>{
 const adminUid=await requireAdmin(request);
 const label=request.data?.label;
 const imported=request.data?.existingCode!==undefined;
 const code=imported?withCode(request.data.existingCode):generateCode();
 let entry;
 try{entry=accountRecord(label,code,imported);}
 catch(_){throw new HttpsError('invalid-argument','請填寫有效的人員名稱。');}
 const uid=vipUid(securePepper(),code);
 if(!await createEntry(uid,entry))throw new HttpsError('already-exists','這組授權碼已登記。');
 await writeAudit(adminUid,imported?'register_existing':'create_new',uid);
 // Full code returned ONLY to authenticated administrator on initial creation.
 return {ok:true,account:publicAccount(uid,entry),code};
});
exports.vipList=onCall(shared,async request=>{
 await requireAdmin(request);
 const all=(await db().ref('/vipAccess/accounts').get()).val()||{};
 const accounts=Object.entries(all).filter(([id])=>validVipUid(id))
  .map(([id,value])=>publicAccount(id,value))
  .sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,500);
 return {ok:true,accounts};
});
exports.vipSetActive=onCall(shared,async request=>{
 const adminUid=await requireAdmin(request);
 const uid=request.data?.uid,active=request.data?.active;
 if(!validVipUid(uid)||typeof active!=='boolean')
  throw new HttpsError('invalid-argument','授權識別或狀態不正確。');
 const ref=db().ref('/vipAccess/accounts/'+uid);
 const result=await ref.transaction(current=>{
  if(current===null)return;
  return {...current,active,version:(current.version||0)+1,updatedAt:stamp()};
 },undefined,false);
 if(!result.committed)throw new HttpsError('not-found','沒有這組授權碼。');
 await writeAudit(adminUid,active?'enable':'disable',uid);
 return {ok:true,account:publicAccount(uid,result.snapshot.val())};
});
exports.vipSyncLegacy=onCall(withSecret,async request=>{
 const adminUid=await requireAdmin(request),pepper=securePepper();
 const whitelist=(await db().ref('/whitelist').get()).val();
 let oldCodes;
 try{oldCodes=allowedLegacyCodes(whitelist);}
 catch(_){throw new HttpsError('failed-precondition','舊授權碼筆數過多，請分批審核。');}
 let added=0;
 for(const code of oldCodes){
  const uid=vipUid(pepper,code);
  const entry=accountRecord('既有授權 …'+code.slice(-4),code,true);
  if(await createEntry(uid,entry))added++;
 }
 await writeAudit(adminUid,'sync_legacy_whitelist');
 return {ok:true,recognized:oldCodes.length,added,
  note:'舊白名單保持不變；原網站停權不受本後台影響，直到正式完成切換。'};
});
