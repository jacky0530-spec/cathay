# 版本更新紀錄

## VIP 管理後台 v0.1.1 停用／啟用修正 — 2026-11-17（已選擇性發布 main）
- 修正 Firebase Realtime Database `runTransaction()` 在單筆授權沒有本機快取時先得到 `null` 而取消停權／復權。
- 新流程先讀取白名單最新布林狀態，僅在與畫面狀態一致時交易；交易後再次讀取確認，避免誤顯示成功。
- 新增回歸測試：初次空快取、停用／復權、畫面狀態過期和非法狀態。
- `main` 只更新獨立 `vip-admin-spark.html`、`vip-admin-spark.js`、新增 `vip-admin-spark-toggle.mjs`；版本升為 0.1.1，使用新的 JS 查詢版本以避開舊快取。
- 未修改 Firebase Rules、白名單實際資料、舊 `auth.js`、首頁、客戶資料及保費試算。
- GitHub Actions 模擬與靜態驗證通過，**但仍需要使用者在真正 Firebase 管理後台測試停用效果**。

## V1.0 Firebase Spark 現行規則截圖核對 — 2026-11-17（尚未發布）
- 核對使用者提供的 Firebase Rules 截圖，確認 `whitelist` 匿名讀／禁寫、`users` 匿名寫／禁讀、`members/$uid` 自己可讀／禁寫。
- 候選版完全保留這三組既有規則；僅新增管理員逐筆修改白名單與私有 `vipProfiles`。
- 新增截圖對照和 Firebase Rules 模擬工具的具體測試步驟；禁止直接覆蓋未知現行規則。
- 對 Firebase Rules、GitHub Pages 正式站、客戶 CRM 未做任何發布或資料改動。

## V1.0 Spark 免費授權後台（開發未部署）— 2026-11-17
- **最新決定：只用 GitHub Pages＋現有 Firebase Spark 免費方案；不使用 Cloudflare、D1、Blaze 或 Cloud Functions**。
- 建立獨立 `vip-access/spark/manager.html`／`manager.mjs`，管理員使用 Firebase Authentication 登入、新增隨機 VIP 碼、停用與重新啟用、管理識別標籤。
- 新增 `firebase.spark-admin.rules.candidate.json`；僅管理員可以修改單筆 `whitelist` 布林值和私有 `vipProfiles`，舊匿名白名單讀取與登入紀錄寫入仍保留。
- 新增 Firebase Emulator 權限測試，覆蓋匿名讀寫、一般帳號、已停權管理員、管理員新增／停用、私有標籤與禁止整份白名單覆寫。
- 刪除先前不適用 Spark 的 Cloud Functions 原型與部署檔；保留 Git 版本記錄供歷史參考。
- 正式網站與 Firebase Rules 尚未發布任何修改；公開白名單、硬編碼共用通行碼與舊匿名寫入均尚未消除，不能宣稱已完成全面安全改善。

## V1.0 不使用 Cloudflare：改為 Firebase 原生服務 — 2026-11-17（草稿）
- 使用者明確要求完全不要 Cloudflare；**停止 Cloudflare Worker、D1、Wrangler 部署流程**，已由開發分支移除相關使用中的檔案。
- 採 GitHub Pages＋現有 Firebase Authentication、Realtime Database＋Cloud Functions for Firebase；保留 VIP 授權碼及同事原本登入步驟。
- 新增 Firebase callable Functions 原型，驗證 VIP 授權碼、發行 Firebase Custom Token、管理員新增／停用／同步舊白名單及登入節流；新增合成資料單元測試。
- Firebase Cloud Functions 部署需要 Blaze 計費方案；尚未取得使用者計費同意，**不部署、不升級**，不建立其他後端平台或資料庫。
- 不修改 `main`、正式 Firebase Rules、原白名單、`users`、`members`、試算內容與本機 `contactRecords`。
- 原本 D1／Worker 的歷史方案在 Git 提交記錄中可追溯，但不再包含於目前部署草稿中。

## V1.0 GitHub → Cloudflare Worker 測試部署設定（開發分支）— 2026-11-17
- 新增受版控的公開 `vip-access/wrangler.toml`，對應獨立測試 Worker `cathay-vip-firebase-staging` 與既有 Firebase（**無 D1 binding**）。
- Cloudflare Git Builds 設定說明指定 `feature/v1-structure-security` 分支與 `vip-access` Root directory，避免意外從 `main` 部署錯誤程式。
- 測試 Worker 未設定後端 Secrets 前預設拒絕授權請求，不能誤當作正式登入；不會觸及原網站、資料庫 Rules 或本機客戶資料。
- Cloudflare Worker 尚未確認實際部署成功，不能宣稱 V1.0 已上線。

