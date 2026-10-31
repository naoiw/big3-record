import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { fetchLogData, type LogRow } from "./sheetApi";
import {
  filterHistory,
  formatDate,
  getBestStats,
  prepareHistory,
  toBodyWeightRatio,
  type HistoryRange,
  type LiftKey,
} from "./metrics";

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
  return value == null ? "—" : value.toFixed(ratio ? 2 : 1);
}

function App() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [ratioMode, setRatioMode] = useState(false);
  const [range, setRange] = useState<HistoryRange>("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchLogData()
      .then((data) => { if (active) setRows(data); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const history = useMemo(() => prepareHistory(rows), [rows]);
  const best = useMemo(() => getBestStats(history), [history]);
  const visibleHistory = useMemo(() => filterHistory(history, range), [history, range]);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestWeight = latest?.bodyWeight ?? null;
  const displayBest = (key: LiftKey | "total") => {
    const value = best[key];
    return ratioMode ? toBodyWeightRatio(value, latestWeight) : value;
  };

  const ratioDescription = ratioMode
    ? "各種目の最高記録 ÷ 最新の記録体重"
    : "各種目の自己ベスト（全期間）";

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
            <p className="hero-description">ベンチプレス・スクワット・デッドリフトの記録</p>
          </div>
          <div className="hero-aside">
            <span className="eyebrow">LATEST ENTRY</span>
            <strong>{formatDate(latest?.date ?? null)}</strong>
            <small>Google Sheets の記録から表示</small>
          </div>
        </section>

        {error && (
          <div className="notice notice-error" role="alert">
            <div><strong>データを取得できませんでした</strong><p>{error}</p></div>
            <button type="button" onClick={() => setReloadKey((n) => n + 1)}>再試行</button>
          </div>
        )}

        {loading && history.length === 0 ? (
          <div className="empty-screen" role="status">記録を読み込んでいます…</div>
        ) : history.length === 0 ? (
          <div className="empty-screen">表示できる記録がありません。シートの日付と公開設定を確認してください。</div>
        ) : (
          <>
            <section aria-labelledby="records-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">BEST LIFTS</p>
                  <h2 id="records-title">自己ベスト</h2>
                  <p className="section-note">{ratioDescription}</p>
                </div>
                <div className="segmented" role="group" aria-label="表示単位">
                  <button type="button" className={!ratioMode ? "active" : ""} aria-pressed={!ratioMode} onClick={() => setRatioMode(false)}>重量 (kg)</button>
                  <button type="button" className={ratioMode ? "active" : ""} aria-pressed={ratioMode} onClick={() => setRatioMode(true)}>体重比</button>
                </div>
              </div>
              <div className="metric-grid">
                {LIFTS.map((lift) => (
                  <article className="metric-card" data-tone={lift.key} key={lift.key}>
                    <div className="metric-top">
                      <span className="metric-name">{lift.abbreviation}</span>
                      <span className="metric-symbol" aria-hidden="true">↗</span>
                    </div>
                    <p className="metric-description">{lift.label}</p>
                    <p className="metric-reading"><strong>{formatNumber(displayBest(lift.key), ratioMode)}</strong><span>{ratioMode ? "倍" : "kg"}</span></p>
                    <div className="metric-rule" />
                  </article>
                ))}
                <article className="metric-card metric-total" data-tone="total">
                  <div className="metric-top"><span className="metric-name">TOTAL</span><span className="metric-symbol" aria-hidden="true">Σ</span></div>
                  <p className="metric-description">3種目の自己ベスト合計</p>
                  <p className="metric-reading"><strong>{formatNumber(displayBest("total"), ratioMode)}</strong><span>{ratioMode ? "倍" : "kg"}</span></p>
                  <div className="metric-rule" />
                </article>
              </div>
            </section>

            <section className="overview" aria-label="記録サマリー">
              <div className="overview-info">
                <span className="eyebrow">BODY WEIGHT</span>
                <strong>{formatNumber(latestWeight, false)} <small>kg</small></strong>
                <span className="overview-hint">最新の記録体重</span>
              </div>
              <div className="overview-breakdown">
                <span className="eyebrow">PERSONAL BEST COMPOSITION</span>
                {best.total !== null && best.total > 0 ? (
                  <>
                    <div className="composition" aria-label="3種目の自己ベスト重量比">
                      {LIFTS.map((lift) => (
                        <div key={lift.key} className={"composition-" + lift.key}
                          style={{ width: ((best[lift.key] ?? 0) / best.total! * 100) + "%" }}
                          title={lift.abbreviation + ": " + ((best[lift.key] ?? 0) / best.total! * 100).toFixed(1) + "%"} />
                      ))}
                    </div>
                    <div className="composition-legend">
                      {LIFTS.map((lift) => (
                        <span key={lift.key}><i className={"legend-dot dot-" + lift.key} />{lift.abbreviation} {((best[lift.key] ?? 0) / best.total! * 100).toFixed(1)}%</span>
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
                  <p className="section-note">選択期間は最新記録日を基準に計算します。</p>
                </div>
                <div className="segmented" role="group" aria-label="グラフの期間">
                  {([
                    ["6m", "6か月"], ["12m", "1年"], ["all", "全期間"],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" className={range === value ? "active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="chart-grid">
                {CHARTS.map((chart) => (
                  <ChartCard key={chart.key} dataKey={chart.key} title={chart.title}
                    color={chart.color} history={visibleHistory} ratioMode={ratioMode} />
                ))}
              </div>
              <p className="chart-footnote">未記録の種目・体重は直前の有効値を引き継ぎます。Totalはその時点の3種目の合計です。体重比は各時点で有効な体重を用います。</p>
            </section>
          </>
        )}
      </main>

      <footer className="page-footer">
        <span>BIG3 RECORD</span>
        <a href="https://github.com/naoiw/big3-record" target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>
    </div>
  );
}

export default App;
