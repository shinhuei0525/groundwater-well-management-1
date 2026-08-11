# 地下水井基本資料維護

大甲工作站地下水井基本資料維護介面試作版。

## 開啟方式

直接下載並用瀏覽器開啟 `index.html`。目前基本資料、照片上傳及刪除結果保存在使用者瀏覽器；尚未連接正式 Google Sheets、Google Drive 或 Apps Script。

## 重新產生網頁

此資料夾位於 `groundwater-well-management` 倉庫內，`build.mjs` 會讀取倉庫的 `docs/data/wells.json` 與 `docs/data/attachments`，產生包含大甲站12口井及原有照片的單一 `index.html`。

```powershell
node .\prototypes\groundwater-well-basic-data-maintenance\build.mjs
```

產生後請確認：

- 大甲站水井數為12口。
- 12口井均有行政區及地段號。
- 原有照片共20張。
- 水權狀號只能查看，不能人工修改。
- 照片可新增、預覽及刪除。

## 後續正式化

下一階段預計以 Apps Script Web App 寫入 Google Sheets，照片改存每口井對應的 Google Drive 資料夾，並加入 Google 帳號白名單及操作紀錄。
