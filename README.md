# 國泰雲端學習站 — V1.0「專案結構與安全整理版」

> **草稿分支，尚未正式部署。** 原始程式備份：`backup/pre-v1-20261116`。現有 GitHub Pages 正式站不受此分支修改影響。

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

## 發布門檻

**GitHub 新增 `firebase.database.rules.json` 並不代表已套用到 Firebase。** 必須先按 [Firebase 遷移與驗收手冊](docs/MIGRATION.md) 建立個人帳號／會員權限，並在管理員端實際部署與測試 Rules，完成所有裝置客戶資料備份，才能合併此分支。

[資料來源與年度清冊](docs/DATA_SOURCES.md)｜[版本變更](CHANGELOG.md)

## 回退

完整程式可由 `backup/pre-v1-20261116` 回復；Firebase Rules 及各裝置的客戶資料需獨立備份與回復。**不可將客戶 JSON 備份上傳至公開倉庫。**
