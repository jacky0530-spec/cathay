// Spark-compatible administrator UI. Existing VIP code login remains unchanged.
// Standalone on GitHub Pages. Actual writes require separately published Firebase Rules.
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
 if(error?.message==='not_admin')return '登入帳號沒有管理員權限。';
 if(error?.code==='auth/invalid-credential')return '帳號或密碼驗證失敗。';
 return '操作未完成：'+String(error?.code||error?.message||'未知錯誤');
}
async function checkAdmin(){
 const uid=auth.currentUser?.uid;
 if(!uid)throw new Error('login_required');
 const m=(await get(ref(db,'members/'+uid))).val();
 if(!m||m.active!==true||m.role!=='admin')throw new Error('not_admin');
}
function createRandomCode(){
 const bytes=crypto.getRandomValues(new Uint8Array(18));
 return 'VIP'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
}
function clearIssued(){justCreated='';el('issuedValue').textContent='';el('issued').hidden=true;}
async function refresh(){
 await checkAdmin();
 const [whitelist,labels]=await Promise.all([get(ref(db,'whitelist')),get(ref(db,'vipProfiles'))]);
 const entries=Object.entries(whitelist.val()||{}).filter(([code,val])=>codeFormat.test(code)&&typeof val==='boolean');
 const names=labels.val()||{};
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
    const update=await runTransaction(ref(db,'whitelist/'+code),old=>{
     if(typeof old!=='boolean')return;
     return !enabled;
    },{applyLocally:false});
    if(!update.committed)throw new Error('authorization_changed');
    say('授權狀態已更新。');await refresh();
   }catch(error){say(reportError(error),true);button.disabled=false;}
  });
  actionCell.append(button);row.append(actionCell);tbody.append(row);
 }
}
el('loginForm').addEventListener('submit',async event=>{
 event.preventDefault();el('loginButton').disabled=true;
 try{
  await signInWithEmailAndPassword(auth,el('email').value.trim(),el('password').value);
  el('password').value='';
  await checkAdmin();await refresh();
  el('loginArea').hidden=true;el('manageArea').hidden=false;
  say('管理員身分驗證成功。');
 }catch(error){
  el('password').value='';
  try{await signOut(auth);}catch(_){}
  say(reportError(error),true);
 }finally{el('loginButton').disabled=false;}
});
el('createForm').addEventListener('submit',async event=>{
 event.preventDefault();el('createButton').disabled=true;clearIssued();
 try{
  await checkAdmin();
  const label=el('label').value.trim();
  if(!label||label.length>80)throw new Error('invalid_label');
  let code='';
  for(let i=0;i<4;i++){
   const candidate=createRandomCode();
   const result=await runTransaction(ref(db,'whitelist/'+candidate),old=>{
    if(old!==null)return;
    return true;
   },{applyLocally:false});
   if(result.committed){code=candidate;break;}
  }
  if(!code)throw new Error('code_generation_failed');
  justCreated=code;el('issuedValue').textContent=code;el('issued').hidden=false;
  el('label').value='';
  try{
   await set(ref(db,'vipProfiles/'+code),label);
   say('已建立新人授權碼；請透過私密管道交給本人。');
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
