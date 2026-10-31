const test = require("node:test");
const assert = require("node:assert/strict");
const { prepareTraining, toBodyWeightRatio, filterByRange } = require("./dist/metrics.js");
const { toDayKey, dayNumber } = require("./dist/timeRange.js");

test("PR events are progressive; Total begins after all three lifts are recorded", () => {
  const data = prepareTraining([
    { date: "2026-09-15", exercise: "BP", weightKg: 115 },
    { date: "2026-09-01", exercise: "BP", weightKg: 110 },
    { date: "2026-09-02", exercise: "DL", weightKg: 160 },
    { date: "2026-09-27", exercise: "DL", weightKg: 170 },
    { date: "2026-10-01", exercise: "SQ", weightKg: 120 },
  ], []);
  assert.deepEqual(data.history.map(point => point.total), [null, null, null, null, 405]);
  assert.equal(data.history.at(-1).total, 405);
  assert.deepEqual(data.best, { bp: 115, sq: 120, dl: 170, total: 405 });
  assert.deepEqual(data.achieved, { bp: "2026-09-15", sq: "2026-10-01", dl: "2026-09-27" });
  assert.equal(data.history[2].bp, 115);
});


test("Total and Total ratio remain unavailable with only one or two lifts", () => {
  const oneLift = prepareTraining([
    { date: "2026-01-01", exercise: "BP", weightKg: 100 },
    { date: "2026-01-15", exercise: "BP", weightKg: 105 },
  ], [{ date: "2026-01-01", weightKg: 80 }]);
  assert.deepEqual(oneLift.best, { bp: 105, sq: null, dl: null, total: null });
  assert.deepEqual(oneLift.history.map(point => point.total), [null, null]);
  assert.equal(toBodyWeightRatio(oneLift.best.total, 80), null);

  const twoLifts = prepareTraining([
    { date: "2026-01-01", exercise: "BP", weightKg: 100 },
    { date: "2026-01-02", exercise: "DL", weightKg: 150 },
  ], []);
  assert.deepEqual(twoLifts.best, { bp: 100, sq: null, dl: 150, total: null });
  assert.deepEqual(twoLifts.history.map(point => point.total), [null, null]);
});

test("Total starts when third lift is first recorded and then follows PB increases", () => {
  const summary = prepareTraining([
    { date: "2026-01-01", exercise: "BP", weightKg: 100 },
    { date: "2026-01-02", exercise: "DL", weightKg: 150 },
    { date: "2026-01-03", exercise: "SQ", weightKg: 120 },
    { date: "2026-01-04", exercise: "BP", weightKg: 105 },
  ], [
    { date: "2026-01-01", weightKg: 80 },
    { date: "2026-01-05", weightKg: 81 },
  ]);
  assert.deepEqual(summary.history.map(p => p.total), [null, null, 370, 375, 375]);
  assert.equal(summary.best.total, 375);
  assert.equal(toBodyWeightRatio(summary.best.total, summary.latestWeight.weightKg), 4.63);
});

test("Total is unavailable when there are no valid lift records", () => {
  const bodyOnly = prepareTraining([], [{ date: "2026-01-01", weightKg: 80 }]);
  assert.equal(bodyOnly.best.total, null);
  assert.equal(bodyOnly.history[0].total, null);

  const invalid = prepareTraining([
    { date: "2026-01-01", exercise: "BP", weightKg: -50 },
    { date: "2026-01-02", exercise: "XX", weightKg: 100 },
  ], []);
  assert.equal(invalid.best.total, null);
  assert.equal(invalid.history.length, 0);
  assert.equal(invalid.warnings.length, 2);
});

test("duplicate dates, invalid values and non-increasing PB are warned, not applied", () => {
  const result = prepareTraining([
    { date: "2026-01-01", exercise: "BP", weightKg: 100 },
    { date: "2026-01-01", exercise: "BP", weightKg: 99 },
    { date: "2026-02-01", exercise: "BP", weightKg: 95 },
    { date: "2026-03-01", exercise: "BP", weightKg: 110 },
    { date: "2026-02-01", exercise: "SQ", weightKg: -4 },
    { date: "2026-05-01", exercise: "EX", weightKg: 400 },
  ], [
    { date: "2026-01-01", weightKg: 81 },
    { date: "2026-01-01", weightKg: 82 },
  ]);
  assert.equal(result.best.bp, 110);
  assert.equal(result.weights[0].weightKg, 82);
  assert.ok(result.warnings.length >= 4);
});

test("historical weight ratio requires a measurement within the preceding seven days", () => {
  const result = prepareTraining([
    { date: "2026-02-09", exercise: "BP", weightKg: 100 },
    { date: "2026-02-08", exercise: "DL", weightKg: 150 },
    { date: "2026-02-20", exercise: "SQ", weightKg: 100 },
  ], [{ date: "2026-02-01", weightKg: 80 }]);
  const byDay = Object.fromEntries(result.history.map(p => [p.day, p]));
  assert.equal(byDay["2026-02-08"].weightForRatio, 80);
  assert.equal(byDay["2026-02-09"].weightForRatio, null);
  assert.equal(byDay["2026-02-20"].weightForRatio, null);
  assert.equal(toBodyWeightRatio(100, 80), 1.25);
  assert.equal(toBodyWeightRatio(100, null), null);
});

test("seven-day moving average uses only actual measurements in past seven dates", () => {
  const result = prepareTraining([], [
    { date: "2026-04-01", weightKg: 80 },
    { date: "2026-04-06", weightKg: 82 },
    { date: "2026-04-07", weightKg: 84 },
    { date: "2026-04-08", weightKg: 86 },
  ]);
  assert.deepEqual(result.weights.map(p => p.avg7), [80, 81, 82, 84]);
  assert.equal(result.latestWeight.day, "2026-04-08");
  assert.equal(result.latestDate, "2026-04-08");
});

test("range filter uses last recorded day across both sheets", () => {
  const result = prepareTraining([
    { date: "2025-01-01", exercise: "BP", weightKg: 100 },
    { date: "2026-01-01", exercise: "BP", weightKg: 105 },
  ], [{ date: "2026-10-01", weightKg: 80 }]);
  assert.equal(filterByRange(result.history, "6m", result.latestDate).length, 1);
  assert.equal(filterByRange(result.history, "12m", result.latestDate).length, 2);
  assert.equal(filterByRange(result.history, "all", result.latestDate).length, 3);
});

test("JST date normalization validates calendar dates", () => {
  assert.equal(toDayKey("2026/2/8"), "2026-02-08");
  assert.equal(toDayKey("2026-02-31"), null);
  assert.ok(Number.isFinite(dayNumber("2026-02-28")));
  assert.ok(Number.isNaN(dayNumber("2026-02-31")));
  assert.equal(toDayKey("1761922800"), "2025-11-01");
  assert.equal(toDayKey("2025-10-31T15:00:00.000Z"), "2025-11-01");
});
