[English](README.md) · [简体中文](doc/README.zh-CN.md) · [日本語](doc/README.ja.md)

# <img src="doc/icon.png" alt="PDFMathReader app icon" style="height: 1em; width: auto;"> PDFMathReader (experimental)

  [![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml) 
  <a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
    <img src="https://img.shields.io/badge/contributions-welcome-green"></a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>  

Read scientific documents in any language, with realtime translation, on any platform. Powered by [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate).

<img src="doc/demo.gif" alt="Demo" width="100%">

## Features

- Open PDFs up to 50 MiB in independent windows, with drag-and-drop and macOS Finder/Dock support.
- Navigate with thumbnails, zoom, fit-to-page controls, vertical or horizontal scrolling, and one-, two-, or four-page layouts.
- Resume recent documents with their reading position and display settings restored.
- Choose full-document or nearby-page translation, and click detected paragraphs to toggle original text and translation.
- Configure translation language, concurrency, and kernel-specific options in Settings. Interface language is configured separately.
- Create saved bidirectional links between a search result and its reading origin, with link buttons available in both original and translated views.
- Use evenly spaced annotation palettes and synchronized titlebar animations across thumbnail, outline, and annotation sidebars.
- Read cached translations with neutral gray progress indicators; active translation uses the selected accent color.

## Recent updates

| Date | Feature | Contributor |
| --- | --- | --- |
| 2026-10-05 | [reduce background resource usage and default to reading mode](https://github.com/PDFMathTranslate/PDFMathReader/commit/1abd72352f0fc8e59130e5a151244ab0adf869c2) | [@reycn](https://github.com/reycn) |
| 2026-10-05 | [add reading emphasis and simplify document menus](https://github.com/PDFMathTranslate/PDFMathReader/commit/9575ef499a1fb982060364f9733a5e85f804c223) | [@reycn](https://github.com/reycn) |
| 2026-10-04 | [add persistent page edits and improve reader navigation](https://github.com/PDFMathTranslate/PDFMathReader/commit/908efd1612769e9b1a4caa8682eaa8cc735cdbb4) | [@reycn](https://github.com/reycn) |
| 2026-10-04 | [add annotation search filters and grouping with sidebar refinements](https://github.com/PDFMathTranslate/PDFMathReader/commit/278ca22a5f6bbcb92ea72d259b7367ba86d44407) | [@reycn](https://github.com/reycn) |
| 2026-10-04 | [add bidirectional quick return links for search results](https://github.com/PDFMathTranslate/PDFMathReader/commit/66715a61680daeb9943b28ed4ca122bc297ff4d8) | [@reycn](https://github.com/reycn) |
| 2026-10-04 | [search selected text within document](https://github.com/PDFMathTranslate/PDFMathReader/commit/d4d5c0f703f0815ae4f9d9767c471dd44edfec8e) | [@reycn](https://github.com/reycn) |
| 2026-10-04 | [support paragraph AND search and stabilize translation display](https://github.com/PDFMathTranslate/PDFMathReader/commit/b05fd13edd4ac2268c7af4fa125bfbcd067d025b) | [@reycn](https://github.com/reycn) |

## Quick start

### Screenshots
| macOS | Windows | Linux |
| :---: | :---: | :---: |
| <img src="doc/preview.png" alt="PDFMathReader reader" height="240"> | <img src="doc/preview-windows.png" alt="PDFMathReader reader" height="240"> | <img src="doc/preview-linux.png" alt="PDFMathReader reader on Linux" height="240"> |

### Installation
Download the package for your system and CPU from [GitHub Actions](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml). Extract the Actions artifact ZIP first.

<details>
<summary>macOS</summary>

Extract the macOS ZIP, move `PDFMathReader.app` to `/Applications`, and open it.

<details>
<summary>macOS says the app is “damaged”</summary>

For a download you trust, run this in Terminal, enter your Mac login password when prompted (it is not displayed), then reopen the app:

```zsh
sudo xattr -dr com.apple.quarantine /Applications/PDFMathReader.app
```

</details>

</details>

<details>
<summary>Windows</summary>

Double-click `PDFMathReader-win32-x64.exe` (or the `ia32` version for 32-bit Windows). The portable app includes its runtime. Launching it registers the PDF **Open with PDFMathReader** menu; launch it again after moving the executable.

</details>

<details>
<summary>Linux</summary>

Extract the `.tar.gz` for your CPU, then run the app from its folder:

```sh
./PDFMathReader
```

</details>

Open a PDF. In **Settings…**, save your OpenAI API key and choose a target language. Reading needs no key; translation does. **Ultra fast** is included. For **Fast** or **Precise**, install `uv`, then choose **Install kernel with uv** in Settings.

## Development
<details>
<summary>Local development</summary>

Use Node.js 22. To run the desktop app from source:

```sh
npm ci
npm run desktop
```

Build on the matching platform:

```sh
# macOS (requires a signing identity; add --unsigned to skip signing)
npm run package:mac
# Windows
npm run package:win
```

Frontend libraries (Vue, MacVue, and Fluent UI) are build dependencies: Vite includes them in `dist`. Node dependencies used by the server or Electron main process remain runtime dependencies. Install with `npm ci` before building; `npm ci --omit=dev` cannot build or package the app.

The default Electron package bundles Express and PDF utilities into the backend/main scripts, retaining their licenses. It copies only external runtime modules into the staged `node_modules`; native PDF Inspector bindings and the PDF.js/DOMMatrix fallback for unsupported native targets remain available. Electron itself and packaging tools are supplied by the build toolchain.

For browser development, set `OPENAI_API_KEY`, run `npm run dev`, and open [127.0.0.1:5173](http://127.0.0.1:5173). Use `OPENAI_MODEL` to override the default model. Desktop environment variables can be loaded with `Launch PDFMathReader.command`.

```sh
npm test
npm run build
```

</details>

<details>
<summary>Details</summary>

PDFMathReader uses Vue 3 and PDF.js for the reader, Electron for the desktop app, and Express for the local backend. Vite supports frontend development and builds; pdf-lib handles PDF manipulation.

Each desktop window has its own renderer and backend running in an Electron utility process. The main process manages windows, menus, credentials, recent documents, and preferences. A sandboxed preload provides desktop IPC; backend requests use authenticated HTTP on `127.0.0.1`.

Rendering, layout analysis, and translation run independently. Pages and thumbnails are virtualized, PDF.js and layout analysis load on demand, and rendering caches have bounded memory use. Each document is uploaded to its local backend once; subsequent requests use its document ID. Outdated translation work is cancelled when the document, language, or kernel changes.

Translation text is cached across documents and app restarts. Identical requests to the same service and model reuse the saved result, including requests from the math translation kernels. Languages, prompts, and other translation options remain part of the cache key. Concurrent identical requests share one service call; failed or empty responses are not cached.

| Setting | Engine | Output |
| --- | --- | --- |
| Ultra fast | PDF Inspector | Paragraph overlays on the original PDF |
| Fast | PDFMathTranslate | Translated PDF pages with formula preservation |
| Precise | PDFMathTranslate-next | Translated PDF pages with more detailed typesetting |

PDF rendering and layout analysis stay local. Translation sends document text to OpenAI and may incur API charges. Fast and Precise run in separate app-managed Python environments installed with `uv`, and access OpenAI through the backend proxy. API keys remain outside the renderer.

Saved desktop keys are encrypted with Electron `safeStorage` and macOS Keychain protection. A saved key overrides `OPENAI_API_KEY`; clearing it restores the environment fallback. Saving is disabled when secure storage is unavailable.

Desktop data is stored in the app directory under `~/Library/Application Support/`: credentials, recent documents, translation/layout caches, and kernel environments. Browser-development caches use `.cache/translations/`. Caches and temporary PDFs can contain document content; **Clear** on the start page removes recent-document history only.

In browser development, Express and Vite run in a standalone Node.js process. Native menus, desktop IPC, and secure desktop key storage are available only in the desktop app.

</details>

## Limitations

- **Platform support:** macOS is the tested platform. Windows and Linux have platform-specific styles, but native runtime validation is pending. Packaging commands target macOS arm64 and Windows x64.
- **Layout fidelity:** Ultra fast uses geometric paragraph grouping and text overlays. Complex tables, rotated text, unusual backgrounds, and long translations may not retain the original typography. Math-kernel output depends on upstream layout handling.
- **Scanned documents:** scanned PDFs require OCR, which this app does not implement.
- **Translation requirements:** translation needs an OpenAI API key and network access. Fast and Precise require separately installed math kernels through `uv`.
- **Scope:** this is an experimental local reader and translation app, not a complete PDF editing or export tool.
- **Validation:** the [30 core regression tests](doc/core-tests.md) cover backend and reader support logic. Mock-provider checks do not establish live OpenAI translation quality or API-key validity.

## License

PDFMathReader is licensed under the GNU Affero General Public License, version 3. See [LICENSE](LICENSE) for the full text.

PDFMathTranslate and PDFMathTranslate-next are also AGPL-3.0 projects. Their runtime installations retain upstream license files; other dependencies retain their respective licenses.

Many thanks to [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/), and [SiliconFlow](https://siliconflow.cn/) for their support.
