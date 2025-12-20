// --- 引入 Firebase SDK (透過網路讀取) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️⚠️⚠️ 請將下方內容替換成您在 Firebase Console 複製的設定 ⚠️⚠️⚠️
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

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 允許的授權碼清單 (您可以隨時新增)
const validCodes = [ "VIP888", "CATHAY2025", "USER001" ];

// 產生隨機 Session ID (用來識別不同次登入)
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 主要驗證邏輯 ---
async function initAuth() {
    const localUser = localStorage.getItem('currentUser');
    const localSession = localStorage.getItem('currentSession');

    // 1. 如果本地沒有登入紀錄，或是被強制登出了
    if (!localUser || !localSession) {
        await performLogin();
    } else {
        // 2. 如果有登入，開始監聽雲端，看有沒有被踢掉
        monitorSession(localUser, localSession);
    }
}

// 執行登入動作
async function performLogin() {
    let isAuthorized = false;
    
    while (!isAuthorized) {
        const inputCode = prompt("【單一裝置限制】\n請輸入授權碼登入：");
        
        if (inputCode === null) {
            document.body.innerHTML = "<h2 style='text-align:center;padding:50px;'>存取被拒絕</h2>";
            throw new Error("User cancelled");
        }

        // 檢查代碼是否在白名單內
        if (validCodes.includes(inputCode)) {
            // 產生新的 Session ID
            const newSessionID = generateUUID();
            
            // 🔥 關鍵：將新 Session 寫入雲端 (這會踢掉舊裝置)
            await set(ref(db, 'users/' + inputCode), {
                session: newSessionID,
                lastLogin: new Date().toISOString()
            });

            // 儲存到本地
            localStorage.setItem('currentUser', inputCode);
            localStorage.setItem('currentSession', newSessionID);
            
            alert("驗證成功！若有其他裝置使用此帳號，將會被登出。");
            isAuthorized = true;
            
            // 開始監聽
            monitorSession(inputCode, newSessionID);
        } else {
            alert("無效的授權碼，請重新輸入。");
        }
    }
}

// 監聽雲端 Session 變化 (踢人機制)
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        
        // 如果雲端沒有資料，或者雲端的 Session 跟我的不一樣
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 偵測到重複登入！\n\n您的帳號已在另一台裝置登入，本機將自動登出。");
            
            // 清除本地資料並重整
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentSession');
            location.reload();
        }
    });
}

// 啟動驗證
initAuth();

// --- 自動產生選單 (保持原本的選單邏輯) ---
document.addEventListener("DOMContentLoaded", function() {
    // ... 這裡放您原本的選單程式碼，保持不變 ...
    // ... 為了節省篇幅，請保留您上一版 auth.js 下半部的選單代碼 ...
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";
    const navHTML = `
    <style>
        /* 您原本的 CSS */
        body { padding-bottom: 70px; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #fff; border-top: 1px solid #ddd; display: flex; justify-content: space-around; align-items: center; z-index: 9999; }
        .nav-item { text-decoration: none; color: #999; text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 11px; }
        .nav-item span { font-size: 20px; display: block; }
        .nav-item.active { color: #00A651; }
    </style>
    <div class="bottom-nav">
        <a href="index.html" class="nav-item ${page === 'index.html' ? 'active' : ''}"><span>🏠</span><div>首頁</div></a>
        <a href="client.html" class="nav-item ${page === 'client.html' ? 'active' : ''}"><span>👥</span><div>客戶</div></a>
        <a href="calc.html" class="nav-item ${page === 'calc.html' ? 'active' : ''}"><span>🧮</span><div>試算</div></a>
        <a href="products.html" class="nav-item ${page === 'products.html' ? 'active' : ''}"><span>🏥</span><div>商品</div></a>
        <a href="event.html" class="nav-item ${page === 'event.html' ? 'active' : ''}"><span>🏆</span><div>高峰會</div></a>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', navHTML);
});