[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md)

# <img src="icon.png" alt="PDFMathReader アプリアイコン" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

リアルタイム翻訳を使い、あらゆるプラットフォームで、あらゆる言語の科学文書を読めます。[PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) を基盤としています。

<img src="demo.gif" alt="デモ" width="100%">

## 機能

- **レイアウト保持**：数式や表、重要な情報を保ち、翻訳後のページを原文のレイアウトに近い状態にします。
- **リアルタイム翻訳**：読みながらレイアウトを検出して翻訳し、文書全体の処理完了を待つ必要がありません。
- **インターフェース言語**：16 言語に対応し、英語の国名順で表示します。既定は英語です。アラビア語、エジプトアラビア語、ヒンディー語、ベンガル語、ロシア語、ポルトガル語、ウルドゥー語、ドイツ語、ナイジェリアピジン語を含みます。
- **翻訳オプション**：翻訳エンジン、サービス、言語を選び、文書全体または近くのページを翻訳できます。
- **対訳表示**：検出された段落をクリックして原文と訳文を切り替えられます。
- **柔軟なナビゲーション**：サムネイル、ズーム、縦横スクロール、1・2・4 ページのレイアウトに対応しています。
- **複数文書**：PDF を独立したウィンドウで開き、再び開くと閲覧位置と表示設定を復元します。
- **閲覧リンク**：検索結果と閲覧元の間の双方向リンクを保存し、簡単に参照できます。
- **ハイライトとコメント**：重要な箇所をハイライトし、コメントを追加して読書メモを残せます。
- **ファイル操作**：macOS では Finder で元の PDF または完全に翻訳された PDF を表示し、AirDrop で送信できます。Windows ではファイル エクスプローラーで元の PDF または完全に翻訳された PDF を表示し、ネイティブの Windows 共有パネルを開けます。

## 最近の更新

