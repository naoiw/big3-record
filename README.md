# BIG3 Record

ベンチプレス（BP）・スクワット（SQ）・デッドリフト（DL）の**1RM自己ベスト**と体重の時系列をGoogle Sheetsから表示する、読み取り専用ダッシュボードです。

## 主な機能

- **1RM自己ベスト** — 種目別の最高記録と達成日、3種目すべてが揃った後に表示するBIG3 Total
- **履歴グラフ** — 累積自己ベストの推移、6か月・1年・全期間の切り替え
- **体重** — 最新実測値・測定日・7日平均・時系列グラフ
- **体重比** — カードは歴代PB÷最新体重、過去グラフは当日または直近7日以内の実測体重を使用
- **操作性** — PC・スマートフォン対応、取得失敗時の再試行

## 公開先

| 環境 | ブランチ | URL |
| --- | --- | --- |
| 本番 | main | https://naoiw.github.io/big3-record/ |
| 開発プレビュー | develop | https://naoiw.github.io/big3-record/develop/ |

2環境は1つのGitHub Pagesサイトに公開。実装はdevelop、mainへの反映はPR経由です。

## Google Sheetsのデータ構造

| シート名 | 1行目のヘッダー | 用途 |
| --- | --- | --- |
| **pr_records** | date, exercise, weight_kg | 1RM自己ベストを更新した時に1行 |
| **body_weight** | date, weight_kg | 体重を測定した日に1行 |

ヘッダー名と入力規則、不正データの警告については[画面・データ仕様](docs/SPEC.md)を参照してください。

## 技術スタック

TypeScript / React 18 / Recharts / Vite / Google Sheets gviz / Node.js 20 / pnpm 9 / GitHub Actions・Pages

## ローカル開発

~~~bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
~~~

シートIDは src/sheetApi.ts に設定します。ブラウザから読み取り可能な権限が必要です。公開リポジトリ・公開ページに秘密情報を含めないでください。

## ドキュメント

- [画面・データ仕様](docs/SPEC.md)
- [開発手順](docs/DEVELOPMENT.md)
- [デプロイ構成](docs/DEPLOYMENT.md)

## ディレクトリ

- src/ — React画面・グラフ・データ取得・集計
- tests/ — 自動テスト
- docs/ — 詳細仕様・開発・デプロイ
- .github/workflows/ — CI・Pages

## ライセンス

[MIT License](LICENSE)
