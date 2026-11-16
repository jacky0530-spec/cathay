# Cathay V1.0 專案結構與安全整理版

## 六大入口
客戶管理 `client.html`；財務試算 `calc.html`；保險商品 `products.html`；績效 `event.html`；金融工具 `tools.html`；系統管理 `system.html`。

## 已整理
- 商品「月月(永)溢、月月(滿)溢、滿溢康愛」移到停售商品區，保留原網址和歷史試算。
- 修復 PWA 的 manifest.display、Service Worker 語法與 GitHub Pages 子路徑。
- 客戶資料維持 `localStorage.contactRecords`，新增完整 JSON 下載備份；**程式碼備份不能取代客戶資料備份**。
- 修正客戶表格插入 HTML 的文字逃逸處理；既有試算公式未改。
- 固定年份資料先附審查警語，不擅自修改未經確認之費率或保險條款。

## 發布前重要限制
原登入頁使用瀏覽器端授權碼及 Firebase whitelist。**這不是伺服器端授權**；必須先啟用 Firebase Authentication、設定成員名單、實際部署安全 Rules，並在測試環境通過權限測試，才可替換登入程式。

安全遷移和雲端資料備份的完整功能將以本 V1.0 草稿分支繼續實作。完成前請勿直接發布本分支。

## 備份與回退
原始主分支：`backup/pre-v1-20261116`，原 commit `24298e3214843be1595f70daf76ba53120908c02`。

### 待核驗的資料來源
- 遺產稅：`calc_plan.html` 原頁為 2025 參數，待財政部 2026 正式資料核對。
- 國保：`calc_combo.html` 固定投保金額和請領假設，待勞保局確認。
- 高峰競賽、A&H、業務薪獎：待核對公司現行內部規章。
- 商品、基金和信用卡：待核對保單條款、費率表與官方權益公告及適用日期。