## V1.0 Firebase 授權後端 — 2026-11-17（開發未部署）
- 改為沿用正式 `cathay-app-5889a` Realtime Database，不新增 Cloudflare D1。
- 建立獨立 Cloudflare Worker 連接現有 Firebase REST API，以 Google 服務帳號 OAuth2 後端授權。
- 新授權儲存於 `vipAccess` 私有節點，保留原有 `whitelist`、`users`、`members`。
- 管理員操作使用 Firebase Authentication JWT 及即時 `members/UID` 權限檢查，可新增、停用、重新啟用、同步既有白名單。
- ETag 條件式更新防止授權狀態衝突，登入工作階段提供短效與停用後失效機制。
- 新版管理頁增加「同步原有 VIP 白名單」以及舊站停權尚不生效的警示。
- 原 D1 Worker 保留為備選，正式 Firebase Rules、GitHub Pages 與客戶本機資料未變更。
- Firebase Worker 尚未遠端實機部署，新前台 `auth.js` 尚未完成保留 VIP 輸入的整合；PR 不能合併。

## V1.0 D1 SQL 實測與部署準備 — 2026-11-17（開發草稿）
- 新增 SQLite 真實 SQL 斷言，測試 Worker 的資料表結構、VIP 授權查詢與停權、IP 限流等。
- 加入 GitHub Actions 回歸測試，不以純模擬 D1 測試結果冒充正式 Cloudflare 測試。
- 新增 Cloudflare D1／Worker 獨立測試環境建立說明；尚未建立任何遠端資源。
- 原有 GitHub Pages、Firebase 會員資料及 VIP 登入不變。

## V1.0 VIP 管理員授權模組（開發未上線）— 2026-11-17
- 在 `vip-access/` 建立獨立 Cloudflare Worker + D1 schema 與部署範例；不存 VIP 明文，雜湊用 HMAC 伺服器端秘密。
- 實作 VIP 驗證、30 分鐘簽章工作階段、登入嘗試限流、帳號停用後即時撤銷已發出的工作階段。
- 實作 Firebase 管理員 JWT 驗證與獨立管理員 UID 白名單、管理員新增／匯入／停用／啟用及稽核 API。
- 新增管理員操作頁：登入、授權名單、新增新人、匯入原 VIP 碼、停權／重啟。頁面預設停用直到可信 Worker origin 設定完成。
- 加入 GitHub Actions 合成資料測試；正式 Cloudflare／Firebase Rules／舊網站均未改動。
- 尚未將正式 VIP 登入接到 Worker；**目前不得合併 V1.0**。

## V1.0 需求調整：保留 VIP 登入＋管理者新增帳號 — 2026-11-17
- 保留現有全部 VIP 授權碼與使用者輸入步驟；不強制既有業務員更換 Email/Password。
- 管理員應能於專屬後台新增、停用、啟用新人帳號；一般使用者不可自行授權。
- 現有 Firebase 電子郵件強制登入的 V1.0 草稿不符合新需求，**暫停直接合併**；先設計具伺服器端驗證的相容登入。
- 舊站目前授權碼公開讀取、使用者紀錄公開寫入、前端硬編碼通用碼，不能只加管理畫面就當成安全上線。
- 正式 Firebase 及 GitHub Pages 既有用戶登入保持不變；不備份、搬移或清除本機客戶資料。

## V1.0 新舊系統相容規則準備 — 2026-11-17（草稿）
- 使用者已實機確認 Firebase 個人管理員登入、members/UID 讀取以及舊正式網站功能正常。
- 新增 `firebase.transition.rules.json`，為新舊站並行期間保留既有登入路徑、開放 V1 管理員安全讀取。
- Firebase Emulator 新增舊白名單／匿名登入紀錄相容性、管理員讀取、停權、跨帳號阻擋測試。
- 過渡規則**尚未部署**；它保留舊 `whitelist` 公開讀、`users` 公開寫，最終切換時必須撤除。
- 不執行客戶資料備份、不覆蓋本機 contactRecords、不更動保險試算公式。

## V1.0 Firebase 動態權限撤銷 — 2026-11-17（草稿）
- 初次登入僅接受 Firebase active user/admin 角色，登入後持續監測 `members/<UID>`。
- 帳號停用、角色變更或會員監控權限失效時立即遮蔽並登出；不清除瀏覽器 `contactRecords`。
- Firebase Emulator 新增停用帳號、管理員降權後的資料庫拒絕測試，並加入靜態檢查。
- 依使用者決定，**不將客戶資料備份設為本次上線必須步驟**；原備份功能留存但不主動操作。
- 正式 Firebase 尚未連接或部署，主系統繼續維持舊版。

