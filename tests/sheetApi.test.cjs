const test = require("node:test");
const assert = require("node:assert/strict");
const { parseGvizResponse, parsePrSheet, parseBodyWeightSheet, convertLegacy, fetchTrainingData } = require("./dist/sheetApi.js");

const wrap = object => "google.visualization.Query.setResponse(" + JSON.stringify(object) + ");";
const table = (cols, rows) => wrap({ status: "ok", table: {
  cols: cols.map(label => ({ label })),
  rows: rows.map(values => ({ c: values.map(value => ({ v: value })) })),
} });

test("new-format sheets support PR events and body-weight rows", () => {
  const pr = parsePrSheet(table(["date", "exercise", "weight_kg"], [
    ["2026/09/01", "bp", 110], ["2026/09/02", "DL", 170],
  ]));
  const weights = parseBodyWeightSheet(table(["date", "weight_kg"], [["2026/09/01", 86]]));
  assert.deepEqual(pr[0], { date: "2026/09/01", exercise: "BP", weightKg: 110 });
  assert.equal(pr[1].exercise, "DL");
  assert.equal(weights[0].weightKg, 86);
});

test("accepts explicitly emitted header as first row and rejects wrong columns", () => {
  const pr = parsePrSheet(table(["", "", ""], [
    ["date", "exercise", "weight_kg"], ["2026/03/01", "SQ", 120],
  ]));
  assert.equal(pr.length, 1);
  assert.throws(() => parsePrSheet(table(["timestamp", "BP", "SQ"], [
    ["2026/03/01", 120, null],
  ])), /ヘッダー/);
});

test("legacy five-column input retains first entry and transforms to events", () => {
  const legacy = parseGvizResponse(table(["timestamp", "BP", "SQ", "DL", "Body Weight"], [
    ["2026/01/01", 100, null, 150, 85],
    ["2026/02/01", 110, 120, null, null],
  ]));
  assert.equal(legacy.length, 2);
  const converted = convertLegacy(legacy);
  assert.equal(converted.prRecords.length, 4);
  assert.equal(converted.bodyWeightRecords.length, 1);
});

test("parses quoted or unquoted gviz Date expressions", () => {
  const data = table(["date", "weight_kg"], [["Date(2026,9,31)", 86]]);
  assert.equal(parseBodyWeightSheet(data)[0].date, "2026-10-31");
  assert.equal(parseBodyWeightSheet(data.replace('"Date(2026,9,31)"', 'Date(2026,9,31)'))[0].date, "2026-10-31");
});

test("legacy is used only when both new sheets are not ready", async () => {
  const oldFetch = global.fetch;
  const legacy = table(["timestamp", "BP", "SQ", "DL", "Body Weight"], [
    ["2026/01/01", 100, 120, 160, 84],
  ]);
  global.fetch = async url => ({
    ok: true, text: async () => String(url).includes("&sheet=")
      ? table(["timestamp", "BP", "SQ"], [["2026/01/01", 100, 120]]) : legacy,
  });
  try {
    const result = await fetchTrainingData();
    assert.equal(result.source, "legacy");
    assert.equal(result.prRecords.length, 3);
  } finally { global.fetch = oldFetch; }
});

test("two ready new sheets are used instead of the old sheet", async () => {
  const oldFetch = global.fetch;
  global.fetch = async url => ({
    ok: true, text: async () => String(url).includes("sheet=pr_records")
      ? table(["date", "exercise", "weight_kg"], [["2026/01/01", "BP", 110]])
      : table(["date", "weight_kg"], [["2026/01/01", 85]]),
  });
  try {
    const result = await fetchTrainingData();
    assert.equal(result.source, "split");
    assert.equal(result.prRecords.length, 1);
    assert.equal(result.bodyWeightRecords.length, 1);
  } finally { global.fetch = oldFetch; }
});
