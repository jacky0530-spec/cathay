import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeNewVipCode,insertNewVipCodeIfAbsent} from '../vip-access/spark/vip-create.mjs';
test('administrator-entered code is normalized and stays deterministic',()=>{
  assert.equal(normalizeNewVipCode(' vip2026a01 '),'VIP2026A01');
  assert.equal(normalizeNewVipCode('20261118'),'20261118');
  assert.equal(normalizeNewVipCode('staff_01'),'STAFF_01');
  assert.equal(normalizeNewVipCode('AB-CD12'),'AB-CD12');
});
test('reject missing, short, too long, invalid, or legacy bypass credentials',()=>{
  for(const value of ['',null,'ABC','ABCDE','a'.repeat(33),'ABC.DEF1','ABC/DEF1','測試人員99','VIP888','CATHAY2025']){
    assert.throws(()=>normalizeNewVipCode(value),String(value));
  }
});
test('create transaction only inserts missing code, preserving active and disabled codes',()=>{
  assert.equal(insertNewVipCodeIfAbsent(null),true);
  assert.equal(insertNewVipCodeIfAbsent(true),undefined);
  assert.equal(insertNewVipCodeIfAbsent(false),undefined);
  assert.equal(insertNewVipCodeIfAbsent('unexpected'),undefined);
});