| 日付       | 機能                                                                                                                                                    | 貢献者                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-10 | [インターフェース言語を 9 言語追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/041a09d7d9bb1035715bcc2adbb74e6fae8b391e)                  | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [macOS に Finder と AirDrop のファイル操作を追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/218541d7ad70ba7fb42ed4321b8d470492391073)    | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [実験的な Jev 文書言語チェックを追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/00d5afbfe58b4ef689c6619c8b6c6f0faf671031)                | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [カーネル起動前に翻訳済みページを復元](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386)               | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [閲覧レイアウトと翻訳動作を改善](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe)                     | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [リキッドグラスと翻訳の再フォーカスを追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)           | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [ショートカットをカスタマイズし、リーダー操作を改善](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1) | [@reycn](https://github.com/reycn) |

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
      <td><img src="preview.png" alt="PDFMathReader のリーダー画面" width="100%"></td>
      <td><img src="preview-windows.png" alt="PDFMathReader のリーダー画面" width="100%"></td>
      <td><img src="preview-linux.png" alt="Linux 上の PDFMathReader のリーダー画面" width="100%"></td>
    </tr>
    <tr>
      <td>ダウンロードリンク</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>インストール</td>
      <td>macOS の ZIP を展開し、<code>PDFMathReader.app</code> を <code>/Applications</code> に移動して開きます。</td>
      <td><code>PDFMathReader-win32-x64.exe</code> をダブルクリックします（32 ビット Windows では <code>ia32</code> 版）。</td>
      <td>CPU に合った <code>.tar.gz</code> を展開し、そのフォルダーで <code>./PDFMathReader</code> を実行します。</td>
    </tr>
    <tr>
      <td>補足</td>
      <td>macOS でアプリが「壊れている」と表示された場合は、ダウンロードが信頼できることを確認してから、ターミナルで <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> を実行します。求められたら Mac のログインパスワードを入力し（表示されません）、アプリを再度開いてください。</td>
      <td>ポータブルアプリにはランタイムが含まれています。起動すると PDF の <strong>Open with PDFMathReader</strong> メニューが登録されます。実行ファイルを移動したら、もう一度起動してください。</td>
      <td>CPU アーキテクチャに合ったパッケージを選んでください。</td>
    </tr>
  </tbody>
</table>
  *テストに使用できるデバイスが限られているため、Windows と Linux の互換性チェックは定期的に実施しています。*

## 開発

<details>
<summary>コントリビューション</summary>

- **ツール：** Bun で依存関係とスクリプトを管理し、Vue/Vite で UI を構築します。Electron と Express は Node.js 上で動作します。依存関係を変更したら `bun.lock` をコミットしてください。
- **テスト：** `bun run build` を実行してから `bun run test` を実行します。CI スクリプトは `node --test .github/scripts/*.test.*` を使用します。動作を変更した場合は、対象を絞った回帰カバレッジを追加してください。[テストの優先順位](testing.md)を参照してください。
- **CI：** **コードスタイル**が書式と lint をチェックし、**パッケージ化**が macOS、Windows、Linux でアプリをビルドして起動します。**リリース**はバージョンが増えたときに、デフォルトブランチで成功したパッケージを公開します。
- **スタイル：** コミット前に `bun run style:fix` を実行してください。Husky はステージ済みファイルを自動で整形・チェックし、未解決のエラーがあると処理を停止します。Prettier/ESLint は JS と Vue、Ruff は Python、swift-format は Swift を対象とします。[セットアップと規則](code-style.md)を参照してください。

</details>

<details>
<summary>ローカル開発</summary>

[Bun 1.3.14](https://bun.sh/docs/installation) と Node.js 22.22.1 以降をインストールします。ソースからデスクトップアプリを実行するには：

```sh
bun install --frozen-lockfile
bun run desktop
```

対応するプラットフォーム向けにビルドします：

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
bun run package:mac
# Windows
bun run package:win
```

フロントエンドライブラリ（Vue、MacVue、Fluent UI）はビルド依存関係です。Vite はそれらを `dist` に含めます。サーバーまたは Electron メインプロセスが使用する Node 依存関係はランタイム依存関係として残ります。ビルド前に `bun install --frozen-lockfile` でインストールしてください。本番用のみのインストールではアプリをビルドまたはパッケージ化できません。

「About」ページには GitHub Release の更新状態、手動チェックボタン、自動チェック切り替え（既定で有効）が含まれます。パッケージ化されたアプリは起動後に遅延してチェックし、その後 6 時間ごとにチェックします。公開されたリリースがない場合は通常の空の状態として表示されます。安定版のバージョンタグは `vX.Y.Z` または `X.Y.Z` を使用する必要があります。対応するリリースアセットは、macOS では `PDFMathReader-<platform>-<arch>.zip`、Windows では `.exe`、Linux では `.tar.gz` を使用します。利用可能な更新があると対応するダウンロードを開き、そのアセットがない場合はリリースページを開きます。インストールは手動です。

「About」ページにはアプリ、インストール済みカーネル、UV のバージョンが表示されます。各 Vite ビルドはパッケージバージョンと、最新 10 件の慣用的な `feat` コミット（スコープ付きと破壊的な機能を含む）を `dist/build-info.json` に埋め込みます。リリース CI は完全な Git 履歴をチェックアウトします。インストール済みアプリは Git やネットワークにアクセスせずこのスナップショットを読み取ります。Git を含まないソースアーカイブからビルドした場合、更新一覧は空になります。

既定の Electron パッケージは Express と PDF ユーティリティをバックエンド/メインスクリプトにバンドルし、それらのライセンスを保持します。ステージングされた `node_modules` には外部のランタイムモジュールだけをコピーします。ネイティブの PDF Inspector バインディングと、対応していないネイティブターゲット向けの PDF.js/DOMMatrix フォールバックは引き続き利用できます。Electron 自体とパッケージ化ツールはビルドツールチェーンから提供されます。

ブラウザー開発では `OPENAI_API_KEY` を設定し、`bun run dev` を実行して [127.0.0.1:5173](http://127.0.0.1:5173) を開きます。`OPENAI_MODEL` で既定のモデルを上書きできます。デスクトップ環境変数は `Launch PDFMathReader.command` で読み込めます。

```sh
bun run test
bun run build
```

アプリケーションスイートにはリスクを重視した 29 件のテストがあります。保持されているカバレッジとケース追加の方針については、[テストの優先順位](testing.md)を参照してください。

</details>

<details>
<summary>詳細</summary>

PDFMathReader はリーダーに Vue 3 と PDF.js、デスクトップアプリに Electron、ローカルバックエンドに Express を使用します。Vite はフロントエンドの開発とビルドをサポートし、pdf-lib は PDF 操作を処理します。

各デスクトップウィンドウには独自のレンダラーと、Electron utility process で動作するバックエンドがあります。メインプロセスはウィンドウ、メニュー、認証情報、最近の文書、設定を管理します。サンドボックス化された preload がデスクトップ IPC を提供し、バックエンドリクエストは `127.0.0.1` 上の認証済み HTTP を使用します。

レンダリング、レイアウト解析、翻訳は独立して動作します。ページとサムネイルは仮想化され、PDF.js とレイアウト解析は必要に応じて読み込まれ、レンダリングキャッシュのメモリ使用量には上限があります。各文書はローカルバックエンドに一度だけアップロードされ、その後のリクエストは文書 ID を使用します。文書、言語、カーネルが変わると古い翻訳処理はキャンセルされます。

翻訳テキストは文書間およびアプリの再起動後もキャッシュされます。同じサービスとモデルへの同一のリクエストは保存済みの結果を再利用し、数式翻訳カーネルからのリクエストも含まれます。言語、プロンプト、その他の翻訳オプションはキャッシュキーの一部です。同一のリクエストが同時に行われた場合は 1 回のサービス呼び出しを共有し、失敗または空の応答はキャッシュされません。

| 設定       | エンジン              | 出力                                    |
| ---------- | --------------------- | --------------------------------------- |
| Ultra fast | PDF Inspector         | 元の PDF 上の段落オーバーレイ           |
| Fast       | PDFMathTranslate      | 数式を保持した翻訳済み PDF ページ       |
| Precise    | PDFMathTranslate-next | より詳細な組版による翻訳済み PDF ページ |

PDF のレンダリングとレイアウト解析はローカルで行われます。翻訳では文書テキストを OpenAI に送信し、API 料金が発生する場合があります。Fast と Precise は `uv` でインストールされたアプリ管理の個別 Python 環境で動作し、バックエンドプロキシ経由で OpenAI にアクセスします。API キーはレンダラーの外部に保持されます。

保存されたデスクトップキーは Electron `safeStorage` と macOS Keychain による保護で暗号化されます。保存されたキーは `OPENAI_API_KEY` を上書きし、消去すると環境変数のフォールバックに戻ります。安全なストレージを利用できない場合、保存は無効になります。

デスクトップデータは `~/Library/Application Support/` 内のアプリディレクトリに保存されます。認証情報、最近の文書、翻訳とレイアウトのキャッシュ、カーネル環境が含まれます。ブラウザー開発のキャッシュは `.cache/translations/` を使用します。キャッシュと一時 PDF には文書の内容が含まれる場合があります。開始ページの **Clear** は最近の文書履歴だけを削除します。

ブラウザー開発では Express と Vite が独立した Node.js プロセスで動作します。ネイティブメニュー、デスクトップ IPC、安全なデスクトップキー保存はデスクトップアプリでのみ利用できます。

</details>

<details>
<summary>制限事項</summary>

- **プラットフォーム対応：** macOS がテスト済みのプラットフォームです。Windows と Linux にはプラットフォーム固有のスタイルがありますが、ネイティブランタイムの検証は保留中です。パッケージ化コマンドは macOS arm64 と Windows x64 を対象としています。
- **レイアウトの忠実度：** Ultra fast は幾何学的な段落グループ化とテキストオーバーレイを使用します。複雑な表、回転したテキスト、特殊な背景、長い翻訳では、元のタイポグラフィを維持できない場合があります。数式カーネルの出力は、上流のレイアウト処理に依存します。
- **スキャン文書：** スキャンされた PDF には OCR が必要ですが、このアプリは実装していません。
- **翻訳の要件：** 翻訳には OpenAI API キーとネットワークアクセスが必要です。Fast と Precise には、`uv` を通じて別途インストールした数式カーネルが必要です。
- **範囲：** これはローカルリーダー兼翻訳アプリであり、完全な PDF 編集・書き出しツールではありません。
- **検証：** [30 件のコア回帰テスト](core-tests.md)がバックエンドとリーダーのサポートロジックをカバーします。モックプロバイダーによるチェックでは、実際の OpenAI 翻訳品質や API キーの有効性は確認できません。

</details>

## 論文

本プロジェクトの基盤となる研究は、[_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/)（EMNLP 2025）に採択されています。

引用：

```
@inproceedings{ouyang-etal-2025-pdfmathtranslate,
	    title = "{PDFM}ath{T}ranslate: Scientific Document Translation Preserving Layouts",
	    author = "Ouyang, Rongxin  and
	      Chu, Chang  and
	      Xin, Zhikuang  and
	      Ma, Xiangyao",
	    editor = {Habernal, Ivan  and
	      Schulam, Peter  and
	      Tiedemann, J{\"o}rg},
	    booktitle = "Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations",
	    month = nov,
	    year = "2025",
	    address = "Suzhou, China",
	    publisher = "Association for Computational Linguistics",
	    url = "https://aclanthology.org/2025.emnlp-demos.71/",
	    pages = "918--924",
	    ISBN = "979-8-89176-334-0",
	    abstract = "Language barriers in scientific documents hinder the diffusion and development of science and technologies. However, prior efforts in translating such documents largely overlooked the information in layouts. To bridge the gap, we introduce PDFMathTranslate, the world{'}s first open-source software for translating scientific documents while preserving layouts. Leveraging the most recent advances in large language models and precise layout detection, we contribute to the community with key improvements in precision, flexibility, and efficiency. The work is open-sourced at https://github.com/byaidu/pdfmathtranslate with more than 222k downloads."
	}
```

## ライセンス

PDFMathReader は GNU Affero General Public License, version 3 に基づいてライセンスされています。全文は [LICENSE](../LICENSE) を参照してください。依存関係にはそれぞれのライセンスが適用されます。

## 謝辞

ご支援いただいた [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[Immersive Translate](https://immersivetranslate.com/)、[SiliconFlow](https://siliconflow.cn/) に心より感謝いたします。
