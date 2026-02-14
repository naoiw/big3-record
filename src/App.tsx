import { useEffect, useMemo, useState } from "react";
import { fetchLogData, type LogRow } from "./sheetApi";
import { parseTimestamp } from "./timeRange";
import { ChartCard } from "./ChartCard";

/** 最新1件の行を取得（タイムスタンプが最も新しい行） */
function getLatestRow(rows: LogRow[]): LogRow | null {
  if (rows.length === 0) return null;
  const withDate = rows
    .map((row) => ({ row, date: parseTimestamp(row.timestamp) }))
    .filter((x): x is { row: LogRow; date: Date } => x.date != null);
  if (withDate.length === 0) return null;
  withDate.sort((a, b) => a.date.getTime() - b.date.getTime());
  return withDate[withDate.length - 1].row;
}

function App() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** true: グラフを体重比で表示、false: 重量(kg)で表示 */
  const [showWeightRatio, setShowWeightRatio] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLogData()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latestRow = useMemo(() => getLatestRow(rows), [rows]);

  /** 最新の体重（タイムスタンプが最も新しい行の体重。無ければその時点で有効な最も新しい体重） */
  const latestBodyWeight = useMemo(() => {
    const withDate = rows
      .map((row) => ({ row, date: parseTimestamp(row.timestamp) }))
      .filter((x): x is { row: LogRow; date: Date } => x.date != null);
    withDate.sort((a, b) => b.date.getTime() - a.date.getTime());
    for (const { row } of withDate) {
      const bw = row.bodyWeight;
      if (bw != null && Number.isFinite(bw) && bw > 0) return bw;
    }
    return null;
  }, [rows]);

  /** 全期間の最高値（BP/SQ/DL）と Total (BIG3) = 3種目合計 */
  const bestStats = useMemo(() => {
    const nums = (key: "bp" | "sq" | "dl") =>
      rows
        .map((r) => r[key])
        .filter((v): v is number => v != null && Number.isFinite(v));
    const maxBP = nums("bp").length ? Math.max(...nums("bp")) : null;
    const maxSQ = nums("sq").length ? Math.max(...nums("sq")) : null;
    const maxDL = nums("dl").length ? Math.max(...nums("dl")) : null;
    const total =
      maxBP != null && maxSQ != null && maxDL != null
        ? Math.round((maxBP + maxSQ + maxDL) * 10) / 10
        : null;
    return { maxBP, maxSQ, maxDL, total };
  }, [rows]);

  /** 自己ベストの体重比：分子＝各種目の最大値(kg)、分母＝最新の体重 */
  const bestStatsRatios = useMemo(() => {
    if (latestBodyWeight == null || latestBodyWeight <= 0) {
      return { maxBP: null, maxSQ: null, maxDL: null, total: null };
    }
    const round2 = (n: number) => Math.round(n * 100) / 100;
    return {
      maxBP:
        bestStats.maxBP != null
          ? round2(bestStats.maxBP / latestBodyWeight)
          : null,
      maxSQ:
        bestStats.maxSQ != null
          ? round2(bestStats.maxSQ / latestBodyWeight)
          : null,
      maxDL:
        bestStats.maxDL != null
          ? round2(bestStats.maxDL / latestBodyWeight)
          : null,
      total:
        bestStats.total != null
          ? round2(bestStats.total / latestBodyWeight)
          : null,
    };
  }, [rows, bestStats, latestBodyWeight]);

  if (loading) return <p>読み込み中…</p>;
  if (error) return <p>エラー: {error}</p>;

  const formatValue = (v: number | null, unit: string, decimals = 1) =>
    v != null && Number.isFinite(v)
      ? unit ? `${v.toFixed(decimals)} ${unit}` : v.toFixed(decimals)
      : "—";

  return (
    <div style={{ padding: "1rem", fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1>精進の記録（BIG3）</h1>

      <div
        style={{
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ fontSize: "0.9rem", color: "#495057" }}>グラフ表示:</span>
        <button
          type="button"
          onClick={() => setShowWeightRatio(false)}
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.875rem",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            background: showWeightRatio ? "#fff" : "#e9ecef",
            fontWeight: showWeightRatio ? 400 : 600,
            cursor: "pointer",
          }}
        >
          重量 (kg)
        </button>
        <button
          type="button"
          onClick={() => setShowWeightRatio(true)}
          style={{
            padding: "0.35rem 0.75rem",
            fontSize: "0.875rem",
            border: "1px solid #dee2e6",
            borderRadius: 6,
            background: showWeightRatio ? "#e9ecef" : "#fff",
            fontWeight: showWeightRatio ? 600 : 400,
            cursor: "pointer",
          }}
        >
          体重比
        </button>
      </div>

      {latestRow && (
        <section
          style={{
            marginBottom: "1.5rem",
            padding: "1rem 1.25rem",
            background: "#f8f9fa",
            borderRadius: 8,
            border: "1px solid #e9ecef",
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", color: "#495057" }}>
            自己ベスト
            {latestRow.timestamp && (
              <span style={{ fontWeight: 400, marginLeft: "0.5rem" }}>
                （{parseTimestamp(latestRow.timestamp)?.toLocaleDateString("ja-JP") ?? latestRow.timestamp}）
              </span>
            )}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>BP（ベンチプレス）</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#e74c3c" }}>
                {showWeightRatio
                  ? formatValue(bestStatsRatios.maxBP, "倍", 2)
                  : formatValue(bestStats.maxBP, "kg")}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>SQ（スクワット）</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#3498db" }}>
                {showWeightRatio
                  ? formatValue(bestStatsRatios.maxSQ, "倍", 2)
                  : formatValue(bestStats.maxSQ, "kg")}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>DL（デッドリフト）</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#9b59b6" }}>
                {showWeightRatio
                  ? formatValue(bestStatsRatios.maxDL, "倍", 2)
                  : formatValue(bestStats.maxDL, "kg")}
              </div>
            </div>
            <div>
              <span style={{ fontSize: "0.8rem", color: "#6c757d" }}>Total (BIG3)</span>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#27ae60" }}>
                {showWeightRatio
                  ? formatValue(bestStatsRatios.total, "倍", 2)
                  : formatValue(bestStats.total, "kg")}
              </div>
            </div>
          </div>
        </section>
      )}

      <ChartCard
        title="Total (BIG3)"
        unit="kg"
        dataKey="total"
        data={rows}
        color="#27ae60"
        weightRatio={showWeightRatio}
      />
      <ChartCard
        title="BP（ベンチプレス）"
        unit="kg"
        dataKey="bp"
        data={rows}
        color="#e74c3c"
        weightRatio={showWeightRatio}
      />
      <ChartCard
        title="SQ（スクワット）"
        unit="kg"
        dataKey="sq"
        data={rows}
        color="#3498db"
        weightRatio={showWeightRatio}
      />
      <ChartCard
        title="DL（デッドリフト）"
        unit="kg"
        dataKey="dl"
        data={rows}
        color="#9b59b6"
        weightRatio={showWeightRatio}
      />
      <ChartCard
        title="Body Weight（体重）"
        unit="kg"
        dataKey="bodyWeight"
        data={rows}
        color="#27ae60"
      />
    </div>
  );
}

export default App;
