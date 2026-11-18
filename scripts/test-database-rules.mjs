import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {ref,get,set,update} from 'firebase/database';

const projectId='demo-cathay-v1';
const rules=readFileSync('firebase.database.rules.json','utf8');
const env=await initializeTestEnvironment({projectId,database:{host:'127.0.0.1',port:9000,rules}});
const path=(context,p)=>ref(context.database(),p);
const backup={schemaVersion:1,updatedAt:'2026-11-17T06:00:00.000Z',records:[{id:1,name:'TEST ONLY',phone:'0000000'}]};

try {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async admin=>{
    await set(path(admin,'members'),{
      admin:{active:true,role:'admin'},
      alice:{active:true,role:'user'},
      bob:{active:true,role:'user'},
      inactive:{active:false,role:'user'}
    });
    await set(path(admin,'users'),{alice:{lastLogin:'old',device:'old'},bob:{lastLogin:'old',device:'old'}});
  });
  const unknown=env.unauthenticatedContext();
  const admin=env.authenticatedContext('admin');
  const alice=env.authenticatedContext('alice');
  const bob=env.authenticatedContext('bob');
  const inactive=env.authenticatedContext('inactive');
  const stranger=env.authenticatedContext('stranger');

  await assertFails(get(path(unknown,'members/alice')));
  await assertFails(get(path(unknown,'users')));
  await assertFails(get(path(unknown,'clientBackups/alice')));
  await assertFails(get(path(alice,'whitelist/legacy')));
  await assertFails(get(path(alice,'members/bob')));
  await assertSucceeds(get(path(alice,'members/alice')));
  await assertSucceeds(get(path(admin,'members/bob')));
  await assertFails(get(path(stranger,'members/alice')));
  await assertFails(set(path(alice,'members/alice/role'),'admin'));

  await assertSucceeds(get(path(admin,'users')));
  await assertFails(get(path(alice,'users')));
  await assertSucceeds(get(path(alice,'users/alice')));
  await assertFails(get(path(alice,'users/bob')));
  await assertSucceeds(update(path(alice,'users/alice'),{lastLogin:'2026-11-17T06:00:00Z',device:'Browser Test'}));
  await assertFails(set(path(alice,'users/alice/role'),'admin'));
  await assertFails(update(path(alice,'users/bob'),{lastLogin:'future'}));
  await assertFails(set(path(inactive,'users/inactive/lastLogin'),'future'));
  // Presence is written only by the owning active user; cleanup after disconnect is allowed.
  await assertSucceeds(set(path(alice,'users/alice/connections/browserA'),true));
  await assertFails(set(path(bob,'users/alice/connections/browserB'),true));
  await assertFails(set(path(inactive,'users/inactive/connections/browserC'),true));
  await assertFails(set(path(alice,'users/alice/connections/browserBad'),'spoofed'));
  await assertSucceeds(get(path(admin,'users/alice/connections')));
  await assertSucceeds(set(path(alice,'users/alice/connections/browserA'),null));
  await assertFails(set(path(alice,'users/alice/connections/browserA/name'),'malicious'));


  // Versioned backup: user may create a new snapshot, but never overwrite/delete an earlier one.
  await assertSucceeds(set(path(alice,'clientBackups/alice/versionA'),backup));
  await assertSucceeds(set(path(alice,'clientBackups/alice/versionB'),{...backup,updatedAt:'2026-11-17T07:00:00.000Z'}));
  const saved=await assertSucceeds(get(path(alice,'clientBackups/alice/versionA')));
  assert.equal(saved.val().records[0].name,'TEST ONLY');
  const second=await assertSucceeds(get(path(alice,'clientBackups/alice/versionB')));
  assert.equal(second.val().schemaVersion,1);
  await assertFails(set(path(alice,'clientBackups/alice/versionA'),backup));
  await assertFails(set(path(alice,'clientBackups/alice/versionA'),null));
  await assertFails(set(path(alice,'clientBackups/alice/versionA/records/0/name'),'Tampered'));
  await assertFails(get(path(bob,'clientBackups/alice/versionA')));
  await assertFails(get(path(admin,'clientBackups/alice/versionA')));
  await assertFails(set(path(bob,'clientBackups/alice/versionX'),backup));
  await assertFails(set(path(inactive,'clientBackups/inactive/versionX'),backup));
  await assertFails(set(path(alice,'clientBackups/alice/versionInvalid'),{schemaVersion:2,updatedAt:backup.updatedAt,records:backup.records}));
  await assertFails(set(path(alice,'clientBackups/alice/versionMissing'),{schemaVersion:1,updatedAt:backup.updatedAt}));
  await assertFails(set(path(alice,'clientBackups/alice/versionEmpty'),{schemaVersion:1,updatedAt:backup.updatedAt,records:[]}));
  // Direct writes to a backup-owner root must also fail.
  await assertFails(set(path(alice,'clientBackups/alice'),{versionA:backup}));
  // Membership state changes must immediately take effect in database authorization.
  await env.withSecurityRulesDisabled(async sys=>{
    await set(path(sys,'members/alice/active'),false);
  });
  await assertSucceeds(get(path(alice,'members/alice'))); // still readable to detect revocation
  await assertFails(get(path(alice,'clientBackups/alice/versionA')));
  await assertFails(set(path(alice,'clientBackups/alice/blockedVersion'),backup));
  await assertFails(update(path(alice,'users/alice'),{device:'Unauthorized after deactivation'}));
  await assertFails(set(path(alice,'users/alice/connections/blocked'),true));
  await assertSucceeds(set(path(alice,'users/alice/connections/browserLeft'),null));
  await env.withSecurityRulesDisabled(async sys=>{
    await set(path(sys,'members/alice/active'),true);
    await set(path(sys,'members/admin/role'),'user');
  });
  await assertSucceeds(get(path(alice,'clientBackups/alice/versionA')));
  await assertFails(get(path(admin,'users'))); // downgraded admin loses access now
  await assertFails(get(path(admin,'members/alice')));
  await assertSucceeds(get(path(admin,'members/admin')));
  console.log('V1.0 Firebase Realtime Database Emulator permissions: PASS');
} finally {
  await env.cleanup();
}
