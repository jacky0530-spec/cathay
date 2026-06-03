// --- 1. 立即啟動白屏保護 (防偷看) ---
const antiPeekStyle = document.createElement('style');
antiPeekStyle.id = 'anti-peek-style';
antiPeekStyle.innerHTML = "body { display: none !important; opacity: 0 !important; }";
document.head.appendChild(antiPeekStyle);

function showContent() {
    const style = document.getElementById('anti-peek-style');
    if (style) style.remove();
    document.body.style.display = ''; // 修復排版跑版的問題
    document.body.style.opacity = '1';
}

// --- 2. 引入 Firebase SDK ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, update, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase 設定
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

    if (!localUser || !localSession) {
        await performLogin();
    } else {
        showContent();
        monitorSession(localUser, localSession);
        setupAutoLogout(); 
    }
}

// --- 登入邏輯 (已移除 GPS，修復卡死問題) ---
async function performLogin() {
    let isAuthorized = false;
    
    while (!isAuthorized) {
        let inputCode = prompt("【安全管制】\n本頁面需要登入才能瀏覽。\n請輸入您的專屬授權碼：");
        
        if (inputCode === null) {
            alert("未經授權無法存取。");
            document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px;'>存取被拒絕，請重新整理網頁。</h2>";
            showContent(); // 解除白屏顯示拒絕訊息
            throw new Error("User cancelled");
        }
        
        inputCode = inputCode.toUpperCase().trim();

        const whitelistRef = ref(db, 'whitelist/' + inputCode);
        const snapshot = await get(whitelistRef);

        if (snapshot.exists() && snapshot.val() === true) {
            
            // 1. 驗證成功，立刻解除白屏並提示，不讓畫面卡死
            alert("驗證成功！歡迎使用。");
            showContent(); 
            
            // 2. 在背景處理 Firebase 資料寫入
            const userRef = ref(db, 'users/' + inputCode);
            const userSnapshot = await get(userRef);
            
            let finalKickCount = 0; 
            let history = []; 

            const now = new Date();
            const timeString = now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
            const timestamp = now.getTime();

            if (userSnapshot.exists()) {
                const userData = userSnapshot.val();
                finalKickCount = (userData.kickCount || 0) + (userData.session ? 1 : 0);

                if (userData.loginHistory) {
                    if (Array.isArray(userData.loginHistory)) {
                        history = userData.loginHistory;
                    } else {
                        history = Object.values(userData.loginHistory);
                    }
                }
            }

            const thirtyDaysAgo = timestamp - 30 * 24 * 60 * 60 * 1000;
            history = history.filter(record => {
                if (record.timestamp) return record.timestamp > thirtyDaysAgo;
                return true; 
            });

            // 紀錄歷史 (移除 location)
            history.unshift({
                time: timeString,
                timestamp: timestamp,
                device: navigator.userAgent
            });
            if (history.length > 50) history.length = 50;

            const newSessionID = generateUUID();
            
            await update(userRef, {
                session: newSessionID,
                lastLogin: timeString,
                device: navigator.userAgent,
                kickCount: finalKickCount,
                loginHistory: history
            });

            localStorage.setItem('currentUser', inputCode);
            localStorage.setItem('currentSession', newSessionID);
            
            isAuthorized = true;

            // 3. 強制重新整理，確保畫面與選單順利載入
            window.location.reload();

        } else {
            alert("授權碼錯誤，請重新輸入。");
        }
    }
}

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
    const localUser = localStorage.getItem('currentUser');
    if (localUser) showContent();

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