// --- 1. 引入 Firebase SDK (⚠️ 注意這裡加了 update) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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


// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 設定：閒置 30 分鐘自動登出
const AUTO_LOGOUT_MINUTES = 30; 

// 產生隨機 Session ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 主要驗證流程 ---
async function initAuth() {
    const localUser = localStorage.getItem('currentUser');
    const localSession = localStorage.getItem('currentSession');

    // 1. 如果本地沒有登入紀錄
    if (!localUser || !localSession) {
        await performLogin();
    } else {
        // 2. 如果有登入，開始監聽是否被踢出
        monitorSession(localUser, localSession);
        setupAutoLogout(); // 啟動閒置偵測
    }
}

// --- 登入邏輯 (包含累積次數) ---
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
            // 2. 讀取使用者目前的狀態 (為了拿舊的累積次數)
            const userRef = ref(db, 'users/' + inputCode);
            const userSnapshot = await get(userRef);
            
            let finalKickCount = 0; 
            let isKicking = 0;

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                
                // A. 拿舊次數
                const oldKickCount = userData.kickCount || 0;
                
                // B. 判斷是否踢人 (如果雲端有 session 代表有人在線)
                if (userData.session) {
                    isKicking = 1;
                }

                // C. 累加
                finalKickCount = oldKickCount + isKicking;

            } else {
                finalKickCount = 0;
            }

            // 產生新 Session
            const newSessionID = generateUUID();
            
            // 3. 使用 update 更新資料 (保留原本欄位，只更新需要的)
            await update(userRef, {
                session: newSessionID,
                lastLogin: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
                device: navigator.userAgent,
                kickCount: finalKickCount // ✅ 寫入累積後的數字
            });

            localStorage.setItem('currentUser', inputCode);
            localStorage.setItem('currentSession', newSessionID);
            
            alert("驗證成功！");
            isAuthorized = true;
            monitorSession(inputCode, newSessionID);
            setupAutoLogout();
        } else {
            alert("授權碼錯誤，或該帳號已被停用。");
        }
    }
}

// --- 監聽踢人機制 ---
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        
        // 如果雲端 session 變了 (被別人覆蓋)，而且不是 null (null 代表正常登出)
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 您的帳號已在其他裝置登入，本機將自動登出。");
            
            // 被踢出時，不需要清除雲端 session (因為那是別人的 session)，也不計入 kickCount (因為是對方害我被踢的)
            doLogout(false, false); 
        }
    });
}

// --- 自動登出計時器 ---
function setupAutoLogout() {
    let timer;
    function resetTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            alert("您已閒置超過 " + AUTO_LOGOUT_MINUTES + " 分鐘，系統自動登出。");
            window.doLogout(false); 
        }, AUTO_LOGOUT_MINUTES * 60 * 1000);
    }
    
    window.onload = resetTimer;
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.ontouchstart = resetTimer;
    document.onclick = resetTimer;
}

// --- 🔥 安全登出函式 (掛載到 window 全域變數) ---
// clearCloud: 是否要清除雲端 Session (正常登出要清除，被踢出不用)
window.doLogout = async function(needConfirm = true, clearCloud = true) {
    if (needConfirm && !confirm("確定要登出系統嗎？")) {
        return;
    }
    
    // 1. 取得目前的使用者
    const user = localStorage.getItem('currentUser');

    // 2. 如果是正常登出，就把雲端 session 清空，這樣下次登入才不會算成「踢人」
    if (user && clearCloud) {
        try {
            await set(ref(db, 'users/' + user + '/session'), null);
        } catch (e) {
            console.error("雲端登出失敗", e);
        }
    }

    // 3. 清除本地
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentSession');
    
    // 4. 重整
    location.reload(); 
}

// 啟動驗證
initAuth();

// --- 底部選單 ---
document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";

    const navHTML = `
    <style>
        body { padding-bottom: 70px; }
        .bottom-nav {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
            background: #ffffff; border-top: 1px solid #e0e0e0;
            display: flex; justify-content: space-around; align-items: center;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 9999;
            padding-bottom: env(safe-area-inset-bottom);
        }
        .nav-item {
            text-decoration: none; color: #999; text-align: center;
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 5px 0; -webkit-tap-highlight-color: transparent;
        }
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
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);
});