# 版本更新紀錄

## 商品頁 v1.1 — 三項已停售商品分區整理 — 2026-11-18
- 依使用者指定，將「月月(永)溢」「月月(滿)溢」「滿溢康愛」移到商品頁最下方單一「已停售商品區」，改灰階樣式並加上「已停售」標籤；移除原本「滿溢康愛」的熱銷展示。
- 保留所有原始試算頁與原 URL，三個試算頁頂部另新增停售提示，不修改任何費率、配息、理賠計算公式或原 VIP 登入。
- 現有醫療保障商品及四項比較工具保留在停售分區之前，所有 10 條商品連結仍各出現一次。
- 修正原 `sw.js` 快取清單語法問題，將快取版本升級為 `cathay-app-v31`，商品列表優先讀取網路最新版本、離線回退快取。
- GitHub Actions #44265628070 全部通過（含商品連結、停售標籤、試算頁提醒及 SW JavaScript 語法）。
- 只選擇性發布 `main` 商品頁、3 個試算頁、`sw.js` 和新增 `CHANGELOG.md`，提交 `20206dfa3ebf581b1906a7175800c85ee5ffc9fd`；**未更改** Firebase Spark、VIP 白名單、其他使用者登入與客戶資料。
- 正式 GitHub Pages 原始碼已可核對；本環境無法獨立讀取對外 Pages 網址，所以仍須使用者瀏覽器重新整理確認新分區已顯示。

## VIP 管理後台 v0.1.7 — 舊帳號識別標籤修改及搜尋 — 2026-11-18（已提交正式 main）
- 新增每筆授權右側「修改標籤」按鈕；舊帳號即使原先顯示「既有授權」，也可以由管理員補填姓名、團隊或識別名稱。已停用但尚未刪除的授權碼也可修改。
- 識別名稱允許 1–80 字元，會去除開頭與結尾空白；按「儲存」才更新 `vipProfiles/<CODE>`，並重新讀取 Firebase 確認。支援取消及 Enter／Esc 快捷鍵。
- 新增在管理員已載入的授權清單內，以**姓名、識別標籤、完整授權碼或末四碼**搜尋；畫面只顯示尾四碼，無需清空或搬移既有資料。
- 每次儲存前確認 Firebase 管理員權限與原授權碼仍存在且未永久註銷；**不寫入 `whitelist`、`users`、`members`，不更動現有登入或停用狀態**。
- 無須重新發布 Firebase Rules。現有 `vipProfiles/$code` 規則已允許管理員建立／更正長度 1–80 的文字標籤。
- CI #44222734969 已通過（包含舊標籤建立／修改、匿名／一般帳號無法修改、原啟用狀態不變、登入與刪除回歸測試）。
- 已選擇性提交 `main` 兩個獨立管理頁檔案，版本 v0.1.7，commit `b62d7ef6fb15d8f3cc492fed3eef55a2f7fdbee6`。不合併不相容的 V1.0 草稿 PR。
- 使用者已回報 V0.1.6 的停用後永久刪除成功；**本次新標籤編輯仍須管理員實機操作確認**。Firebase Spark 免費方案維持。

## VIP 管理後台 v0.1.6 — 刪除已停用 VIP 授權（需更新 Rules）— 2026-11-18
- 使用者提出舊帳號刪除需求；本次只針對 Firebase Realtime Database **VIP whitelist 授權碼**，不刪除 Firebase Authentication 管理員、登入歷史 `users`、客戶資料 `contactRecords` 或保費試算。
- 獨立後台新增「永久刪除」功能，**只在已停用、非前端硬編碼共用碼且新 Rules 支援時**顯示；執行前要求警告確認及輸入 `刪除-末四碼`。
- 新增受管理員規則限制的 `vipRetired/<CODE>=true` 墓碑，先留永久停用記號，再刪除已停用的 `whitelist/<CODE>`，最後清理 `vipProfiles/<CODE>` 私有名稱；墓碑不可修改或刪除，阻擋代碼重新發行。
- `firebase.spark-admin.rules.candidate.json` 新增管理員只能在 `data.val() === false` 且墓碑存在時刪除單筆碼，私有標籤也只能於白名單刪除後清除；維持舊匿名白名單讀取及 `users` 相容，禁止整份覆寫。
- Firebase Emulator 已驗證匿名／一般會員無法刪除、管理員不能刪除啟用碼、停用碼沒有墓碑不可刪、墓碑成立後才能刪且不可重新發行。CI #44204800126 全部通過。
- 已選擇性更新正式 `main` 兩個獨立管理頁檔案至 v0.1.6，提交 `46b00ba961e675436b47305a79bc24e18c68b3ac`。**正式 Firebase 新 Rules 尚未發布，所以永久刪除按鈕暫不會顯示，也未實際刪除任何 VIP**。
- 仍有舊版前端共用碼、公開讀取白名單與已登入工作階段無法即時撤銷等限制；新版按鈕不會刪除使用者本機資料或歷史紀錄。

