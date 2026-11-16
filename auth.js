// V1.0: Firebase Authentication + database member rules; no shared front-end passwords.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, get, set, ref, update } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
const firebaseConfig = {
  apiKey: "AIzaSyAXmxp2R7oeM-DJsbDoT6YAVlHV4vKC_Xo",
  authDomain: "cathay-app-5889a.firebaseapp.com",
  databaseURL: "https://cathay-app-5889a-default-rtdb.firebaseio.com",
  projectId: "cathay-app-5889a",
  storageBucket: "cathay-app-5889a.firebasestorage.app",
  messagingSenderId: "222981030218",
  appId: "1:222981030218:web:5f557a386a38cf3d1c41b3",
  measurementId: "G-2C57S9M2H5"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app), db = getDatabase(app);
let completeReady;
window.cathayAuthReady = new Promise(resolve => {completeReady = resolve;});
window.cathayMember = null;
const cover=document.createElement('style');
cover.textContent='body{visibility:hidden!important}';
document.head.appendChild(cover);
function reveal(){cover.remove();document.body.style.visibility='visible';}
function loginScreen(message){
  document.body.innerHTML='<main style="max-width:410px;margin:8vh auto;padding:25px;background:white;border-radius:14px;box-shadow:0 3px 12px #0002;font-family:system-ui,Microsoft JhengHei"><h1>🔐 國泰雲端學習站</h1><p>請使用管理員核發的個人帳號登入。</p><form id="login-form"><label>電子郵件<input type="email" id="login-email" required autocomplete="username" style="display:block;box-sizing:border-box;width:100%;padding:10px;margin:8px 0 15px"></label><label>密碼<input type="password" id="login-pass" required autocomplete="current-password" style="display:block;box-sizing:border-box;width:100%;padding:10px;margin:8px 0 15px"></label><button id="login-btn" type="submit" style="background:#00a651;color:white;border:0;border-radius:8px;padding:13px;width:100%">登入</button></form><p id="login-msg" role="alert" style="color:#b22;font-size:13px"></p></main>';
  reveal();
  const msg=document.getElementById('login-msg');msg.textContent=message||'';
  document.getElementById('login-form').addEventListener('submit',async event=>{
    event.preventDefault();
    const button=document.getElementById('login-btn');
    button.disabled=true;msg.textContent='驗證中…';
    try{
      await signInWithEmailAndPassword(auth,document.getElementById('login-email').value.trim(),document.getElementById('login-pass').value);
      location.reload();
    }catch(error){msg.textContent='驗證失敗，請檢查帳號、密碼及權限設定。';button.disabled=false;}
  });
}
let idleTimer;
window.doLogout=async function(ask=true){
  if(ask&&!confirm('確定要登出嗎？'))return;
  clearTimeout(idleTimer);
  await signOut(auth);
  location.href='index.html';
};
function navigation(){
  if(document.querySelector('.bottom-nav'))return;
  const page=location.pathname.split('/').pop()||'index.html';
  const items=[['index.html','🏠','首頁'],['client.html','👥','客戶'],['calc.html','🧮','試算'],['products.html','🏥','商品'],['event.html','🏆','高峰會']];
  const bar=document.createElement('nav');
  bar.className='bottom-nav';bar.setAttribute('aria-label','主要功能');
  bar.style.cssText='position:fixed;bottom:0;left:0;right:0;background:white;border-top:1px solid #ddd;box-shadow:0 -2px 10px #0001;display:flex;justify-content:space-around;height:60px;z-index:9999;padding-bottom:env(safe-area-inset-bottom)';
  for(const item of items){
    const a=document.createElement('a');a.href=item[0];a.style.cssText='flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-decoration:none;font-size:11px;color:'+(page===item[0]?'#00a651':'#888');
    const icon=document.createElement('span');icon.style.fontSize='20px';icon.textContent=item[1];
    const title=document.createElement('span');title.textContent=item[2];
    a.append(icon,title);bar.append(a);
  }
  document.body.style.paddingBottom='80px';document.body.append(bar);
}
function idle(){
  function reset(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>window.doLogout(false),30*60*1000);}
  ['pointerdown','keydown','touchstart'].forEach(name=>document.addEventListener(name,reset,{passive:true}));
  reset();
}
window.cathayCloud={
  async backup(records){
    await window.cathayAuthReady;
    if(!auth.currentUser||!Array.isArray(records))throw Error('Invalid backup');
    await set(ref(db,'clientBackups/'+auth.currentUser.uid),{schemaVersion:1,updatedAt:new Date().toISOString(),records});
    return records.length;
  },
  async restore(){
    await window.cathayAuthReady;
    if(!auth.currentUser)throw Error('Not authorized');
    const snapshot=await get(ref(db,'clientBackups/'+auth.currentUser.uid));
    return snapshot.exists()?snapshot.val():null;
  }
};
function run(){
  onAuthStateChanged(auth,async user=>{
    if(!user){loginScreen();return;}
    try{
      const snapshot=await get(ref(db,'members/'+user.uid));
      if(!snapshot.exists()||snapshot.val().active!==true)throw Error('No membership');
      window.cathayMember={uid:user.uid,role:snapshot.val().role||'user'};
      completeReady(window.cathayMember);
      update(ref(db,'users/'+user.uid),{lastLogin:new Date().toISOString(),device:navigator.userAgent}).catch(()=>{});
      reveal();navigation();idle();
    }catch(error){await signOut(auth);loginScreen('此帳號尚未獲得授權，請聯絡管理員。');}
  },()=>loginScreen('無法連線至驗證服務。'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
