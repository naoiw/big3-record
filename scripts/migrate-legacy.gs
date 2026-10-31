/**
 * One-time migration from legacy A:date B:BP C:SQ D:DL E:bodyWeight.
 * Back up the spreadsheet first. Does not delete/overwrite any source data.
 */
const SOURCE_SHEET_NAME = "Sheet1"; // Replace with the actual existing tab name.

function migrateLegacyBig3() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const source = book.getSheetByName(SOURCE_SHEET_NAME);
  if (!source) throw new Error("Legacy tab does not exist: " + SOURCE_SHEET_NAME);
  if (book.getSheetByName("pr_records") || book.getSheetByName("body_weight")) {
    throw new Error("Destination tabs already exist; refusing to overwrite.");
  }
  const rows = source.getDataRange().getValues();
  if (rows.length < 2) throw new Error("No source records.");
  const timezone = book.getSpreadsheetTimeZone();
  const dated = [];
  const warnings = [];
  for (let i = 1; i < rows.length; i++) {
    const date = migrateDay_(rows[i][0], timezone);
    if (date) dated.push({ date, index: i + 1, values: rows[i] });
    else if (rows[i].some(value => value !== "" && value != null)) {
      warnings.push("Invalid date on row " + (i + 1));
    }
  }
  dated.sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index);
  const best = { BP: 0, SQ: 0, DL: 0 };
  const pr = [];
  const body = new Map();
  for (const item of dated) {
    const values = item.values;
    [["BP", 1], ["SQ", 2], ["DL", 3]].forEach(([exercise, column]) => {
      const raw = values[column];
      if (raw === "" || raw == null) return;
      const kg = Number(raw);
      if (!Number.isFinite(kg) || kg <= 0) {
        warnings.push("Invalid " + exercise + " on row " + item.index);
      } else if (kg > best[exercise]) {
        best[exercise] = kg;
        pr.push([item.date, exercise, kg]);
      } else {
        warnings.push("Non-increasing " + exercise + " on row " + item.index);
      }
    });
    const rawWeight = values[4];
    if (rawWeight !== "" && rawWeight != null) {
      const kg = Number(rawWeight);
      if (Number.isFinite(kg) && kg > 0) {
        if (body.has(item.date)) warnings.push("Duplicate body weight on " + item.date);
        body.set(item.date, kg);
      } else {
        warnings.push("Invalid body weight on row " + item.index);
      }
    }
  }
  const bodyRows = [...body.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!pr.length && !bodyRows.length) throw new Error("No valid records, aborted.");

  const prSheet = book.insertSheet("pr_records");
  const bodySheet = book.insertSheet("body_weight");
  prSheet.getRange("A:A").setNumberFormat("@"); // Keep ISO calendar date text.
  bodySheet.getRange("A:A").setNumberFormat("@");
  prSheet.getRange(1, 1, 1, 3).setValues([["date", "exercise", "weight_kg"]]);
  bodySheet.getRange(1, 1, 1, 2).setValues([["date", "weight_kg"]]);
  if (pr.length) prSheet.getRange(2, 1, pr.length, 3).setValues(pr);
  if (bodyRows.length) bodySheet.getRange(2, 1, bodyRows.length, 2).setValues(bodyRows);
  prSheet.setFrozenRows(1);
  bodySheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  Logger.log("Migrated: " + pr.length + " PRs, " + bodyRows.length + " weight days.");
  warnings.forEach(message => Logger.log("WARNING: " + message));
  Logger.log("Review records and " + warnings.length + " warnings before using new sheets.");
}

function migrateDay_(value, timezone) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, "yyyy-MM-dd");
  }
  const text = String(value ?? "").trim();
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[ T])/.exec(text);
  if (m) {
    const year = Number(m[1]), month = Number(m[2]), day = Number(m[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day) return null;
    return year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric >= 1e9 && numeric < 1e15) {
    return Utilities.formatDate(new Date(numeric < 1e12 ? numeric * 1000 : numeric),
      timezone, "yyyy-MM-dd");
  }
  return null;
}
