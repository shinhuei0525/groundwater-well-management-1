# Groundwater Weekly Sync Automation

這個設計讓使用者只需要把原始 Excel、水權狀 PDF、抽水紀錄來源檔放到 Google Drive。Apps Script 每週觸發 GitHub Actions，GitHub Actions 再依照 `groundwater-well-sync` 與 `groundwater-pumping-sync` 的規則更新公開頁面的 `data/wells.json` 與 `data/pumping-history.json`。

## 架構

1. Google Drive 保存原始資料與索引資料。
2. Apps Script 每週一早上 6 點觸發 GitHub repository dispatch。
3. GitHub Actions 下載 Drive 來源、比對 Drive 索引、只處理有變動的 Excel / 水權狀 / 抽水紀錄。
4. GitHub Actions 產生公開頁 JSON 與同步報告。
5. 有變更時才 commit 到 GitHub Pages repository。

## Apps Script 設定

把 `apps-script/Code.gs` 貼到 Apps Script 專案，並在「專案設定 > 指令碼屬性」設定：

| 名稱 | 必填 | 說明 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 是 | GitHub token，需要可呼叫 repository dispatch。 |
| `GITHUB_OWNER` | 是 | repository owner，例如 `wushinhuei`。 |
| `GITHUB_REPO` | 是 | repository 名稱，例如 `groundwater-well-management`。 |
| `GITHUB_EVENT_TYPE` | 否 | 預設 `groundwater-sync`。 |
| `GROUNDWATER_ROOT_FOLDER_ID` | 否 | Drive 專案根目錄。預設已填入目前資料夾 id。 |
| `REGISTRY_FOLDER_ID` | 否 | `抽水井一覽表` 資料夾；放原始 Excel 一覽表。 |
| `WELL_INDEX_FOLDER_ID` | 否 | `00_系統索引資料` 資料夾。 |
| `PUMPING_INDEX_FOLDER_ID` | 否 | `00_系統索引資料/抽水紀錄` 資料夾。 |
| `WATER_RIGHT_FOLDER_ID` | 否 | `02_現行有效` 水權狀資料夾。 |

第一次設定後，手動執行一次 `installWeeklyTrigger()`，授權完成後會建立每週一 06:00 的排程。若要立即測試，執行 `testTriggerGroundwaterSync()`。

## GitHub 設定

把 `github-actions/groundwater-sync.yml` 放到 repository 的 `.github/workflows/groundwater-sync.yml`。

需要設定 GitHub secret：

| 名稱 | 說明 |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account JSON。該 service account 必須被分享進地下水井 Drive 根目錄與索引資料夾。 |

建議設定 repository variables，作為 Apps Script payload 缺漏時的備援：

| 名稱 | 目前建議值 |
| --- | --- |
| `GROUNDWATER_ROOT_FOLDER_ID` | `10ntiTPQl7190Tcmim_oTPDIs1eCDTctq` |
| `REGISTRY_FOLDER_ID` | `1ZwNZHe0JslvSY62ZAX2BvwPGTPosdz9d` |
| `WELL_INDEX_FOLDER_ID` | `16GN_DaR8slqnWH3d57l-jM-BLMAgDUsG` |
| `PUMPING_INDEX_FOLDER_ID` | `1DsnG04mvDZ4r01opr0i-wcFbqAd_FiOV` |
| `WATER_RIGHT_FOLDER_ID` | `193PcI2sW9IleuMYdtqE3h_aEj8aKx3K5` |

## Repository 內需要的同步程式

workflow 會呼叫兩段程式：

1. `scripts/groundwater_drive_sync.py`
   - 從 Drive 找最新一覽表 Excel。
   - 依登錄日期優先、Drive modifiedTime 備援，判斷是否需要重讀 Excel。
   - 若 Excel 未變，不重新解析全部內容。
   - 若 Excel 變了，只解析一次，拆成每口井索引。
   - 從 Excel 抽出內嵌照片 hash，用每口井 `photoHash` 判斷照片是否變更。
   - 掃描 Drive 水權狀資料夾 metadata，只下載新增或已修改的檔案。
   - 更新 Drive 的 `well-index.json`、`station-index.json`、`warnings.csv`、抽水紀錄索引與 `sync-index.json`。
   - 本工作區已建立雲端執行版範本：[scripts/groundwater_drive_sync.py](../scripts/groundwater_drive_sync.py)。

2. `work/sync_public_data.py`
   - 讀取最新 Drive 索引與目前公開頁資料。
   - 合併成公開頁 `data/wells.json` 與 `data/pumping-history.json`。
   - 檢查過期與即將過期水權狀。
   - 產出同步摘要。

目前本工作區已有 `scripts/groundwater_drive_sync.py` 與 `work/sync_public_data.py`。搬到實際 GitHub Pages repository 時，建議把兩支都放進 repository，或把 `work/sync_public_data.py` 移到 `scripts/sync_public_data.py`。

## 每週更新策略

- 固定每週一 06:00 由 Apps Script 觸發。
- 若一覽表 Excel 的登錄日期與 Drive metadata 都未改變，跳過 Excel 全檔解析。
- 若只有一口井照片變更，仍需讀取該 Excel 一次來取得內嵌圖片，但公開頁只更新該井相關資料與 hash。
- 若水權狀 PDF 在 Drive 有更新，只處理該檔案匹配到的井。
- 若抽水紀錄來源檔未變，跳過抽水紀錄重建。
- 若水權期限已過期，摘要中提醒更換掃描最新水權狀；無法判斷期限或匹配關係時才需要人工確認。
