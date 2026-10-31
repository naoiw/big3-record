# BIG3 Record

ベンチプレス（BP）・スクワット（SQ）・デッドリフト（DL）のトレーニング記録を表示するダッシュボードです。Google Sheetsに入力された記録から、自己ベスト、3種目の合計、体重比、各種目の推移を表示します。

## 主な機能

- **自己ベスト** — BP・SQ・DLと、各種目の自己ベストを足したBIG3 Total
- **体重比** — kg表示と、各種目の自己ベスト ÷ 最新の記録体重による倍率表示の切り替え
- **グラフ** — Total、BP、SQ、DL、体重の5グラフ（6か月・1年・全期間）
- **レスポンシブ** — PCは4列の数値カード・2列のグラフ、スマートフォンは2列のカード・1列のグラフ
- **読み取り専用** — Google Sheetsからデータを取得して表示し、ブラウザから記録の変更は行わない

## 公開先

| 環境 | ブランチ | URL |
| --- | --- | --- |
| 本番 | `main` | https://naoiw.github.io/big3-record/ |
| 開発プレビュー | `develop` | https://naoiw.github.io/big3-record/develop/ |

両環境はGitHub Pagesの**1つのサイト**に公開します。`develop`の検証が成功したときに開発プレビューが更新され、`main`の変更は本番に反映されます。

## 技術スタック

- TypeScript / React 18 / Recharts — 表示・グラフ・集計
- CSS / Vite — スタイル・開発・ビルド
- Google Sheets（gviz JSON）— 記録データの読み取り
- Node.js 20 / pnpm 9 — 開発・テスト
- GitHub Actions / GitHub Pages — 検証・デプロイ

## ローカルで動かす

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev       # 開発サーバー
pnpm test      # 日付・集計・シート読み取りの回帰テスト
pnpm build     # TypeScript型チェック＋本番ビルド
```

読み取り元のスプレッドシートIDは`src/sheetApi.ts`で定義しています。利用者のブラウザが直接読み取れるシートが必要です。認証トークンや非公開情報をコード・シートに含めないでください。

## 開発ルール

実装は`develop`で行い、`main`への反映は**Pull Request**で行います。マージ後も`develop`ブランチは残して同期します。詳しくは[開発手順](docs/DEVELOPMENT.md)を参照してください。

## ディレクトリ構成

- `src/App.tsx` — 画面・表示モード・取得状態
- `src/ChartCard.tsx` / `src/index.css` — グラフ・レスポンシブスタイル
- `src/metrics.ts` / `src/timeRange.ts` — 期間選択・集計・日時
- `src/sheetApi.ts` — Google Sheets読み取り・パース
- `tests/` — Node.jsによる回帰テスト
- `.github/workflows/` — CI・GitHub Pages
- `docs/` — 仕様・開発・デプロイ

## ドキュメント

- [画面とデータの仕様](docs/SPEC.md)
- [開発手順](docs/DEVELOPMENT.md)
- [デプロイ構成](docs/DEPLOYMENT.md)

## ライセンス

[MIT License](LICENSE)
