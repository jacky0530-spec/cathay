# 國泰雲端學習站 — V1.0「專案結構與安全整理版」

> **草稿分支，尚未正式部署。** 原始程式備份：`backup/pre-v1-20261116`。現有 GitHub Pages 正式站不受此分支修改影響。

## 六大首頁入口

客戶管理 `client.html`、財務試算 `calc.html`、商品 `products.html`、業務績效 `event.html`、金融工具 `tools.html`、系統管理 `system.html`。

## 主要更新

- 商品區獨立「停售商品區」：月月(永)溢、月月(滿)溢、滿溢康愛。原試算 URL 不變。
- PWA：修正 `sw.js` 與 `manifest.json`，相對路徑支援 GitHub Pages。
- 客戶 CRM：保留原 `localStorage.contactRecords` 格式；完整 JSON 下載、JSON 合併匯入、Firebase 個人雲端手動備份／合併復原；不自動刪除／覆蓋本機。
- 安全：移除前端共用授權碼及管理員固定密碼；改用 Firebase Authentication＋`/members/<UID>` 會員授權＋資料庫 Rules。
- 保留現有 `calc_*.html` 與 `prod_*.html` 計算公式；對明顯歷史固定參數加註待核實。
- 新入口頁 `tools.html`、`system.html` 共用 `assets/css/section.css`，舊試算頁暫不搬動，以免破壞功能。

## 發布門檻

**GitHub 新增 `firebase.database.rules.json` 並不代表已套用到 Firebase。** 必須先按 [Firebase 遷移與驗收手冊](docs/MIGRATION.md) 建立個人帳號／會員權限，並在管理員端實際部署與測試 Rules，完成所有裝置客戶資料備份，才能合併此分支。

[資料來源與年度清冊](docs/DATA_SOURCES.md)｜[版本變更](CHANGELOG.md)

## 回退

完整程式可由 `backup/pre-v1-20261116` 回復；Firebase Rules 及各裝置的客戶資料需獨立備份與回復。**不可將客戶 JSON 備份上傳至公開倉庫。**
