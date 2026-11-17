// Standalone Firebase administrator diagnostic. No CRM, writes or persistent login.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword,signOut} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {getDatabase,ref,get} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
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
const app=initializeApp(firebaseConfig,'cathay-admin-login-smoke');
const auth=initializeAuth(app,{persistence:inMemoryPersistence});
const db=getDatabase(app);
const form=document.getElementById('test-login');
const status=document.getElementById('status');
const email=document.getElementById('test-email');
const password=document.getElementById('test-password');
const button=document.getElementById('test-submit');
function say(message,kind=''){status.textContent=message;status.dataset.state=kind;}
class StageTimeout extends Error {
  constructor(stage){super(stage+'逾時');this.stage=stage;this.name='StageTimeout';}
}
function within(promise,ms,stage){
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new StageTimeout(stage)),ms);})
  ]).finally(()=>clearTimeout(timer));
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  button.disabled=true;
  let result='',kind='error',timedOut=false;
  try{
    say('階段 1 / 2：正在使用電子郵件與密碼登入 Firebase Authentication…');
    const login=await within(signInWithEmailAndPassword(auth,email.value.trim(),password.value),15000,'Firebase Authentication 登入');
    say('階段 1 / 2：帳號登入成功。\n階段 2 / 2：正在讀取 Firebase Realtime Database 的 members/UID…');
    const snap=await within(get(ref(db,'members/'+login.user.uid)),12000,'Realtime Database 會員權限讀取');
    const member=snap.exists()?snap.val():null;
    if(member&&member.active===true&&member.role==='admin'){
      result='測試成功：Firebase 帳號驗證有效，而且 members/UID 已設為 active=true、role=admin。';
      kind='success';
    }else{
      result='帳號登入與資料庫讀取成功，但 members/UID 的 active 或 role 設定不符合管理員要求。請核對完整 UID。';
    }
  }catch(error){
    if(error instanceof StageTimeout){
      timedOut=true;
      result=error.stage+'沒有在預設時間內完成。這代表請求仍在等待，不能判定密碼錯誤。\n請檢查瀏覽器網路、隱私／廣告封鎖工具及 Firebase 連線，重新整理頁面後再重試。';
    }else{
      const code=String(error&&error.code||'');
      if(code==='auth/operation-not-allowed'){
        result='Authentication 失敗：Email/Password 登入方式尚未啟用。';
      }else if(code==='auth/too-many-requests'){
        result='Authentication 失敗：短時間登入過多，已被 Firebase 暫時限制。請勿連續重試。';
      }else if(code==='auth/invalid-credential'||code==='auth/wrong-password'||code==='auth/user-not-found'){
        result='Authentication 失敗：帳號或密碼未通過驗證。請確認使用 Firebase Authentication 的帳號而非舊 VIP 授權碼。';
      }else if(code==='auth/network-request-failed'){
        result='Authentication 無法連線：請檢查網路連線、瀏覽器阻擋或防毒／防火牆設定。';
      }else if(code==='PERMISSION_DENIED'||code==='database/permission-denied'){
        result='帳號登入成功，但 members/UID 讀取遭資料庫規則拒絕。請檢查過渡規則及完整 UID。';
      }else{
        // Only an error code may be displayed. Do not disclose credentials or tokens.
        result='驗證失敗，發生階段：'+(auth.currentUser?'資料庫讀取':'Firebase Authentication')+
          '。錯誤代碼：'+(code||'未提供')+'。';
      }
    }
  }finally{
    password.value='';
    say('正在結束測試登入…');
    try{
      await within(signOut(auth),5000,'Firebase 登出');
    }catch(_){
      result+='\n提醒：測試頁登出未能確認；使用的是記憶體登入，請關閉此頁。';
      kind='error';timedOut=true;
    }
    say((result||'測試未完成。')+'\n未讀寫任何客戶資料，正式系統未變動。'+
      (timedOut?'\n請重新整理測試頁後再重試。':''),kind);
    button.disabled=timedOut;
    if(timedOut)button.textContent='請重新整理頁面後重試';
  }
});
