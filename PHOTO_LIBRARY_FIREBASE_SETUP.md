# 共用照片資料專區（V2.6）Firebase 部署備註

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
- v2.3：既有和自訂分類的改名、圖示及說明更新到 `/photoLibraryV2/categories/{id}` 的 `name`、`emoji`、`description` 欄位。分類 ID 不改，舊照片維持原分類。
- v2.3：分類顯示排序由 `/photoLibraryV2/categories/{id}/order` 儲存，Firebase REST `PATCH /photoLibraryV2/categories.json` 使用多路徑鍵（例如 `news/order`）一次更新所有分類順序，避免覆寫原有分類內容。所有使用者共用此排序。
- v2.3：移動圖片只 `PATCH /photoLibraryV2/catalog/{photoId}` 的 `category`，保留原始照片檔 `/images/{photoId}`、圖片 ID、上傳人及獨立個人 `/pins/{accountHash}/{photoId}` 設定。所有使用者能使用圖片「移動」按鈕，僅上傳者介面顯示完整編輯、刪除。

- 分類讀取失敗時，原有共用照片仍可正常使用，但「新增資料區」停用並顯示 Firebase 分類權限錯誤。
- 舊版照片仍存在裝置 IndexedDB，按「搬移舊版照片」才上傳；舊檔不會被刪除。
- 圖庫讀取後每 60 秒自動同步、切回分頁時重新同步，也能手動按「重新同步」。
- 新增／編輯／刪除內容會更新所有使用者可見的共用圖庫；只有置頂順序個別保存。
- 上傳時自動壓縮原圖，避免大量占用 Firebase Spark Realtime Database 額度。

## V2.4 多選照片批次管理

- 啟用「多選照片」，可逐張勾選照片；「全選目前顯示」只選取目前專區及搜尋條件下的結果，跨分類切換仍保留勾選。一次最多選擇 200 張。
- 「批次移動」使用 `PATCH /photoLibraryV2/catalog.json` 的多路徑欄位更新：`{photoId}/category` 與 `{photoId}/updatedAt`，保持圖片原檔及個人置頂狀態不變。
- 「批次刪除」先顯示確認訊息，僅包含前端驗證為目前登入授權碼上傳的圖片；其他人的圖片不會加入刪除清單。
- 刪除用 `PATCH /photoLibraryV2.json` 一次送出 `catalog/{id}: null`、`images/{id}: null`、`pins/{accountHash}/{id}: null`，確保該批次的圖檔、清單索引和目前授權碼的置頂紀錄不會出現部分更新。其他使用者的舊置頂鍵不會自動清除，因照片已從清單刪除，並不影響圖庫顯示。
- **權限說明：** 目前「僅可刪除自己上傳的照片」是網站 UI 的檢查。若 Realtime Database 的 Rules 仍設公開寫入，此限制不是 Firebase 伺服器端強制執行。建議日後導入 Firebase Authentication／受保護後端與更嚴格的安全規則。


## V2.5 移動後顯示、重複照片與縮圖改善

- 共用照片縮圖改成 `object-fit: contain`，在桌機、平板、手機都顯示完整圖片而不裁切文字；縮圖本身仍使用上傳時產生的 JPEG 壓縮版。
- 資料庫單筆移動 `PATCH /photoLibraryV2/catalog/{id}.json` 只會改動 `category`、`updatedAt`，不會複製一筆新照片。若同圖同時顯示於兩個分類，通常代表共用目錄原已有多個獨立照片 ID。
- 所有寫入後（移動、批次移動、刪除、上傳、改名與置頂等）使用 `refreshAfterMutation`，先等待既有未完成的讀取，再主動重新讀取資料庫，避免舊讀取結果覆蓋剛寫入的畫面。
- 若有**縮圖資料完全相同**的多筆上傳紀錄，會在照片卡片標示數量；不會自動隱藏或刪除。上傳者可選擇其中一筆點「保留此張、整理重複」，確認後以單次 Firebase 多路徑 `PATCH /photoLibraryV2.json` 刪除本人上傳的其餘同圖副本，同時保留被選中的照片 ID 與目標分類。
- 如果遭刪的本人副本原先被目前登入授權碼設定為最愛，而保留的照片未置頂，清理時會將個人置頂轉移至保留照片。**其他使用者上傳的相同影像不會被此功能刪除**，其他帳號的最愛紀錄也不會自動轉移。
- 以上皆為前端權限行為；如果 Firebase Rules 仍允許公開寫入，權限保護必須於資料庫端另行加強。

## V2.6 資料區圖示選擇器

- 新增、編輯資料區時，提供 80 種 Emoji 圖示，分為常用分類、醫療健康、癌症／老化／長照、新聞／文書、科技／研究、保險／理財／生活六組。
- 可點選圖示格直接選定，並有即時預覽、中文關鍵字搜尋及自訂 Emoji 輸入。未填仍使用 📁。
- 延用 Firebase `/photoLibraryV2/categories/{id}/emoji` 字串欄位，不建立新資料庫路徑；既有分類 ID、照片分類、排序與個人置頂不變。
- 手機使用可捲動的圖示格，並在新增／修改時套用相同操作方式。

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

## V2.7 照片刪除審核

「刪除」、批次刪除與重複照片整理只建立待審申請。照片在審核期間仍可查看。管理者在 `vip-admin-spark.html` 用既有 Firebase 管理員帳號登入後，可在「照片刪除審核」預覽並核准或駁回。核准會同時移除縮圖索引與原圖，並記錄審核結果。駁回後原上傳者可重新送審。

部署時，將 `photo-deletion-rules.fragment.json` 的三組規則合併至 `rules.photoLibraryV2`，保留原有讀取權限與其他資料庫規則。移除或縮限根節點、`photoLibraryV2`、`catalog`、`images`、`deleteRequests` 中會授予刪除或審核寫入的較寬鬆規則及萬用規則。Firebase 的上層允許規則會覆蓋子路徑限制。確認 `members` 的管理員資格只能由受信任管理端設定。請先在 Rules 模擬器驗證下列流程，再發布規則與網頁。

- 一般使用者可上傳、搬移、編輯照片，並可申請刪除。待審時，原圖及目錄仍存在。
- 一般使用者與非管理員的 Firebase 帳號執行直接刪除及送出審核決定時，資料庫拒絕。
- 管理員駁回後照片保留，可再次送審。管理員核准時，申請狀態、目錄與原圖在同一次更新提交。
- 普通 VIP 授權碼目前仍是網頁登入。Firebase 只能依申請中的上傳者雜湊與照片資料比對，無法驗證送審者的 VIP 身分。管理員裁決與永久刪除則由 Firebase Auth 及 `members` 規則驗證。
