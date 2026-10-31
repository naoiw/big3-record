import type { LogRow } from "./sheetApi";
import { parseTimestamp } from "./timeRange";

export type LiftKey = "bp" | "sq" | "dl";
export type MetricKey = LiftKey | "total" | "bodyWeight";
export type HistoryRange = "all" | "12m" | "6m";

export interface HistoryPoint {
  timestamp: string;
  date: Date;
  bp: number | null;
  sq: number | null;
  dl: number | null;
  bodyWeight: number | null;
  total: number | null;
}

export interface BestStats {
  bp: number | null;
  sq: number | null;
  dl: number | null;
  total: number | null;
}

function validWeight(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

/** Sort chronologically; carry the last recorded value forward independently for each metric. */
export function prepareHistory(rows: LogRow[]): HistoryPoint[] {
  const sorted = rows
    .map((row) => ({ row, date: parseTimestamp(row.timestamp) }))
    .filter((item): item is { row: LogRow; date: Date } => item.date !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let bp: number | null = null;
  let sq: number | null = null;
  let dl: number | null = null;
  let bodyWeight: number | null = null;

  return sorted.map(({ row, date }) => {
    bp = validWeight(row.bp) ?? bp;
    sq = validWeight(row.sq) ?? sq;
    dl = validWeight(row.dl) ?? dl;
    bodyWeight = validWeight(row.bodyWeight) ?? bodyWeight;
    const total = bp !== null && sq !== null && dl !== null
      ? Math.round((bp + sq + dl) * 10) / 10
      : null;
    return { timestamp: row.timestamp, date, bp, sq, dl, bodyWeight, total };
  });
}

/** The combined PB is the sum of independent exercise maxima, not necessarily one session. */
export function getBestStats(history: HistoryPoint[]): BestStats {
  const max = (key: LiftKey): number | null => {
    const values = history.map((row) => row[key]).filter((n): n is number => n !== null);
    return values.length ? Math.max(...values) : null;
  };
  const bp = max("bp");
  const sq = max("sq");
  const dl = max("dl");
  return {
    bp, sq, dl,
    total: bp !== null && sq !== null && dl !== null
      ? Math.round((bp + sq + dl) * 10) / 10
      : null,
  };
}

export function toBodyWeightRatio(value: number | null, weight: number | null): number | null {
  if (value === null || weight === null || weight <= 0) return null;
  return Math.round((value / weight) * 100) / 100;
}

/** Relative to the newest record, not to today's date (historical logs remain viewable). */
export function filterHistory(history: HistoryPoint[], range: HistoryRange): HistoryPoint[] {
  if (range === "all" || history.length === 0) return history;
  const newest = history[history.length - 1].date;
  const cutoff = new Date(newest);
  cutoff.setMonth(cutoff.getMonth() - (range === "6m" ? 6 : 12));
  return history.filter((point) => point.date.getTime() >= cutoff.getTime());
}

export function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" }) : "—";
}
