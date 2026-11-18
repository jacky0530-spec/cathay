# Cathay VIP 管理後台：Firebase Spark 免費方案（開發草稿）

**使用者決定：不升級 Blaze、不使用 Cloudflare、Cloud Functions 或 D1。**

## 功能
- `spark/manager.html` 與 `spark/manager.mjs`：管理員登入、隨機新增 VIP 授權碼、查看白名單、個別停用／啟用，識別名稱另外存放在私有的 `vipProfiles`。
- `../firebase.spark-admin.rules.candidate.json`：保留目前已知舊站 `whitelist` 匿名讀、`users` 匿名寫、`members` 會員讀取的候選 Rules，新增 admin 才能寫入 VIP 布林值與名稱。
- `../scripts/test-spark-rules.mjs`：Firebase Emulator 的權限整合測試，不接觸真實資料庫。

## 部署狀態
- 只在 `feature/v1-structure-security` PR 草稿；正式 GitHub Pages、Firebase Rules 均**未**修改。
- 須先核對實際 Firebase Rules、模擬測試及 Playground，再有意識地發布合併後的管理權限規則。
- 因整個 V1.0 草稿 `auth.js` 還會改掉業務員舊登入，**不可合併整個 PR**，應待此功能單獨驗收後才挑選獨立管理頁進正式站。

## 重要風險
公開讀取的 Firebase `whitelist` 使所有 VIP 碼不具保密性；舊 `auth.js` 已有公開的通用碼可跳過白名單，不能透過本管理頁停用。原 `users` 匿名寫入仍不安全。**Spark 管理頁只解決授權操作的便利性與授權修改權限，不能聲稱完成真正的伺服器端身分驗證。**

原有 `localStorage.contactRecords`、保費試算、商品頁均保持原狀。使用者已決定不執行客戶資料備份。