## VIP 管理後台 v0.1.5 — 修正管理員權限讀取卡住 — 2026-11-18（main 已更新）
- 使用者提供 v0.1.4 截圖，明確停在「步驟 2／3：帳號驗證成功，正在確認管理員權限」，故 Firebase Authentication 本身已成功，卡住的是 Realtime Database `members/<UID>` 讀取。
- 新增 `readFirebaseRest()`，使用 Firebase Authentication ID Token 以官方 REST API 的 `auth` 參數讀取 `members/<UID>`、`whitelist`、`vipProfiles`，繞開可能卡住的 Realtime Database SDK 長連線。讀取設 10 秒逾時與錯誤提示、`no-store`、`no-referrer`。
- 確認帳號權限仍由 Firebase Rules 限制，沒有前端管理員硬編碼；VIP 授權寫入／停用保留已通過的 SDK 交易流程。
- GitHub Actions 執行 #44202017298（靜態回歸、REST 流程檢查、Firebase Emulator）成功。只更新正式 `main` 的 `vip-admin-spark.js` 和 `vip-admin-spark.html`，提交 `f98e8a3a15b8c59b625538a302c7841c6333a4bb`。
- Firebase Spark 免費方案不變；**未修改** Firebase Rules、實際 VIP 白名單、其他業務員原登入 `auth.js`、客戶本機資料或保費試算。
- **仍需使用者瀏覽器實測。** 靜態與模擬器通過不等於已證實實際管理員登入完成；如仍失敗，頁面將提供精確錯誤。

## VIP 管理後台 v0.1.4 — 登入狀態與清單載入分離 — 2026-11-18
- 使用者提供 v0.1.3 畫面，顯示登入畫面未前進且沒有實際錯誤訊息；無法單憑截圖判斷密碼是否已輸入、Firebase 認證是否成功。
- 改為登入步驟即時顯示：「驗證 Firebase 管理員帳號」→「確認管理員權限」→「載入 VIP 清單」，並提示驗證／資料庫查詢逾時。
- 管理員權限確認成功後立即顯示管理頁，清單另行載入；即使讀取清單超時或失敗，也會在畫面明確顯示錯誤，不再讓登入按鈕卡住。
- 保留管理員自訂 VIP 授權碼、停用／重新啟用、獨立 Firebase Spark 管理員登入，不使用 Cloudflare 或付費 Functions。
- 開發分支 GitHub Actions **#44196001885 通過**；選擇性更新正式 main `vip-admin-spark.js`、`vip-admin-spark.html`，提交 `1501d89d5aab74743ee4d934b8521f8d5bb55f70`，版本 v0.1.4。
- 沒有更動正式 Firebase Rules、任何 VIP 白名單資料、原 `auth.js`、保費試算或客戶本機資料。
- 仍需使用者瀏覽器實測，錯誤詳細原因只有刷新 v0.1.4 後才能確認。

## VIP 管理後台 v0.1.3 — 修復可能的登入模組載入問題 — 2026-11-18（正式 main 已更新）
- 反映使用者回報「無法登入」，但尚未收到確切錯誤訊息或登入頁別，因此**原因仍待實機確認**。
- 移除 v0.1.2 新增的 `vip-admin-spark-create.mjs` **執行時匯入依賴**，將自訂授權碼格式檢查與防重複交易函式內嵌於 `vip-admin-spark.js`；避免新增模組載入失敗時連 Firebase 管理員登入都無法啟動。
- 保留管理員自訂碼、v0.1.1 停權／復權與 Firebase 驗證；新增常見登入失敗錯誤說明。更新頁面至 `0.1.3` 並修改 JS 查詢版本防快取。
- Main 提交 `9ff809c0a43d338af44e99f1acafc612565bb37b` 僅更新獨立管理頁 HTML 與 JS，無需變更 Firebase Spark 計費、正式規則、既有 VIP 資料、客戶本機資料、原登入 `auth.js` 或計算公式。
- 待使用者以瀏覽器登入驗證；先前缺少錯誤截圖，無法保證原因已完全排除。

## VIP 管理後台 v0.1.2 — 管理員自訂授權碼 — 2026-11-18（已選擇性發布 main）
- 管理員新增新人時自行輸入 VIP 授權碼，取消自動隨機產生。
- 新增格式檢查：6–32 位英文、數字、底線、連字號，自動轉換大寫；拒絕已公開的舊版共用通行碼。
- 先讀取指定授權碼，已存在（含停用）則拒絕建立；再以 Firebase 交易檢查避免併發覆寫，成功後重新確認資料庫內容。
- 保留 v0.1.1 已實測正常的停用／啟用，增加純函式測試，GitHub Actions 執行 #44121608541 全部通過。
- 只更新 `main` 的獨立管理頁 `vip-admin-spark.html`、`vip-admin-spark.js` 並新增 `vip-admin-spark-create.mjs`；提交 `ed367ce8ba70cb0d493d5204be62928d801429c2`。
- **沒有**修改 Firebase Rules、既有 VIP 清單、舊登入 `auth.js`、首頁、客戶本機資料或保費試算。
- 仍要由管理員在 GitHub Pages 實際建立一組自訂測試碼確認；舊白名單公開可讀的安全限制仍未改善。

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
