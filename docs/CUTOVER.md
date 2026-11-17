# Cathay V1.0：保留既有 VIP 登入的安全切換清單

**現行正式站繼續使用原 VIP 登入，其他同事正常。現在不能合併 V1.0，也不能直接發布最終 Firebase Rules。**

## 方案
- GitHub Pages 原網址 + 既有 Firebase Authentication、Realtime Database。
- Firebase Cloud Functions 驗證 VIP 碼並核發 Custom Token；使用者畫面與授權碼不變。
- Firebase 管理員後台將實作新增、停用、重啟、同步舊授權碼。完全不使用 Cloudflare 或 D1。
- 此方案在正式部署前需 Blaze 計費方案，現階段未經核准不改計費。

## 安全切換順序
1. 先在開發分支完成 Functions／管理台／VIP 登入整合與 Emulator 測試；不更動正式網站。
2. 原 `whitelist`、`users`、`members` 保留；逐一核對仍需使用的舊 VIP 碼。已公開共用通行碼要有安全更換計畫。
3. 經使用者明確同意 Blaze 計費與部署後，才設定 Firebase Functions 所需的伺服器端 Secret 並測試。
4. 在 Firebase Emulator 驗證新 `vipAccess` 只有 Admin SDK 寫入且一般帳號不能讀取私有內容，停用帳號立即失去受保護的資料權限。
5. 維持原網站網址及 VIP 輸入方式；完成新版 `auth.js` 和 `signInWithCustomToken`，測試多位舊用戶、新人、停權、復權、手機與 PWA。
6. 所有必要使用者已驗收後再同步發布新版前端與保護性 Rules，撤除匿名讀 `whitelist`、匿名寫 `users`。
7. `localStorage.contactRecords` 不清除、不搬移、不覆寫；依使用者決定不執行備份。注意未備份的瀏覽器資料遺失風險。

**注意：** `firebase.database.rules.json` 目前是先前全員 Firebase Email 登入的草稿規則，尚不符合此 VIP 架構；不能直接套用。原先 D1／Worker 部署檔已停止使用。
