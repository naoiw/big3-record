const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePrSheet, parseBodyWeightSheet, fetchTrainingData } = require("./dist/sheetApi.js");

const wrap = object => "google.visualization.Query.setResponse(" + JSON.stringify(object) + ");";
const table = (cols, rows) => wrap({ status: "ok", table: {
  cols: cols.map(label => ({ label })),
  rows: rows.map(values => ({ c: values.map(value => ({ v: value })) })),
} });

test("reads PR events and body-weight measurements", () => {
  const pr = parsePrSheet(table(["date", "exercise", "weight_kg"], [
    ["2026/09/01", "bp", 110], ["2026/09/02", "DL", 170],
  ]));
  const weights = parseBodyWeightSheet(table(["date", "weight_kg"], [["2026/09/01", 86]]));
  assert.deepEqual(pr[0], { date: "2026/09/01", exercise: "BP", weightKg: 110 });
  assert.equal(pr[1].exercise, "DL");
  assert.equal(weights[0].weightKg, 86);
});

test("accepts explicit header rows and rejects mismatched headers", () => {
  const pr = parsePrSheet(table(["", "", ""], [
    ["date", "exercise", "weight_kg"], ["2026/03/01", "SQ", 120],
  ]));
  assert.equal(pr.length, 1);
  assert.throws(() => parsePrSheet(table(["timestamp", "BP", "SQ"], [
    ["2026/03/01", 120, null],
  ])), /ヘッダー/);
});

test("parses quoted and unquoted gviz Date expressions", () => {
  const data = table(["date", "weight_kg"], [["Date(2026,9,31)", 86]]);
  assert.equal(parseBodyWeightSheet(data)[0].date, "2026-10-31");
  const unquoted = data.replace('"Date(2026,9,31)"', 'Date(2026,9,31)');
  assert.equal(parseBodyWeightSheet(unquoted)[0].date, "2026-10-31");
});

test("retains invalid rows so the metrics layer can display warnings", () => {
  const pr = parsePrSheet(table(["date", "exercise", "weight_kg"], [
    ["2026/01/01", "BP", 100], ["bad-date", "SQ", -10], ["2026/02/01", "EX", "invalid"],
  ]));
  assert.equal(pr.length, 3);
  assert.equal(pr[1].weightKg, -10);
  assert.equal(pr[2].exercise, "EX");
  assert.ok(Number.isNaN(pr[2].weightKg));
});

test("reads exactly two named tabs", async () => {
  const oldFetch = global.fetch;
  const urls = [];
  global.fetch = async url => {
    urls.push(String(url));
    return { ok: true, text: async () => String(url).includes("sheet=pr_records")
      ? table(["date", "exercise", "weight_kg"], [["2026/01/01", "BP", 110]])
      : table(["date", "weight_kg"], [["2026/01/01", 85]]) };
  };
  try {
    const result = await fetchTrainingData();
    assert.deepEqual(result, {
      prRecords: [{ date: "2026/01/01", exercise: "BP", weightKg: 110 }],
      bodyWeightRecords: [{ date: "2026/01/01", weightKg: 85 }],
    });
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.includes("&sheet=")));
  } finally { global.fetch = oldFetch; }
});

test("treats two valid empty tabs as empty data", async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => ({ ok: true, text: async () =>
    String(url).includes("sheet=pr_records")
      ? table(["date", "exercise", "weight_kg"], [])
      : table(["date", "weight_kg"], []) });
  try {
    assert.deepEqual(await fetchTrainingData(), { prRecords: [], bodyWeightRecords: [] });
  } finally { global.fetch = oldFetch; }
});

test("does not silently fall back when headers are incorrect", async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => ({ ok: true, text: async () =>
    String(url).includes("sheet=pr_records")
      ? table(["date", "exercise", "weight_kg"], [["2026/01/01", "BP", 110]])
      : table(["timestamp", "BP", "SQ"], [["2026/01/01", 100, 120]]) });
  try {
    await assert.rejects(fetchTrainingData(), /スプレッドシートの形式/);
  } finally { global.fetch = oldFetch; }
});

test("reports inaccessible tabs as fetch errors", async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => String(url).includes("sheet=body_weight")
    ? { ok: false, status: 403 }
    : { ok: true, text: async () => table(["date", "exercise", "weight_kg"], []) };
  try {
    await assert.rejects(fetchTrainingData(), /body_weight.*403/);
  } finally { global.fetch = oldFetch; }
});
