const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareHistory, getBestStats, toBodyWeightRatio, filterHistory } = require("./dist/metrics.js");

test("sorts dates and carries forward only known values", () => {
  const history = prepareHistory([
    { timestamp: "2026-04-01", bp: null, sq: 120, dl: null, bodyWeight: 85 },
    { timestamp: "2026-01-01", bp: 100, sq: null, dl: 160, bodyWeight: null },
    { timestamp: "2026-08-01", bp: 115, sq: null, dl: 170, bodyWeight: 86 },
    { timestamp: "invalid", bp: 300, sq: 300, dl: 300, bodyWeight: 1 },
  ]);
  assert.equal(history.length, 3);
  assert.equal(history[0].total, null);
  assert.equal(history[1].total, 380);
  assert.equal(history[2].total, 405);
  assert.equal(history[1].bodyWeight, 85);
  assert.deepEqual(getBestStats(history), { bp: 115, sq: 120, dl: 170, total: 405 });
});

test("calculates ratios only with valid body weight", () => {
  assert.equal(toBodyWeightRatio(115, 86), 1.34);
  assert.equal(toBodyWeightRatio(100, null), null);
  assert.equal(toBodyWeightRatio(100, 0), null);
});

test("range filters are anchored to the most recent record", () => {
  const history = prepareHistory([
    { timestamp: "2025-01-01", bp: 90, sq: 90, dl: 90, bodyWeight: 80 },
    { timestamp: "2026-01-01", bp: 100, sq: 100, dl: 100, bodyWeight: 80 },
    { timestamp: "2026-10-01", bp: 110, sq: 110, dl: 110, bodyWeight: 80 },
  ]);
  assert.equal(filterHistory(history, "6m").length, 1);
  assert.equal(filterHistory(history, "12m").length, 2);
  assert.equal(filterHistory(history, "all").length, 3);
});
