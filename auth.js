import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// 記得加上 update
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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ⏱️ 設定：閒置幾分鐘後自動登出？ (預設 30 分鐘)
const AUTO_LOGOUT_MINUTES = 30; 

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 🔥 修正版：累積次數邏輯，不會歸零
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
            
            let finalKickCount = 0; // 最終要寫入的次數
            let isKicking = 0;      // 本次是否發生踢人 (0或1)

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                
                // A. 先把「舊的次數」抓出來 (如果沒有就是0)
                const oldKickCount = userData.kickCount || 0;
                
                // B. 判斷這次有沒有踢人？ (如果雲端上有 session，代表有人在線上，我要把他踢掉)
                if (userData.session) {
                    isKicking = 1;
                }

                // C. 計算新的總數 = 舊次數 + 本次踢人
                finalKickCount = oldKickCount + isKicking;

            } else {
                // 如果是第一次使用這個系統，次數就是 0
                finalKickCount = 0;
            }

            // 產生新 Session
            const newSessionID = generateUUID();
            
            // 3. 使用 update 更新資料 (比 set 更安全，不會洗掉其他欄位)
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

// 監聽 Session
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 您的帳號已在其他裝置登入，本機將自動登出。");
            doLogout(false); // 被踢出時不需確認
        }
    });
}

// 🔥 新增功能：自動登出計時器
function setupAutoLogout() {
    let timer;
    function resetTimer() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            alert("您已閒置超過 " + AUTO_LOGOUT_MINUTES + " 分鐘，系統自動登出。");
            doLogout(false);
        }, AUTO_LOGOUT_MINUTES * 60 * 1000);
    }
    
    // 只要有這些動作，就重算時間
    window.onload = resetTimer;
    document.onmousemove = resetTimer; // 滑鼠移動
    document.onkeypress = resetTimer;  // 打字
    document.ontouchstart = resetTimer; // 手機觸控
    document.onclick = resetTimer;      // 點擊
}

// 🔥 新增功能：執行登出 (公開給 HTML 呼叫)
// needConfirm: true=要跳詢問視窗, false=直接登出
// 🔥 修改後的登出功能：同步清除雲端紀錄，避免誤判為踢人
window.doLogout = async function(needConfirm = true) {
    if (needConfirm && !confirm("確定要登出系統嗎？")) {
        return;
    }
    
    // 1. 取得目前的使用者代碼
    const user = localStorage.getItem('currentUser');

    // 2. 如果找得到人，就去 Firebase 把他的 Session 清空 (設為 null)
    if (user) {
        try {
            // 清空雲端 Session，這樣下次登入就不會被算成「踢出」
            await set(ref(db, 'users/' + user + '/session'), null);
        } catch (e) {
            console.error("雲端登出失敗 (可能是網路問題)，僅執行本地登出", e);
        }
    }

    // 3. 清除本地資料
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentSession');
    
    // 4. 重整頁面
    location.reload(); 
}

initAuth();

// --- 底部選單 (保持不變) ---
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