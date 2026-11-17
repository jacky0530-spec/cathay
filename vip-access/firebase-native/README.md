# Firebase 原生 VIP 授權後端（尚未部署）

**不使用 Cloudflare，也不建立 D1。**

目前 V1.0 草稿以 Firebase **Cloud Functions（2nd gen）**、**Authentication**、**Realtime Database** 實作後端原型；主站仍用原本的 GitHub Pages 網址與 VIP 登入畫面。所有程式只在 GitHub 開發分支，未連接正式服務。

## Firebase 計費
依 Firebase 官方文件，**部署 Cloud Functions 需要 Blaze（按用量付費）**。即使有免費使用額度，仍可能產生費用。此原型**尚未獲得使用者同意啟用 Blaze 或付費**，所以不部署、不要求建立付款帳戶，也不要求安裝任何額外後端平台。

## 已寫的程式
- `functions/core.js`：VIP 授權碼規格化、使用伺服器端 Secret 計算不可逆 HMAC、產生新代碼、判斷管理角色。
- `functions/index.js`：Callable Functions，管理員新增／停用／重啟授權、同步現有白名單、VIP 登入驗證、核發 Firebase Custom Token。
- `functions/core.test.js`：Node.js 離線測試，不使用實際帳號、資料或金鑰。
- `firebase.json`：隔離的 codebase `vipAuth`，不含正式 Database Rules 配置。
- `vip-access.rules.preview.json`：**僅示意新節點的 Rules，非完整正式 Rules，不能單獨發布。**

## 正式切換前不可略過
1. 取得使用者對 Blaze 與費用風險的明確同意。
2. 在 Firebase CLI 以專屬 Secret `CATHAY_VIP_PEPPER` 安全保存伺服器金鑰；不得將值放入 GitHub、客戶端 JavaScript、對話或截圖。
3. 管理員核對原有 `whitelist` 及硬編碼共用碼，確認哪些還有人使用。共用碼已公開，安全上需要安排替換。
4. 重寫 V1.0 `auth.js` 使用原 VIP 輸入視窗→`httpsCallable('vipAuthenticate')`→`signInWithCustomToken`；管理後台改用已驗證成功的 Firebase 管理員登入。
5. 合併測試過的新 Rules，讓停用的 `vip_<HMAC>` 即使已有登入憑證也不能讀取受保護的資料；原白名單不能提前停用。
6. 在 Firebase Emulator 測試停權、一般人不能操作管理台、速率限制、多裝置、舊同事與新同事登入、原有試算以及本機 CRM 不受影響。
7. 最後才逐步切換正式 GitHub Pages；不得直接合併本分支舊的全員 Email 登入版本。

官方文件：
- https://firebase.google.com/docs/functions/manage-functions
- https://firebase.google.com/docs/functions/config-env
- https://firebase.google.com/docs/auth/admin/create-custom-tokens
- https://firebase.google.com/docs/database/security/rules-conditions
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
