import { useMemo } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  toBodyWeightRatio, type HistoryPoint, type MetricKey, type WeightPoint,
} from "./metrics";

interface ChartCardProps {
  title: string;
  dataKey: MetricKey;
  color: string;
  history: HistoryPoint[];
  weights: WeightPoint[];
  ratioMode: boolean;
}

const PADDING: Record<MetricKey, number> = {
  total: 5, bp: 2.5, sq: 2.5, dl: 2.5, bodyWeight: 1,
};

export function ChartCard({ title, dataKey, color, history, weights, ratioMode }: ChartCardProps) {
  const isBodyWeight = dataKey === "bodyWeight";
  const useRatio = ratioMode && !isBodyWeight;
  const points = useMemo(() => isBodyWeight
    ? weights.map(point => ({
      date: point.date, value: point.weightKg, avg7: point.avg7,
    }))
    : history.map(point => ({
      date: point.date,
      value: useRatio ? toBodyWeightRatio(point[dataKey as Exclude<MetricKey, "bodyWeight">], point.weightForRatio) : point[dataKey as Exclude<MetricKey, "bodyWeight">],
      avg7: null,
    })), [dataKey, history, weights, isBodyWeight, useRatio]);

  const values = points.flatMap(point =>
    [point.value, ...(isBodyWeight ? [point.avg7] : [])])
    .filter((v): v is number => v !== null);
  const padding = useRatio ? 0.05 : PADDING[dataKey];
  const min = values.length ? Math.min(...values) - padding : 0;
  const max = values.length ? Math.max(...values) + padding : 100;
  const unit = useRatio ? "倍" : "kg";
  const dateLabel = (time: number) => new Date(time).toLocaleDateString("ja-JP", {
    year: "2-digit", month: "numeric", day: "numeric", timeZone: "UTC",
  });
  const formatTooltip = (value: number, name: string) =>
    [value.toFixed(useRatio ? 2 : 1) + " " + unit,
      name === "avg7" ? "7日平均" : title] as [string, string];

  return (
    <article className="chart-card">
      <div className="chart-heading">
        <div><span className="eyebrow">{dataKey.toUpperCase()}</span><h3>{title} <small>{unit}</small></h3></div>
        <span className="chart-indicator" style={{ color }} aria-hidden="true" />
      </div>
      {values.length === 0 ? (
        <div className="chart-empty">表示できる記録がありません</div>
      ) : (
        <div className="chart-plot" role="img" aria-label={title + "の推移グラフ"}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 8, right: 10, left: -8, bottom: 5 }}>
              <CartesianGrid stroke="#2a374b" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="date" tickFormatter={dateLabel} tick={{ fill: "#8192ab", fontSize: 11 }}
                axisLine={false} tickLine={false} minTickGap={25} />
              <YAxis domain={[min, max]} tickCount={5} width={50}
                tick={{ fill: "#8192ab", fontSize: 11 }}
                tickFormatter={(value: number) => value.toFixed(useRatio ? 2 : 1)}
                axisLine={false} tickLine={false} />
              <Tooltip labelFormatter={(value) => dateLabel(Number(value))}
                formatter={(value: number, name: string) => formatTooltip(value, name)}
                contentStyle={{ background: "#152136", border: "1px solid #34445a", borderRadius: 10, color: "#eaf0f8" }}
                itemStyle={{ color: "#eaf0f8" }} />
              <Line type="stepAfter" dataKey="value" stroke={color} strokeWidth={2.5}
                dot={points.length <= 1} activeDot={{ r: 4 }}
                connectNulls={false} isAnimationActive={false} name="value" />
              {isBodyWeight && (
                <Line type="monotone" dataKey="avg7" stroke="#53c9ae" strokeWidth={1.8}
                  strokeDasharray="5 4" dot={false} isAnimationActive={false} name="avg7" />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </article>
  );
}
