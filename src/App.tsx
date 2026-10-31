import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { fetchTrainingData, SPREADSHEET_ID, type TrainingData } from "./sheetApi";
import {
  filterByRange, prepareTraining, toBodyWeightRatio,
  type HistoryRange, type LiftKey,
} from "./metrics";
import { formatDay } from "./timeRange";

const LIFTS: { key: LiftKey; abbreviation: string; label: string }[] = [
  { key: "bp", abbreviation: "BP", label: "ベンチプレス" },
  { key: "sq", abbreviation: "SQ", label: "スクワット" },
  { key: "dl", abbreviation: "DL", label: "デッドリフト" },
];

const CHARTS = [
  { key: "total", title: "BIG3 Total", color: "#53c9ae" },
  { key: "bp", title: "Bench Press", color: "#f08f84" },
  { key: "sq", title: "Squat", color: "#77b9f4" },
  { key: "dl", title: "Deadlift", color: "#b49ff2" },
  { key: "bodyWeight", title: "Body Weight", color: "#c9d4e4" },
] as const;

function formatNumber(value: number | null, ratio: boolean): string {
  return value === null ? "—" : value.toFixed(ratio ? 2 : 1);
}

function App() {
  const [data, setData] = useState<TrainingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ratioMode, setRatioMode] = useState(false);
  const [range, setRange] = useState<HistoryRange>("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTrainingData()
      .then(result => { if (active) setData(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const summary = useMemo(() => prepareTraining(data?.prRecords ?? [], data?.bodyWeightRecords ?? []), [data]);
  const history = useMemo(() => filterByRange(summary.history, range, summary.latestDate),
    [summary, range]);
  const weights = useMemo(() => filterByRange(summary.weights, range, summary.latestDate),
    [summary, range]);
  const best = summary.best;
  const latestWeight = summary.latestWeight;
  const displayBest = (key: LiftKey | "total") =>
    ratioMode ? toBodyWeightRatio(best[key], latestWeight?.weightKg ?? null) : best[key];

  return (
    <div className="dashboard">
      <header className="page-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>BIG3 RECORD</span>
        </div>
        <span className="header-caption">TRAINING LOG</span>
      </header>

      <main>
        <section className="hero" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">PERSONAL RECORDS</p>
            <h1 id="page-title">精進の記録 <span>BIG3</span></h1>
            <p className="hero-description">ベンチプレス・スクワット・デッドリフトの1RM自己ベスト記録</p>
          </div>
          <div className="hero-aside">
            <span className="eyebrow">LATEST ENTRY</span>
            <strong>{formatDay(summary.latestDate)}</strong>
            <small><a href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`}
              target="_blank" rel="noopener noreferrer">Google Sheets の記録から表示</a></small>
          </div>
        </section>

        {error && (
          <div className="notice notice-error" role="alert">
            <div><strong>データを取得できませんでした</strong><p>{error}</p></div>
            <button type="button" onClick={() => setReloadKey(n => n + 1)}>再試行</button>
          </div>
        )}
        {data && (summary.warnings.length > 0) && (
          <details className="warnings">
            <summary>データに関するお知らせ（{summary.warnings.length}件）</summary>
            <ul>{summary.warnings.slice(0, 15).map((warning, index) =>
              <li key={index}>{warning}</li>)}</ul>
            {summary.warnings.length > 15 && <p>ほかにも警告があります。シートを確認してください。</p>}
          </details>
        )}

        {loading && !data ? (
          <div className="empty-screen" role="status">記録を読み込んでいます…</div>
        ) : !data || (summary.history.length === 0 && summary.weights.length === 0) ? (
          <div className="empty-screen">表示できる記録がありません。シートの日付と公開設定を確認してください。</div>
        ) : (
          <>
            <section aria-labelledby="records-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">BEST LIFTS</p>
                  <h2 id="records-title">自己ベスト</h2>
                  <p className="section-note">{ratioMode
                    ? "歴代の1RM自己ベスト ÷ 最新の実測体重"
                    : "各種目の歴代1RM自己ベスト"}</p>
                </div>
                <div className="segmented" role="group" aria-label="表示単位">
                  <button type="button" className={!ratioMode ? "active" : ""} aria-pressed={!ratioMode}
                    onClick={() => setRatioMode(false)}>重量 (kg)</button>
                  <button type="button" className={ratioMode ? "active" : ""} aria-pressed={ratioMode}
                    onClick={() => setRatioMode(true)}>体重比</button>
                </div>
              </div>
              <div className="metric-grid">
                {LIFTS.map(lift => (
                  <article className="metric-card" data-tone={lift.key} key={lift.key}>
                    <div className="metric-top">
                      <span className="metric-name">{lift.abbreviation}</span>
                      <span className="metric-symbol" aria-hidden="true">↗</span>
                    </div>
                    <p className="metric-description">{lift.label}</p>
                    <p className="metric-reading"><strong>{formatNumber(displayBest(lift.key), ratioMode)}</strong>
                      <span>{ratioMode ? "倍" : "kg"}</span></p>
                    <div className="metric-rule" />
                    <p className="records-date">達成日：{formatDay(summary.achieved[lift.key])}</p>
                  </article>
                ))}
                <article className="metric-card metric-total" data-tone="total">
                  <div className="metric-top"><span className="metric-name">TOTAL</span>
                    <span className="metric-symbol" aria-hidden="true">Σ</span></div>
                  <p className="metric-description">3種目の歴代自己ベスト合計</p>
                  <p className="metric-reading"><strong>{formatNumber(displayBest("total"), ratioMode)}</strong>
                    <span>{ratioMode ? "倍" : "kg"}</span></p>
                  <div className="metric-rule" />
                  <p className="records-date">3種目の自己ベストを合算</p>
                </article>
              </div>
            </section>

            <section className="overview" aria-label="記録サマリー">
              <div className="overview-info">
                <span className="eyebrow">BODY WEIGHT</span>
                <strong>{formatNumber(latestWeight?.weightKg ?? null, false)} <small>kg</small></strong>
                <span className="overview-hint">最新測定：{formatDay(latestWeight?.day ?? null)}</span>
                <span className="overview-average">7日平均：
                  {formatNumber(latestWeight?.avg7 ?? null, false)} kg</span>
              </div>
              <div className="overview-breakdown">
                <span className="eyebrow">PERSONAL BEST COMPOSITION</span>
                {best.total !== null && best.total > 0 ? (
                  <>
                    <div className="composition" aria-label="3種目の自己ベスト重量比">
                      {LIFTS.map(lift => (
                        <div key={lift.key} className={"composition-" + lift.key}
                          style={{ width: ((best[lift.key] ?? 0) / best.total! * 100) + "%" }}
                          title={lift.abbreviation + ": " +
                            ((best[lift.key] ?? 0) / best.total! * 100).toFixed(1) + "%"} />
                      ))}
                    </div>
                    <div className="composition-legend">
                      {LIFTS.map(lift => (
                        <span key={lift.key}><i className={"legend-dot dot-" + lift.key} />
                          {lift.abbreviation} {((best[lift.key] ?? 0) / best.total! * 100).toFixed(1)}%</span>
                      ))}
                    </div>
                  </>
                ) : <p className="section-note">3種目が揃うと内訳を表示します。</p>}
              </div>
            </section>

            <section className="trends" aria-labelledby="trends-title">
              <div className="section-heading section-heading-trends">
                <div>
                  <p className="eyebrow">HISTORY</p>
                  <h2 id="trends-title">記録の推移</h2>
                  <p className="section-note">自己ベストは累積最大値で表示します。期間は最新記録日が基準です。</p>
                </div>
                <div className="segmented" role="group" aria-label="グラフの期間">
                  {([["6m", "6か月"], ["12m", "1年"], ["all", "全期間"]] as const)
                    .map(([value, label]) => (
                      <button key={value} type="button" className={range === value ? "active" : ""}
                        aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>
                    ))}
                </div>
              </div>
              <div className="chart-grid">
                {CHARTS.map(chart => (
                  <ChartCard key={chart.key} dataKey={chart.key} title={chart.title}
                    color={chart.color} history={history} weights={weights} ratioMode={ratioMode} />
                ))}
              </div>
              <p className="chart-footnote">
                自己ベストは1RM更新履歴から算出。体重比の履歴はその時点の自己ベストと、当日または直近7日以内の実測体重を使用します。
                体重グラフの破線は直近7暦日の測定値の平均です。
              </p>
            </section>
          </>
        )}
      </main>

      <footer className="page-footer"><span>BIG3 RECORD</span>
        <a href="https://github.com/naoiw/big3-record" target="_blank" rel="noopener noreferrer" aria-label="GitHubでソースコードを開く">GitHub ↗</a>
      </footer>
    </div>
  );
}

export default App;
