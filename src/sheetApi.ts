/** Public, read-only Google Sheet. Do not include private data or credentials. */
export const SPREADSHEET_ID = "1hpUEOWQJ4bofox-do8eRF7fNlVknVyNK8kHsUiTOmAk";
export type Exercise = "BP" | "SQ" | "DL";

export interface PrRecord { date: string; exercise: Exercise; weightKg: number; }
export interface BodyWeightRecord { date: string; weightKg: number; }
export interface TrainingData {
  prRecords: PrRecord[];
  bodyWeightRecords: BodyWeightRecord[];
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

function readTable(text: string, expected: string[]): (Cell | null)[][] {
  const table = decodeGviz(text).table!;
  const rows = table.rows!.map(row => row.c ?? []);
  const names = (table.cols ?? []).map(col => (col.label ?? "").trim().toLowerCase());
  const first = rows[0]?.map(cell => cellText(cell).trim().toLowerCase()) ?? [];
  const header = expected.map(item => item.toLowerCase());
  const colMatches = header.every((name, index) => names[index] === name);
  const rowMatches = header.every((name, index) => first[index] === name);
  if (!colMatches && !rowMatches) {
    throw new Error("シートのヘッダーが一致しません: " + expected.join(", "));
  }
  return rowMatches ? rows.slice(1) : rows;
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

/** Reads only the two current tabs; missing tabs are treated as errors. */
async function fetchSheet(sheet: "pr_records" | "body_weight"): Promise<string> {
  const url = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID +
    "/gviz/tq?tqx=out:json&sheet=" + encodeURIComponent(sheet);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(sheet + " の取得に失敗しました (HTTP " + response.status + ")");
  }
  return response.text();
}

export async function fetchTrainingData(): Promise<TrainingData> {
  const [prResponse, weightResponse] = await Promise.all([
    fetchSheet("pr_records"),
    fetchSheet("body_weight"),
  ]);
  try {
    return {
      prRecords: parsePrSheet(prResponse),
      bodyWeightRecords: parseBodyWeightSheet(weightResponse),
    };
  } catch (error) {
    throw new Error("スプレッドシートの形式を確認してください: " +
      (error instanceof Error ? error.message : String(error)));
  }
}
