# 共用照片資料專區（V2.2）Firebase 部署備註

正式頁面：`photos.html`
JavaScript：`photos.js`
樣式：`photos.css`
Firebase 專案：`cathay-app-5889a`
Realtime Database：`https://cathay-app-5889a-default-rtdb.firebaseio.com`

## 設計與資料結構

共用照片與個人置頂分開保存：

- `/photoLibraryV2/catalog/{id}`：共用圖片描述、分類、縮圖（JPEG Data URL）、上傳者識別、時間。
- `/photoLibraryV2/images/{id}`：放大用 JPEG 壓縮圖片（Data URL）。只有點圖放大時讀取。
- `/photoLibraryV2/pins/{accountHash}/{id}`：個人置頂時間戳記。相同授權碼跨裝置使用同一組最愛。
- `/photoLibraryV2/categories/{categoryId}`：使用者新增的共用資料區（名稱、圖示、說明、建立時間）。全員讀取同一份分類清單；預設分類「新聞剪報、癌症議題、醫療收據、老化議題」由程式內建。
- 分類讀取失敗時，原有共用照片仍可正常使用，但「新增資料區」停用並顯示 Firebase 分類權限錯誤。
- 舊版照片仍存在裝置 IndexedDB，按「搬移舊版照片」才上傳；舊檔不會被刪除。
- 圖庫讀取後每 60 秒自動同步、切回分頁時重新同步，也能手動按「重新同步」。
- 新增／編輯／刪除內容會更新所有使用者可見的共用圖庫；只有置頂順序個別保存。
- 上傳時自動壓縮原圖，避免大量占用 Firebase Spark Realtime Database 額度。

## 上線驗證與待完成工作

⚠️ **不能只靠 GitHub Pages 部署就保證 Firebase 可以寫入。** 目前 `auth.js` 使用網頁授權碼（localStorage）且不會核發 Firebase Authentication ID Token；`photos.js` 使用 Firebase Realtime Database 的未登入 REST 存取方式。能否讀寫取決於實際資料庫 Rules，這些規則未在本次更新中修改或驗證。

建議下一階段使用 Firebase 官方外掛連接該 Firebase 專案，確認現有 Realtime Database 規則，並採用 Firebase Authentication 或可信任後端保護照片寫入。**請勿直接把資料庫根目錄設成所有人可任意讀寫，也不要覆蓋其他既有 whitelist/users 規則。**

若規則拒絕照片讀取，頁面會顯示「Firebase 尚未授權共用照片資料讀寫」，且不會誤稱照片已同步。

## 驗收步驟

1. 在 Firebase 正確授權後，用 A 授權碼登入，上傳一張新聞剪報。
2. 用不同裝置的 B 授權碼登入，按重新同步，應看見同一張照片。
3. B 將照片設成最愛置頂，A 的排序不能因此被改動。
4. B 與 A 在不同裝置使用自己的授權碼，應各自看到個人置頂排序。
5. 測試放大、分類、編輯、刪除及備份。共用內容的刪除應影響所有使用者。
6. 若已有舊版本機照片，點「搬移舊版照片」，不應產生同 ID 的重複項目。

## 目前限制

- Firebase Spark Realtime Database 有容量與下載流量額度；這不是無限制圖床。
- 原始的 20MB 照片會經過 JPEG 壓縮後上傳，需特別注意收據小字是否清楚。
- 授權碼若被多個人共用，兩人也會共用相同的個人最愛設定。
- 現有「只有上傳者可編輯／刪除」僅為前端限制；未設 Firebase Auth 與正確資料庫規則前，不是伺服器強制安全權限。
