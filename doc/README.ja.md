[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

# <img src="icon.png" alt="PDFMathReader アプリアイコン" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

あらゆる言語の科学文書を、リアルタイム翻訳付きで、どのプラットフォームでも読むことができます。[PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) を基盤としています。

<img src="demo.gif" alt="デモ" width="100%">

## 機能

- **レイアウト保持**: 数式や表、重要な情報を保持し、原文のレイアウトをできる限り維持して翻訳します。
- **リアルタイム翻訳**: 閲覧中にレイアウト解析と翻訳を進め、文書全体の処理完了を待たずに読めます。
- **翻訳設定**: 翻訳エンジン、サービス、言語を選び、文書全体または近くのページを翻訳できます。
- **対訳表示**: 検出された段落をクリックして原文と訳文を切り替えられます。
- **柔軟な閲覧**: サムネイル、ズーム、縦横スクロール、1・2・4 ページのレイアウトに対応しています。
- **複数文書の管理**: PDF を独立したウィンドウで開き、再び開くと閲覧位置と表示設定が復元されます。
- **閲覧リンク**: 検索結果と元の閲覧位置を双方向リンクで保存し、簡単に行き来できます。
- **ハイライトと注釈**: 重要な箇所をハイライトし、注釈を追加して読書メモを残せます。

## 最近の更新

| 日付       | 機能の変更                                                                                                                                                                      | 貢献者                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-03 | [カスタムメニューと左側の赤・黄・緑のウィンドウボタンを追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/b144cbfe577c1e6787b01edafb9cdf2b2043fa4f)                 | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [実行可能な CI パッケージを提供し、閲覧画面のレイアウトアニメーションを改善](https://github.com/PDFMathTranslate/PDFMathReader/commit/04f76caf8fe966bb33721ad981d902de8cae62c8) | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [依存関係・Electron・アイコンのキャッシュで CI を高速化](https://github.com/PDFMathTranslate/PDFMathReader/commit/a9324f4cc40eb8585d760bda4d56f83bf62b74e2)                     | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [Windows のコントロールとページ表示のショートカットを改善](https://github.com/PDFMathTranslate/PDFMathReader/commit/04519de3448b5d707f8ecffd0fdabc695c2155ef)                   | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [Windows の PDF コンテキストメニューと「開く」項目を追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/f4da6ea1d1ec225b333722703ab87b7010538305)                    | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [段落のグループ化・プレビュー・文書アニメーションを改善](https://github.com/PDFMathTranslate/PDFMathReader/commit/46cf3fb126102ad507fa203dc4aa707f2c5f7769)                     | [@reycn](https://github.com/reycn) |
| 2026-10-03 | [Intel Mac・32 ビット Windows・Linux ARMv7 のビルドを追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/ed4b4567f381123cff49d20a710c2a94c034d81f)                   | [@reycn](https://github.com/reycn) |

## クイックスタート

<table width="100%">
  <thead>
    <tr>
      <th width="10%">プラットフォーム</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>スクリーンショット</td>
      <td><img src="preview.png" alt="PDFMathReader の閲覧画面" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader の閲覧画面" width="100%"></td>
      <td><img src="preview-linux.png" alt="Linux 上の PDFMathReader の閲覧画面" width="100%"></td>
    </tr>
    <tr>
      <td>ダウンロードリンク</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>インストール方法</td>
      <td>macOS の ZIP を展開し、<code>PDFMathReader.app</code> を <code>/Applications</code> に移動して開きます。</td>
      <td><code>PDFMathReader-win32-x64.exe</code> をダブルクリックします（32 ビット Windows では <code>ia32</code> 版）。</td>
      <td>CPU に合った <code>.tar.gz</code> を展開し、アプリのフォルダーで <code>./PDFMathReader</code> を実行します。</td>
    </tr>
    <tr>
      <td>補足</td>
      <td>「アプリが壊れている」と表示される場合は、信頼できる配布元であることを確認し、ターミナルで <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> を実行します。求められたら Mac のログインパスワードを入力し（表示されません）、アプリを再度開いてください。</td>
      <td>ランタイムを含むポータブル版です。起動すると PDF の <strong>Open with PDFMathReader</strong> メニューが登録されます。ファイルを移動したら再度起動してください。</td>
      <td>CPU アーキテクチャに合ったパッケージを選んでください。</td>
    </tr>
  </tbody>
</table>

## 開発

<details>
<summary>コントリビュート</summary>

- **ツール：** Bun で依存関係とスクリプトを管理し、Vue/Vite で UI を構築します。Electron と Express は Node.js で動作します。依存関係を変更したら `bun.lock` もコミットしてください。
- **テスト：** `bun run build` の後に `bun run test` を実行します。CI スクリプトは `node --test .github/scripts/*.test.*` で検証します。動作変更には対象を絞った回帰テストを追加してください。[テスト方針](testing.md)を参照。
- **CI：** **Code style** が書式と lint を検証し、**Packaging** が macOS・Windows・Linux でビルドと起動を確認します。**Release** はバージョン更新時にデフォルトブランチの成功したビルドを公開します。
- **コードスタイル：** コミット前に `bun run style:fix` を実行してください。Husky がステージ済みファイルを自動整形・検証し、未解決のエラーがあるとコミットを停止します。JS/Vue は Prettier/ESLint、Python は Ruff、Swift は swift-format を使います。[セットアップと規則](code-style.md)を参照。

</details>

<details>
<summary>ローカル開発</summary>

Bun 1.3.14 と Node.js 22.22.1 以降をインストールしてから、ソースからデスクトップアプリを起動します。

```sh
bun install --frozen-lockfile
bun run desktop
```

各 OS 上でビルドします。

```sh
# macOS（署名証明書が必要です。--unsigned で署名を省略できます）
bun run package:mac
# Windows
bun run package:win
```

ブラウザ開発では `OPENAI_API_KEY` を設定し、`bun run dev` を実行して [127.0.0.1:5173](http://127.0.0.1:5173) を開きます。`OPENAI_MODEL` でモデルを指定できます。デスクトップの環境変数は `Launch PDFMathReader.command` で読み込めます。

```sh
bun run test
bun run build
```

</details>

<details>
<summary>詳細</summary>

PDFMathReader は Vue 3 と PDF.js で閲覧画面を構築し、Electron をデスクトップ環境、Express をローカルバックエンドとして使用します。Vite はフロントエンドの開発とビルド、pdf-lib は PDF の操作を担当します。

各デスクトップウィンドウには独立したレンダラーと、Electron utility process で動作するバックエンドがあります。メインプロセスはウィンドウ、メニュー、認証情報、最近の文書、設定を管理します。サンドボックス化された preload がデスクトップ IPC を提供し、バックエンドとは `127.0.0.1` 上の認証付き HTTP で通信します。

描画、レイアウト解析、翻訳は独立して動作します。ページとサムネイルは仮想化され、PDF.js とレイアウト解析は必要に応じて読み込まれます。描画キャッシュのメモリ使用量には上限があります。文書はローカルバックエンドに一度だけアップロードされ、以後の要求は文書 ID を使用します。文書、言語、カーネルを変更すると古い翻訳処理をキャンセルします。

| 設定       | エンジン              | 出力                                    |
| ---------- | --------------------- | --------------------------------------- |
| Ultra fast | PDF Inspector         | 元の PDF 上の段落オーバーレイ           |
| Fast       | PDFMathTranslate      | 数式を保持した翻訳済み PDF ページ       |
| Precise    | PDFMathTranslate-next | より詳細な組版による翻訳済み PDF ページ |

PDF の描画とレイアウト解析はローカルで行います。翻訳では文書テキストを OpenAI に送信し、API 料金が発生する場合があります。Fast と Precise は `uv` でインストールしたアプリ管理の個別 Python 環境で動作し、バックエンドのプロキシ経由で OpenAI にアクセスします。API キーはレンダラーに渡されません。

デスクトップのキーは Electron `safeStorage` と macOS Keychain による保護で暗号化されます。保存したキーは `OPENAI_API_KEY` より優先され、削除すると環境変数に戻ります。安全なストレージが利用できない場合、保存は無効になります。

デスクトップデータは `~/Library/Application Support/` 内のアプリディレクトリに保存されます。認証情報、最近の文書、翻訳とレイアウトのキャッシュ、カーネル環境が含まれます。ブラウザ開発時のキャッシュは `.cache/translations/` にあります。キャッシュと一時 PDF には文書の内容が含まれる場合があります。開始ページの **Clear** は最近の文書履歴だけを削除します。

ブラウザ開発では Express と Vite が独立した Node.js プロセスで動作します。ネイティブメニュー、デスクトップ IPC、安全なキー保存はデスクトップアプリのみで利用できます。

</details>

<details>
<summary>制限事項</summary>

- **プラットフォーム対応:** macOS がテスト済みのプラットフォームです。Windows と Linux にはプラットフォーム固有のスタイルがありますが、ネイティブランタイムの検証は保留中です。パッケージ化コマンドは macOS arm64 と Windows x64 を対象としています。
- **レイアウトの忠実度:** Ultra fast は幾何学的な段落グループ化とテキストオーバーレイを使用します。複雑な表、回転したテキスト、特殊な背景、長い翻訳では、元のタイポグラフィを維持できない場合があります。数式カーネルの出力は、上流のレイアウト処理に依存します。
- **スキャン文書:** スキャンされた PDF には OCR が必要ですが、このアプリは実装していません。
- **翻訳の要件:** 翻訳には OpenAI API key とネットワークアクセスが必要です。Fast と Precise には、`uv` を通じて別途インストールした数式カーネルが必要です。
- **範囲:** これはローカルリーダー兼翻訳アプリであり、完全な PDF 編集・書き出しツールではありません。
- **検証:** 自動テストでは、バックエンドとリーダーのサポートロジックを確認します。モックプロバイダーによるチェックでは、実際の OpenAI 翻訳品質や API キーの有効性は確認できません。

</details>

## ライセンス

PDFMathReader は GNU Affero General Public License, version 3 に基づいてライセンスされています。全文は [LICENSE](../LICENSE) を参照してください。 PDFMathTranslate と PDFMathTranslate-next も AGPL-3.0 プロジェクトです。ランタイムへのインストールでは、上流プロジェクトのライセンスファイルが保持され、その他の依存関係にはそれぞれのライセンスが適用されます。

## 謝辞

ご支援いただいた [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[Immersive Translate](https://immersivetranslate.com/)、[SiliconFlow](https://siliconflow.cn/) に心より感謝いたします。
