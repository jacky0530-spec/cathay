# Cloudflare 測試環境：從零建立（V1.0 開發分支）

**用途：** 在 Cloudflare 建立一組新的測試 D1 與 Worker，不接觸原本的國泰雲端學習站、原有 Firebase 資料或其他 Cloudflare 問卷／CRM 專案。

## 目前只須先做第一步：建立 D1

1. 登入 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 在側邊選單開啟「Storage & Databases（儲存與資料庫）」→「D1 SQL Database」，按 **Create Database（建立資料庫）**。介面分類名稱可能稍有差異。
3. **Name（資料庫名稱）** 填入 `cathay-vip-auth-staging`。請勿選既有的 D1（尤其問卷／客戶管理使用中的資料庫）。
4. Location hint 若有選項，可選 **Asia Pacific（APAC）**；這只是位置偏好，不保證資料駐留區域。
5. 按 **Create**。建立後記下畫面上的 **Database ID（UUID）**，這不是密碼。只需提供資料庫名稱及 ID，不要提供 API Token、Firebase 密碼或任何客戶資料。

## 第二步（取得 D1 ID 後才執行）

- 將本資料夾的 `wrangler.toml.example` 複製成僅本機使用的 `wrangler.toml`，把 `REPLACE_WITH_D1_DATABASE_ID` 換成新 D1 的 UUID。
- 在 Worker 的專屬資料夾（`vip-access/`）使用最新 Wrangler 工具。`wrangler.toml` 不應提交，防止誤用其他專案的資料庫 ID。

```powershell
cd vip-access
npx wrangler login
npx wrangler d1 execute cathay-vip-auth-staging --local --file=./schema.sql
npx wrangler dev
```

這裡的 `--local` 僅影響本機模擬資料庫，**不會**修改遠端 Cloudflare D1。測試成功後、再次確認資料庫名稱與 ID，才可對剛建立的測試 D1 執行：

```powershell
npx wrangler d1 execute cathay-vip-auth-staging --remote --file=./schema.sql
```

**請不要在未確認 DB ID 前執行 `--remote`。** 永遠不對原本問卷／客戶 CRM 的資料庫執行 schema。

## 第三步（Worker 測試部署，尚未執行）

1. 新建獨立 Worker 名稱 `cathay-vip-auth-staging`，與 `wrangler.toml` 一致；D1 binding 必須是 **`DB`**（Worker 程式使用 `env.DB`）。
2. 為該 Worker 設定三個**加密 Secret**：`CODE_PEPPER`、`SESSION_SECRET`（彼此不同、各至少 32 個隨機字元）、`ADMIN_UIDS`（已驗證 Firebase 管理員 UID）。**不要將任何 Secret 值貼進 GitHub、聊天或截圖。**
3. Worker 的一般環境變數 `SITE_ORIGIN` 必須是 `https://jacky0530-spec.github.io`；`FIREBASE_PROJECT_ID` 為 `cathay-app-5889a`。
4. 運用 Wrangler 部署 `npx wrangler deploy`。**注意：**官方文件指出 `wrangler secret put` 本身會建立並發布 Worker 新版本，因此在 Secret 尚未齊全之前，不可將測試 Worker 當正式入口；Worker 缺少必要 Secret 時預設拒絕請求。
5. 先驗證 Worker API、稽核、停權／重啟，不接入正式首頁，亦不匯入正式 VIP 碼。
6. 最後才能把 `manager.mjs` 的 `NOT-DEPLOYED.invalid` 改為經確認的專屬 Worker HTTPS 網址；在此之前管理員畫面維持禁用。

**上線阻擋條件：** 草稿 V1.0 的 `auth.js` 仍強制 Email/Password，不符合使用者「現有 VIP 登入方式不變」的要求。Worker 測試通過也不能直接合併 PR。正式前台必須保留舊 VIP 輸入、經後端驗證，且所有舊授權碼完成安全遷移。

## 實際進度

- [x] 已建立 Worker / D1 schema / 管理頁與合成資料測試程式
- [x] 自動化測試：Firebase 權限與 VIP 授權流
- [ ] 使用者建立獨立 D1 測試資料庫
- [ ] 填入新 D1 ID，建立專屬 Worker
- [ ] 實際 D1 與 Worker 部署及連線驗證
- [ ] 從管理頁加入一位測試使用者並停權
- [ ] 實作真正保留舊 VIP 提示畫面的前端與安全遷移

參考：[Cloudflare D1 建立教學](https://developers.cloudflare.com/d1/get-started/)、[Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Cloudflare D1 Wrangler 指令](https://developers.cloudflare.com/d1/wrangler-commands/)。
