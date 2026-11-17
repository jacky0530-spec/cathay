# V1.0 Firebase 安全切換與客戶資料保護

> **此分支尚未上線。請勿在 Firebase Auth 使用者與 Realtime Database Rules 完成前合併到正式 main。**

## A. 備份每台裝置的客戶資料

1. 在目前正式網站的每台手機、iPad、電腦，以**原本有資料的同一個瀏覽器**進入 `backup-export.html`（網址：`https://jacky0530-spec.github.io/cathay/backup-export.html`），確認和客戶管理頁相同網域。這是已加入正式 main 的獨立唯讀備份頁，不需啟用 V1.0 登入。
2. 檢查頁面顯示的筆數，再點「下載完整 JSON 備份」。若頁面找不到紀錄，請確認同一瀏覽器／同一網站 origin，先不要清除網站資料。核對下載檔的 `records` 筆數。每台設備、每個瀏覽器的 `localStorage.contactRecords` **可能不同**。
3. 在相同裝置開啟 `https://jacky0530-spec.github.io/cathay/backup-verify.html`，選取已下載的 JSON（**不會上傳**），確認格式有效、紀錄筆數及異常統計，再記下 SHA-256 校驗值。這個公開工具本身不會還原資料。
4. 將 JSON 檔保存在加密位置；不可上傳到公開 GitHub、群組或未授權雲端。
5. 遷移期間不要清除網站資料，並維持原網站網域與路徑；客戶資料**不在** GitHub 版本備份中。

## B. 由管理員完成 Firebase 設定

1. 在原 Firebase 專案的 Authentication 開啟「Email/Password」登入方式，為每人建立唯一帳號。
2. 記下每個帳號的 Firebase Auth UID。由 Firebase Console 或 Admin SDK 建立 `/members/<UID>`，值為 `{"active":true,"role":"user"}`，有權查詢管理報表者設 `role:"admin"`。
3. 將 GitHub 的 `firebase.database.rules.json` 用 Firebase Emulator／安全測試專案測試並部署到正式 Realtime Database Rules（**GitHub 內新增規則檔不會自動生效**）。
4. 驗證：未登入無法讀取任何資料；一般使用者只能讀取自己的 `clientBackups/<UID>`，且只能新增自己路徑下的歷史版本，禁止覆寫或刪除已存在的版本，無法讀取其他會員；管理員可以讀取 `users`；舊 `whitelist` 無法讀取。
5. 用測試帳號驗證 `auth.js` 登入、登出、閒置登出、無會員記錄拒絕及 `admin.html` 管理員權限。確認至少一位管理員能進後台後，再決定合併。
6. 原有前端通用授權碼及後台固定密碼已從 V1.0 移除，但舊提交歷史仍可能包含，必須停用相關舊通路並按需要輪換其他憑證。

## C. 雲端備份與復原

- 資料仍以本機 `localStorage.contactRecords` 為工作資料來源；**不自動同步也不自動上傳**。
- 「上傳雲端備份」須使用者明確確認，新增 Firebase `clientBackups/<UID>/<備份版本ID>` 的唯增寫入版本；**舊備份不可由一般使用者覆寫或刪除**。
- 「選擇雲端版本合併」可以選擇最近 20 份歷史備份之一，再提出本機 JSON 下載，將所選紀錄依內容去重合併；同 ID 不同內容另建一筆而不覆蓋。更早歷史備份仍在資料庫，但目前介面不列出。
- 「合併 JSON 備份」支援手動跨設備匯入；請再次核對筆數，確認正確後再上傳最新雲端備份。
- 請制定個人資料保存、授權、加密、刪除及操作紀錄政策；Firebase 備份不等同正式災難復原備份。

### 留存與刪除注意事項

不可覆寫版本是減少誤操作的防護，不代表永久保存所有個資才是正確做法；實際上線仍須設計管理員可稽核的保存期限、到期刪除與刪除備份作業。管理員 Admin SDK 可在必要時執行經授權的刪除流程，但目前前端沒有此能力。

### 管理員監控相容性
- 新版「在線」由 `users/<UID>/connections` 的即時連線數判斷，不再直接使用舊 `session` 字串。
- 為避免誤計為「登入」，`lastLogin` 以每個瀏覽器工作階段記錄一次。不同分頁會有獨立工作階段；不代表員工每次都重新輸入密碼。
- 舊系統的踢除、地點與足跡歷史欄位只作歷史顯示；V1.0 不主動蒐集新地理位置或假設可重現舊踢除機制。
- Firebase 官方建議先註冊 `onDisconnect` 再寫入在線狀態，相關 `connections` 權限須在 emulator 及正式環境驗證。

### CSV 與 PWA 交付檢查
- CSV 文字包含逗號、雙引號、換行時匯入不得錯欄；重複匯入同一筆不得建立多筆。
- CSV 只是資料交換，完整資料備份必須使用 JSON。所有 CSV 匯入前應先另存 JSON。
- V1.0 Service Worker 不離線快取 HTML、登入 JavaScript 或客戶畫面，離線狀態需拒絕舊版登入流程。
- 上線前請使用各種瀏覽器確認新 Service Worker 正常接管，舊 `cathay-app-` 快取已清除。

## D. 回歸測試

- 核對六大入口、底部五個選單、原商品 URL 與所有既有試算公式。
- 確認停售區三個商品仍可查看舊資料，不可呈現為可新投保。
- 確認所有客戶建檔、搜尋、修改、刪除、CSV 匯入匯出、JSON 備份及合併還原功能。
- 測試 iPhone / iPad Safari、Android Chrome、桌面 Chrome 的登入與快取更新。
- 未驗證官方最新法規、費率與條款的頁面仍標示「待確認」，不得誤稱已完成更新。

## E. 回退

原始程式備份分支為 `backup/pre-v1-20261116`，commit 為 `24298e3214843be1595f70daf76ba53120908c02`。回退 GitHub 程式碼並不會回退 Firebase Rules；如需回退，必須事先單獨備份規則設定。客戶本機資料亦需 JSON 備份。

**正式發布門檻：Firebase 成員建檔、Rules 部署、權限測試、至少一台原客戶資料裝置的備份與復原演練全部完成。**

## 備份工具注意事項（V1.0 staging）

- `backup-export.html` 已另行新增到原始 main，**不修改原登入程式、試算或現有客戶資料**。
- GitHub 可以確認程式檔存在，但 GitHub Pages 網址是否完成發布、不同設備 Safari 下載是否順利，須實際開頁確認。
- 正式站沒有 V1.0 新增的 `client.html` 備份按鈕，所以**遷移前請使用獨立備份頁**，不要誤以為舊頁已有 JSON 匯出按鈕。

**本機驗證限制**：校驗值只能協助確認檔案位元組是否相同，不能證明內容在匯出時就是完整的；仍須在各原裝置核對客戶筆數，並於測試環境進行真正的資料還原演練。
