# VIP 永久刪除（Firebase Spark）— 尚需發布規則

## 已完成
- v0.1.6 獨立後台：https://jacky0530-spec.github.io/cathay/vip-admin-spark.html
- `firebase.spark-admin.rules.candidate.json` 已有 Firebase Emulator 測試（CI #44204800126 通過）。
- 正式網站只提交管理頁檔案；**尚未發布新的 Firebase Realtime Database Rules，也沒有刪除任何現有授權**。

## 實際功能
1. 管理員先將不再使用的 VIP 碼**停用**（值 `false`）。
2. 發布配套 Rules 後，管理頁重新整理會只在已停用帳號旁顯示「永久刪除」。
3. 管理員先確認名稱與授權碼尾四碼，再二次輸入 `刪除-末四碼`。
4. 管理頁寫入管理員專屬的 `vipRetired/<CODE>=true` 永久註銷標記，之後才刪除 `whitelist/<CODE>` 與 `vipProfiles/<CODE>`。
5. 已註銷的代碼不能再次設定給新人，以免舊持有人利用同一碼登入。
6. 不清除 `users/<CODE>` 登入歷史；不清除 Firebase Authentication 使用者，也不碰客戶 `localStorage.contactRecords`。

## 配套 Rules

請先核對 Firebase Console 仍是 `cathay-app-5889a`、當前 Rules 與先前發布的 Spark 版本相符。候選規則位於：
[firebase.spark-admin.rules.candidate.json](../firebase.spark-admin.rules.candidate.json)

這次新增／調整節點：
- `whitelist/$code`：管理員可新增、停用、重啟；已退休代碼不得再啟用／新增；**僅已停用且 `vipRetired/$code=true` 才可刪除**。
- `vipRetired/$code`：只有管理員可新建一次永久註銷標記，條件為該白名單已停用；無法刪除或改寫。
- `vipProfiles/$code`：只有管理員可編輯標籤，且只有白名單消失且有永久註銷標記後才可刪除。
- `members`、`users` 及 `whitelist` 原有匿名讀權保持不變。

**請勿在未核對 Console 其他正在使用規則前直接覆蓋。** Emulator 測試不會修改正式資料庫。正式 Rules 更新須由管理員在 Firebase Console 操作。

## 限制
舊前端內硬編碼的共用授權碼不依白名單檢查，無法從此功能安全刪除。刪除授權碼也不會立即登出已登入的瀏覽器（登入階段仍使用本機會話）。目前的 Spark 相容模式保留 `whitelist` 公開讀取、`users` 匿名寫入兩項既有風險。
