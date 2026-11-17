import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update} from 'firebase/database';

// TEMPORARY transitional rules to let the legacy site continue alongside V1.0.
// Deliberately verify the unsafe legacy behavior still exists and must be retired.
const projectId='demo-cathay-v1';
const rules=readFileSync('firebase.transition.rules.json','utf8');
const env=await initializeTestEnvironment({projectId,database:{host:'127.0.0.1',port:9000,rules}});
const path=(context,key)=>ref(context.database(),key);
const backup={schemaVersion:1,updatedAt:'2026-11-17T10:00:00.000Z',records:[{id:1,name:'SYNTHETIC DATA ONLY',phone:'000'}]};

try{
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async seed=>{
    await set(path(seed,'whitelist'),{LEGACY_EXAMPLE:true});
    await set(path(seed,'users'),{LEGACY_EXAMPLE:{session:'old',lastLogin:'2026-11-17'}});
    await set(path(seed,'members'),{
      admin:{active:true,role:'admin'},alice:{active:true,role:'user'},
      bob:{active:true,role:'user'},inactive:{active:false,role:'user'}
    });
  });
  const anon=env.unauthenticatedContext();
  const admin=env.authenticatedContext('admin');
  const alice=env.authenticatedContext('alice');
  const bob=env.authenticatedContext('bob');
  const inactive=env.authenticatedContext('inactive');

  // Legacy behavior intentionally preserved until all old login-code users migrate.
  const list=await assertSucceeds(get(path(anon,'whitelist/LEGACY_EXAMPLE')));
  assert.equal(list.val(),true);
  await assertFails(set(path(anon,'whitelist/NEW_CODE'),true));
  await assertSucceeds(update(path(anon,'users/LEGACY_EXAMPLE'),{session:'new-session',device:'Legacy Browser'}));
  await assertFails(get(path(anon,'users/LEGACY_EXAMPLE')));
  // Important: this is a known, temporary SECURITY LIABILITY, not a recommended policy.
  await assertSucceeds(set(path(anon,'users/ANONYMOUS_WRITE_DEMONSTRATION/lastLogin'),'legacy-write-allowed'));

  // Individual Firebase accounts and V1.0 admin should work in parallel.
  await assertSucceeds(get(path(alice,'members/alice')));
  await assertFails(get(path(anon,'members/alice')));
  await assertFails(get(path(alice,'members/bob')));
  await assertSucceeds(get(path(admin,'members/bob')));
  await assertFails(set(path(alice,'members/alice/role'),'admin'));
  await assertSucceeds(get(path(admin,'users')));
  await assertFails(get(path(alice,'users')));
  await assertFails(get(path(inactive,'users')));
  await assertSucceeds(get(path(alice,'users/alice')));

  // Optional private Firebase backup paths are constrained during migration too.
  await assertSucceeds(set(path(alice,'clientBackups/alice/versionA'),backup));
  await assertSucceeds(get(path(alice,'clientBackups/alice/versionA')));
  await assertFails(get(path(bob,'clientBackups/alice/versionA')));
  await assertFails(get(path(admin,'clientBackups/alice/versionA')));
  await assertFails(set(path(bob,'clientBackups/alice/versionB'),backup));
  await assertFails(set(path(alice,'clientBackups/alice/versionA'),backup));
  await assertFails(set(path(alice,'clientBackups/alice/versionA'),null));

  // A disabled member or downgraded admin immediately loses new authorization.
  await env.withSecurityRulesDisabled(async seed=>{
    await set(path(seed,'members/admin/role'),'user');
    await set(path(seed,'members/alice/active'),false);
  });
  await assertFails(get(path(admin,'users')));
  await assertFails(get(path(alice,'clientBackups/alice/versionA')));
  await assertFails(set(path(alice,'clientBackups/alice/newVersion'),backup));
  // The public old /users write path cannot be secured until final cutover.
  await assertSucceeds(update(path(anon,'users/LEGACY_EXAMPLE'),{session:'still-legacy'}));

  console.log('V1.0 transitional rules emulator: PASS (legacy public access remains until final cutover)');
}finally{
  await env.cleanup();
}
