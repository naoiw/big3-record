import type { BodyWeightRecord, Exercise, PrRecord } from "./sheetApi";
import { dayNumber, toDayKey } from "./timeRange";

export type LiftKey = "bp" | "sq" | "dl";
export type MetricKey = LiftKey | "total" | "bodyWeight";
export type HistoryRange = "all" | "12m" | "6m";
export type BestStats = Record<LiftKey | "total", number | null>;

export interface HistoryPoint {
  day: string;
  date: number;
  bp: number | null;
  sq: number | null;
  dl: number | null;
  total: number | null;
  /** Most recent body weight at this date, if measured within the preceding 7 days. */
  weightForRatio: number | null;
}
export interface WeightPoint {
  day: string;
  date: number;
  weightKg: number;
  avg7: number;
}
export interface TrainingSummary {
  history: HistoryPoint[];
  weights: WeightPoint[];
  best: BestStats;
  achieved: Record<LiftKey, string | null>;
  latestDate: string | null;
  latestWeight: WeightPoint | null;
  warnings: string[];
}

const EXERCISE: Record<Exercise, LiftKey> = { BP: "bp", SQ: "sq", DL: "dl" };
const LIFTS: LiftKey[] = ["bp", "sq", "dl"];

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function toBodyWeightRatio(value: number | null, weight: number | null): number | null {
  return value !== null && weight !== null && validPositive(weight)
    ? round(value / weight) : null;
}

/** Each day may contain multiple lifts but only one record per lift. */
export function prepareTraining(prRecords: PrRecord[], bodyWeightRecords: BodyWeightRecord[]): TrainingSummary {
  const warnings: string[] = [];
  const prByDay = new Map<string, Partial<Record<LiftKey, number>>>();
  const weightByDay = new Map<string, number>();

  for (const entry of prRecords) {
    const day = toDayKey(entry.date);
    const lift = EXERCISE[entry.exercise];
    if (!day || !lift || !validPositive(entry.weightKg)) {
      warnings.push("不正なPR記録を除外しました: " + String(entry.date) + " " + String(entry.exercise));
      continue;
    }
    const values = prByDay.get(day) ?? {};
    if (values[lift] !== undefined) {
      warnings.push(day + " の " + entry.exercise + " が重複しています（高い記録を使用）。");
    }
    values[lift] = Math.max(values[lift] ?? 0, entry.weightKg);
    prByDay.set(day, values);
  }
  for (const entry of bodyWeightRecords) {
    const day = toDayKey(entry.date);
    if (!day || !validPositive(entry.weightKg)) {
      warnings.push("不正な体重記録を除外しました: " + String(entry.date));
      continue;
    }
    if (weightByDay.has(day)) warnings.push(day + " の体重記録が重複しています（最後の値を使用）。");
    weightByDay.set(day, entry.weightKg);
  }

  const weightDays = [...weightByDay.keys()].sort();
  const weights: WeightPoint[] = weightDays.map(day => {
    const start = dayNumber(day) - 6;
    const recent = weightDays
      .filter(other => dayNumber(other) >= start && other <= day)
      .map(other => weightByDay.get(other)!);
    return {
      day, date: dayNumber(day) * 86400000, weightKg: weightByDay.get(day)!,
      avg7: round(recent.reduce((a, b) => a + b, 0) / recent.length),
    };
  });

  const best: BestStats = { bp: null, sq: null, dl: null, total: null };
  const achieved: Record<LiftKey, string | null> = { bp: null, sq: null, dl: null };
  const history: HistoryPoint[] = [];
  const days = [...new Set([...prByDay.keys(), ...weightDays])].sort();
  let weightIndex = -1;
  for (const day of days) {
    const atDay = prByDay.get(day);
    if (atDay) {
      for (const lift of LIFTS) {
        const submitted = atDay[lift];
        if (submitted === undefined) continue;
        if (best[lift] !== null && submitted <= best[lift]) {
          warnings.push(day + " の " + lift.toUpperCase() + " は前回のPR以下のため除外しました。");
        } else {
          best[lift] = submitted;
          achieved[lift] = day;
        }
      }
    }
    while (weightIndex + 1 < weights.length && weights[weightIndex + 1].day <= day) weightIndex++;
    const currentWeight = weightIndex >= 0 ? weights[weightIndex] : null;
    const age = currentWeight ? dayNumber(day) - dayNumber(currentWeight.day) : Infinity;
    const weightForRatio = currentWeight && age >= 0 && age <= 7 ? currentWeight.weightKg : null;
    best.total = LIFTS.every(lift => best[lift] !== null)
      ? round(best.bp! + best.sq! + best.dl!, 1) : null;
    history.push({ day, date: dayNumber(day) * 86400000, ...best, weightForRatio });
  }

  return {
    history, weights, best: { ...best }, achieved,
    latestWeight: weights.length ? weights[weights.length - 1] : null,
    latestDate: days.length ? days[days.length - 1] : null, warnings,
  };
}

/** Time range relative to the newest entry (PR or body weight). */
export function filterByRange<T extends { day: string }>(
  points: T[], range: HistoryRange, latestDay: string | null,
): T[] {
  if (range === "all" || !latestDay) return points;
  const [year, month, day] = latestDay.split("-").map(Number);
  const cutoff = new Date(Date.UTC(year, month - 1, day));
  cutoff.setUTCMonth(cutoff.getUTCMonth() - (range === "6m" ? 6 : 12));
  const start = cutoff.toISOString().slice(0, 10);
  return points.filter(point => point.day >= start);
}
