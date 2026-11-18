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

        // 🌟 關鍵修改：加入本地無敵密碼，不怕 Firebase 阻擋
        const localCodes = { 
            "VIP888": true, 
            "CATHAY2025": true 
        };

        try {
            let isValid = false;

            // 1. 先檢查是不是無敵密碼
            if (localCodes[inputCode]) {
                isValid = true;
            } 
            // 2. 如果不是，才去問 Firebase 資料庫
            else {
                const response = await fetch(`${FIREBASE_URL}/whitelist/${inputCode}.json`);
                const data = await response.json();
                if (data === true) isValid = true;
            }

            // --- 驗證成功的後續動作 ---
            if (isValid) {
                alert("驗證成功！歡迎使用。");
                
                const newSessionID = generateUUID();
                const timeString = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
                
                // 寫入登入紀錄 (背景執行，出錯也不影響登入)
                fetch(`${FIREBASE_URL}/users/${inputCode}.json`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session: newSessionID,
                        lastLogin: timeString,
                        device: navigator.userAgent
                    })
                }).catch(e => console.log("寫入紀錄失敗，但允許登入"));

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
// --- 5. 響應式全站導覽（不變動驗證流程） ---
function buildNavigation() {
    if (document.querySelector('.site-nav')) return;
    const page = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const activeSection = page === 'index.html' ? 'home'
        : page === 'client.html' ? 'client'
        : (page === 'calc.html' || page.startsWith('calc_')) ? 'calc'
        : (page === 'products.html' || page.startsWith('prod_')) ? 'products'
        : page === 'photos.html' ? 'photos'
        : (page === 'event.html' || page.startsWith('event_')) ? 'event'
        : '';
    const items = [
        ['home', 'index.html', '🏠', '首頁'],
        ['client', 'client.html', '👥', '客戶'],
        ['calc', 'calc.html', '🧮', '試算'],
        ['products', 'products.html', '🛡️', '商品'],
        ['photos', 'photos.html', '🖼️', '照片'],
        ['event', 'event.html', '🏆', '高峰會']
    ];
    const markup = items.map(([key, href, emoji, label]) =>
        '<a href="' + href + '" class="site-nav-link' + (activeSection === key ? ' is-active' : '') +
        '"' + (activeSection === key ? ' aria-current="page"' : '') + '>' +
        '<span class="site-nav-icon" aria-hidden="true">' + emoji + '</span>' +
        '<span class="site-nav-label">' + label + '</span></a>'
    ).join('');
    const navHtml = '<nav class="site-nav" aria-label="主要功能導覽">' +
        '<div class="site-nav-inner"><div class="site-nav-brand"><span class="site-nav-brand-icon" aria-hidden="true">🍀</span><span>國泰雲端學習站</span></div>' +
        '<div class="site-nav-links">' + markup + '</div></div></nav>';
    const style = document.createElement('style');
    style.id = 'site-navigation-theme';
    style.textContent = "\n.site-nav-ready { padding-bottom: calc(86px + env(safe-area-inset-bottom)) !important; }\n.site-nav {position:fixed;bottom:0;left:0;right:0;z-index:9999;background:rgba(255,255,255,.97);border-top:1px solid #d9e8de;box-shadow:0 -6px 24px rgba(13,64,39,.09);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"Microsoft JhengHei\",sans-serif}\n.site-nav-inner{display:flex;align-items:center;justify-content:center;width:100%;max-width:1180px;margin:0 auto}\n.site-nav-brand{display:none}\n.site-nav-links{display:flex;align-items:stretch;justify-content:space-between;gap:2px;width:100%;min-height:65px;padding:4px 5px calc(4px + env(safe-area-inset-bottom))}\n.site-nav-link{display:flex;flex:1 1 0;min-width:0;min-height:55px;flex-direction:column;justify-content:center;align-items:center;gap:3px;padding:5px 3px;border-radius:12px;text-decoration:none;font-weight:650;color:#6a7b70;transition:background .18s,color .18s;-webkit-tap-highlight-color:transparent}\n.site-nav-icon{font-size:21px;line-height:1.2}\n.site-nav-label{font-size:11.5px;line-height:1.3;white-space:nowrap}\n.site-nav-link.is-active{background:#e7f5ec;color:#087b48}\n.site-nav-link:hover{color:#07693e;background:#f0f8f3}\n.site-nav-link:focus-visible{outline:3px solid #e4ad4f;outline-offset:-3px}\n@media (min-width:600px) and (max-width:1023px) {\n.site-nav-ready{padding-bottom:110px !important}\n.site-nav{bottom:14px;left:50%;right:auto;transform:translateX(-50%);width:min(94vw,720px);border:1px solid #d9e8de;border-radius:22px;overflow:hidden;box-shadow:0 12px 35px rgba(19,75,48,.18)}\n.site-nav-links{padding:7px;min-height:72px;gap:7px}\n.site-nav-link{min-height:57px;flex-direction:row;gap:9px}\n.site-nav-label{font-size:14px}\n}\n@media (min-width:1024px) {\n.site-nav-ready{padding-top:92px !important;padding-bottom:24px !important}\n.site-nav{top:0;bottom:auto;box-shadow:0 5px 25px rgba(15,73,44,.07);border-top:0;border-bottom:1px solid #dce9e0}\n.site-nav-inner{padding:11px 26px;justify-content:space-between;gap:30px}\n.site-nav-brand{display:flex;flex:0 0 auto;align-items:center;gap:10px;color:#0b7044;font-weight:780;font-size:16px;white-space:nowrap}\n.site-nav-brand-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#e9f7ed}\n.site-nav-links{width:auto;min-height:0;padding:0;gap:7px}\n.site-nav-link{flex:0 0 auto;flex-direction:row;gap:8px;min-height:46px;padding:9px 17px;border-radius:11px}\n.site-nav-icon{font-size:18px}\n.site-nav-label{font-size:14px}\n}\n@media(prefers-reduced-motion:reduce){.site-nav-link{transition:none}}\n";
    document.head.appendChild(style);
    document.body.insertAdjacentHTML('beforeend', navHtml);
    document.body.classList.add('site-nav-ready');
}
