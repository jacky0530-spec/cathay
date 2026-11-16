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

  await assertSucceeds(set(path(alice,'clientBackups/alice'),backup));
  const response=await assertSucceeds(get(path(alice,'clientBackups/alice')));
  assert.equal(response.val().records[0].name,'TEST ONLY');
  await assertFails(get(path(bob,'clientBackups/alice')));
  await assertFails(get(path(admin,'clientBackups/alice')));
  await assertFails(set(path(bob,'clientBackups/alice'),backup));
  await assertFails(set(path(inactive,'clientBackups/inactive'),backup));
  await assertFails(set(path(alice,'clientBackups/alice'),{schemaVersion:2,updatedAt:backup.updatedAt,records:backup.records}));
  await assertFails(set(path(alice,'clientBackups/alice'),{schemaVersion:1,updatedAt:backup.updatedAt}));
  await assertFails(set(path(alice,'clientBackups/alice'),{schemaVersion:1,updatedAt:backup.updatedAt,records:[]}));
  console.log('V1.0 Firebase Realtime Database Emulator permissions: PASS');
} finally {
  await env.cleanup();
}
