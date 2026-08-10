import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const [inputPath, outputPath, previewDir] = process.argv.slice(2);
const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const reportTitle = "本處抽水井歷年每月抽水量";

if (payload.waterRightCount !== 106 || payload.recordCount !== 824 || payload.monthlyRecordCount !== 9888) {
  throw new Error("歷史資料筆數驗證失敗");
}
if (payload.authorityCounts?.臺中市政府 !== 92 || payload.authorityCounts?.苗栗縣政府 !== 15) {
  throw new Error("主管機關統計驗證失敗");
}

const workbook = Workbook.create();
const summary = workbook.worksheets.add("摘要");
const annual = workbook.worksheets.add("年度橫向表");
const monthly = workbook.worksheets.add("月份直向表");

const titleFormat = {
  fill: "#0F6655",
  font: { bold: true, color: "#FFFFFF", size: 18 },
  verticalAlignment: "center",
};
const subtitleFormat = { fill: "#EAF4F0", font: { color: "#365C50", size: 10 } };

summary.showGridLines = false;
summary.mergeCells("A1:F1");
summary.getRange("A1").values = [[reportTitle]];
summary.getRange("A1:F1").format = titleFormat;
summary.getRange("A1:F1").format.rowHeight = 34;
summary.mergeCells("A2:F2");
summary.getRange("A2").values = [["資料來源：經濟部水利署水權資訊網｜涵蓋臺中市政府及苗栗縣政府核准水權"]];
summary.getRange("A2:F2").format = subtitleFormat;
summary.getRange("A4:A11").values = [
  ["井籍總數"], ["有歷史資料水權數"], ["臺中市政府核准"], ["苗栗縣政府核准"],
  ["年度資料筆數"], ["月份資料筆數"], ["資料年度"], ["無歷史資料新井"],
];
summary.getRange("B4:B11").values = [
  [payload.wellCount], [payload.waterRightCount], [payload.authorityCounts.臺中市政府],
  [payload.authorityCounts.苗栗縣政府], [payload.recordCount], [payload.monthlyRecordCount],
  [`民國${payload.yearFrom}年至${payload.yearTo}年`], [payload.emptyWaterRightNos.join("、")],
];
summary.getRange("A4:A11").format = { fill: "#DDEDE7", font: { bold: true, color: "#124F40" } };
summary.getRange("A4:B11").format.borders = { preset: "outside", style: "thin", color: "#A9C6BB" };
summary.getRange("B4:B9").format.numberFormat = "#,##0";
summary.mergeCells("A13:F13");
summary.getRange("A13").values = [["說明：官方空白值標示為「未填報」；官方數值0保留為「已填報、抽水量0」。5口井未出現在官方歷史報表，不建立虛擬月份資料。"]];
summary.getRange("A13:F13").format = { fill: "#FFF4D6", font: { color: "#66501A", size: 10 }, wrapText: true };
summary.getRange("A13:F13").format.rowHeight = 34;
summary.getRange("A:A").format.columnWidth = 22;
summary.getRange("B:B").format.columnWidth = 42;
summary.getRange("C:F").format.columnWidth = 14;

