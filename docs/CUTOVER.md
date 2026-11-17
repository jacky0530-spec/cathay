# V1.0 Spark 免費方案：授權管理安全切換

**目前正式 GitHub Pages 網站與 Firebase Rules 均未變動。** 其他業務員仍用原 VIP 授權碼登入。

## 改動範圍
- 新增獨立 Spark 管理員頁（Firebase Authentication Email/Password 僅管理員需要）。
- 使用 Realtime Database Security Rules 在 `whitelist/<code>` 允許管理員新增／停權／復權，但原匿名讀取仍需保留供舊站使用。
- 新增 `vipProfiles/<code>` 私有識別標籤，不搬動原會員、登入紀錄與客戶本機資料。
- **不使用 Cloud Functions、Cloudflare、D1 或 Blaze。**

## 安全切換前檢查
1. 先執行 `npm run test:rules`（含 Spark 候選規則 Emulator）。
2. 由管理員核對 Firebase Console **實際正在生效的 Rules**；`firebase.spark-admin.rules.candidate.json` 只是以已知過渡規則為基礎的候選版，不能整份直接覆蓋未知新設定。
3. 只合併需要的 `whitelist/$code` 管理員布林值寫入授權及 `vipProfiles` 管理員讀寫規則；不要更動原 `users`、`members` 或其他已存在節點。
4. 在 Firebase Console Rules Playground 先確認未登入／一般 user 不可修改、admin 可新增及停用；符合後再由有權限的管理員決定發布。
5. 等候選規則正式發布並驗證後，才能從開發分支挑選獨立管理頁部署於既有 GitHub Pages；不合併整個 V1.0 PR，因為原 `auth.js` 還會強制全員電子郵件登入。
6. 實測既有 VIP 登入／新人登入／停用復權，以及原保費試算、手機 PWA 與 CRM 資料仍正常。

## 已知且尚未解決的安全問題
- `whitelist` 為公開讀取，VIP 碼不保密。
- 舊 `auth.js` 內的共用通行碼可繞過白名單停權。
- `users` 仍有匿名寫入，原網站登入會話放在客戶端；GitHub Pages 靜態內容本身為公開。
- 本方案改善管理效率與白名單個別修改權限，但**不能當作安全驗證後端的替代品**。

**客戶 CRM `localStorage.contactRecords` 不清理、不搬移、不備份。**
