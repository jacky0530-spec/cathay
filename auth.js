import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️⚠️⚠️ 這裡記得填回您自己的 Firebase 設定 ⚠️⚠️⚠️
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
const db = getDatabase(app);

// 產生亂數 Session ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 初始化
async function initAuth() {
    const localUser = localStorage.getItem('currentUser');
    const localSession = localStorage.getItem('currentSession');

    if (!localUser || !localSession) {
        await performLogin();
    } else {
        // 檢查是否被踢出
        monitorSession(localUser, localSession);
    }
}

// 🔥 修正後的登入邏輯：去 Firebase 檢查 whitelist
// 🔥 修改後的登入邏輯：增加記錄踢出次數與裝置名稱
async function performLogin() {
    let isAuthorized = false;
    
    while (!isAuthorized) {
        let inputCode = prompt("【單一裝置限制】\n請輸入您的專屬授權碼：");
        
        if (inputCode === null) {
            document.body.innerHTML = "<h2 style='text-align:center;padding:50px;'>存取被拒絕</h2>";
            throw new Error("User cancelled");
        }
        
        inputCode = inputCode.toUpperCase().trim();

        // 1. 檢查白名單
        const whitelistRef = ref(db, 'whitelist/' + inputCode);
        const snapshot = await get(whitelistRef);

        if (snapshot.exists() && snapshot.val() === true) {
            // 2. 準備登入
            const userRef = ref(db, 'users/' + inputCode);
            const userSnapshot = await get(userRef);
            
            let currentKickCount = 0;
            
            // 檢查是否已經有人登入中 (如果有 session 代表有人在線)
            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                currentKickCount = userData.kickCount || 0; // 讀取舊的次數
                
                // 如果舊資料有 session，代表這次登入會把對方踢掉
                if (userData.session) {
                    currentKickCount += 1; 
                }
            }

            // 產生新 Session
            const newSessionID = generateUUID();
            
            // 3. 寫入詳細資訊 (包含踢出次數)
            await set(userRef, {
                session: newSessionID,
                lastLogin: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }), // 轉成台灣時間好讀版
                device: navigator.userAgent, // 紀錄裝置型號
                kickCount: currentKickCount // 寫入累計的踢人次數
            });

            localStorage.setItem('currentUser', inputCode);
            localStorage.setItem('currentSession', newSessionID);
            
            alert("驗證成功！");
            isAuthorized = true;
            monitorSession(inputCode, newSessionID);
        } else {
            alert("授權碼錯誤，或該帳號已被停用。");
        }
    }
}

// 監聽踢人機制
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 您的帳號已在其他裝置登入，本機將自動登出。");
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentSession');
            location.reload();
        }
    });
}

initAuth();

// --- 底部選單保持不變 ---
document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";
    const navHTML = `
    <style>
        body { padding-bottom: 70px; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #fff; border-top: 1px solid #ddd; display: flex; justify-content: space-around; align-items: center; z-index: 9999; padding-bottom: env(safe-area-inset-bottom); }
        .nav-item { text-decoration: none; color: #999; text-align: center; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5px 0; -webkit-tap-highlight-color: transparent; }
        .nav-item span { font-size: 20px; margin-bottom: 2px; display: block; }
        .nav-item div { font-size: 11px; font-weight: 500; } 
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