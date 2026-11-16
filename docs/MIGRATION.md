# V1.0 Firebase 安全切換與客戶資料保護

> **此分支尚未上線。請勿在 Firebase Auth 使用者與 Realtime Database Rules 完成前合併到正式 main。**

## A. 備份每台裝置的客戶資料

1. 在目前正式網站的每台手機、iPad、電腦，進入 `client.html`。
2. 點「下載完整 JSON 備份」，核對下載檔的 `records` 筆數。每台設備、每個瀏覽器的 `localStorage.contactRecords` **可能不同**。
3. 將 JSON 檔保存在加密位置；不可上傳到公開 GitHub、群組或未授權雲端。
4. 遷移期間不要清除網站資料，並維持原網站網域與路徑；客戶資料**不在** GitHub 版本備份中。

## B. 由管理員完成 Firebase 設定

1. 在原 Firebase 專案的 Authentication 開啟「Email/Password」登入方式，為每人建立唯一帳號。
2. 記下每個帳號的 Firebase Auth UID。由 Firebase Console 或 Admin SDK 建立 `/members/<UID>`，值為 `{"active":true,"role":"user"}`，有權查詢管理報表者設 `role:"admin"`。
3. 將 GitHub 的 `firebase.database.rules.json` 用 Firebase Emulator／安全測試專案測試並部署到正式 Realtime Database Rules（**GitHub 內新增規則檔不會自動生效**）。
4. 驗證：未登入無法讀取任何資料；一般使用者只能讀寫自己的 `clientBackups/<UID>`，無法讀取其他會員；管理員可以讀取 `users`；舊 `whitelist` 無法讀取。
5. 用測試帳號驗證 `auth.js` 登入、登出、閒置登出、無會員記錄拒絕及 `admin.html` 管理員權限。確認至少一位管理員能進後台後，再決定合併。
6. 原有前端通用授權碼及後台固定密碼已從 V1.0 移除，但舊提交歷史仍可能包含，必須停用相關舊通路並按需要輪換其他憑證。

## C. 雲端備份與復原

- 資料仍以本機 `localStorage.contactRecords` 為工作資料來源；**不自動同步也不自動上傳**。
- 「上傳雲端備份」須使用者明確確認，寫入 Firebase `clientBackups/<UID>`；覆寫同一 UID 的舊雲端備份前再次確認。
- 「合併雲端備份」會先下載本機 JSON，再將雲端記錄與本機紀錄按欄位內容去重合併；發生同 ID 不同內容時另建一筆，而不是覆蓋原紀錄。
- 「合併 JSON 備份」支援手動跨設備匯入；請再次核對筆數，確認正確後再上傳最新雲端備份。
- 請制定個人資料保存、授權、加密、刪除及操作紀錄政策；Firebase 備份不等同正式災難復原備份。

## D. 回歸測試

- 核對六大入口、底部五個選單、原商品 URL 與所有既有試算公式。
- 確認停售區三個商品仍可查看舊資料，不可呈現為可新投保。
- 確認所有客戶建檔、搜尋、修改、刪除、CSV 匯入匯出、JSON 備份及合併還原功能。
- 測試 iPhone / iPad Safari、Android Chrome、桌面 Chrome 的登入與快取更新。
- 未驗證官方最新法規、費率與條款的頁面仍標示「待確認」，不得誤稱已完成更新。

## E. 回退

原始程式備份分支為 `backup/pre-v1-20261116`，commit 為 `24298e3214843be1595f70daf76ba53120908c02`。回退 GitHub 程式碼並不會回退 Firebase Rules；如需回退，必須事先單獨備份規則設定。客戶本機資料亦需 JSON 備份。

**正式發布門檻：Firebase 成員建檔、Rules 部署、權限測試、至少一台原客戶資料裝置的備份與復原演練全部完成。**
