# V1.0 VIP 授權系統：沿用 Firebase 的部署步驟

> 2026-11-17 使用者決定 **不再建立 Cloudflare D1 資料庫**。本方案保留舊業務員的 VIP 授權碼和登入畫面，使用現有 Firebase Realtime Database `cathay-app-5889a`。
>
> **目前僅為 GitHub 開發分支，沒有部署遠端 Worker、沒有修改正式 Firebase Rules、沒有將前台切到新版登入。** 現有舊版授權碼和個人客戶資料維持原狀。

## 系統設計

- 正式網站保持原本 GitHub Pages 網址及 VIP 授權碼輸入流程。
- 透過獨立 Cloudflare Worker 作為**後端驗證服務**；它不保存第二份資料庫。
- Worker 使用 Google 官方 OAuth2 服務帳號授權，透過 HTTPS REST API 讀寫已存在的 Firebase Realtime Database。
- `whitelist` 仍作為既有授權碼的認證來源，`users`、`members` 保留原結構。
- 私有的 `vipAccess/codes/<HMAC>` 保存新增授權碼（不可逆派生鍵，不存明碼）。
- `vipAccess/legacy/<HMAC>` 保存經過驗證、同步的既有 VIP 碼管理狀態，包含啟用及版本號。
- `vipAccess/rate/<IP-HMAC>/<window>` 暫存登入嘗試限制；`vipAccess/audit` 記錄管理操作，不存授權碼。
- 管理員以 Firebase Authentication 登入，Worker 驗證 Firebase JWT 簽章及**即時查詢** `members/<UID>` 的 `active=true`、`role=admin` 才允許新增／停權。
- 只有新前台開始呼叫 Worker 後，停權才會真正阻止舊 VIP 碼登入；切換前舊網站仍照原方式使用白名單。

## 現在只需要第一步：檢查 Firebase 專案

1. 開啟 [Firebase Console](https://console.firebase.google.com/project/cathay-app-5889a/database/cathay-app-5889a-default-rtdb/data)。
2. 確認現有 `Realtime Database` 仍有 `whitelist`、`users`、`members`，**只檢查，不要增刪資料**。
3. 不要更動正式 Realtime Database Rules，因為其他同事目前仍使用舊站登入。
4. 原本已通過的 Firebase 管理員驗證不需重做。

## 下一階段：建立獨立 Worker（暫不要求操作）

1. 在 [Cloudflare Dashboard](https://dash.cloudflare.com/) 建立測試專用 Worker `cathay-vip-firebase-staging`，**不建立任何 D1**。
2. 從 `vip-access/wrangler.toml.example` 複製本機 `vip-access/wrangler.toml`，保持 `main = "firebase-worker/index.mjs"`，且保留已確認的 `SITE_ORIGIN`、`FIREBASE_PROJECT_ID`。
3. 在 Firebase 專案的「Project settings → Service Accounts」產生專門授權給 Worker 的服務帳號私鑰（JSON），並只放在 Cloudflare Worker 的加密 Secret `FIREBASE_SERVICE_ACCOUNT_JSON`。**這是高權限憑證：不得上傳 GitHub、傳到聊天或用截圖顯示，亦不得加入一般環境變數。** 盡量使用權限最小化的專屬服務帳號；評估後續改用無長期金鑰的身分聯邦架構。
4. 將 `CODE_PEPPER`、`SESSION_SECRET` 設定成彼此不同的獨立 32 字元以上密鑰，僅放在 Cloudflare encrypted Secrets。
5. `LEGACY_COMPAT_CODES` 只在明確確認舊站硬編碼通行碼仍有人使用時才短期設定；它們已暴露於公開 JavaScript，應安排汰換。**不要在公開設定檔或此聊天中提供實際值**。
6. 透過 Wrangler `npx wrangler deploy` 部署新的測試 Worker；先跑 `/api/health`，再由管理員測試新授權、原 whitelist 同步、停權及失效工作階段。**HTTP health 成功不代表授權安全測試已通過**。
7. 經確認可信 Worker HTTPS URL 後才把 `manager.mjs` 中的 `NOT-DEPLOYED.invalid` 換成固定網址，管理員登入頁才可操作。

## 完整切換前必須完成

- 不更動業務員原有 VIP 輸入視窗及原首頁網址。
- 將開發分支 `auth.js` 目前不符需求的 Firebase 全員 Email/Password 流程重構為**原 VIP 輸入 UI → Worker 驗證**，並由後端定期確認工作階段有效性，不能只依 `localStorage.currentUser` 放行。
- 核對 `whitelist` 現有啟用碼及舊前端的固定通行碼，測試既有同事能正常登入。
- 確認管理員新建授權碼能用、一般使用者無法冒用管理員、新舊停權效果符合預期，並測試 PWA 快取、手機 LINE 入口及各保費試算。
- 之後才考慮關閉 Firebase `whitelist` 匿名讀取及 `users` 匿名寫入；不要先套用舊 V1.0 的最終規則。
- 保留瀏覽器的 `localStorage.contactRecords` 原狀；依使用者決定不執行備份。未備份時清除站點資料仍可能導致無法復原。

## 已有的程式與測試

- `firebase-worker/index.mjs`：Firebase 版授權碼 API、管理員、登入、停權與既有 whitelist 同步。
- `firebase-worker/database.mjs`：Firebase OAuth2 服務帳號 REST 客戶端、ETag 條件式寫入與限流計數。
- `test/firebase-worker.test.mjs`：用模擬 Firebase 資料庫跑登入、管理員身分、舊資料保留、同步、停用與防暴力猜測。
- `worker/`、`schema.sql`、`test/d1-sqlite.test.mjs`：原先的 D1 備選方案留作程式版本參考，**不再是這次的部署目標**。

## 待驗證的限制

- Firebase Realtime Database Rules 尚未針對 `vipAccess` 新節點發布安全政策；正式對外部署前須驗證未授權客戶端無法直接讀寫該節點。後端服務帳號的 OAuth2 有高權限，故必須保護 Worker Secrets。
- Firebase 服務帳號 OAuth2 與真實 Realtime Database REST API **尚未做遠端實機測試**。
- Firebase REST API ETag 測試目前採本機模擬，不等同遠端併發行為已驗證。
- 既有公開的通用 VIP 碼本身有被冒用的風險，換成私有後端後也無法使它重新變成秘密。
- 目前 Worker 的 IP 限流記錄沒有自動清理，部署前需建立保存期限與清理策略，並評估 Cloudflare Rate Limiting。

官方依據：[Firebase REST 服務帳號 OAuth2](https://firebase.google.com/docs/database/rest/auth)、
[Firebase ETag 條件式請求](https://firebase.google.com/docs/database/rest/save-data)、
[Cloudflare Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。
