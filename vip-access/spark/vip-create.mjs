// The administrator supplies each new VIP code. Never generate a random code.
const CODE_FORMAT=/^[A-Z0-9_-]{6,32}$/;
const RESERVED=new Set(['VIP888','CATHAY2025']); // Legacy hard-coded bypass values: never issue as new credentials.
export function normalizeNewVipCode(value){
  if(typeof value!=='string')throw new Error('invalid_vip_code');
  const code=value.trim().toUpperCase();
  if(!CODE_FORMAT.test(code))throw new Error('invalid_vip_code');
  if(RESERVED.has(code))throw new Error('reserved_vip_code');
  return code;
}
export function insertNewVipCodeIfAbsent(current){
  // Even a disabled existing code must never be silently reactivated/overwritten.
  return current===null?true:undefined;
}
