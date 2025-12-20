// --- 1. 引入 Firebase SDK ---
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


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 設定：閒置 30 分鐘自動登出
const AUTO_LOGOUT_MINUTES = 30; 

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 取得詳細位置 (OpenStreetMap)
function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("不支援定位");
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=zh-TW`;
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    if (data && data.address) {
                        const addr = data.address;
                        const city = addr.city || addr.county || '';
                        const district = addr.suburb || addr.town || addr.district || '';
                        const road = addr.road || addr.street || addr.pedestrian || addr.residential || '';

                        let fullAddress = `${city} ${district} ${road}`.trim();
                        if (!road) fullAddress = `${city} ${district} (附近)`.trim();
                        resolve(fullAddress || "未知地點");
                    } else {
                        resolve(`座標:${latitude.toFixed(3)},${longitude.toFixed(3)}`);
                    }
                } catch (e) {
                    resolve(`GPS:${latitude.toFixed(3)},${longitude.toFixed(3)}`);
                }
            },
            (error) => {
                // 🔥 這裡是關鍵：回傳明確的錯誤訊息
                switch(error.code) {
                    case error.PERMISSION_DENIED: resolve("使用者拒絕定位"); break; // 使用者按了「封鎖」
                    case error.TIMEOUT: resolve("定位逾時"); break;
                    case error.POSITION_UNAVAILABLE: resolve("定位無法使用"); break;
                    default: resolve("定位錯誤"); break;
                }
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    });
}

// --- 主要驗證流程 ---
async function initAuth() {
    const localUser = localStorage.getItem('currentUser');
    const localSession = localStorage.getItem('currentSession');

    if (!localUser || !localSession) {
        await performLogin();
    } else {
        monitorSession(localUser, localSession);
        setupAutoLogout(); 
    }
}

// 🔥 修改後的 performLogin：加入 30 天足跡紀錄
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
            
            // 提示定位中
            alert("系統將開始偵測您的位置，請務必點選「允許」。");

            let userLocation = "讀取中...";
            try {
                userLocation = await getUserLocation();
            } catch(e) {
                userLocation = "定位錯誤";
            }

            // 強制定位檢查
            if (userLocation === "使用者拒絕定位" || userLocation === "不支援定位" || userLocation === "定位無法使用") {
                alert("⛔【登入失敗】\n\n必須允許定位權限才能使用本系統。");
                location.reload();
                return; 
            }

            // 2. 讀取舊資料
            const userRef = ref(db, 'users/' + inputCode);
            const userSnapshot = await get(userRef);
            
            let finalKickCount = 0; 
            let isKicking = 0;
            let history = []; // 準備存放歷史紀錄

            const now = new Date();
            const timeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                
                // --- 處理踢人次數 ---
                const oldKickCount = userData.kickCount || 0;
                if (userData.session) isKicking = 1;
                finalKickCount = oldKickCount + isKicking;

                // --- 🔥 處理 30 天歷史紀錄 ---
                if (userData.loginHistory) {
                    history = userData.loginHistory;
                }
            }

            // A. 清除超過 30 天的舊紀錄
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            history = history.filter(record => {
                // 假設紀錄格式有 time 欄位，轉換回 Date 物件比較
                // 如果是舊資料沒有 time 欄位就保留或是刪除，這裡預設保留近期
                return new Date(record.time) > thirtyDaysAgo;
            });

            // B. 加入本次新紀錄
            history.unshift({ // unshift 放最前面，最新的在上面
                time: timeString,
                location: userLocation,
                device: navigator.userAgent
            });
            
            // C. 為了節省空間，最多只留最近 50 筆 (可選)
            if (history.length > 50) history.length = 50;

            const newSessionID = generateUUID();
            
            // 3. 寫入資料 (包含 loginHistory)
            await update(userRef, {
                session: newSessionID,
                lastLogin: timeString,
                device: navigator.userAgent,
                kickCount: finalKickCount,
                location: userLocation,     // 這是給首頁快速看的「最新位置」
                loginHistory: history       // 🔥 這是完整的歷史紀錄
            });

            localStorage.setItem('currentUser', inputCode);
            localStorage.setItem('currentSession', newSessionID);
            
            alert(`驗證成功！\n登入位置：${userLocation}`);
            isAuthorized = true;
            monitorSession(inputCode, newSessionID);
            setupAutoLogout();
        } else {
            alert("授權碼錯誤，或該帳號已被停用。");
        }
    }
}

// ... (以下 monitorSession, setupAutoLogout, doLogout, 底部選單 程式碼完全不變) ...
// 請保留您原本的這部分程式碼
// 為了避免篇幅過長，這裡省略下半部，請確認您的檔案下半部是完整的
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 您的帳號已在其他裝置登入，本機將自動登出。");
            doLogout(false, false);
        }
    });
}

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

window.doLogout = async function(needConfirm = true, clearCloud = true) {
    if (needConfirm && !confirm("確定要登出系統嗎？")) { return; }
    const user = localStorage.getItem('currentUser');
    if (user && clearCloud) {
        try { await set(ref(db, 'users/' + user + '/session'), null); } catch (e) { console.error(e); }
    }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentSession');
    location.reload(); 
}

initAuth();

document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";
    const navHTML = `
    <style>
        body { padding-bottom: 70px; }
        .bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #ffffff; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-around; align-items: center; box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 9999; padding-bottom: env(safe-area-inset-bottom); }
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