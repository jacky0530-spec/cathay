const test=require('node:test');
const assert=require('node:assert/strict');
const {
 normalizeCode,codeDigest,vipUid,generateCode,validVipUid,
 publicAccount,isAdminMember,accountRecord,allowedLegacyCodes
}=require('./core');
const secret='TEST_ONLY_DO_NOT_DEPLOY_01234567890123456789';
test('保留舊 VIP 授權碼輸入方式及格式',()=>{
 assert.equal(normalizeCode(' vip888 '),'VIP888');
 assert.equal(normalizeCode('CATHAY2025'),'CATHAY2025');
 assert.equal(normalizeCode('vip_a-12'),'VIP_A-12');
 assert.throws(()=>normalizeCode('bad/code'));
 assert.throws(()=>normalizeCode('bad.key'));
});
test('代碼只保存伺服器端加密衍生 UID、資料庫不保存明碼',()=>{
 const uid=vipUid(secret,'CODE-1234');
 assert.match(uid,/^vip_[a-f0-9]{64}$/);
 assert(validVipUid(uid));
 assert.equal(vipUid(secret,' code-1234 '),uid);
 assert.notEqual(codeDigest(secret,'CODE-1234'),codeDigest(secret,'CODE-1235'));
 const record=accountRecord('新進業務員','CODE-1234',false,()=> '2026-11-17T00:00:00Z');
 assert(!JSON.stringify(record).includes('CODE-1234'));
 assert.equal(record.hint,'…1234');
 assert.equal(record.active,true);
 assert.equal(record.version,1);
 const pub=publicAccount(uid,record);
 assert(!('version' in pub));
 assert(!('secret' in pub));
});
test('新增 VIP 授權碼不可預測且格式一致',()=>{
 const a=generateCode(),b=generateCode();
 assert.match(a,/^VIP[A-F0-9]{30}$/);
 assert.notEqual(a,b);
});
test('非管理員、停權管理員不能通過角色檢查',()=>{
 assert(isAdminMember({active:true,role:'admin'}));
 assert(!isAdminMember({active:false,role:'admin'}));
 assert(!isAdminMember({active:true,role:'user'}));
 assert(!isAdminMember(null));
});
test('舊白名單只辨認 true，不修改原資料及停用項',()=>{
 const old={VIP888:true,CATHAY2025:true,DISABLED:false};
 const copy=JSON.stringify(old);
 assert.deepEqual(allowedLegacyCodes(old),['VIP888','CATHAY2025']);
 assert.equal(JSON.stringify(old),copy);
 assert.deepEqual(allowedLegacyCodes(null),[]);
});
