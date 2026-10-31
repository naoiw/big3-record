/** Calendar dates in the sheet are JST civil dates, not instants. */
export function dayNumber(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return NaN;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const result = Date.UTC(year, month - 1, date);
  const check = new Date(result);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === date ? result / 86400000 : NaN;
}

export function toDayKey(value: string): string | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?=$|[ T])/.exec(text);
  if (match) {
    const key = match[1] + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0");
    return Number.isFinite(dayNumber(key)) ? key : null;
  }
  if (!text) return null;
  const unix = Number(text);
  const parsed = Number.isFinite(unix) && unix >= 1e9 && unix < 1e15
    ? new Date(unix < 1e12 ? unix * 1000 : unix)
    : new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  // Date-time timestamps are converted to Japan's local calendar date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(parsed);
}

export function formatDay(day: string | null): string {
  return day ? day.replace(/-/g, "/") : "—";
}
