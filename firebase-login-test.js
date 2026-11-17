// Standalone non-persistent authentication smoke test. No legacy app code or client records.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {getAuth,signInWithEmailAndPassword,signOut,setPersistence,inMemoryPersistence} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
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
const auth=getAuth(app);
const db=getDatabase(app);
const form=document.getElementById('test-login');
const status=document.getElementById('status');
const email=document.getElementById('test-email');
const password=document.getElementById('test-password');
const button=document.getElementById('test-submit');
function say(message,kind=''){
  status.textContent=message;
  status.dataset.state=kind;
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  button.disabled=true;
  say('測試中：正在驗證 Firebase 帳號與會員權限…');
  let result='無法驗證登入。',kind='error';
  try{
    // Firebase Auth state is ephemeral, so no Firebase auth session remains in localStorage.
    await setPersistence(auth,inMemoryPersistence);
    const login=await signInWithEmailAndPassword(auth,email.value.trim(),password.value);
    try{
      const snap=await get(ref(db,'members/'+login.user.uid));
      const member=snap.exists()?snap.val():null;
      if(member&&member.active===true&&member.role==='admin'){
        result='測試成功：Firebase 帳號登入有效，members/UID 的 active=true、role=admin，已可讀取自己的會員權限。';kind='success';
      }else{
        result='Firebase 登入成功，但 members/UID 未設定 active=true、role=admin。請檢查 UID 完全一致，以及資料是否已儲存。';
      }
    }catch(_){
      result='Firebase 登入成功，但無法讀取 members/UID。請確認過渡期規則已發布，且 UID 與 Authentication 清單一致。';
    }
  }catch(error){
    const code=String(error&&error.code||'');
    if(code==='auth/operation-not-allowed')
      result='無法登入：Firebase Authentication 尚未啟用 Email/Password 登入方式。';
    else if(code==='auth/too-many-requests')
      result='驗證嘗試過多，Firebase 暫時限制登入；請勿反覆重試。';
    else
      result='Firebase 登入失敗。請確認使用的是 Authentication 中建立的電子郵件與密碼，而不是舊網站的授權碼。';
  }finally{
    password.value='';
    try{await signOut(auth);}catch(_){result+='\n注意：自動登出失敗，請關閉此測試頁。';kind='error';}
    say(result+'\n測試已結束，沒有修改客戶資料或資料庫內容。',kind);
    button.disabled=false;
  }
});