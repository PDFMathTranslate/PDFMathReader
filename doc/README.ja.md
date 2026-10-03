[English](../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md)

# <img src="icon.png" alt="PDFMathReader アプリアイコン" style="height: 1em; width: auto;"> PDFMathReader（実験版）

あらゆる言語の科学文書を、リアルタイム翻訳付きで、どのプラットフォームでも読むことができます。PDFMathTranslate を基盤としています。

<img src="demo.gif" alt="デモ" width="100%">

## クイックスタート

### デスクトップアプリを実行する

<table>
  <tr>
    <th>macOS</th>
    <th>Windows</th>
    <th>Linux</th>
  </tr>
  <tr>
    <td><img src="preview.png" alt="PDFMathReader の閲覧画面" height="240"></td>
    <td><img src="preview.png" alt="PDFMathReader の閲覧画面" height="240"></td>
    <td><img src="preview.png" alt="PDFMathReader の閲覧画面" height="240"></td>
  </tr>
</table>

開発には Apple Silicon Mac 上の Node.js 22 を使用してください。

```zsh
npm install
npm run desktop
```

PDF を開き、**Settings…** または **File → Preference** を開きます。OpenAI API key を入力し、**Save key** を選択します。対象言語と翻訳カーネルを選びます。PDF の閲覧とレイアウトの確認にはキーは不要ですが、翻訳には必要です。

**Ultra fast** が含まれています。**Fast** または **Precise** を使用するには、`uv` をインストールし、Settings でカーネルを選択して **Install kernel with uv** を選びます。各数式カーネルはアプリが管理する個別の Python 環境を使用します。利用可能かどうかの確認では、パッケージをインストールしたりグローバルツールを変更したりしません。

### macOS アプリをビルドする

```zsh
npm run package:mac
```

`release/PDFMathReader-darwin-arm64/PDFMathReader.app` を開きます。パッケージ化されたアプリにはランタイムとローカルバックエンドが含まれているため、別途 Node.js をインストールしたり開発サーバーを起動したりする必要はありません。パッケージ化コマンドは、署名されていないローカル Apple Silicon ビルドを生成します。

デスクトップアプリは `OPENAI_API_KEY` と `OPENAI_MODEL` も受け付けます。Finder は通常、ターミナルの環境変数を引き継ぎません。ログインシェルの設定でパッケージ化されたアプリを起動するには、`Launch PDFMathReader.command` を使用します。

### ブラウザ開発

```zsh
read -s 'OPENAI_API_KEY?OpenAI API key: '; export OPENAI_API_KEY
npm run dev
```

[127.0.0.1:5173](http://127.0.0.1:5173) を開きます。起動前に `OPENAI_MODEL` を設定すると、デフォルトモデル `gpt-4.1-mini` を上書きできます。

バックエンドとリーダーのサポートロジックを確認し、フロントエンドをビルドするには、次を実行します。

```zsh
npm test
npm run build
```

## 機能

- 最大 50 MiB の PDF を独立したウィンドウで開けます。ドラッグ＆ドロップと macOS Finder/Dock に対応しています。
- サムネイル、ズーム、ページに合わせる表示、縦横スクロール、1・2・4 ページのレイアウトを利用できます。
- 最近の文書を開くと、閲覧位置と表示設定が復元されます。
- 文書全体または近くのページを翻訳でき、検出された段落をクリックして原文と翻訳を切り替えられます。
- Settings で翻訳言語、並列処理数、カーネル固有のオプションを設定できます。表示言語は個別に設定します。

## 技術詳細

PDFMathReader は Vue 3 と PDF.js で閲覧画面を構築し、Electron をデスクトップ環境、Express をローカルバックエンドとして使用します。Vite はフロントエンドの開発とビルド、pdf-lib は PDF の操作を担当します。

各デスクトップウィンドウには独立したレンダラーと、Electron utility process で動作するバックエンドがあります。メインプロセスはウィンドウ、メニュー、認証情報、最近の文書、設定を管理します。サンドボックス化された preload がデスクトップ IPC を提供し、バックエンドとは `127.0.0.1` 上の認証付き HTTP で通信します。

描画、レイアウト解析、翻訳は独立して動作します。ページとサムネイルは仮想化され、PDF.js とレイアウト解析は必要に応じて読み込まれます。描画キャッシュのメモリ使用量には上限があります。文書はローカルバックエンドに一度だけアップロードされ、以後の要求は文書 ID を使用します。文書、言語、カーネルを変更すると古い翻訳処理をキャンセルします。

| 設定 | エンジン | 出力 |
| --- | --- | --- |
| Ultra fast | PDF Inspector | 元の PDF 上の段落オーバーレイ |
| Fast | PDFMathTranslate | 数式を保持した翻訳済み PDF ページ |
| Precise | PDFMathTranslate-next | より詳細な組版による翻訳済み PDF ページ |

PDF の描画とレイアウト解析はローカルで行います。翻訳では文書テキストを OpenAI に送信し、API 料金が発生する場合があります。Fast と Precise は `uv` でインストールしたアプリ管理の個別 Python 環境で動作し、バックエンドのプロキシ経由で OpenAI にアクセスします。API キーはレンダラーに渡されません。

デスクトップのキーは Electron `safeStorage` と macOS Keychain による保護で暗号化されます。保存したキーは `OPENAI_API_KEY` より優先され、削除すると環境変数に戻ります。安全なストレージが利用できない場合、保存は無効になります。

デスクトップデータは `~/Library/Application Support/` 内のアプリディレクトリに保存されます。認証情報、最近の文書、翻訳とレイアウトのキャッシュ、カーネル環境が含まれます。ブラウザ開発時のキャッシュは `.cache/translations/` にあります。キャッシュと一時 PDF には文書の内容が含まれる場合があります。開始ページの **Clear** は最近の文書履歴だけを削除します。

ブラウザ開発では Express と Vite が独立した Node.js プロセスで動作します。ネイティブメニュー、デスクトップ IPC、安全なキー保存はデスクトップアプリのみで利用できます。

## 制限事項

- **プラットフォーム対応:** macOS がテスト済みのプラットフォームです。Windows と Linux にはプラットフォーム固有のスタイルがありますが、ネイティブランタイムの検証は保留中です。パッケージ化コマンドは macOS arm64 と Windows x64 を対象としています。
- **レイアウトの忠実度:** Ultra fast は幾何学的な段落グループ化とテキストオーバーレイを使用します。複雑な表、回転したテキスト、特殊な背景、長い翻訳では、元のタイポグラフィを維持できない場合があります。数式カーネルの出力は、上流のレイアウト処理に依存します。
- **スキャン文書:** スキャンされた PDF には OCR が必要ですが、このアプリは実装していません。
- **翻訳の要件:** 翻訳には OpenAI API key とネットワークアクセスが必要です。Fast と Precise には、`uv` を通じて別途インストールした数式カーネルが必要です。
- **範囲:** これは実験的なローカルリーダー兼翻訳アプリであり、完全な PDF 編集・書き出しツールではありません。
- **検証:** 自動テストでは、バックエンドとリーダーのサポートロジックを確認します。モックプロバイダーによるチェックでは、実際の OpenAI 翻訳品質や API キーの有効性は確認できません。

## ライセンス

PDFMathReader は GNU Affero General Public License, version 3 に基づいてライセンスされています。全文は [LICENSE](../LICENSE) を参照してください。

PDFMathTranslate と PDFMathTranslate-next も AGPL-3.0 プロジェクトです。ランタイムへのインストールでは、上流プロジェクトのライセンスファイルが保持され、その他の依存関係にはそれぞれのライセンスが適用されます。
