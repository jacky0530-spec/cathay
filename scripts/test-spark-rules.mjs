import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update,runTransaction} from 'firebase/database';
const env=await initializeTestEnvironment({
 projectId:'demo-cathay-v1',
 database:{host:'127.0.0.1',port:9000,
 rules:readFileSync('firebase.spark-admin.rules.candidate.json','utf8')}
});
const path=(ctx,key)=>ref(ctx.database(),key);
try{
 await env.clearDatabase();
 await env.withSecurityRulesDisabled(async seed=>{
  await set(path(seed,'whitelist'),{LEGACY_EXAMPLE:true,DISABLED_EXAMPLE:false});
  await set(path(seed,'members'),{
   admin:{active:true,role:'admin'},
   user:{active:true,role:'user'},
   inactive:{active:false,role:'admin'}
  });
  await set(path(seed,'users'),{LEGACY_EXAMPLE:{lastLogin:'before'}});
 });
 const anon=env.unauthenticatedContext(),admin=env.authenticatedContext('admin');
 const user=env.authenticatedContext('user'),inactive=env.authenticatedContext('inactive');
 // The screenshot was a root-path READ; rejection there is expected.
 await assertFails(get(path(anon,'')));
 await assertFails(get(path(admin,'')));
 // Test the intended whitelist path and the admin-only scoped paths.
 // The exact screenshot baseline must remain intact for all existing paths.
 assert.equal((await assertSucceeds(get(path(anon,'whitelist')))).val().LEGACY_EXAMPLE,true);
 assert.equal((await assertSucceeds(get(path(anon,'whitelist/LEGACY_EXAMPLE')))).val(),true);
 await assertSucceeds(get(path(admin,'whitelist')));
 await assertFails(set(path(user,'whitelist'),{LEGACY_EXAMPLE:false}));
 await assertFails(set(path(anon,'vipProfiles/SHADOW'),'access denied'));
 await assertFails(set(path(anon,''),{whitelist:{ROOTWRITE:true}}));
 await assertFails(set(path(admin,''),{whitelist:{ROOTWRITE:true}}));
 await assertFails(set(path(anon,'whitelist/NEW_CODE'),true));
 await assertFails(set(path(user,'whitelist/NEW_CODE'),true));
 await assertFails(set(path(inactive,'whitelist/NEW_CODE'),true));
 await assertFails(get(path(anon,'vipProfiles')));
 await assertFails(get(path(user,'vipProfiles')));
 await assertFails(set(path(user,'vipProfiles/NEW_CODE'),'test'));
 const inserted=await assertSucceeds(runTransaction(path(admin,'whitelist/NEW_CODE'),
  current=>current===null?true:undefined,{applyLocally:false}));
 assert.equal(inserted.committed,true);
 await assertSucceeds(set(path(admin,'whitelist/NEW_CODE'),false));
 assert.equal((await assertSucceeds(get(path(anon,'whitelist/NEW_CODE')))).val(),false);
 await assertSucceeds(set(path(admin,'whitelist/NEW_CODE'),true));
 await assertFails(set(path(admin,'whitelist/NEW_CODE'),null));
 await assertFails(set(path(admin,'whitelist/NEW_CODE'),'yes'));
 await assertFails(set(path(admin,'whitelist'),{NEW_CODE:true}));
 await assertSucceeds(set(path(admin,'vipProfiles/NEW_CODE'),'新人識別'));
 await assertFails(get(path(anon,'vipProfiles/NEW_CODE')));
 await assertFails(set(path(admin,'vipProfiles/NEW_CODE'),''));
 await assertFails(set(path(admin,'vipProfiles/NEW_CODE'),'x'.repeat(81)));
 await assertFails(set(path(admin,'vipProfiles/NEW_CODE'),null));
 await assertSucceeds(update(path(anon,'users/LEGACY_EXAMPLE'),{lastLogin:'still legacy'}));
 await assertFails(get(path(anon,'users/LEGACY_EXAMPLE')));
 await assertFails(set(path(admin,'members/admin/role'),'user'));
 await env.withSecurityRulesDisabled(async seed=>await set(path(seed,'members/admin/active'),false));
 await assertFails(set(path(admin,'whitelist/NOT_ALLOWED'),true));
 await assertFails(set(path(admin,'vipProfiles/NEW_CODE'),'changed'));
 await env.withSecurityRulesDisabled(async seed=>{
  await set(path(seed,'members/admin/active'),true);
  await set(path(seed,'members/admin/role'),'user');
 });
 await assertFails(set(path(admin,'whitelist/NOT_ALLOWED'),true));
 console.log('Spark admin-only VIP whitelist emulator tests passed');
}finally{await env.cleanup();}
