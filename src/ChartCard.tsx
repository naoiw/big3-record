import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { LogRow } from "./sheetApi";
import { parseTimestamp } from "./timeRange";

/** 縦軸の補助線（横線）の本数（全グラフで統一） */
const Y_TICK_COUNT = 5;

/** 縦軸の余白（表示データの min - padding 〜 max + padding が縦軸になる） */
const Y_PADDING_BY_KEY: Record<NumericDataKey, number> = {
  total: 5,
  bp: 2.5,
  sq: 2.5,
  dl: 2.5,
  bodyWeight: 1,
};

type NumericDataKey = "total" | "bp" | "sq" | "dl" | "bodyWeight";

function getDomainWithPadding(values: number[], padding: number): [number, number] {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return [0, 100];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  return [min - padding, max + padding];
}

interface ChartCardProps {
  title: string;
  unit: string;
  dataKey: NumericDataKey;
  data: LogRow[];
  color: string;
}

/** セル値を数値に統一（空文字・無効は null） */
function toNum(v: unknown): number | null {
  if (v == null || (typeof v === "string" && v === "")) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 日付昇順にソートし、BP/SQ/DL の空欄を「それ以前で最も新しい値」で補完した行の配列を返す */
function sortAndFillBpSqDl(rows: LogRow[]): LogRow[] {
  const sorted = [...rows].sort((a, b) => {
    const ta = parseTimestamp(a.timestamp)?.getTime() ?? Infinity;
    const tb = parseTimestamp(b.timestamp)?.getTime() ?? Infinity;
    return ta - tb;
  });
  let lastBp: number | null = null;
  let lastSq: number | null = null;
  let lastDl: number | null = null;
  return sorted.map((row) => {
    const bp = toNum(row.bp);
    const sq = toNum(row.sq);
    const dl = toNum(row.dl);
    if (bp != null) lastBp = bp;
    if (sq != null) lastSq = sq;
    if (dl != null) lastDl = dl;
    return {
      ...row,
      bp: bp ?? lastBp,
      sq: sq ?? lastSq,
      dl: dl ?? lastDl,
    };
  });
}

export function ChartCard({
  title,
  unit,
  dataKey,
  data,
  color,
}: ChartCardProps) {
  // 古い→新しいでソートし、BP/SQ/DL の空欄を直前の有効値で補完
  const filledRows = sortAndFillBpSqDl(data);

  const chartData = filledRows.map((row) => {
    const bp = row.bp != null && Number.isFinite(row.bp) ? row.bp : null;
    const sq = row.sq != null && Number.isFinite(row.sq) ? row.sq : null;
    const dl = row.dl != null && Number.isFinite(row.dl) ? row.dl : null;
    const total =
      bp != null && sq != null && dl != null
        ? Math.round((bp + sq + dl) * 10) / 10
        : null;
    const bodyWeight = toNum(row.bodyWeight);
    return {
      ...row,
      bp,
      sq,
      dl,
      total,
      bodyWeight,
    };
  });

  const values = chartData
    .map((d) => d[dataKey])
    .filter((v): v is number => v != null && Number.isFinite(v));
  const domain = getDomainWithPadding(values, Y_PADDING_BY_KEY[dataKey]);

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ marginBottom: "0.5rem", fontSize: "1.1rem" }}>
        {title} ({unit})
      </h2>
      <div style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                if (Number.isNaN(d.getTime())) return v;
                return d.toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                });
              }}
            />
            <YAxis
              domain={domain}
              tickCount={Y_TICK_COUNT}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return String(v);
                return n.toFixed(1);
              }}
            />
            <Tooltip
              formatter={(value: number) => [value, title]}
              labelFormatter={(label) =>
                new Date(label).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                })
              }
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
