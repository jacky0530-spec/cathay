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

function ensureHubUsageTracker() {
    const page = location.pathname.split('/').pop()?.replace(/\.html$/, '');
    if (!/^(products|prod_[a-z_]+|calc(?:_[a-z_]+)?)$/.test(page || '')) return;
    import('./hub-usage.mjs?v=20261122-4').catch(error => {
        try {
            localStorage.setItem('hubUsageTrackerStatus', 'load-error:' + String(error?.message || error));
            localStorage.setItem('hubUsageTrackerStatusAt', String(Date.now()));
        } catch (_) {}
        console.warn('網站使用追蹤模組載入失敗', error);
    });
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
        ensureHubUsageTracker(); // 主動載入最新版使用追蹤
    }
});

function ensureLoginStyles() {
    if (document.getElementById('auth-login-theme')) return;
    const style = document.createElement('style');
    style.id = 'auth-login-theme';
    style.textContent = `
.auth-login-screen{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px;background:linear-gradient(145deg,#eef8f2 0%,#f8fbf9 48%,#eef4f0 100%);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif;color:#17392a}
.auth-login-card{width:min(100%,430px);background:#fff;border:1px solid #dce9e1;border-radius:24px;box-shadow:0 22px 60px rgba(14,74,44,.15);padding:30px}
.auth-login-brand{display:flex;align-items:center;gap:12px;margin-bottom:22px}
.auth-login-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:15px;background:#e8f7ed;font-size:23px}
.auth-login-title{font-size:22px;font-weight:800;letter-spacing:.02em;color:#0b7044}
.auth-login-subtitle{font-size:13px;color:#718078;margin-top:3px}
.auth-login-heading{font-size:18px;font-weight:750;margin:0 0 8px}
.auth-login-help{font-size:14px;line-height:1.65;color:#65756c;margin:0 0 20px}
.auth-login-label{display:block;font-size:13px;font-weight:700;margin:0 0 7px}
.auth-login-field{position:relative}
.auth-login-input{box-sizing:border-box;width:100%;height:52px;border:1.5px solid #cbdcd2;border-radius:13px;background:#fff;padding:0 48px 0 15px;font-size:17px;color:#17392a;outline:none;transition:border-color .18s,box-shadow .18s}
.auth-login-input:focus{border-color:#15945d;box-shadow:0 0 0 4px rgba(21,148,93,.12)}
.auth-login-toggle{position:absolute;right:7px;top:7px;width:39px;height:38px;border:0;border-radius:9px;background:transparent;color:#65756c;font-size:17px;cursor:pointer}
.auth-login-status{min-height:23px;margin-top:9px;font-size:13px;line-height:1.5;color:#bf3b35}
.auth-login-status.is-ok{color:#087b48}
.auth-login-button{width:100%;height:50px;border:0;border-radius:13px;background:#0b7a49;color:#fff;font-size:16px;font-weight:750;cursor:pointer;margin-top:8px;box-shadow:0 8px 20px rgba(11,122,73,.18)}
.auth-login-button:disabled{opacity:.58;cursor:wait}
.auth-login-note{margin:15px 0 0;text-align:center;color:#89958f;font-size:12px}
@media(max-width:520px){.auth-login-screen{padding:16px}.auth-login-card{padding:24px 20px;border-radius:20px}}
@media(prefers-reduced-motion:reduce){.auth-login-input{transition:none}}
`;
    document.head.appendChild(style);
}

function renderLoginScreen() {
    ensureLoginStyles();
    let screen = document.getElementById('auth-login-screen');
    if (screen) return screen;

    screen = document.createElement('div');
    screen.id = 'auth-login-screen';
    screen.className = 'auth-login-screen';
    screen.setAttribute('role', 'dialog');
    screen.setAttribute('aria-modal', 'true');
    screen.setAttribute('aria-labelledby', 'auth-login-heading');
    screen.innerHTML = `
      <form class="auth-login-card" id="auth-login-form" novalidate>
        <div class="auth-login-brand">
          <div class="auth-login-icon" aria-hidden="true">🔐</div>
          <div>
            <div class="auth-login-title">安全管制</div>
            <div class="auth-login-subtitle">國泰雲端學習站</div>
          </div>
        </div>
        <h1 class="auth-login-heading" id="auth-login-heading">登入後才能瀏覽</h1>
        <p class="auth-login-help">請輸入您的密碼／專屬授權碼。驗證成功後，本裝置會保留登入狀態；閒置 30 分鐘會自動登出。</p>
        <label class="auth-login-label" for="auth-login-code">密碼</label>
        <div class="auth-login-field">
          <input id="auth-login-code" class="auth-login-input" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" enterkeyhint="go" required aria-describedby="auth-login-status">
          <button class="auth-login-toggle" id="auth-login-toggle" type="button" aria-label="顯示密碼" title="顯示／隱藏密碼">👁</button>
        </div>
        <div class="auth-login-status" id="auth-login-status" role="status" aria-live="polite"></div>
        <button class="auth-login-button" id="auth-login-submit" type="submit">登入</button>
        <p class="auth-login-note">僅限授權人員使用</p>
      </form>
    `;
    document.body.appendChild(screen);
    document.body.style.overflow = 'hidden';
    showContent();

    const input = screen.querySelector('#auth-login-code');
    const toggle = screen.querySelector('#auth-login-toggle');
    toggle.addEventListener('click', () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        toggle.setAttribute('aria-label', show ? '隱藏密碼' : '顯示密碼');
        toggle.textContent = show ? '🙈' : '👁';
        input.focus();
    });
    setTimeout(() => input.focus(), 80);
    return screen;
}

async function performLogin() {
    const screen = renderLoginScreen();
    const form = screen.querySelector('#auth-login-form');
    const input = screen.querySelector('#auth-login-code');
    const status = screen.querySelector('#auth-login-status');
    const submit = screen.querySelector('#auth-login-submit');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submit.disabled) return;

        const inputCode = input.value.toUpperCase().trim();
        if (!inputCode) {
            status.className = 'auth-login-status';
            status.textContent = '請輸入密碼。';
            input.focus();
            return;
        }

        submit.disabled = true;
        submit.textContent = '驗證中…';
        status.className = 'auth-login-status';
        status.textContent = '';

        // 保留既有本機授權碼相容性。
        const localCodes = {
            "VIP888": true,
            "CATHAY2025": true
        };

        try {
            let isValid = Boolean(localCodes[inputCode]);

            if (!isValid) {
                const response = await fetch(`${FIREBASE_URL}/whitelist/${encodeURIComponent(inputCode)}.json`, { cache: 'no-store' });
                if (!response.ok) throw new Error('AUTH_LOOKUP_FAILED');
                const data = await response.json();
                isValid = data === true;
            }

            if (!isValid) {
                status.className = 'auth-login-status';
                status.textContent = '密碼錯誤，請重新輸入。';
                input.value = '';
                input.focus();
                return;
            }

            const newSessionID = generateUUID();
            const timeString = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

            fetch(`${FIREBASE_URL}/users/${encodeURIComponent(inputCode)}.json`, {
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
            status.className = 'auth-login-status is-ok';
            status.textContent = '驗證成功，正在進入…';
            submit.textContent = '登入成功';
            setTimeout(() => window.location.reload(), 250);
        } catch (error) {
            status.className = 'auth-login-status';
            status.textContent = '目前無法連線驗證，請確認網路後再試。';
            console.error('Login verification failed', error);
        } finally {
            if (!localStorage.getItem('currentSession')) {
                submit.disabled = false;
                submit.textContent = '登入';
            }
        }
    }, { once: false });
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
