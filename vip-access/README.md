# VIP 舊登入保留＋管理員新增人員：開發與部署指引

> **2026-11-17：目前僅在 feature/V1.0 草稿分支，未部署 Worker、D1，未改動 main／正式 Firebase Rules；不能當成正式可用功能。**

## 已建立的內容
- \`worker/crypto.mjs\`：VIP 碼規格化與 HMAC 派生碼、30 分鐘簽章工作階段、Firebase JWT RS256 簽章與 issuer/audience/exp 檢查。
- \`worker/index.mjs\`：Cloudflare Worker API，驗證 VIP 碼、登入工作階段、管理員新增／匯入／停權／啟用、稽核記錄、限制登入嘗試；CORS 僅允許指定 GitHub Pages 來源。
- \`schema.sql\`：Cloudflare D1 資料庫結構。只保存 HMAC 授權碼雜湊、末四碼、啟用狀態，不存原碼。
- \`manager.html\`／\`manager.mjs\`：開發中的管理員介面，採 Firebase 管理員 email/password 登入（僅管理員需要），**預設 API URL 是 invalid，登入與授權按鈕停用**。
- \`test/worker.test.mjs\`：只用合成測試資料與模擬 D1，驗證新增、登入、停權、停權後舊工作階段不可再使用、非法管理員拒絕與流量限制。

## 使用者既定操作不變
- 既有業務員：同樣的網址、同一個 VIP 授權碼提示。正式前端還沒改成呼叫 Worker，因此目前舊網站會繼續以原方式驗證。
- 新人：未來由管理員在管理頁新增、由 Worker 產生專屬 VIP 碼並私下傳給本人。
- 現有個人資料仍由原網域與瀏覽器中的 \`localStorage.contactRecords\` 存放；不清除、不搬移、不匯入，依使用者指示**不執行備份**。

## 部署前準備（現在不操作）
1. 在 Cloudflare 建立獨立測試 Worker 和 D1，暫不修改正式站或 Firebase。
2. 在 \`vip-access\` 資料夾使用範例 \`wrangler.toml.example\` 製作 \`wrangler.toml\`；完成 D1 綁定並填入建立後顯示的 \`database_id\`。
3. 對**獨立測試 D1**執行 \`schema.sql\`，不得對其他專案已在用的資料庫執行。
4. 透過 \`wrangler secret put\` 設定三個獨立秘密：
   - \`CODE_PEPPER\`：隨機且穩定的高熵字串至少 32 字元，改掉會令先前所有 VIP 碼無法比對。
   - \`SESSION_SECRET\`：另一組獨立 32+ 字元隨機字串，輪替會使原工作階段失效。
   - \`ADMIN_UIDS\`：已完成 Firebase V3 登入驗證的管理員 UID，逗號分隔，多管理員需要明確另行授權；不從前端角色或已登入 Email 直接推測。
5. 部署測試 Worker。透過 \`/api/health\` 可確認 Worker 服務存在，但**不能**證明使用者授權或安全遷移完成。
6. 確認 API origin 後，把 \`manager.mjs\` 裡的 \`https://NOT-DEPLOYED.invalid\` 換成核驗後的固定 HTTPS Worker origin。不得讓使用者在登入頁自行指定任意 URL，避免將 Firebase ID Token 發送給未授權網站。
7. 管理員測試新增一組**測試用** VIP 碼，使用 \`POST /api/v1/login\` 驗證、呼叫 \`GET /api/v1/session\` 確認短效授權，停用後測試舊 token 被拒絕；不可使用正式客戶資料。
8. 逐一清點現行 Firebase \`whitelist\` 的所有有效授權碼，另包括舊前端內硬編碼、並非 whitelist 登錄的共用碼。在受保護管理介面匯入時不改動既有碼。**已公開或過短的共用碼即使搬到 Worker 仍容易遭冒用，安全上必須另設停用／替換計畫**；不能宣稱舊碼全部保密。
9. 最後才改新版前端的 VIP 查詢路徑，不更動畫面／輸入步驟，但每次受保護功能要由 Worker 驗證工作階段。確認所有現有使用者能登入，正式改掉 Firebase \`whitelist\` 匿名讀取及 \`users\` 匿名寫入。
10. 未完成第 8、9 項前，禁止正式 V1.0 PR 合併，也不得提前將 \`firebase.database.rules.json\` 直接發布到原資料庫。

## API 契約（未部署）
| 方法 | 路徑 | 權限 | 用途 |
|---|---|---|---|
| GET | \`/api/health\` | 來源限制 | 測試服務存在 |
| POST | \`/api/v1/login\` | VIP 碼、IP 節流 | 回傳 30 分鐘簽章工作階段 |
| GET | \`/api/v1/session\` | VIP bearer 工作階段 | 每次重新驗證啟用及版本，可立即停權 |
| GET | \`/api/admin/vip\` | Firebase JWT + Worker 管理員 UID 白名單 | 查人員狀態、僅顯示尾碼 |
| POST | \`/api/admin/vip\` | 同上 | 新增或匯入舊 VIP 碼，僅本次回傳完整碼 |
| POST | \`/api/admin/vip/<UUID>/status\` | 同上 | 啟用或停用；每次改變令舊 session 失效 |
| GET | \`/api/admin/audit\` | 同上 | 管理操作稽核（不記錄授權碼） |

## 尚未完成／限制
- **沒有真實 Cloudflare Worker／D1 部署或實機連線測試**；目前測試採模擬 D1，只覆蓋重要流程。
- **前台正式 VIP 登入尚未接到 Worker**；草稿 V1.0 \`auth.js\` 目前仍採 Email/Password 全員登入，不符合最新需求，尚不可合併。
- Worker 管理員身分目前依 Firebase JWT 簽章 + \`ADMIN_UIDS\` 後端白名單雙重檢查；變更 Firebase Realtime Database \`members/<UID>/active\` 不會自動撤銷 Worker \`ADMIN_UIDS\`，停用管理員應同步移除 Worker 白名單或日後補強會員狀態檢查。
- Firebase ID Token 是短效憑證；驗證簽章本身不等於立即檢測 Firebase Auth 撤銷狀態。部署前應安排帳號停權及管理員密鑰輪替應變。
- Session bearer 暫時設計存於瀏覽器同分頁 sessionStorage，不能跨網域讀取、不代表 HttpOnly cookie；完整切換時仍須檢查 XSS、防盜用與 PWA 行為。
- Worker D1 的 IP 嘗試計數不是完整 DDoS 防護，未來需要 Cloudflare Rate Limiting／Turnstile 等外層保護，以及登入安全稽核。
- D1 授權紀錄、稽核資料與節流紀錄需規劃保存及刪除期限，不應無限保留。

## 參考
- https://developers.cloudflare.com/d1/worker-api/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- https://firebase.google.com/docs/auth/admin/verify-id-tokens
