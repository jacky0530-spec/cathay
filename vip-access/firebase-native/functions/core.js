// Firebase-only VIP authorization core. No Cloudflare, no second database.
// Security-critical verification happens inside Firebase Cloud Functions.
const crypto=require('node:crypto');
const VIP_PATTERN=/^[A-Z0-9_-]{1,64}$/;
function normalizeCode(value){
 if(typeof value!=='string')throw new Error('invalid_code');
 const code=value.trim().toUpperCase();
 if(!VIP_PATTERN.test(code))throw new Error('invalid_code');
 return code;
}
function codeDigest(secret,code){
 if(typeof secret!=='string'||secret.length<32)throw new Error('secret_unavailable');
 return crypto.createHmac('sha256',secret).update('vip:'+normalizeCode(code)).digest('hex');
}
function vipUid(secret,code){return 'vip_'+codeDigest(secret,code);}
function generateCode(){return 'VIP'+crypto.randomBytes(15).toString('hex').toUpperCase();}
function validVipUid(value){return typeof value==='string'&&/^vip_[a-f0-9]{64}$/.test(value);}
function publicAccount(uid,record){
 if(!validVipUid(uid)||!record||typeof record!=='object')throw new Error('bad_account');
 return {
  uid,label:record.label||'',hint:record.hint||'',
  active:record.active===true,
  createdAt:record.createdAt||'',updatedAt:record.updatedAt||'',
  lastUsedAt:record.lastUsedAt||null
 };
}
function isAdminMember(member){return !!member&&member.active===true&&member.role==='admin';}
function accountRecord(label,code,legacy=false,clock=()=>new Date().toISOString()){
 if(typeof label!=='string'||label.trim().length<1||label.trim().length>80)
  throw new Error('invalid_label');
 const when=clock();
 return {label:label.trim(),hint:'…'+normalizeCode(code).slice(-4),
  active:true,version:1,legacy:Boolean(legacy),createdAt:when,updatedAt:when};
}
function allowedLegacyCodes(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))return [];
 const entries=Object.entries(value).filter(([code,enabled])=>
  enabled===true && VIP_PATTERN.test(code));
 if(entries.length>500)throw new Error('too_many_legacy_codes');
 return entries.map(([code])=>code);
}
module.exports={normalizeCode,codeDigest,vipUid,generateCode,validVipUid,
 publicAccount,isAdminMember,accountRecord,allowedLegacyCodes};
