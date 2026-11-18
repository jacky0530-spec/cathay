import assert from 'node:assert/strict';
import test from 'node:test';
import {nextVipStatus} from '../vip-access/spark/vip-toggle.mjs';
test('uncached initial null does not cancel a verified disable transaction',()=>{
 assert.equal(nextVipStatus(null,true),false);
 assert.equal(nextVipStatus(true,true),false);
});
test('uncached initial null does not cancel verified re-enable transaction',()=>{
 assert.equal(nextVipStatus(null,false),true);
 assert.equal(nextVipStatus(false,false),true);
});
test('stale concurrent state does not overwrite a newer status',()=>{
 assert.equal(nextVipStatus(false,true),undefined);
 assert.equal(nextVipStatus(true,false),undefined);
 assert.equal(nextVipStatus('yes',true),undefined);
 assert.equal(nextVipStatus({},false),undefined);
 assert.equal(nextVipStatus(true,'false'),undefined);
});
