# Cathay VIP 管理：Firebase 原生後端，尚未部署

## 目前選定
- 網站：原 GitHub Pages `https://jacky0530-spec.github.io/cathay/`。
- 同事登入：**原 VIP 碼、原輸入提示**，不要求每人註冊電子郵件。
- 資料：只用既有 `cathay-app-5889a` Firebase Authentication＋Realtime Database。
- 伺服器：**Cloud Functions for Firebase**（Firebase 原生產品）；**不用 Cloudflare、Worker 或 D1**。
- 管理員：沿用已測試成功的 Firebase Authentication 登入；由後端確認 `members/<UID>` 已啟用且為 admin。
- 舊資料：`whitelist`、`users`、`members` 都不修改，客戶資料 `localStorage.contactRecords` 不清理、不匯出、不搬移。

## 程式碼
- `firebase-native/functions/core.js`：VIP 授權碼格式與 HMAC，簽發 UID、建立管理紀錄的純函式。
- `firebase-native/functions/index.js`：Firebase callable Functions：
  `vipAuthenticate`、`vipCheck`、`vipCreate`、`vipList`、`vipSetActive`、`vipSyncLegacy`。
- `firebase-native/functions/core.test.js`：合成測試，無正式 Firebase 存取。
- `firebase-native/firebase.json`：只列 Functions，**不包含正式 Realtime Database Rules 部署**。
- [Firebase 原生部署門檻](firebase-native/README.md)

## 重要限制
Firebase Cloud Functions 需要專案處於 **Blaze 計費方案**。Blaze 是用量計費，有免費額度但不保證零費用；使用者目前只要求停用 Cloudflare，**尚未同意變更 Firebase 計費**。因此目前沒有部署、沒有變更 Firebase 設定、沒有使用任何真實授權碼。

現有 V1.0 草稿 `auth.js` 仍需重寫成「VIP 輸入→callable→Custom Token」，並測試新 Rules 真正限制停權身分。完成前不得合併草稿 PR。
