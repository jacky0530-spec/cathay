# V1.0 保留原 VIP 登入＋Spark 免費管理後台

**決策（2026-11-17）：只使用 GitHub Pages＋Firebase Spark 免費方案。** 不升級 Blaze，不使用 Cloudflare，不部署 Cloud Functions，不建立第二套資料庫。

## 功能及限制
- **舊業務員**：仍用原來網址與同一組 VIP 授權碼提示視窗；不強迫建立電子郵件或更改登入。
- **管理員**：使用先前實機驗證成功的 Firebase Authentication 帳號，經 `members/<UID>` 的 `active=true`、`role=admin` 驗證後，在獨立管理頁操作。
- **新增與停權**：瀏覽器 SDK 直接操作既有 Firebase Realtime Database 的 `whitelist/<VIP code>`。Rules 僅允許 admin 個別寫入布林值，不可刪除或覆寫整份白名單。
- **標籤**：識別名稱存於管理員才可讀寫的 `vipProfiles/<VIP code>`，不是放在公開白名單。
- **操作畫面**：`vip-access/spark/manager.html`，暫時僅在開發分支，未對正式使用者發布。
- **安全限制**：舊登入採公開讀取白名單，因此完整 VIP 碼仍可被匿名取得；用戶端登入不能等同伺服器保護。原站曾存在寫死在公開 JS 的共用通行碼，該通行碼不會受 Firebase 白名單停用控制。現有 `users` 匿名寫入也尚未解決。不可對用戶保證碼已保密、停權可完全封鎖所有通道。
- **資料**：原 `whitelist`、`users`、`members` 不遷移、不刪除；`localStorage.contactRecords` 不清空、不備份（依使用者決定）。

## 上線條件
1. **不直接合併原 V1.0 PR**，因為其 `auth.js` 仍強制所有人用 Firebase Email/Password，與需求不合。
2. 新版候選 Rules 在 `firebase.spark-admin.rules.candidate.json`，僅供模擬測試與人工合併；Firebase Console 目前實際規則可能與範例不同，發布前必須逐項核對現行規則。
3. 先確認 Emulator 所有匿名、一般使用者、管理員、停用管理員測試通過；再人工發布合併後的正式 Rules，並實機測試新增、停用、復權、舊同事登入。
4. 在同一 GitHub Pages 網址部署獨立管理頁，不修改舊站首頁和 VIP 登入腳本；所有新授權操作都需通過 Firebase Rules，不能只用前端按鈕當成權限檢查。
5. 已公開的共用通行碼應訂定逐步更換方案；若要真正保密與伺服器端登入驗證，必須另評估不違反 Spark／無 Cloudflare 限制的設計，不可假稱已解決。
6. 不變更保費試算、PWA 與現有本機 CRM，不清空或覆寫資料。
