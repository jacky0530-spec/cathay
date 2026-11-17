# Firebase Spark 規則：2026-11-17 控制台截圖核對結果

> **只有規則草稿，尚未發布。** Firebase Console 截圖顯示目前正式資料庫只有 `whitelist`、`users`、`members` 三組已設定 Rules；原有資料可能另有節點，本文件不主張覆蓋未知的後續變更。

## 截圖核實的正式生效規則
```json
{
  "rules": {
    "whitelist": {
      ".read": true,
      ".write": false
    },
    "users": {
      ".read": false,
      ".write": true
    },
    "members": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": false
      }
    }
  }
}
```

## 候選版變動範圍

[下載／檢視候選規則](../firebase.spark-admin.rules.candidate.json)

僅增加：
1. `/whitelist/$code`：唯有登入的 `members/<UID>` `active=true, role=admin` 可逐筆寫入；代碼為 1–64 個大寫英數／底線／連字號，只能寫入 `true` 或 `false`，不可刪除或整份覆寫白名單。
2. `/vipProfiles`：新增管理員專用識別標籤，非管理員不能讀取；每組標籤 1–80 字元，名稱以任意字串內容保存，不包含密碼。

**原本 `whitelist` 匿名讀取、`users` 匿名寫入、`members/$uid` 自己可讀及禁止寫入，均保持原本行為**。此保留是為確保舊網站相容，不代表安全隱患已修好。

## 安全操作

1. GitHub Actions 先通過 `test-spark-rules.mjs` 模擬器測試。
2. Firebase Console → Realtime Database → Rules 先將候選規則貼入**編輯器但不發布**。
3. 使用右上「規則模擬工具」按匿名、一般 UID 和已驗證的管理員 UID 分別測試：
   - 匿名 **read** `/whitelist` → 應允許；匿名 **write** `/whitelist/TEST_SAMPLE` → 應拒絕；
   - 一般 UID **write** `/whitelist/TEST_SAMPLE` → 應拒絕；
   - 管理員 UID **write** `/whitelist/TEST_SAMPLE` 布林值 `true` → 應允許；刪除或覆寫整個 `/whitelist` → 應拒絕；
   - 匿名 **read** `/vipProfiles` → 應拒絕；管理員 **read** `/vipProfiles` → 應允許。
4. 測試顯示的結果是模擬，不會新增測試 VIP 授權；不要直接在「資料」頁寫入真實測試碼。
5. 再確認 Console 仍是同一 Firebase 專案 `cathay-app-5889a`，由管理員決定何時發布。

## 未解決的限制
- 公開讀取 `whitelist` 代表 VIP 碼可被列舉，無法視為秘密；GitHub Pages 的 HTML/JS 亦可被任何人讀取。
- 舊 `auth.js` 另有硬編碼通用授權碼，可以繞過白名單；Spark 管理後台無法使這些共用碼失效。
- 舊 `users` 仍可匿名寫入，未做真正伺服器端驗證。
- **發布規則本身不會把 `manager.html` 部署到正式 GitHub Pages**；正式管理頁需要獨立從開發分支選擇性上線，不能直接合併原 V1.0 草稿的全員 Firebase email 登入版本。
