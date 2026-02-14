/** スプレッドシートID（仕様で指定） */
const SPREADSHEET_ID = "1hpUEOWQJ4bofox-do8eRF7fNlVknVyNK8kHsUiTOmAk";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`;

/** 1行分のログデータ（A: 日付, B: BP, C: SQ, D: DL, E: Body Weight） */
export interface LogRow {
  timestamp: string;
  bp: number | null;
  sq: number | null;
  dl: number | null;
  bodyWeight: number | null;
}

/** gviz のセル（値は .v） */
interface GvizCell {
  v?: string | number;
  f?: string;
}

function getCellNumber(c: GvizCell | null | undefined): number | null {
  if (c?.v == null || c.v === "") return null;
  const n = Number(c.v);
  return Number.isFinite(n) ? n : null;
}

/**
 * 日付用セルを文字列に変換する。
 * - 数値または数字文字列（UNIX秒 or ミリ秒）の場合は ISO 日付文字列に変換
 * - それ以外（"YYYY/MM/DD" 等の既存形式）はそのまま返す
 */
function getCellTimestamp(c: GvizCell | null | undefined): string {
  if (c == null) return "";
  const raw = c.v ?? c.f;
  if (raw == null || raw === "") return "";
  const num = Number(raw);
  // UNIX秒（10桁）またはミリ秒（13桁）とみなして ISO に変換
  if (Number.isFinite(num) && num >= 1e9 && num < 1e15) {
    const ms = num < 1e12 ? num * 1000 : num;
    return new Date(ms).toISOString();
  }
  return String(c.f ?? c.v);
}

/**
 * スプレッドシートからデータを取得し、LogRow の配列に変換する。
 * 1行目はヘッダのためスキップ、2行目～がデータ。A: 日付, B: BP, C: SQ, D: DL, E: Body Weight。空セルは null。
 */
export async function fetchLogData(): Promise<LogRow[]> {
  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2)) as {
    table?: { rows?: { c?: (GvizCell | null)[] }[] };
  };
  const rows = json.table?.rows ?? [];
  const result: LogRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cells = row?.c ?? [];
    result.push({
      timestamp: getCellTimestamp(cells[0]),
      bp: getCellNumber(cells[1]),
      sq: getCellNumber(cells[2]),
      dl: getCellNumber(cells[3]),
      bodyWeight: getCellNumber(cells[4]),
    });
  }
  return result;
}
