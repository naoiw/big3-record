import { toDayKey } from "./timeRange";

/** Public, read-only Google Sheet. Do not include private data or credentials. */
export const SPREADSHEET_ID = "1hpUEOWQJ4bofox-do8eRF7fNlVknVyNK8kHsUiTOmAk";
export type Exercise = "BP" | "SQ" | "DL";

export interface PrRecord { date: string; exercise: Exercise; weightKg: number; }
export interface BodyWeightRecord { date: string; weightKg: number; }
export interface TrainingData {
  prRecords: PrRecord[];
  bodyWeightRecords: BodyWeightRecord[];
  source: "split" | "legacy";
  warnings: string[];
}

interface Cell { v?: string | number | null; f?: string; }
interface ResponseBody {
  status?: string;
  errors?: { message?: string }[];
  table?: {
    cols?: { label?: string }[];
    rows?: { c?: (Cell | null)[] }[];
  };
}

function cellNumber(cell: Cell | null | undefined): number | null {
  const value = cell?.v;
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function cellText(cell: Cell | null | undefined): string {
  if (cell == null) return "";
  const raw = cell.v ?? cell.f;
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "string" && raw.startsWith("Date(")) {
    if (cell.f) return cell.f;
    const found = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,\d{1,2},\d{1,2},\d{1,2})?\)$/.exec(raw);
    if (found) {
      return found[1] + "-" + String(Number(found[2]) + 1).padStart(2, "0") +
        "-" + found[3].padStart(2, "0");
    }
  }
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric >= 1e9 && numeric < 1e15) {
    return new Date(numeric < 1e12 ? numeric * 1000 : numeric).toISOString();
  }
  return String(cell.f ?? raw);
}

/** Gviz wraps JSON in a callback and may emit unquoted Date(...) expressions. */
function decodeGviz(text: string): ResponseBody {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Google Sheets の応答形式が不正です。");
  const json = text.slice(start, end + 1)
    .replace(/("v"\s*:\s*)(Date\(\d{4}(?:,\d{1,2}){2,5}\))/g, '$1"$2"');
  const parsed = JSON.parse(json) as ResponseBody;
  if (parsed.status === "error") throw new Error(parsed.errors?.[0]?.message ?? "gviz query error");
  if (!Array.isArray(parsed.table?.rows)) throw new Error("シートの表データを取得できませんでした。");
  return parsed;
}

function readTable(text: string, expected: string[] | null): (Cell | null)[][] {
  const table = decodeGviz(text).table!;
  const rows = table.rows!.map(row => row.c ?? []);
  const names = (table.cols ?? []).map(col => (col.label ?? "").trim().toLowerCase());
  const first = rows[0]?.map(cell => cellText(cell).trim().toLowerCase()) ?? [];
  if (expected) {
    const header = expected.map(item => item.toLowerCase());
    const colMatches = header.every((name, index) => names[index] === name);
    const rowMatches = header.every((name, index) => first[index] === name);
    if (!colMatches && !rowMatches) throw new Error("シートのヘッダーが一致しません: " + expected.join(", "));
    return rowMatches ? rows.slice(1) : rows;
  }
  return rows.filter(row => !/^(timestamp|date|日時|日付)$/i.test(cellText(row[0]).trim()));
}

export function parsePrSheet(text: string): PrRecord[] {
  return readTable(text, ["date", "exercise", "weight_kg"]).map(row => ({
    date: cellText(row[0]), exercise: cellText(row[1]).trim().toUpperCase() as Exercise,
    weightKg: cellNumber(row[2]) ?? NaN,
  }));
}

export function parseBodyWeightSheet(text: string): BodyWeightRecord[] {
  return readTable(text, ["date", "weight_kg"]).map(row => ({
    date: cellText(row[0]), weightKg: cellNumber(row[1]) ?? NaN,
  }));
}

export interface LegacyRow {
  timestamp: string;
  bp: number | null;
  sq: number | null;
  dl: number | null;
  bodyWeight: number | null;
}
export function parseGvizResponse(text: string): LegacyRow[] {
  return readTable(text, null).map(row => ({
    timestamp: cellText(row[0]), bp: cellNumber(row[1]), sq: cellNumber(row[2]),
    dl: cellNumber(row[3]), bodyWeight: cellNumber(row[4]),
  }));
}

/** Keeps data unchanged; the shared metrics layer checks PB progression and duplicates. */
export function convertLegacy(rows: LegacyRow[]): Pick<TrainingData, "prRecords" | "bodyWeightRecords"> {
  const prRecords: PrRecord[] = [];
  const bodyWeightRecords: BodyWeightRecord[] = [];
  for (const row of rows) {
    const date = toDayKey(row.timestamp) ?? row.timestamp;
    for (const [field, exercise] of [
      ["bp", "BP"], ["sq", "SQ"], ["dl", "DL"],
    ] as const) {
      const weightKg = row[field];
      if (weightKg !== null) prRecords.push({ date, exercise, weightKg });
    }
    if (row.bodyWeight !== null) bodyWeightRecords.push({ date, weightKg: row.bodyWeight });
  }
  return { prRecords, bodyWeightRecords };
}

async function fetchSheet(sheet?: string): Promise<string> {
  const address = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID +
    "/gviz/tq?tqx=out:json" + (sheet ? "&sheet=" + encodeURIComponent(sheet) : "");
  const result = await fetch(address);
  if (!result.ok) throw new Error("HTTP " + result.status + ": " + result.statusText);
  return result.text();
}

/**
 * Switch only when BOTH new sheets are readable and at least one contains data.
 * Until then, read the original first sheet (read-only and no data mutation).
 */
export async function fetchTrainingData(): Promise<TrainingData> {
  let reason = "";
  try {
    const [pr, weight] = await Promise.all([fetchSheet("pr_records"), fetchSheet("body_weight")]);
    const prRecords = parsePrSheet(pr);
    const bodyWeightRecords = parseBodyWeightSheet(weight);
    if (prRecords.length || bodyWeightRecords.length) {
      return { prRecords, bodyWeightRecords, source: "split", warnings: [] };
    }
    reason = "新形式のシートが空のため旧形式を表示しています。";
  } catch (error) {
    reason = "新形式の2シートが未準備です（" +
      (error instanceof Error ? error.message : String(error)) + "）。";
  }
  try {
    const legacy = convertLegacy(parseGvizResponse(await fetchSheet()));
    return {
      ...legacy, source: "legacy",
      warnings: [reason, "旧形式からの暫定読み込みです。移行後は2シートを使用します。"],
    };
  } catch (error) {
    throw new Error("新形式と旧形式の両方から取得できません: " +
      (error instanceof Error ? error.message : String(error)));
  }
}
