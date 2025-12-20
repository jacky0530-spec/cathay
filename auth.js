// --- 1. 引入 Firebase SDK ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️⚠️⚠️ 【請修改】這裡要填入您自己的 Firebase 設定 ⚠️⚠️⚠️
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

// 🔥 取得詳細位置 (含路名) - 使用 OpenStreetMap
function getUserLocation() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve("不支援定位");
            return;
        }
        
        // 提示：OpenStreetMap 需要較精確的經緯度
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // 使用 Nominatim 免費服務 (zoom=18 代表街道等級)
                    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=zh-TW`;
                    
                    const res = await fetch(url);
                    const data = await res.json();
                    
                    if (data && data.address) {
                        const addr = data.address;
                        
                        // 1. 抓取縣市
                        const city = addr.city || addr.county || '';
                        // 2. 抓取區/鄉鎮
                        const district = addr.suburb || addr.town || addr.district || '';
                        // 3. 抓取路名
                        const road = addr.road || addr.street || addr.pedestrian || addr.residential || '';

                        // 組合地址：高雄市 左營區 博愛三路
                        let fullAddress = `${city} ${district} ${road}`.trim();
                        
                        if (!road) fullAddress = `${city} ${district} (附近)`.trim();

                        resolve(fullAddress || "未知地點");
                    } else {
                        resolve(`座標:${latitude.toFixed(3)},${longitude.toFixed(3)}`);
                    }
                } catch (e) {
                    console.error(e);
                    resolve(`GPS:${latitude.toFixed(3)},${longitude.toFixed(3)}`);
                }
            },
            (error) => {
                switch(error.code) {
                    case error.PERMISSION_DENIED: resolve("使用者拒絕定位"); break;
                    case error.TIMEOUT: resolve("定位逾時"); break;
                    default: resolve("定位無法使用"); break;
                }
            },
            { timeout: 8000, enableHighAccuracy: true } // 開啟高精準度以抓取路名
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

// --- 登入邏輯 ---
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
            
            // 提示定位中 (不阻擋流程，但在背景跑)
            let userLocation = "讀取中...";
            try {
                userLocation = await getUserLocation();
            } catch(e) {
                userLocation = "定位錯誤";
            }

            // 2. 讀取舊資料 (計算踢人次數)
            const userRef = ref(db, 'users/' + inputCode);
            const userSnapshot = await get(userRef);
            
            let finalKickCount = 0; 
            let isKicking = 0;

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                const oldKickCount = userData.kickCount || 0;
                // 如果雲端有 session，代表有人在線，這次登入算是踢人
                if (userData.session) {
                    isKicking = 1;
                }
                finalKickCount = oldKickCount + isKicking;
            }

            const newSessionID = generateUUID();
            
            // 3. 寫入資料 (使用 update 保留其他欄位)
            await update(userRef, {
                session: newSessionID,
                lastLogin: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
                device: navigator.userAgent,
                kickCount: finalKickCount, // 累積次數
                location: userLocation     // 寫入路名地址
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

// --- 監聽踢人機制 ---
function monitorSession(userCode, mySessionID) {
    const userRef = ref(db, 'users/' + userCode + '/session');
    
    onValue(userRef, (snapshot) => {
        const cloudSession = snapshot.val();
        
        // 如果雲端 session 被改了 (被別人覆蓋)，且不是 null (null 是正常登出)
        if (cloudSession && cloudSession !== mySessionID) {
            alert("⚠️ 您的帳號已在其他裝置登入，本機將自動登出。");
            doLogout(false, false); // 被踢出時，不清除雲端 session
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

// --- 安全登出函式 ---
// clearCloud: true=正常登出(清空session), false=被踢出(不清空)
window.doLogout = async function(needConfirm = true, clearCloud = true) {
    if (needConfirm && !confirm("確定要登出系統嗎？")) {
        return;
    }
    
    const user = localStorage.getItem('currentUser');

    if (user && clearCloud) {
        try {
            // 正常登出時，把雲端 Session 設為 null，下次登入就不會算成踢人
            await set(ref(db, 'users/' + user + '/session'), null);
        } catch (e) {
            console.error("雲端登出失敗", e);
        }
    }

    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentSession');
    location.reload(); 
}

// 啟動程式
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