<img src="doc/banner.jpg" alt="Demo" width="100%">

[English](README.md) · [简体中文](doc/README.zh-CN.md) · [日本語](doc/README.ja.md) · [हिन्दी](doc/README.hi.md) · [Français](doc/README.fr.md) · [Español](doc/README.es.md) · [বাংলা](doc/README.bn.md) · [한국어](doc/README.ko.md)

# <img src="doc/icon.png" alt="PDFMathReader app icon" style="height: 1em; width: auto;"> PDFMathReader

[![Electron compile](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml/badge.svg)](https://github.com/PDFMathTranslate/PDFMathReader/actions/workflows/electron-build.yml)
<a href="https://github.com/PDFMathTranslate/PDFMathReader/pulls">
<img src="https://img.shields.io/badge/contributions-welcome-green"></a>
<a href="./LICENSE">
<img src="https://img.shields.io/github/license/PDFMathTranslate/PDFMathReader"></a>

Read scientific documents in your language, in realtime, on any platform.  
Powered by [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate) with frontier artificial intelligence.

See [PDFMathReader-iOS](https://github.com/PDFMathTranslate/PDFMathReader-iOS) for the mobile companion.

## Features

- **Read translated documents with layouts preserved**: Keep formulas, tables, and other essential content intact.
- **Start reading without waiting**: Detect layouts and translate content as you read.
- **Read in your preferred language**: Choose from a wide range of interface, source, and target languages, with options for further customization.
- **Choose your preferred translation service**:
  - Connect to major AI providers.
  - Use custom services through OpenAI-compatible APIs.
  - Access free translation through our partnerships, helping make multilingual reading more accessible.
- **Keep your notes alongside your reading**: Highlight passages and add comments in both original and translated documents.
- **Navigate efficiently**:
  - Explore documents through thumbnails, quick links, search, outlines, page numbers, and gallery views.
  - Choose from multiple reading layouts.
  - Organize your work across windows and tabs.
- **Tailor the reading experience**:
  - Automatically emphasize topic sentences, scientific findings, and logical connections.
  - Adjust translation behavior to suit your workflow.
  - Customize fonts, icons, accent colors, and dark mode.
  - Balance layout-detection speed and quality.
  - Enable smooth scrolling.
- **Make text easier to follow**:
  - Emphasize distinctive terms with TF-IDF weighting.
  - Enable bionic reading with fixed-length or word-root emphasis.
- **Keep your workflow open**: Share and edit files across applications and devices—for example, use AirDrop to continue reading on a mobile device.
- **Enjoy a familiar interface across platforms**: Read on macOS, Windows, Linux, and iOS.

## At a glance

<img src="doc/demo.gif" alt="Demo" width="100%">

## Recent updates

| Date       | Feature                                                                                                                                           | Contributor                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 2026-10-21 | [add quick glossary and AI paraphrase actions](https://github.com/PDFMathTranslate/PDFMathReader/commit/38cf3a8e87da9e0d81328bd09fe0b463a82d70b3) | [@reycn](https://github.com/reycn) |
| 2026-10-21 | [add native Handoff between macOS and iOS](https://github.com/PDFMathTranslate/PDFMathReader/commit/f586b30c16d542e97c093e8d1f33809a38a48b4d)     | [@reycn](https://github.com/reycn) |
| 2026-10-21 | [reopen closed tabs with cmd shift t](https://github.com/PDFMathTranslate/PDFMathReader/commit/5cf3a9d401b9a5414e6fdeaa4df1332ce92396b6)          | [@reycn](https://github.com/reycn) |
| 2026-10-21 | [make DOI text clickable](https://github.com/PDFMathTranslate/PDFMathReader/commit/cfb1d08238021c0735038061a78173160cb527c2)                      | [@reycn](https://github.com/reycn) |
| 2026-10-21 | [add exact and regex document search](https://github.com/PDFMathTranslate/PDFMathReader/commit/65a5bb93f863cced68dd9ee36517135054cee507)          | [@reycn](https://github.com/reycn) |
| 2026-10-21 | [add stop all tasks to translation menu](https://github.com/PDFMathTranslate/PDFMathReader/commit/d5c5a99a67204c018ed5fbe7a44c65181ecbfd74)       | [@reycn](https://github.com/reycn) |
| 2026-10-18 | [build prepared demo with actual app UI](https://github.com/PDFMathTranslate/PDFMathReader/commit/aae85e7fc46e3b0788045823ba64d6361754b0b7)       | [@reycn](https://github.com/reycn) |

## Quick start

### Desktop

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
  *Due to the limited devices available for testing, the compatibility checks on Windows and Linux are done periodically (contribution welcome).*

### Mobile

- **iOS**: [Provided in this repository](https://github.com/PDFMathTranslate/PDFMathReader-iOS) with familar design to desktop clients
- **Android**: (contribution welcome)

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

Experimental Jev paragraph continuation detection is available with Ultra fast and Fast. Fast combines confirmed adjoining fragments within the same column before translation and typesetting, keeping formulas in place. Uncertain or failed checks preserve separate fragments. Enabling it uses separate page caches so earlier unmerged output is regenerated.

Experimental: Settings → Experimental → Generate table of contents adds Edit → Generate Table of Contents, which builds a contents list locally for documents without bookmarks, with progress shown in the Contents sidebar. It parses a printed contents page (including dot leaders and right-aligned page numbers) and maps its page numbers to physical pages; if there is none, it infers headings from font sizes, numbering, and spacing. Nothing is sent anywhere. Scanned pages without a text layer are not supported, and generated contents are not saved with the document.

Experimental: Precise can instead translate through a remote [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) server over HTTP (Settings → Experimental). PDFMathReader implements that server's HTTP protocol as a client; the server is not bundled and is optional. The remote kernel is used only when the server's `/health` check passes, otherwise the local Precise kernel runs. No API key is sent; the server uses its own translation service. Remote pages have no reading text layer, and the selected translation service and glossaries are not used for remotely translated pages.

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

## Paper

The kernel of this work has been accepted by the [_Proceedings of the 2025 Conference on Empirical Methods in Natural Language Processing: System Demonstrations_](https://aclanthology.org/2025.emnlp-demos.71/) (EMNLP 2025).

Citation:

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

## License

PDFMathReader is licensed under the GNU Affero General Public License, version 3. See [LICENSE](LICENSE) for the full text. Dependencies retain their respective licenses, including [PDFMathTranslate](https://github.com/PDFMathTranslate/PDFMathTranslate), [PDFMathTranslate-next](https://github.com/PDFMathTranslate-next/PDFMathTranslate-next), and [zotero-pdf2zh](https://github.com/guaguastandup/zotero-pdf2zh) (AGPL-3.0, optional remote kernel protocol).

## Acknowledgements

Many thanks to [OpenAI](https://openai.com/), [Anthropic](https://www.anthropic.com/), [Warp](https://www.warp.dev/), [Immersive Translate](https://immersivetranslate.com/), and [SiliconFlow](https://siliconflow.cn/) for their support and [Linux.Do](https://linux.do/) for allowing us share the project.
