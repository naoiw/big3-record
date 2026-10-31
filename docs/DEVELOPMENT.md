# 開発手順

## 環境と起動

Node.js 20 / pnpm 9 を使用します。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm build
```

`pnpm test`は計算・シート読み取り用TypeScriptを`tests/dist/`にCommonJSとして一時コンパイルし、Node標準のテストランナーで検証します。`tests/dist/`と`*.tsbuildinfo`はGit管理対象外です。

## ブランチ運用

1. **実装と修正は`develop`**。通常`main`を直接更新しません。
2. `develop`へのpushでビルド検証を実施し、成功したコミットを開発プレビューへ自動デプロイします。
3. `main`へ取り込むときは**`develop` → `main`のPull Request**を作成し、CIを確認します。
4. マージ後も`develop`を削除せず、`main`の変更を取り込んで同期します。

```bash
git switch develop
git pull origin develop
# 実装・動作確認
pnpm test
pnpm build
git add .
git commit -m "refactor: update dashboard"
git push origin develop
# GitHubで develop → main のPRを作成
```

マージ後の同期：

```bash
git switch develop
git fetch origin
git merge origin/main
git push origin develop
```

## コードの責務

| ファイル | 担当 |
| --- | --- |
| `src/App.tsx` | UI、データ取得状態、表示切り替え |
| `src/ChartCard.tsx` | グラフの描画 |
| `src/metrics.ts` | 日付順・補完・自己ベスト・体重比・期間抽出 |
| `src/timeRange.ts` | 日時文字列の解釈 |
| `src/sheetApi.ts` | gviz取得・数値/日時セル変換 |
| `src/index.css` | 画面スタイル、画面幅への対応 |
| `tests/` | 集計と入力パースの回帰テスト |

データの正規化や集計に関する変更はReactコンポーネントへ直接追加せず、`metrics.ts`または`sheetApi.ts`に実装します。日時の境界、欠損値、初回記録の扱いはテストでも確認します。

## CI

`validate-develop.yml`はdevelop pushまたはmain/develop向けPRでテストとビルドを実行します。`deploy_pages.yml`はmain側で起動し、mainと検証済みdevelopの両方を同じPagesアーティファクトへ統合します。

公開の詳細は[DEPLOYMENT.md](DEPLOYMENT.md)を参照してください。
