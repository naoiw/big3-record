# GitHub Pagesデプロイ

## 公開先

| ソースブランチ | URL |
| --- | --- |
| `main` | https://naoiw.github.io/big3-record/ |
| `develop` | https://naoiw.github.io/big3-record/develop/ |

本番とプレビューは**1つのGitHub Pagesサイト**でホストし、公開環境は`github-pages`のみを使用します。

## ワークフロー

1. `.github/workflows/validate-develop.yml`：developへのpush、またはmain/develop宛てのPRで依存関係のインストール・ビルドを実行します。
2. developへのpushの検証が成功した場合、mainに置かれた`.github/workflows/deploy_pages.yml`が`workflow_run`から起動します。PRのみの検証や失敗・キャンセルは公開しません。
3. mainへのpushでも同じデプロイワークフローが起動します。`workflow_dispatch`はmainからのみ実行できます。
4. ビルド時にmainを`production/`、developを`preview/`へcheckout。develop push由来の実行では、検証に合格した**コミットSHA**を使います。
5. 本番は通常の`pnpm build`、プレビューは`vite build --base=/big3-record/develop/`でビルドします。
6. `production/dist/`を公開ルートに、`preview/dist/`を`develop/`にコピーして1つのPagesアーティファクトを公開します。

`concurrency`により公開は順次実行され、古い展開が新しい展開を上書きしにくい構成です。

## GitHub設定

- Repository Settings → Pages → Build and deployment → Source: **GitHub Actions**
- Environment: **github-pages**
- Actions権限：ビルドは`contents: read`のみ。公開ジョブのみ`pages: write`と`id-token: write`。
- `workflow_run`はデフォルトブランチ上のワークフローを参照するため、**deploy_pages.ymlはmainで管理**します。
- ワークフロー名`Validate develop`を変えたときは、デプロイ側`workflow_run.workflows`も揃えてください。

## 注意点

- developの検証が失敗しても、既存のプレビューは直近の成功版のままです。
- GitHub Pagesは公開サイトです。スプレッドシートIDと公開データは閲覧者に見えます。秘密の情報・認証トークンをコードに埋め込まないでください。
- デプロイ状況はGitHub Actionsタブで確認してください。
