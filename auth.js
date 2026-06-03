// --- 1. 立即啟動白屏保護 (防偷看) ---
const antiPeekStyle = document.createElement('style');
antiPeekStyle.id = 'anti-peek-style';
antiPeekStyle.innerHTML = "body { display: none !important; opacity: 0 !important; }";
document.head.appendChild(antiPeekStyle);

function showContent() {
    const style = document.getElementById('anti-peek-style');
    if (style) style.remove();
    // 確保 body 存在才修改樣式，避免當機
    if (document.body) {
        document.body.style.display = ''; 
        document.body.style.opacity = '1';
    }
}

// --- 2. 核心設定 (HTTPS REST API) ---
const FIREBASE_URL = "https://cathay-app-5889a-default-rtdb.firebaseio.com";
const AUTO_LOGOUT_MINUTES = 30; 

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 3. 登出功能 (註冊到全域，確保按鈕點得到) ---
window.doLogout = function(needConfirm = true) {
    if (needConfirm && !confirm("確定要登出系統嗎？")) { return; }
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentSession');
    location.reload(); 
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

// --- 4. 主要流程 (🌟 關鍵修正：等待網頁載入完畢才執行) ---
document.addEventListener("DOMContentLoaded", async function() {
    const localUser = localStorage.getItem('currentUser');
    const localSession = localStorage.getItem('currentSession');

    if (!localUser || !localSession) {
        await performLogin();
    } else {
        showContent();        // 顯示畫面
        setupAutoLogout();    // 啟動閒置偵測
        buildNavigation();    // 產生底部選單
    }
});

async function performLogin() {
    let isAuthorized = false;
    
    while (!isAuthorized) {
        let inputCode = prompt("【安全管制】\n本頁面需要登入才能瀏覽。\n請輸入您的專屬授權碼：");
        
        if (inputCode === null) {
            document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px;'>存取被拒絕，請重新整理網頁。</h2>";
            showContent(); 
            return;
        }
        
        inputCode = inputCode.toUpperCase().trim();

        try {
            const response = await fetch(`${FIREBASE_URL}/whitelist/${inputCode}.json`);
            const isValid = await response.json();

            if (isValid === true) {
                alert("驗證成功！歡迎使用。");
                
                const newSessionID = generateUUID();
                const timeString = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                
                // 寫入登入紀錄 (背景執行)
                fetch(`${FIREBASE_URL}/users/${inputCode}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session: newSessionID,
                        lastLogin: timeString,
                        device: navigator.userAgent
                    })
                });

                localStorage.setItem('currentUser', inputCode);
                localStorage.setItem('currentSession', newSessionID);
                isAuthorized = true;
                
                window.location.reload(); // 重新整理進入正式畫面
            } else {
                alert("授權碼錯誤，請重新輸入。");
            }
        } catch (error) {
            alert("網路異常：無法連線至資料庫，請確認您的網路狀況。");
            showContent();
            return;
        }
    }
}

// --- 5. 底部選單生成器 ---
function buildNavigation() {
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
}