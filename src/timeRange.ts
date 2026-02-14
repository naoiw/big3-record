/**
 * スプレッドシートのタイムスタンプ文字列を Date にパースする。
 * UNIX秒（数値文字列）・ISO・"YYYY/MM/DD" 形式に対応。パースできない場合は null。
 */
export function parseTimestamp(ts: string): Date | null {
  if (!ts || typeof ts !== "string") return null;
  const trimmed = ts.trim();
  if (!trimmed) return null;
  // UNIX秒（10桁）またはミリ秒（13桁）の数値文字列
  const num = Number(trimmed);
  if (Number.isFinite(num) && num >= 1e9 && num < 1e15) {
    const ms = num < 1e12 ? num * 1000 : num;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // ISO / スラッシュ形式などに対応
  let d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  // "YYYY/MM/DD HH:MM" など
  d = new Date(trimmed.replace(/\//g, "-"));
  return Number.isNaN(d.getTime()) ? null : d;
}
