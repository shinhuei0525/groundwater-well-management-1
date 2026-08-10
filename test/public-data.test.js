import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readJson(path) {
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

test("public registry matches all 111 pumping records", async () => {
  const wells = await readJson("../docs/data/wells.json");
  const pumping = await readJson("../docs/data/pumping-records/pumping-records-115.json");
  const wellNumbers = wells.map((well) => well.waterRightNo);
  const pumpingNumbers = pumping.records.map((record) => record.waterRightNo);

  assert.equal(wells.length, 111);
  assert.equal(pumping.records.length, 111);
  assert.equal(new Set(wellNumbers).size, 111);
  assert.deepEqual(new Set(wellNumbers), new Set(pumpingNumbers));
  assert.equal(wells.filter((well) => well.latitude == null || well.longitude == null).length, 0);
  assert.equal(
    wells.filter((well) => !(well.attachments || []).some((file) => file.mimeType === "application/pdf")).length,
    0
  );
  for (const well of wells) {
    const pdf = well.attachments.find((file) => file.mimeType === "application/pdf");
    const content = await readFile(new URL(`../docs/data/attachments/${pdf.storedName}`, import.meta.url));
    assert.equal(content.subarray(0, 4).toString("ascii"), "%PDF", `${well.waterRightNo} 水權狀檔案無效`);
  }
  assert.equal(wellNumbers.includes("B0112603"), true);
  assert.equal(wellNumbers.includes("B1140034"), true);
  assert.equal(wellNumbers.includes("K0124336"), true);
  assert.equal(wellNumbers.includes("B1150091"), false);
});

test("official pumping history covers 106 current wells and leaves five wells empty", async () => {
  const wells = await readJson("../docs/data/wells.json");
  const history = await readJson("../docs/data/pumping-history.json");
  const historyNumbers = new Set(history.records.map((record) => record.waterRightNo));
  const expectedEmpty = ["B1150050", "B1150051", "B1150052", "B1150103", "K0124336"];

  assert.equal(wells.length, 111);
  assert.equal(history.waterRightCount, 106);
  assert.equal(history.recordCount, 824);
  assert.equal(history.monthlyRecordCount, 9888);
  assert.deepEqual(history.authorityCounts, { 臺中市政府: 91, 苗栗縣政府: 15 });
  assert.equal(history.records.filter((record) => record.authority === "臺中市政府").length, 708);
  assert.equal(history.records.filter((record) => record.authority === "苗栗縣政府").length, 116);
  assert.equal(new Set(history.records.filter((record) => record.waterRightNo.startsWith("K")).map((record) => record.waterRightNo)).size, 15);
  assert.deepEqual(history.emptyWaterRightNos, expectedEmpty);
  assert.deepEqual(wells.map((well) => well.waterRightNo).filter((number) => !historyNumbers.has(number)).sort(), expectedEmpty);
  assert.equal(history.records.some((record) => record.monthlyM3.some((value) => value === 0)), true);
  assert.equal(history.records.some((record) => record.monthlyM3.some((value) => value == null)), true);
  assert.equal(history.anomalyRecordCount, 9);
  assert.deepEqual(
    history.records.find((record) => record.waterRightNo === "K0124239" && record.yearMinguo === 114).anomalies,
    [{ month: 11, reasons: ["單月值明顯高於同年度其他月份"] }]
  );
  assert.deepEqual(
    history.records.find((record) => record.waterRightNo === "B1150050"),
    undefined
  );
});

test("history table shows the monthly water-right volume", async () => {
  const [html, app] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /水權量（m³）/);
  assert.match(html, /<col class="history-value-column">/);
  assert.match(app, /calculateMonthlyWaterRight/);
  assert.match(app, /registeredFlowCms \* 86400 \* daysInMonth/);
});
