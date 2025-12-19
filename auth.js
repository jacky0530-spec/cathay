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

// --- 2. 自動產生底部選單 (UI) ---
document.addEventListener("DOMContentLoaded", function() {
    const navHTML = `
    <style>
        body { padding-bottom: 70px; margin: 0; font-family: sans-serif; }
        .bottom-nav {
            position: fixed; bottom: 0; left: 0; width: 100%; height: 60px;
            background: #fff; border-top: 1px solid #ddd;
            display: flex; justify-content: space-around; align-items: center;
            box-shadow: 0 -2px 5px rgba(0,0,0,0.1); z-index: 9999;
        }
        .nav-item {
            text-decoration: none; color: #555; font-size: 14px; text-align: center;
            flex: 1;
        }
        .nav-item span { display: block; font-size: 20px; margin-bottom: 2px; }
        .nav-item.active { color: #00A651; font-weight: bold; }
    </style>
    <div class="bottom-nav">
        <a href="index.html" class="nav-item"><span>🏠</span>首頁</a>
        <a href="page1.html" class="nav-item"><span>📊</span>報表</a>
        <a href="#" class="nav-item" onclick="alert('聯絡客服：0912-345-678')"><span>📞</span>客服</a>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', navHTML);
});