/** Public, read-only Google Sheet used by the dashboard. Do not store secrets here. */
export const SPREADSHEET_ID = "1hpUEOWQJ4bofox-do8eRF7fNlVknVyNK8kHsUiTOmAk";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/" + SPREADSHEET_ID + "/gviz/tq?tqx=out:json";

export interface LogRow {
  timestamp: string;
  bp: number | null;
  sq: number | null;
  dl: number | null;
  bodyWeight: number | null;
}

interface GvizCell {
  v?: string | number | null;
  f?: string;
}

interface GvizResponse {
  table?: { rows?: { c?: (GvizCell | null)[] }[] };
}

function getCellNumber(cell: GvizCell | null | undefined): number | null {
  const value = cell?.v;
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getCellTimestamp(cell: GvizCell | null | undefined): string {
  const raw = cell?.v ?? cell?.f;
  if (raw === null || raw === undefined || raw === "") return "";

  const number = Number(raw);
  if (Number.isFinite(number) && number >= 1e9 && number < 1e15) {
    return new Date(number < 1e12 ? number * 1000 : number).toISOString();
  }

  // gviz dates can be represented as Date(year, zeroBasedMonth, day, ...).
  // Prefer the formatted sheet cell when available.
  if (typeof raw === "string" && /^Date\(/.test(raw)) {
    if (cell?.f) return cell.f;
    const match = /^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/.exec(raw);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]), Number(match[3]),
        Number(match[4] ?? 0), Number(match[5] ?? 0), Number(match[6] ?? 0));
      return date.toISOString();
    }
  }
  return String(cell?.f ?? raw);
}

/** Extract the JSON object from the Google Visualization callback wrapper. */
export function parseGvizResponse(responseText: string): LogRow[] {
  const start = responseText.indexOf("{");
  const end = responseText.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("Google Sheets の応答形式が不正です。");

  const data = JSON.parse(responseText.slice(start, end + 1)) as GvizResponse;
  if (!data.table || !Array.isArray(data.table.rows)) {
    throw new Error("Google Sheets から表データを取得できませんでした。");
  }

  // A gviz query normally consumes the first Sheet row as column labels.
  // Skip a heading only if it is explicitly present in the returned data.
  return data.table.rows
    .filter((row) => {
      const title = String(row.c?.[0]?.v ?? row.c?.[0]?.f ?? "").trim();
      return !/^(timestamp|date|日時|日付)$/i.test(title);
    })
    .map((row) => {
      const cells = row.c ?? [];
      return {
        timestamp: getCellTimestamp(cells[0]),
        bp: getCellNumber(cells[1]),
        sq: getCellNumber(cells[2]),
        dl: getCellNumber(cells[3]),
        bodyWeight: getCellNumber(cells[4]),
      };
    });
}

export async function fetchLogData(): Promise<LogRow[]> {
  const response = await fetch(SHEET_URL);
  if (!response.ok) throw new Error("HTTP " + response.status + ": " + response.statusText);
  return parseGvizResponse(await response.text());
}