## V1.0 下載檔完整性驗證 — 2026-11-17（草稿）
- 在正式 main 新增 `backup-verify.html`：純本機 JSON 欄位及筆數檢驗、SHA-256 雜湊，沒有資料上傳。
- 正式暫行 `backup-export.html` 新增驗證入口，不修改原客戶資料匯出程式。
- V1.0 草稿整合驗證頁、遷移文件與測試；備份頁依然需 Firebase 登入才能讀取本機 contactRecords。
- 以上變動不等於正式 Firebase 安全規則已部署或 V1.0 已上線。

## V1.0 客戶資料匯入與 PWA 安全補強 — 2026-11-17（開發草稿）
- CSV 匯入改為完整引號欄位解析、先驗證後去重合併，避免逗號、雙引號、換行造成欄位錯位或重複建立。
- CSV 匯出採標準引號包覆，保留原始欄位文字，並降低 Excel 公式注入風險。**JSON 仍為完整資料備份主格式**。
- Service Worker 僅快取圖示、共用 CSS 等公開靜態素材；登入 JS、HTML 頁面全部強制走網路，不使用離線快取回退。
- GitHub Actions 增加 CSV 格式、重複匯入與 PWA 快取安全回歸檢查。
- 本版尚未正式上線，資料來源與法規數值待驗證。

## V1.0 客戶資料回歸測試 — 2026-11-17（開發草稿）
- 客戶管理、管理員監控加入同步預隱藏樣式，通過 Firebase 登入後才顯示畫面；不宣稱可保護公開靜態原始碼。
- 新增 `scripts/test-client-merge.mjs`，以合成測試資料檢查：重複匯入去重、同 ID 不同內容另建紀錄、原資料保持不變、無效備份拒絕。
- CI 工作流程加入客戶資料合併測試，以降低升級過程中誤覆蓋既有資料的風險。
- 未更動保險商品的公式、費率或正式客戶資料。

## V1.0 管理監控相容性修正 — 2026-11-17（草稿）
- 修正舊管理報表以 `session` 字串判斷在線，導致新版 Firebase 登入一律顯示離線的問題。
- 使用 Firebase `.info/connected` 與 `onDisconnect()` 記錄每個瀏覽器連線；登出時嘗試立即移除本人連線。
- 登入時間改為每個瀏覽器工作階段寫入一次，避免每次換頁都把「最後登入」誤當最後瀏覽時間。
- 保留舊資料的 `lastLogin`、`kickCount`、`loginHistory` 並兼容舊日期格式；不清除歷史資料。
- Firebase 模擬器新增在線連線寫入、跨帳號拒絕、停用帳號拒絕及正常移除測試。

## V1.0 直接網址權限補強 — 2026-11-17（開發草稿）
- 全 30 個 HTML 頁面確認登入引入情況；補齊 `calc_business.html`、`cardshow.html`、`portfolio.html`、`topsales.html` 的 `auth.js`。
- V1.0 開發分支中的 `backup-export.html` 改為 Firebase 會員驗證後才能讀取本機紀錄；原正式 main 上的臨時遷移備份頁不受影響。
- 對原先未保護的五頁加同步預隱藏 CSS，避免 Firebase 核驗前閃現資料；靜態 CI 納入所有 HTML 頁面的登入引入檢查。
- 請注意：GitHub Pages 是公開靜態主機，前端登入遮罩**無法**保護 HTML 原始碼；敏感客戶資料的實際授權必須由 Firebase Rules 實施。

## V1.0 安全補強 — 2026-11-17（同一個草稿 PR）

- Firebase 備份改為不可覆寫／刪除的歷史版本結構 `clientBackups/<UID>/<版本ID>`。
- 手動備份會新增新版本，選擇最近 20 份中任一版本進行合併。
- Firebase 模擬器新增舊版覆寫、刪除、跨帳號讀取／寫入的拒絕測試。
- 正式 Firebase 仍未部署，`main` 不包含新版驗證與試算結構。

## V1.0 — 2026-11-16（開發草稿／尚未正式上線）

- 原始 main 完整保留於 `backup/pre-v1-20261116`。
- 六大功能首頁、金融工具／系統管理入口、共用分類頁樣式。
- 月月(永)溢、月月(滿)溢、滿溢康愛：移至停售商品區並標註「已停售」，保留原有商品網址。
- PWA 修正：修復 Service Worker 清單、相對快取路徑、Manifest display。
- CRM：原本地端資料不變，新增 JSON 備份及合併匯入、Firebase 個人雲端手動備份／合併、輸入內容及 ID 輸出防護。
- 前端登入：替換通用密碼為 Firebase 個人帳密＋會員驗證；管理員改用角色判斷，新增 Realtime Database 安全規則檔。
- 來源清冊與歷史固定參數提示；保險、薪獎及法規數字 **尚未正式複核**，未修改計算公式。

**發布條件**：Firebase 帳號、會員清單、Rules 部署、個資備份與回歸測試全部完成，PR 經審核後再合併。
