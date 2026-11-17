# Cathay V1.0：VIP 授權碼管理（Firebase 版，尚未部署）

**使用者決定保留目前所有同事的 VIP 授權碼與登入步驟，管理員以 Firebase 管理員帳號新增、停用人員。沿用既有 Firebase Realtime Database，不新增 Cloudflare D1。**

## 本次開發的主路徑
- `firebase-worker/index.mjs`：Cloudflare Worker，後端驗證現有 Firebase `whitelist`、新人私有授權碼、停權、管理員權限及白名單同步；**未部署**。
- `firebase-worker/database.mjs`：透過 Google 服務帳號 OAuth2 授權存取 **現有** Realtime Database；僅在新 `vipAccess` 節點新增授權記錄。
- `manager.html` / `manager.mjs`：管理員操作畫面，未設定可信 Worker 網址前預設停用，避免誤操作。
- `test/firebase-worker.test.mjs`：合成資料模擬測試，不操作真實 Firebase。
- `wrangler.toml.example`：新的 Firebase 版 Worker 範例，**沒有 D1 binding**。
- [部署及驗收教學](SETUP_CLOUDFLARE.md)

## 保持不變的內容
- 原本網址、VIP 授權碼輸入步驟與現有同事登入。
- Realtime Database 既有 `whitelist`、`users`、`members`。
- 原有保費試算、商品頁、客戶本機紀錄 `localStorage.contactRecords`。使用者不要求備份，因此不自動清理或覆蓋本機資料。

## 尚未完成
- 尚未建立或部署 Cloudflare Worker，也沒有取得或設置任何 Firebase 私密金鑰。
- `auth.js` 目前 V1.0 草稿仍會要求全員 Email/Password，與新需求不符，**不可合併 PR**。
- 正式舊站仍以匿名讀 `whitelist`、匿名寫 `users`，並含公開的通用授權碼。須待 Worker 安全整合與所有舊授權碼驗證通過才可停用。
- 新後台停權在正式前台改接 Worker 前**不會影響舊網站登入**。

## 原 D1 備選
`worker/index.mjs`、`worker/crypto.mjs`（共用加密工具）、`schema.sql`、`test/d1-sqlite.test.mjs` 是先前 D1 方案的保留參考。除 `worker/crypto.mjs` 仍為共用套件外，**不使用 D1 DB、不建立 D1、不要再依舊版 D1 指引操作**。
