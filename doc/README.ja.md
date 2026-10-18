[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [हिन्दी](README.hi.md) · [Français](README.fr.md) · [Español](README.es.md) · [বাংলা](README.bn.md) · [한국어](README.ko.md)

# <img src="icon.png" alt="PDFMathReader アプリアイコン" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="../LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

お好みの言語で科学文書をリアルタイムに、あらゆるプラットフォームで読めます。<br>
[PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) を基盤に、最先端の人工知能を活用しています。

<img src="demo.gif" alt="デモ" width="100%">

## 機能

- **レイアウトを保った翻訳文書の閲覧**：数式、表、その他の重要な内容をそのまま保ちます。
- **待たずに読み始める**：読み進めながらレイアウトを検出して内容を翻訳します。
- **好みの言語で読む**：インターフェース言語、原文言語、翻訳先言語を幅広く選べ、さらに細かくカスタマイズできます。
- **好みの翻訳サービスを選ぶ**：
  - 主要な AI プロバイダーに接続できます。
  - OpenAI 互換 API を使ってカスタムサービスを利用できます。
  - パートナーシップによる無料翻訳を利用でき、多言語での読書をより身近にします。
- **読書中のメモを手元に残す**：原文と翻訳文の両方で、文章をハイライトしたりコメントを追加したりできます。
- **効率的にナビゲーションする**：
  - サムネイル、クイックリンク、検索、アウトライン、ページ番号、ギャラリービューで文書を閲覧できます。
  - 複数の閲覧レイアウトから選べます。
  - ウィンドウとタブをまたいで作業を整理できます。
- **閲覧体験を調整する**：
  - トピックセンテンス、科学的知見、論理的なつながりを自動的に強調します。
  - ワークフローに合わせて翻訳の動作を調整できます。
  - フォント、アイコン、アクセントカラー、ダークモードをカスタマイズできます。
  - レイアウト検出の速度と品質のバランスを調整できます。
  - スムーズスクロールを有効にできます。
- **文章を読みやすくする**：
  - TF-IDF の重み付けで特徴的な用語を強調します。
  - 固定長または語根の強調によるバイオニックリーディングを有効にできます。
- **ワークフローを途切れさせない**：アプリケーションやデバイス間でファイルを共有・編集できます。たとえば AirDrop を使ってモバイルデバイスで読書を続けられます。
- **プラットフォーム間で使い慣れたインターフェースを利用する**：macOS、Windows、Linux、iOS で読めます。

## 最近の更新

| 日付       | 機能                                                                                                                                                                    | 貢献者                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-17 | [コンパニオンのペアリングコードを 8 文字に短縮](https://github.com/PDFMathTranslate/PDFMathReader/commit/5bec25f69a04c0a7cb8811f1faed6ada1a84ba52)                      | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [マウス使用時だけスムーズスクロールを強制するオプションを追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/b90ebdd8f2311d1060af6882ea20bc1c90404a8f)       | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [Art と Zotero のアプリアイコンを追加し、モダンアイコンを更新](https://github.com/PDFMathTranslate/PDFMathReader/commit/ea8fc7a0787fe67788e6501d5fffba02f6869e76)       | [@reycn](https://github.com/reycn) |
| 2026-10-17 | [ウィンドウを最小化している間もサービスモードで翻訳を継続](https://github.com/PDFMathTranslate/PDFMathReader/commit/b77dccaaefd92cfd145781c1b9164b67f02adf2b)           | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [リモートデバイスとカーネルを共有し、接続中のクライアントを表示](https://github.com/PDFMathTranslate/PDFMathReader/commit/6ecb48f5759d1eda69470c54d6236cbbe43b8204)     | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [Cmd+C で選択範囲またはフォーカス中の注釈をコピーし、トーストを表示](https://github.com/PDFMathTranslate/PDFMathReader/commit/b9e5cc82b22dee2ae35160df31db9dadace538ac) | [@reycn](https://github.com/reycn) |
| 2026-10-16 | [外観設定にアプリアイコンの選択機能を追加](https://github.com/PDFMathTranslate/PDFMathReader/commit/729755524d0e3cf3464d0ebbf0020e8fb9ddf90d)                           | [@reycn](https://github.com/reycn) |

## クイックスタート

### デスクトップ

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
      <td>macOS 用 ZIP を展開し、<code>PDFMathReader.app</code> を <code>/Applications</code> に移動して開きます。</td>
      <td><code>PDFMathReader-win32-x64.exe</code> をダブルクリックします（32 ビット版 Windows では <code>ia32</code> 版）。</td>
      <td>CPU に合った <code>.tar.gz</code> を展開し、そのフォルダーで <code>./PDFMathReader</code> を実行します。</td>
    </tr>
    <tr>
      <td>補足</td>
      <td>macOS でアプリが「壊れている」と表示された場合は、ダウンロードが信頼できることを確認してから、ターミナルで <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> を実行します。求められたら Mac のログインパスワードを入力してください（入力中は表示されません）。その後、アプリを再度開きます。</td>
      <td>ポータブルアプリにはランタイムが含まれています。起動すると PDF の <strong>Open with PDFMathReader</strong> メニューが登録されます。実行ファイルを移動した後は、もう一度起動してください。</td>
      <td>CPU アーキテクチャに合ったパッケージを選んでください。</td>
    </tr>
  </tbody>
</table>
  *テストに使用できるデバイスが限られているため、Windows と Linux の互換性チェックは定期的に実施しています（ご協力を歓迎します）。*

### モバイル

- **iOS**：[このリポジトリで提供](https://github.com/PDFMathTranslate/PDFMathReader-iOS)。デスクトップクライアントと親しみやすいデザインを採用しています。
- **Android**：（ご協力を歓迎します）

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
# macOS（署名 ID が必要です。署名を省略するには --unsigned を追加してください）
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

実験的な Jev 段落継続検出は Ultra fast と Fast で利用できます。Fast は、翻訳と組版の前に同じ段組み内で連続していることが確認された断片を結合し、数式の位置を保ちます。判定が不確実または失敗した場合は、断片を分離したままにします。有効にするとページキャッシュが分離されるため、以前に結合されていない出力が再生成されます。

実験的機能：設定 → 実験 →「目次を生成」を選ぶと、編集 →「目次を生成」が追加されます。これはブックマークのない文書に対して目次をローカルで作成し、目次サイドバーに進捗を表示します。印刷された目次ページ（ドットリーダーと右揃えのページ番号を含む）を解析してページ番号を物理ページに対応付け、目次ページがない場合はフォントサイズ、番号付け、間隔から見出しを推定します。データが外部に送信されることはありません。テキストレイヤーのないスキャンページには対応しておらず、生成した目次は文書と一緒には保存されません。

実験的機能：Precise は、リモートの [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) サーバーを HTTP 経由で利用して翻訳することもできます（設定 → 実験）。PDFMathReader はそのサーバーの HTTP プロトコルをクライアントとして実装しています。サーバーは同梱されず、利用は任意です。リモートカーネルはサーバーの `/health` チェックが成功した場合のみ使用され、それ以外ではローカルの Precise カーネルが動作します。API キーは送信されず、サーバーは独自の翻訳サービスを使用します。リモートページには読書用テキストレイヤーがなく、選択した翻訳サービスと用語集はリモート翻訳ページでは使用されません。

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

本研究の中核は、[_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/)（EMNLP 2025）に採択されています。

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

PDFMathReader は GNU Affero General Public License, version 3 に基づいてライセンスされています。全文は [LICENSE](../LICENSE) を参照してください。依存関係にはそれぞれのライセンスが適用されます。これには [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate)、[PDFMathTranslate-next](https://github.com/PDFMathTranslate-next/PDFMathTranslate-next)、[zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh)（AGPL-3.0、任意のリモートカーネルプロトコル）が含まれます。

## 謝辞

ご支援いただいた [OpenAI](https://openai.com/)、[Anthropic](https://www.anthropic.com/)、[Warp](https://www.warp.dev/)、[Immersive Translate](https://immersivetranslate.com/)、[SiliconFlow](https://siliconflow.cn/) に心より感謝いたします。
