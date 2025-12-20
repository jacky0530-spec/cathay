// --- 1. 驗證邏輯 ---
(function() {
    // 檢查是否已驗證
    if (localStorage.getItem('isVIP') !== 'true') {
        // 設定您的授權碼清單
        const validCodes = { 
            "VIP888": true, 
            "CATHAY2025": true 
        };
        
        let isSuccess = false;
        while (!isSuccess) {
            const input = prompt("【安全管制】\n本應用程式僅限授權人員使用。\n請輸入您的授權碼：");
            
            if (input === null) {
                document.body.innerHTML = "<h2 style='text-align:center;margin-top:50px;'>存取被拒絕</h2>";
                throw new Error("User cancelled"); // 停止執行
            }
            
            if (validCodes[input]) {
                alert("驗證成功！歡迎使用。");
                localStorage.setItem('isVIP', 'true');
                isSuccess = true;
            } else {
                alert("授權碼錯誤，請重新輸入。");
            }
        }
    }
})();



// ... (上半部驗證代碼不變) ...

// --- 2. 自動產生底部選單 (分類版) ---
document.addEventListener("DOMContentLoaded", function() {
    const path = window.location.pathname;
    const page = path.split("/").pop() || "index.html";

    const navHTML = `
    <style>
        body { padding-bottom: 70px; margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f4f4f4; }
        .bottom-nav {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
            background: #ffffff; border-top: 1px solid #e0e0e0;
            display: flex; justify-content: space-around; align-items: center;
            box-shadow: 0 -2px 10px rgba(0,0,0,0.05); z-index: 9999;
        }
        .nav-item {
            text-decoration: none; color: #999; text-align: center;
            flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
            padding: 5px 0;
        }
        .nav-item span { font-size: 20px; margin-bottom: 2px; display: block; }
        .nav-item div { font-size: 11px; } 
        .nav-item.active { color: #00A651; font-weight: bold; }
    </style>

    <div class="bottom-nav">
        <a href="index.html" class="nav-item ${page === 'index.html' ? 'active' : ''}">
            <span>🏠</span><div>首頁</div>
        </a>

        <a href="client.html" class="nav-item ${page === 'client.html' ? 'active' : ''}">
            <span>👥</span><div>客戶</div>
        </a>

        <a href="calc.html" class="nav-item ${page === 'calc.html' ? 'active' : ''}">
            <span>🧮</span><div>勞保</div>
        </a>

        <a href="products.html" class="nav-item ${page === 'products.html' ? 'active' : ''}">
            <span>🏥</span><div>商品</div>
        </a>

        <a href="event.html" class="nav-item ${page === 'event.html' ? 'active' : ''}">
            <span>🏆</span><div>高峰會</div>
        </a>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);
});