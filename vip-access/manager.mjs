// VIP manager UI: fail closed until Cloudflare Worker URL is verified and configured.
// NEVER enter Firebase credentials into a third-party or arbitrary API URL.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
const config={
  apiKey:"AIzaSyAXmxp2R7oeM-DJsbDoT6YAVlHV4vKC_Xo",
  authDomain:"cathay-app-5889a.firebaseapp.com",
  projectId:"cathay-app-5889a",
  appId:"1:222981030218:web:5f557a386a38cf3d1c41b3"
};
// To be replaced with the fixed, verified Worker deployment origin, never user-editable at runtime.
const API_ORIGIN='https://NOT-DEPLOYED.invalid';
const ready=API_ORIGIN.startsWith('https://')&&!API_ORIGIN.endsWith('.invalid');
const form=document.getElementById('loginForm');
const create=document.getElementById('createForm');
const msg=document.getElementById('message');
const button=document.getElementById('loginButton');
const manager=document.getElementById('manager');
const table=document.getElementById('accountRows');
let app,auth;
function say(text,isError=false){msg.textContent=text;msg.className=isError?'error':'';}
function requireReady(){
 if(!ready)throw new Error('管理員後端尚未完成部署或設定。請勿在測試版輸入密碼。');
}
async function api(path,options={}){
 requireReady();
 if(!auth.currentUser)throw new Error('管理員尚未登入');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch(API_ORIGIN+path,{
   method:options.method||'GET',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
   body:options.body===undefined?undefined:JSON.stringify(options.body),
   cache:'no-store'
 });
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'操作被拒絕');
 return data;
}
async function refresh(){
 const result=await api('/api/admin/vip');
 table.replaceChildren();
 for(const acc of result.accounts){
   const row=document.createElement('tr');
   for(const value of [acc.label,acc.hint,acc.active?'啟用':'停用',acc.lastUsedAt||'未曾使用']){
     const cell=document.createElement('td');cell.textContent=value;row.append(cell);
   }
   const cell=document.createElement('td');
   const change=document.createElement('button');change.type='button';
   change.textContent=acc.active?'停用':'啟用';change.className=acc.active?'secondary':'';
   change.addEventListener('click',async()=>{
     if(!confirm('確定'+(acc.active?'停用':'啟用')+'這組授權嗎？'))return;
     change.disabled=true;
     try{
       await api('/api/admin/vip/'+encodeURIComponent(acc.id)+'/status',{method:'POST',body:{active:!acc.active}});
       say('授權狀態已變更。');
       await refresh();
     }catch(error){say(error.message,true);change.disabled=false;}
   });
   cell.append(change);row.append(cell);table.append(row);
 }
}
form.addEventListener('submit',async event=>{
 event.preventDefault();
 button.disabled=true;
 try{
   requireReady();
   if(!auth){
     app=initializeApp(config,'cathay-vip-manager');
     auth=initializeAuth(app,{persistence:inMemoryPersistence});
   }
   await signInWithEmailAndPassword(auth,document.getElementById('email').value.trim(),
     document.getElementById('password').value);
   document.getElementById('password').value='';
   await refresh();manager.hidden=false;document.getElementById('signIn').hidden=true;
   say('管理員登入與後端權限驗證成功。');
 }catch(error){document.getElementById('password').value='';say(error.message||'登入失敗',true);}
 finally{button.disabled=!ready;}
});
create.addEventListener('submit',async event=>{
 event.preventDefault();
 const add=document.getElementById('addButton');add.disabled=true;
 document.getElementById('issued').hidden=true;
 try{
   const label=document.getElementById('label').value.trim();
   const code=document.getElementById('legacyCode').value.trim();
   const payload={label};if(code)payload.existingCode=code;
   const result=await api('/api/admin/vip',{method:'POST',body:payload});
   document.getElementById('issuedValue').textContent=result.code;
   document.getElementById('issued').hidden=false;
   create.reset();say('授權碼已新增，請以私密管道提供給本人。');
   await refresh();
 }catch(error){say(error.message||'新增失敗',true);}
 finally{add.disabled=false;}
});
document.getElementById('hideIssued').addEventListener('click',()=>{
 document.getElementById('issuedValue').textContent='';
 document.getElementById('issued').hidden=true;
});
document.getElementById('refreshButton').addEventListener('click',()=>refresh().catch(e=>say(e.message,true)));
document.getElementById('logoutButton').addEventListener('click',async()=>{
 if(auth)await signOut(auth);
 document.getElementById('issuedValue').textContent='';
 document.getElementById('issued').hidden=true;manager.hidden=true;document.getElementById('signIn').hidden=false;
 table.replaceChildren();say('已登出。');
});
button.disabled=!ready;
if(!ready)say('此頁仍是開發測試版，沒有設定 Worker URL，因此登入及人員新增功能已停用。正式網站及舊 VIP 授權碼不受影響。');
