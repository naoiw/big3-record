# 開発手順

## 起動・検証

Node.js 20 / pnpm 9 を使用します。

~~~bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
~~~

テストでは集計・日付・gvizパースを一時コンパイルし、Node標準テストランナーで検証します。生成物はGit管理外です。

## ブランチ運用

1. 開発は **develop**、mainは本番。
2. developへのpushでテストとビルド。成功した版をプレビューへデプロイ。
3. 本番反映は **develop → mainのPull Request** 経由で行います。
4. マージ後もdevelopを残し、mainから同期して次の開発を続けます。

## 責務の分離

| パス | 役割 |
| --- | --- |
| src/sheetApi.ts | 2タブのgviz読み取り・ヘッダー検証 |
| src/timeRange.ts | 日本の暦日キー・日時検証 |
| src/metrics.ts | 自己ベスト・達成日・体重比・7日平均・集計 |
| src/App.tsx | データ取得、サマリー、切り替えUI、警告 |
| src/ChartCard.tsx | PB推移・体重および平均体重のグラフ |
| tests/ | データ正規化・集計・入力パースの回帰テスト |

詳細仕様とスプレッドシートの入力規則は [SPEC.md](SPEC.md)、デプロイ構成は [DEPLOYMENT.md](DEPLOYMENT.md) を参照してください。