const annualHeaders = ["序號", "水權狀號", "水井名稱", "工作站別", "主管機關", "年度", "1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "年度合計(m³)"];
const annualRows = payload.records.map((record, index) => [
  index + 1, record.waterRightNo, record.wellName, record.station, record.authority,
  record.yearMinguo, ...record.monthlyM3,
]);
const firstAnnualRow = 5;
const lastAnnualRow = firstAnnualRow + annualRows.length - 1;
annual.showGridLines = false;
annual.mergeCells("A1:S1");
annual.getRange("A1").values = [[reportTitle]];
annual.getRange("A1:S1").format = titleFormat;
annual.getRange("A1:S1").format.rowHeight = 32;
annual.mergeCells("A2:S2");
annual.getRange("A2").values = [[`來源：${payload.source}｜官方匯出檔：${payload.sourcePdf}`]];
annual.getRange("A2:S2").format = subtitleFormat;
annual.getRange("A4:S4").values = [annualHeaders];
annual.getRange(`A${firstAnnualRow}:R${lastAnnualRow}`).values = annualRows;
annual.getRange(`S${firstAnnualRow}`).formulas = [[`=SUM(G${firstAnnualRow}:R${firstAnnualRow})`]];
annual.getRange(`S${firstAnnualRow}:S${lastAnnualRow}`).fillDown();
annual.tables.add(`A4:S${lastAnnualRow}`, true, "AllAnnualTable").style = "TableStyleMedium4";
annual.freezePanes.freezeRows(4);
annual.freezePanes.freezeColumns(2);
annual.getRange(`A4:S${lastAnnualRow}`).format.verticalAlignment = "center";
annual.getRange(`F${firstAnnualRow}:F${lastAnnualRow}`).setNumberFormat('0"年"');
annual.getRange(`G${firstAnnualRow}:S${lastAnnualRow}`).setNumberFormat("#,##0.00");
annual.getRange("A:A").format.columnWidth = 9;
annual.getRange("B:B").format.columnWidth = 15;
annual.getRange("C:C").format.columnWidth = 28;
annual.getRange("D:D").format.columnWidth = 13;
annual.getRange("E:E").format.columnWidth = 16;
annual.getRange("F:F").format.columnWidth = 10;
annual.getRange("G:R").format.columnWidth = 12;
annual.getRange("S:S").format.columnWidth = 17;

const monthlyHeaders = ["序號", "水權狀號", "水井名稱", "工作站別", "主管機關", "年度", "月份", "民國年月", "抽水量(m³)", "填報狀態"];
const monthlyRows = [];
for (const record of payload.records) {
  record.monthlyM3.forEach((value, monthIndex) => monthlyRows.push([
    monthlyRows.length + 1, record.waterRightNo, record.wellName, record.station,
    record.authority, record.yearMinguo, monthIndex + 1,
    `${record.yearMinguo}-${String(monthIndex + 1).padStart(2, "0")}`,
    value, value == null ? "未填報" : "已填報",
  ]));
}
const firstMonthlyRow = 5;
const lastMonthlyRow = firstMonthlyRow + monthlyRows.length - 1;
monthly.showGridLines = false;
monthly.mergeCells("A1:J1");
monthly.getRange("A1").values = [[reportTitle]];
monthly.getRange("A1:J1").format = titleFormat;
monthly.getRange("A1:J1").format.rowHeight = 32;
monthly.mergeCells("A2:J2");
monthly.getRange("A2").values = [["每列為一張水權狀的一個月份；空白值與數值0分開標示"]];
monthly.getRange("A2:J2").format = subtitleFormat;
monthly.getRange("A4:J4").values = [monthlyHeaders];
monthly.getRange(`A${firstMonthlyRow}:J${lastMonthlyRow}`).values = monthlyRows;
monthly.tables.add(`A4:J${lastMonthlyRow}`, true, "AllMonthlyTable").style = "TableStyleMedium4";
monthly.freezePanes.freezeRows(4);
monthly.freezePanes.freezeColumns(2);
monthly.getRange(`A4:J${lastMonthlyRow}`).format.verticalAlignment = "center";
monthly.getRange(`F${firstMonthlyRow}:F${lastMonthlyRow}`).setNumberFormat('0"年"');
monthly.getRange(`G${firstMonthlyRow}:G${lastMonthlyRow}`).setNumberFormat('0"月"');
monthly.getRange(`I${firstMonthlyRow}:I${lastMonthlyRow}`).setNumberFormat("#,##0.00");
monthly.getRange("A:A").format.columnWidth = 9;
monthly.getRange("B:B").format.columnWidth = 15;
monthly.getRange("C:C").format.columnWidth = 28;
monthly.getRange("D:D").format.columnWidth = 13;
monthly.getRange("E:E").format.columnWidth = 16;
monthly.getRange("F:G").format.columnWidth = 10;
monthly.getRange("H:H").format.columnWidth = 13;
monthly.getRange("I:I").format.columnWidth = 16;
monthly.getRange("J:J").format.columnWidth = 13;

for (let recordIndex = 0; recordIndex < payload.records.length; recordIndex += 1) {
  const record = payload.records[recordIndex];
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const row = monthlyRows[recordIndex * 12 + monthIndex];
    if (row[8] !== record.monthlyM3[monthIndex]) throw new Error("橫向與直向月份數值不一致");
    if ((row[8] == null) !== (row[9] === "未填報")) throw new Error("填報狀態驗證失敗");
  }
  const total = record.monthlyM3.reduce((sum, value) => sum + (value ?? 0), 0);
  if (record.sourceTotalM3 != null && Math.abs(total - record.sourceTotalM3) > 0.01) {
    throw new Error(`年度合計不一致：${record.waterRightNo} ${record.yearMinguo}年`);
  }
}

const inspection = await workbook.inspect({
  kind: "table", range: "摘要!A1:F13", include: "values,formulas",
  tableMaxRows: 14, tableMaxCols: 6,
});
console.log(inspection.ndjson);
const errors = await workbook.inspect({
  kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 50 }, summary: "formula error scan",
});
console.log(errors.ndjson);

await fs.mkdir(previewDir, { recursive: true });
for (const [sheetName, range, fileName] of [
  ["摘要", "A1:F13", "summary.png"],
  ["年度橫向表", "A1:S14", "annual.png"],
  ["月份直向表", "A1:J16", "monthly.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: sheetName === "摘要" ? 1.5 : 1, format: "png" });
  await fs.writeFile(`${previewDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, annualRows: annualRows.length, monthlyRows: monthlyRows.length, waterRights: payload.waterRightCount }));
