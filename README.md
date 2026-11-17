# 國泰雲端學習站 — V1.0「專案結構與安全整理版」

> **草稿分支，尚未正式部署。** 原始程式備份：`backup/pre-v1-20261116`。現有 GitHub Pages 正式站不受此分支修改影響。

## 2026-11-17 新需求：原 VIP 登入不變

**使用者已決定保留現有 VIP 授權碼與登入操作，並讓授權管理員自行新增新人。** 因此目前草稿將全員改為 Firebase Email/Password 的 `auth.js` **不符合最新發布條件**，不得直接合併。應先把保留 VIP 的受保護後端驗證＋管理員新增／停用功能完成並測試。完整規格見 [保留 VIP 登入＋管理者授權](docs/KEEP_VIP_LOGIN.md)。目前仍維持正式舊網站與已發布的過渡 Rules；不動客戶紀錄。

## 六大首頁入口

客戶管理 `client.html`、財務試算 `calc.html`、商品 `products.html`、業務績效 `event.html`、金融工具 `tools.html`、系統管理 `system.html`。

## 主要更新

- 商品區獨立「停售商品區」：月月(永)溢、月月(滿)溢、滿溢康愛。原試算 URL 不變。
- PWA：修正 `sw.js` 與 `manifest.json`，相對路徑支援 GitHub Pages。
- 客戶 CRM：保留原 `localStorage.contactRecords` 格式；完整 JSON 下載、JSON 合併匯入、Firebase 個人雲端**不可覆寫歷史版本**的手動備份、歷史版本選擇與合併復原；不自動刪除／覆蓋本機。
- 安全：移除前端共用授權碼及管理員固定密碼；改用 Firebase Authentication＋`/members/<UID>` 會員授權＋資料庫 Rules。
- 保留現有 `calc_*.html` 與 `prod_*.html` 計算公式；對明顯歷史固定參數加註待核實。
- 新入口頁 `tools.html`、`system.html` 共用 `assets/css/section.css`，舊試算頁暫不搬動，以免破壞功能。

## 遷移前的獨立客戶備份（正式 main）

目前正式站仍使用舊版 CRM，尚未包含新版 JSON 按鈕。已另行在 main 新增 `backup-export.html`，可在原資料所在的同一瀏覽器開啟 `https://jacky0530-spec.github.io/cathay/backup-export.html` 下載完整 JSON。該頁不連線到其他服務，但仍須自行在瀏覽器確認下載成功。

## V1.0 雲端備份版本保護

每次備份都會新增一個不可由使用者覆寫或刪除的 Firebase 歷史版本；使用者可選擇最近 20 份備份進行合併。更早版本仍保存於資料庫中，但目前介面只顯示最近 20 份。此設計需要先部署並驗證配套的 Firebase Rules；不等於已具備合規的伺服器層備份與刪除程序。

## 全站身分驗證檢查

已將直接網址可開啟的 `calc_business.html`、`cardshow.html`、`portfolio.html`、`topsales.html` 加入共用登入腳本，並把 V1.0 版本的 `backup-export.html` 改為 Firebase 會員驗證後才能讀取 localStorage。正式 main 既有的過渡備份頁不受這項分支修改影響。

**GitHub Pages 公開站的 HTML、JS 原始碼仍可直接下載；前端登入僅是 UI 的存取流程，不是伺服器端的靜態資源權限控制。** 請勿在公開 HTML / JS 包含真實客戶資料、內部機密、密碼或 API 私密金鑰。客戶雲端資料由 Firebase Rules 保護。

## 管理員監控相容性（V1.0）

原版管理報表依靠舊 `session` 欄位判斷在線，新版改用 Firebase `.info/connected` + `onDisconnect` 記錄每個登入瀏覽器的即時連線；管理員以 `users/<UID>/connections` 判斷在線。每個瀏覽器工作階段的登入時間僅寫入一次，不再每換頁就改寫。舊版位置、踢除次數及歷史資料保留，**不宣稱可自動重建舊版地理位置／踢除功能**。

## 客戶 CSV 與 PWA 安全
- 原本的 CSV 匯入直接以逗號切割，可能導致備註包含逗號／換行時資料錯欄。V1.0 改為引號格式解析、完整資料檢查、去重合併；CSV 僅用於交換，完整保存請用 JSON。
- V1.0 PWA **需要網路**才能開啟登入、客戶及所有 HTML 頁面；這是為了避免切換 Firebase 登入後使用過期的離線驗證腳本。僅快取不含客戶資料的共用 CSS、圖示及 Manifest。
- 瀏覽器的 HTTP 快取、舊版本 Service Worker 或實機環境需在上線前實際驗證；更新 `sw.js` 不代表使用者裝置已自動完成切換。

## 下載後的 JSON 完整性驗證

正式 `main` 已新增唯讀 `backup-verify.html`（`https://jacky0530-spec.github.io/cathay/backup-verify.html`），不需向任何人上傳 JSON，可在本機選擇檔案驗證 schemaVersion、資料筆數、缺漏欄位、重複 ID，以及 SHA-256。檔案不離開瀏覽器。驗證通過仍需確認下載檔在安全位置、且日後可以復原。V1.0 保留此頁作為公開的**本機檔案檢查工具**，不得用它作為伺服器端資料存取介面。

## Firebase 會員停用與角色變更
- 初次登入須在 `members/<UID>` 找到已啟用的 `user/admin` 成員。
- 登入後持續監聽會員狀態。若帳號停用、會員紀錄被刪除、角色調整或會員監控權限失效，會遮蔽畫面並登出。
- Firebase Rules 仍須於正式環境部署與驗證。前端即時登出不能取代資料庫存取控制。
- **本次依使用者決定不執行客戶資料備份。** 既有 `localStorage.contactRecords` 不清除、不遷移、不自動覆寫；不備份意味著清除網站資料或裝置損壞時可能無法復原。

## 新舊登入切換用過渡規則

新增 `firebase.transition.rules.json`，僅用於模擬器與**短期相容驗收**：保留舊 `whitelist` 公開讀及 `users` 公開寫，同時補上 V1.0 的 admin 與會員授權。這**不能解決**舊系統公開寫入的安全風險；完整版必須待所有需要的舊帳號遷移後改用 `firebase.database.rules.json`。參閱 `docs/CUTOVER.md`。目前未發布過渡規則。

## 發布門檻

**GitHub 新增 `firebase.database.rules.json` 並不代表已套用到 Firebase。** 必須先按 [Firebase 遷移與驗收手冊](docs/MIGRATION.md) 建立個人帳號／會員權限，並在管理員端實際部署與測試 Rules，確認同一瀏覽器的客戶資料仍可正常讀取後，才能合併此分支。

[資料來源與年度清冊](docs/DATA_SOURCES.md)｜[版本變更](CHANGELOG.md)

## 回退

完整程式可由 `backup/pre-v1-20261116` 回復；Firebase Rules 及各裝置的客戶資料需獨立備份與回復。**不可將客戶 JSON 備份上傳至公開倉庫。**
