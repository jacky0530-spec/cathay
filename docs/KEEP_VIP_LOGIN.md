# 保留原 VIP 登入，管理者新增人員：Firebase 原生方案

> 使用者 2026-11-17 明確決定：**不使用 Cloudflare**、不更換既有 VIP 授權碼與輸入步驟；未來由管理員新增及停用授權。**不要求備份、不改動本機 `localStorage.contactRecords`。**

## 預定架構
- 前端：GitHub Pages 原網址和 VIP 輸入視窗維持不變。
- 驗證與管理：使用 **Cloud Functions for Firebase**（Firebase 原生產品，不是 Cloudflare Worker），以 Firebase Admin SDK 存取已存在的 Realtime Database。
- 管理員：維持已驗證的 Firebase Authentication 電子郵件帳號；每次操作仍要驗證 `members/<UID>` 的 `active=true`、`role=admin`。
- 同事：不需建立郵件或設定密碼，只輸入原 VIP 碼。授權碼由 Cloud Function 在伺服器端做 HMAC 驗證，登入後核發 Firebase Custom Token，前端無感地以 `signInWithCustomToken` 建立 Firebase 身分。
- 新資料：`vipAccess/accounts/vip_<HMAC>`、`vipAccess/rate`、`vipAccess/audit`；不用第二套資料庫。對一般客戶端禁止存取私有管理索引。
- 管理員新增／停權、同步原 `whitelist` 的部分已完成**開發原型**，但不能當成正式可用功能。

## 不可妥協的發布條件
1. Firebase Cloud Functions 部署要求 Blaze 計費方案；**未經使用者明確同意不升級、不部署**，也不保證免費。
2. 現有老授權碼只允許管理員審核後同步；現有前端硬編碼的共用碼已公開，無法保證保密，須另外安排安全更換及回歸測試。
3. 正式站 `auth.js` 尚未改回 VIP 输入、亦未整合 `signInWithCustomToken`；**不可合併 V1.0**。
4. 舊 Firebase Rules `whitelist` 公開讀、`users` 公開寫必須在前端完全切換後再關閉；不能先關而讓同事無法登入。
5. 必須在 Rules 層阻擋已停用帳號存取受保護資料，不能只靠 UI 隱藏按鈕、localStorage 或前端重新整理。
6. CRM、商品試算與資料不搬移、不刪除；網站 origin 維持相同；原商品保費計算不能受到影響。
7. 完成 Firebase Emulator + 實機驗收，才考慮合併到 `main`。

## 目前狀態
- 已有純 Firebase Functions 原型：`vip-access/firebase-native/functions/`，目前沒有部署。
- Firebase Authentication 管理員已實機驗證，舊站使用者也已確認登入正常。
- 正式 Firebase Rules、`whitelist` 和其他現有資料未動。
- 未同意 Blaze 計費前，只開發離線測試與可驗證的上線檢查。
