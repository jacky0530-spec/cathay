// Spark-compatible administrator UI. Existing VIP code login remains unchanged.
// A separate deployment and explicit Firebase rules publish are required.
import {nextVipStatus} from './vip-admin-spark-toggle.mjs';
// Manual VIP code utilities are embedded so login never depends on loading another module.
const CODE_FORMAT=/^[A-Z0-9_-]{6,32}$/;
const RESERVED=new Set(['VIP888','CATHAY2025']);
function normalizeNewVipCode(value){
 if(typeof value!=='string')throw new Error('invalid_vip_code');
 const code=value.trim().toUpperCase();
 if(!CODE_FORMAT.test(code))throw new Error('invalid_vip_code');
 if(RESERVED.has(code))throw new Error('reserved_vip_code');
 return code;
}
function insertNewVipCodeIfAbsent(current){return current===null?true:undefined;}
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword,signOut}
 from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {getDatabase,ref,get,set,runTransaction}
 from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
const config={
 apiKey:"AIzaSyAXmxp2R7oeM-DJsbDoT6YAVlHV4vKC_Xo",
 authDomain:"cathay-app-5889a.firebaseapp.com",
 databaseURL:"https://cathay-app-5889a-default-rtdb.firebaseio.com",
 projectId:"cathay-app-5889a",
 appId:"1:222981030218:web:5f557a386a38cf3d1c41b3"
};
const app=initializeApp(config,'cathay-spark-vip-manager');
const auth=initializeAuth(app,{persistence:inMemoryPersistence});
const db=getDatabase(app);
const el=id=>document.getElementById(id);
const codeFormat=/^[A-Z0-9_-]{1,64}$/;
let justCreated='';
function say(message,error=false){el('status').textContent=message;el('status').className=error?'error':'';}
function reportError(error){
 if(error?.code==='PERMISSION_DENIED'||error?.code==='database/permission-denied')
  return '操作遭 Firebase Rules 拒絕。請先確認規則已完成模擬測試及正式發布。';
 if(error?.message==='authorization_changed')return '授權狀態已被修改，請重新整理清單再試。';
 if(error?.message==='code_missing')return '找不到這組授權碼，請重新整理清單。';
 if(error?.message==='verify_failed')return '資料庫變更後驗證失敗，請重新整理清單確認狀態。';
 if(error?.message==='duplicate_vip_code')return '這組 VIP 授權碼已存在（包含已停用），請另外輸入一組，不會覆蓋原授權。';
 if(error?.message==='invalid_vip_code')return '授權碼請填寫 6～32 位英文、數字、底線或連字號。';
 if(error?.message==='reserved_vip_code')return '這組授權碼為舊版共用碼，不可再分配給新人。';
 if(error?.code==='auth/network-request-failed')return '無法連接 Firebase Authentication，請確認網路後重新整理頁面。';
 if(error?.code==='auth/too-many-requests')return 'Firebase 暫時限制登入次數，請稍後再試。';
 if(error?.code==='auth/unauthorized-domain')return '目前網址尚未列入 Firebase Authentication 授權網域。';
 if(error?.code==='auth/user-disabled')return 'Firebase 管理員帳號已停用，請檢查 Authentication 設定。';
 if(error?.message==='auth_timeout')return 'Firebase 帳號驗證逾時。請確認網路，重新整理後再試。';
 if(error?.message==='membership_timeout')return 'Firebase 帳號已驗證，但管理員權限查詢逾時。請檢查資料庫連線及規則。';
 if(error?.message==='list_timeout')return '授權清單讀取逾時；登入身分已通過，請按「重新整理清單」再試。';
 if(error?.message==='login_required')return '登入狀態已失效，請重新登入。';
 if(error?.message==='db_request_timeout')return '已驗證 Firebase 帳號，但 Realtime Database 讀取逾時，請檢查連線或網路安全軟體。';
 if(error?.message==='db_network_failed')return '無法連接 Firebase Realtime Database。請檢查網路，或使用瀏覽器無痕模式測試。';
 if(error?.message==='member_access_denied')return 'Firebase 資料庫拒絕驗證此管理員的會員資料，請確認 members/UID 規則與帳號角色。';
 if(error?.message?.startsWith('db_http_'))return 'Firebase 資料庫回應錯誤（HTTP '+error.message.slice(8)+'）。';
 if(error?.message==='not_admin')return '登入帳號沒有管理員權限。';
 if(error?.code==='auth/invalid-credential')return '帳號或密碼驗證失敗。';
 return '操作未完成：'+String(error?.code||error?.message||'未知錯誤');
}
// Use authenticated REST reads instead of the persistent Realtime Database
// connection for admin verification and list loading. On some browsers the SDK
// read can remain pending after Firebase Authentication succeeds.
// Firebase officially accepts its ID token as the REST "auth" query parameter.
async function readFirebaseRest(path){
 if(!auth.currentUser)throw new Error('login_required');
 const idToken=await auth.currentUser.getIdToken();
 const ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),10000);
 try{
  const endpoint=new URL(config.databaseURL+'/'+path+'.json');
  endpoint.searchParams.set('auth',idToken);
  const response=await fetch(endpoint.toString(),{
   method:'GET',cache:'no-store',referrerPolicy:'no-referrer',
   headers:{Accept:'application/json'},signal:ctrl.signal
  });
  if(!response.ok){
   if(response.status===401||response.status===403)throw new Error('member_access_denied');
   throw new Error('db_http_'+response.status);
  }
  return await response.json();
 }catch(error){
  if(error?.name==='AbortError')throw new Error('db_request_timeout');
  if(error?.name==='TypeError')throw new Error('db_network_failed');
  throw error;
 }finally{clearTimeout(timeout);}
}
async function checkAdmin(){
 const uid=auth.currentUser?.uid;
 if(!uid)throw new Error('login_required');
 const m=await readFirebaseRest('members/'+encodeURIComponent(uid));
 if(!m||m.active!==true||m.role!=='admin')throw new Error('not_admin');
}
function clearIssued(){justCreated='';el('issuedValue').textContent='';el('issued').hidden=true;}
async function refresh(){
 await checkAdmin();
 const [whitelist,labels]=await Promise.all([
  readFirebaseRest('whitelist'),readFirebaseRest('vipProfiles')
 ]);
 const entries=Object.entries(whitelist||{}).filter(([code,val])=>codeFormat.test(code)&&typeof val==='boolean');
 const names=labels||{};
 const tbody=el('rows');tbody.replaceChildren();
 for(const [code,enabled] of entries.sort((a,b)=>a[0].localeCompare(b[0]))){
  const row=document.createElement('tr');
  for(const value of [names[code]||'既有授權','••••'+code.slice(-4),enabled?'啟用':'停用']){
   const cell=document.createElement('td');cell.textContent=value;row.append(cell);
  }
  const actionCell=document.createElement('td'),button=document.createElement('button');
  button.type='button';button.className=enabled?'danger':'secondary';
  button.textContent=enabled?'停用':'啟用';
  button.addEventListener('click',async()=>{
   if(!confirm('確定要'+(enabled?'停用':'啟用')+'尾碼 '+code.slice(-4)+' 的授權碼？'))return;
   button.disabled=true;
   try{
    await checkAdmin();
    // Firebase may call the transaction callback with null before this
    // individual code has been cached. Verify its real value first.
    const entryRef=ref(db,'whitelist/'+code);
    const latest=(await get(entryRef)).val();
    if(typeof latest!=='boolean')throw new Error('code_missing');
    if(latest!==enabled)throw new Error('authorization_changed');
    const update=await runTransaction(entryRef,current=>nextVipStatus(current,enabled),{applyLocally:false});
    if(!update.committed)throw new Error('authorization_changed');
    const saved=(await get(entryRef)).val();
    if(saved!==!enabled)throw new Error('verify_failed');
    say('授權狀態已更新為'+(saved?'啟用':'停用')+'，已重新確認資料庫。');await refresh();
   }catch(error){say(reportError(error),true);button.disabled=false;}
  });
  actionCell.append(button);row.append(actionCell);tbody.append(row);
 }
}
// Keep Firebase Authentication, membership validation and list loading separate.
// A slow or denied list read must never make a successful login look stuck.
function withDeadline(promise,ms,phase){
 let timeout;
 const timer=new Promise((_,reject)=>{
  timeout=setTimeout(()=>reject(new Error(phase+'_timeout')),ms);
 });
 return Promise.race([promise,timer]).finally(()=>clearTimeout(timeout));
}
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();
 if(!el('password').value){say('請先輸入 Firebase 管理員密碼。',true);return;}
 const button=el('loginButton');
 button.disabled=true;button.textContent='驗證中…';
 let signedIn=false;
 try{
  say('步驟 1／3：正在驗證 Firebase 管理員帳號…');
  await withDeadline(signInWithEmailAndPassword(auth,el('email').value.trim(),el('password').value),15000,'auth');
  signedIn=true;
  el('password').value='';
  say('步驟 2／3：帳號驗證成功，正在確認管理員權限…');
  await withDeadline(checkAdmin(),15000,'membership');
  el('loginArea').hidden=true;el('manageArea').hidden=false;
  say('步驟 3／3：管理員登入成功，正在載入 VIP 授權清單…');
  // The admin UI is usable even when the optional list read fails or stalls.
  void withDeadline(refresh(),15000,'list').then(
   ()=>say('管理員登入成功，授權清單已載入。'),
   error=>say('管理員登入成功，但清單載入失敗：'+reportError(error),true)
  );
 }catch(error){
  el('password').value='';
  if(signedIn){try{await signOut(auth);}catch(_){}}
  say(reportError(error),true);
 }finally{
  button.disabled=false;button.textContent='登入後台';
 }
});
el('createForm').addEventListener('submit',async event=>{
 event.preventDefault();el('createButton').disabled=true;clearIssued();
 try{
  await checkAdmin();
  const label=el('label').value.trim();
  if(!label||label.length>80)throw new Error('invalid_label');
  const code=normalizeNewVipCode(el('vipCode').value);
  const codeRef=ref(db,'whitelist/'+code);
  // Check both enabled and disabled codes; never overwrite/re-enable an existing person.
  if((await get(codeRef)).exists())throw new Error('duplicate_vip_code');
  // Firebase transaction retries on concurrent writes to preserve uniqueness.
  const result=await runTransaction(codeRef,insertNewVipCodeIfAbsent,{applyLocally:false});
  if(!result.committed)throw new Error('duplicate_vip_code');
  const confirmed=(await get(codeRef)).val();
  if(confirmed!==true)throw new Error('verify_failed');
  justCreated=code;el('issuedValue').textContent=code;el('issued').hidden=false;
  el('label').value='';el('vipCode').value='';
  try{
   await set(ref(db,'vipProfiles/'+code),label);
   say('管理員指定的 VIP 授權碼已建立，請透過私密管道交給本人。');
  }catch(_){say('授權碼已建立，但識別標籤未成功儲存；請先記下畫面上的授權碼。',true);}
  await refresh();
 }catch(error){say(reportError(error),true);}
 finally{el('createButton').disabled=false;}
});
el('refresh').addEventListener('click',()=>refresh().catch(e=>say(reportError(e),true)));
el('hideCode').addEventListener('click',clearIssued);
el('copy').addEventListener('click',async()=>{
 if(!justCreated)return;
 try{await navigator.clipboard.writeText(justCreated);say('已複製授權碼。');}
 catch(_){say('瀏覽器不允許複製，請自行複製本次授權碼。',true);}
});
el('logout').addEventListener('click',async()=>{
 clearIssued();el('rows').replaceChildren();
 await signOut(auth);el('manageArea').hidden=true;el('loginArea').hidden=false;say('已安全登出。');
});
