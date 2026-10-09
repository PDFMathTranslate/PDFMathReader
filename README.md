[English](README.md) · [简体中文](doc/README.zh-CN.md) · [日本語](doc/README.ja.md)

# <img src="doc/icon.png" alt="PDFMathReader app icon" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="./LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

Read scientific documents in any language, with realtime translation, on any platform. Powered by [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate).

<img src="doc/demo.gif" alt="Demo" width="100%">

## Features

- **Layout preservation**: Preserve formulas, tables, and key information while keeping translated pages close to the original layout.
- **Realtime translation**: Detect layouts and translate as you read, without waiting for the entire document to finish.
- **Translation options**: Choose translation engines, services, languages, and full-document or nearby-page translation.
- **Bilingual reading**: Click detected paragraphs to switch between original text and translation.
- **Flexible navigation**: Read with thumbnails, zoom, vertical or horizontal scrolling, and one-, two-, or four-page layouts.
- **Multiple documents**: Open PDFs in independent windows and restore reading positions and display settings when reopening them.
- **Reading links**: Save bidirectional links between search results and their reading origins for easy reference.
- **Highlights and comments**: Highlight key passages and add comments to record your reading notes.

## Recent updates

| Date       | Feature                                                                                                                                                 | Contributor                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-09 | [restore translated pages before kernel startup](https://github.com/PDFMathTranslate/PDFMathReader/commit/e902a304fcd62e333e44e1a9100e19bd5b8ba386)     | [@reycn](https://github.com/reycn) |
| 2026-10-09 | [improve reading layout and translation behavior](https://github.com/PDFMathTranslate/PDFMathReader/commit/5729cd091d34b2134ba4202392074efc3205bdbe)    | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [add liquid glass and translation refocus](https://github.com/PDFMathTranslate/PDFMathReader/commit/d68b7614328512be5cbb879dbaef48895adf8c91)           | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [customize shortcuts and refine reader interactions](https://github.com/PDFMathTranslate/PDFMathReader/commit/4b3deefab7eb854fbae0fac33cc62664469f96f1) | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [add local formula OCR and copy in reading mode](https://github.com/PDFMathTranslate/PDFMathReader/commit/2896ebf2fc75aaad25e3fec39709df3d0c5b54e4)     | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [discuss PDF selections with local AI apps](https://github.com/PDFMathTranslate/PDFMathReader/commit/ce47d2d1dd998892b784b235390cfc3316c6d30a)          | [@reycn](https://github.com/reycn) |
| 2026-10-08 | [continue reading PDFs in another application](https://github.com/PDFMathTranslate/PDFMathReader/commit/a5ed5e6baff7f6888e583e7379658afb33cf9bda)       | [@reycn](https://github.com/reycn) |

## Quick start

<table width="100%">
  <thead>
    <tr>
      <th width="10%">Platform</th>
      <th width="30%">macOS</th>
      <th width="30%">Windows</th>
      <th width="30%">Linux</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Screenshot</td>
      <td><img src="doc/preview.png" alt="PDFMathReader reader" width="100%"></td>
      <td><img src="doc/preview-windows.png" alt="PDFMathReader reader" width="100%"></td>
      <td><img src="doc/preview-linux.png" alt="PDFMathReader reader on Linux" width="100%"></td>
    </tr>
    <tr>
      <td>Download link</td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
      <td><a href="https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml">GitHub Actions</a></td>
    </tr>
    <tr>
      <td>Installation</td>
      <td>Extract the macOS ZIP, move <code>PDFMathReader.app</code> to <code>/Applications</code>, and open it.</td>
      <td>Double-click <code>PDFMathReader-win32-x64.exe</code> (or the <code>ia32</code> version for 32-bit Windows).</td>
      <td>Extract the <code>.tar.gz</code> for your CPU, then run <code>./PDFMathReader</code> from its folder.</td>
    </tr>
    <tr>
      <td>Additional notes</td>
      <td>If macOS says the app is “damaged”, confirm the download is trusted, then run <code>sudo xattr -dr</code> <code>com.apple.quarantine</code> <code>/Applications/PDFMathReader.app</code> in Terminal. Enter your Mac login password when prompted (it is not displayed), then reopen the app.</td>
      <td>The portable app includes its runtime. Launching it registers the PDF <strong>Open with PDFMathReader</strong> menu; launch it again after moving the executable.</td>
      <td>Choose the package matching your CPU architecture.</td>
    </tr>
  </tbody>
</table>
  *Due to the limited devices for testing, the compatibility checks on Windows and Linux are done periodically.*
## Development

<details>
<summary>Contributing</summary>

- **Tooling:** Bun manages dependencies and scripts; Vue/Vite build the UI, while Electron and Express run on Node.js. Commit `bun.lock` when changing dependencies.
- **Tests:** run `bun run build`, then `bun run test`; CI scripts use `node --test .github/scripts/*.test.*`. Add focused regression coverage for behavior changes; see [test priorities](doc/testing.md).
- **CI:** **Code style** checks formatting and lint; **Packaging** builds and launches apps on macOS, Windows and Linux. **Release** publishes successful default-branch packages when the version increases.
- **Style:** run `bun run style:fix` before committing. Husky automatically formats and checks staged files, blocking unresolved errors. Prettier/ESLint cover JS and Vue, Ruff covers Python, and swift-format covers Swift; see [setup and rules](doc/code-style.md).

</details>

<details>
<summary>Local development</summary>

Install [Bun 1.3.14](https://bun.sh/docs/installation) and Node.js 22.22.1 or newer. To run the desktop app from source:

```sh
bun install --frozen-lockfile
bun run desktop
```

Build on the matching platform:

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
bun run package:mac
# Windows
bun run package:win
```

Frontend libraries (Vue, MacVue, and Fluent UI) are build dependencies: Vite includes them in `dist`. Node dependencies used by the server or Electron main process remain runtime dependencies. Install with `bun install --frozen-lockfile` before building; a production-only install cannot build or package the app.

The About page includes GitHub Release update status, a manual check button, and an automatic check switch (enabled by default). Packaged apps check lazily after startup and every six hours; no published release is shown as a normal empty state. Stable version tags must use `vX.Y.Z` or `X.Y.Z`. Matching release assets use `PDFMathReader-<platform>-<arch>.zip` (macOS), `.exe` (Windows), or `.tar.gz` (Linux). Available updates open the matching download, or the release page when that asset is absent; installation remains manual.

The About page shows the application, installed kernels and UV versions. Each Vite build embeds `dist/build-info.json` with the package version and the latest ten conventional `feat` commits (including scoped and breaking features); release CI checks out the full Git history. The installed app reads this snapshot without Git or network access. Builds from a source archive without Git show an empty update list.

The default Electron package bundles Express and PDF utilities into the backend/main scripts, retaining their licenses. It copies only external runtime modules into the staged `node_modules`; native PDF Inspector bindings and the PDF.js/DOMMatrix fallback for unsupported native targets remain available. Electron itself and packaging tools are supplied by the build toolchain.

For browser development, set `OPENAI_API_KEY`, run `bun run dev`, and open [127.0.0.1:5173](http://127.0.0.1:5173). Use `OPENAI_MODEL` to override the default model. Desktop environment variables can be loaded with `Launch PDFMathReader.command`.

```sh
bun run test
bun run build
```

The application suite contains 29 risk-focused tests. See [test priorities](doc/testing.md) for retained coverage and the policy for adding cases.

</details>

<details>
<summary>Details</summary>

PDFMathReader uses Vue 3 and PDF.js for the reader, Electron for the desktop app, and Express for the local backend. Vite supports frontend development and builds; pdf-lib handles PDF manipulation.

Each desktop window has its own renderer and backend running in an Electron utility process. The main process manages windows, menus, credentials, recent documents, and preferences. A sandboxed preload provides desktop IPC; backend requests use authenticated HTTP on `127.0.0.1`.

Rendering, layout analysis, and translation run independently. Pages and thumbnails are virtualized, PDF.js and layout analysis load on demand, and rendering caches have bounded memory use. Each document is uploaded to its local backend once; subsequent requests use its document ID. Outdated translation work is cancelled when the document, language, or kernel changes.

Translation text is cached across documents and app restarts. Identical requests to the same service and model reuse the saved result, including requests from the math translation kernels. Languages, prompts, and other translation options remain part of the cache key. Concurrent identical requests share one service call; failed or empty responses are not cached.

| Setting    | Engine                | Output                                              |
| ---------- | --------------------- | --------------------------------------------------- |
| Ultra fast | PDF Inspector         | Paragraph overlays on the original PDF              |
| Fast       | PDFMathTranslate      | Translated PDF pages with formula preservation      |
| Precise    | PDFMathTranslate-next | Translated PDF pages with more detailed typesetting |

PDF rendering and layout analysis stay local. Translation sends document text to OpenAI and may incur API charges. Fast and Precise run in separate app-managed Python environments installed with `uv`, and access OpenAI through the backend proxy. API keys remain outside the renderer.

Saved desktop keys are encrypted with Electron `safeStorage` and macOS Keychain protection. A saved key overrides `OPENAI_API_KEY`; clearing it restores the environment fallback. Saving is disabled when secure storage is unavailable.

Desktop data is stored in the app directory under `~/Library/Application Support/`: credentials, recent documents, translation/layout caches, and kernel environments. Browser-development caches use `.cache/translations/`. Caches and temporary PDFs can contain document content; **Clear** on the start page removes recent-document history only.

In browser development, Express and Vite run in a standalone Node.js process. Native menus, desktop IPC, and secure desktop key storage are available only in the desktop app.

</details>

<details>
<summary>Limitations</summary>

- **Platform support:** macOS is the tested platform. Windows and Linux have platform-specific styles, but native runtime validation is pending. Packaging commands target macOS arm64 and Windows x64.
- **Layout fidelity:** Ultra fast uses geometric paragraph grouping and text overlays. Complex tables, rotated text, unusual backgrounds, and long translations may not retain the original typography. Math-kernel output depends on upstream layout handling.
- **Scanned documents:** scanned PDFs require OCR, which this app does not implement.
- **Translation requirements:** translation needs an OpenAI API key and network access. Fast and Precise require separately installed math kernels through `uv`.
- **Scope:** this is a local reader and translation app, not a complete PDF editing or export tool.
- **Validation:** the [30 core regression tests](doc/core-tests.md) cover backend and reader support logic. Mock-provider checks do not establish live OpenAI translation quality or API-key validity.

</details>

## License

PDFMathReader is licensed under the GNU Affero General Public License, version 3. See [LICENSE](LICENSE) for the full text. PDFMathTranslate and PDFMathTranslate-next are also AGPL-3.0 projects. Their runtime installations retain upstream license files; other dependencies retain their respective licenses.

## Acknowledgements

Many thanks to [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/), and [SiliconFlow](https://siliconflow.cn/) for their support.
