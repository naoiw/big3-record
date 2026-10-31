const test = require("node:test");
const assert = require("node:assert/strict");
const { parseGvizResponse } = require("./dist/sheetApi.js");

test("reads the first data row (gviz already interprets column headers)", () => {
  const json = { table: { rows: [
    { c: [{ v: "2026/01/01" }, { v: 100 }, { v: null }, { v: 150 }, { v: 85 }] },
    { c: [{ v: "2026/02/01" }, { v: 105 }, { v: 110 }, { v: 160 }, { v: null }] },
  ] } };
  const rows = parseGvizResponse("/*O_o*/\ngoogle.visualization.Query.setResponse(" + JSON.stringify(json) + ");");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].bp, 100);
  assert.equal(rows[0].sq, null);
  assert.equal(rows[1].bodyWeight, null);
});

test("understands formatted gviz date cells and explicit header rows", () => {
  const json = { table: { rows: [
    { c: [{ v: "timestamp" }, { v: "BP" }] },
    { c: [{ v: "Date(2026,9,31)", f: "2026/10/31" }, { v: 115 }] },
  ] } };
  const rows = parseGvizResponse("google.visualization.Query.setResponse(" + JSON.stringify(json) + ");");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timestamp, "2026/10/31");
});

test("fails clearly on invalid gviz response", () => {
  assert.throws(() => parseGvizResponse("invalid"), /応答形式/);
});
