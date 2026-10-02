<p align="center">
  <img src="doc/icon.png" alt="PDFMathReader app icon" style="height: 4em; width: auto;">
</p>

# PDFMathReader (experimental)

[English](README.md) · [简体中文](doc/README.zh-CN.md) · [日本語](doc/README.ja.md)

An experimental local PDF reader powered by PDFMathTranslate. Built with Vue 3, PDF.js, and Electron.

Currently tested on macOS. Windows and Linux have platform-specific window and toolbar styles; native runtime validation on those systems is still pending.

<img src="doc/preview.png" alt="PDFMathReader reader" width="70%">

## Recent updates

- Open multiple PDFs in separate windows, each with its own reading position, translation work, and backend process. Closing one window leaves the others running.
- Browse recent PDFs in a thumbnail gallery from **File → Open recents...**. Reopening a document restores its page, scroll position, zoom, layout, sidebar, and original/translation view.
- Open the existing settings panel through **File → Preference** or **Settings…**.
- Switch individual detected regions between original and translation in place: single-click with **Ultra fast**, **Fast**, or **Precise**.
- Read large documents with virtualized pages and thumbnails, bounded rendering caches, and independent rendering, layout analysis, and translation.

## Quick start

### Run the desktop app

For development, use Node.js 22 on an Apple Silicon Mac:

```zsh
npm install
npm run desktop
```

Open a PDF, then open **Settings…** or **File → Preference**. Enter your OpenAI API key and choose **Save key**. Select a target language and translation kernel. Reading PDFs and inspecting their layout do not require a key; translation does.

**Ultra fast** is included. To use **Fast** or **Precise**, install `uv`, select the kernel in Settings, and choose **Install kernel with uv**. Each math kernel uses a separate app-managed Python environment. Checking availability does not install packages or change your global tools.

### Build a macOS app

```zsh
npm run package:mac
```

Open `release/PDFMathReader-darwin-arm64/PDFMathReader.app`. The packaged app includes its runtime and local backend, so it does not require a separate Node.js installation or development server. The packaging command produces an unsigned local Apple Silicon build.

The desktop app also accepts `OPENAI_API_KEY` and `OPENAI_MODEL`. Finder usually does not inherit terminal environment variables. Use `Launch PDFMathReader.command` to launch the packaged app with your login-shell configuration.

### Browser development

```zsh
read -s 'OPENAI_API_KEY?OpenAI API key: '; export OPENAI_API_KEY
npm run dev
```

Open [127.0.0.1:5173](http://127.0.0.1:5173). Set `OPENAI_MODEL` before launching to override the default model, `gpt-4.1-mini`.

To check backend and reader support logic and build the frontend:

```zsh
npm test
npm run build
```

## Features

### Reading and document management

- Open or drag in PDFs up to 50 MiB. The packaged macOS app also supports Finder **Open With** and dropping PDFs onto its Dock icon.
- Read different PDFs in independent desktop windows. Each window has its own renderer and backend process.
- Navigate with thumbnails, change zoom, fit width or height, scroll vertically or horizontally, and choose one, two, or four pages per row.
- Resume recent documents from the start page or the File menu gallery. Reading state is saved for each document.
- Use **⌘N** for a new window, **⌘O** to open a PDF, **⌘W** to close the current document, and **Ctrl+W** to close its window on macOS. On Windows and Linux, use **Ctrl+N**, **Ctrl+O**, **Ctrl+W**, and **Ctrl+Shift+W**, respectively.

macOS uses an integrated toolbar, native traffic lights, and vibrancy. Windows uses a native title bar and menu with a Segoe UI toolbar. Linux uses desktop-managed window decorations, system fonts, and an opaque toolbar. Other reader shortcuts use Ctrl in place of Command on Windows and Linux.

### Translation

| Setting | Engine | Output |
| --- | --- | --- |
| Ultra fast | PDF Inspector | Paragraph overlays on the original PDF |
| Fast | PDFMathTranslate | Translated PDF pages with formula preservation |
| Precise | PDFMathTranslate-next | Translated PDF pages with more detailed typesetting |

Choose a target language in Settings. **完整翻译** translates the entire document; **降低翻译请求** translates the current page and up to two pages on either side as you read. Configure 1–4 parallel pages and 1–8 translation requests; defaults are 2 pages and 4 requests.

The toolbar translation control switches between original and translated content. With any kernel, single-click a detected paragraph to toggle its original and translation in place. Enable **Show paragraph boundaries** to see detected regions. Retry a failed current page from Settings.

Rendering, layout detection, and translation run independently, and results appear as paragraphs or pages finish. Changing the document, language, or kernel cancels outdated work. Minimizing or hiding a window pauses rendering and reading-mode work; full-document translation continues.

### Local processing and storage

PDF rendering and layout analysis run locally. Translation sends document text to OpenAI and may incur API charges. Math kernels also create temporary local PDF files. Translation results and layout metadata are cached on this device.

Desktop API keys saved in Settings are encrypted with Electron `safeStorage` and macOS Keychain protection. A saved key takes precedence over `OPENAI_API_KEY`; clearing it restores the environment fallback. Saving is disabled when secure storage is unavailable, and renderer APIs do not expose saved keys.

Desktop data lives in the app’s directory under `~/Library/Application Support/`:

| Location | Contents |
| --- | --- |
| `openai-key.enc` | Encrypted API key |
| `recent-documents.json` | Recent document paths, previews, and reading positions |
| `translations/` | Cached text, translated PDF pages, and layout metadata |
| `engines/` | Math-kernel environments and assets |

Use **Clear** on the start page to remove recent-document history. Browser-development translations are cached in `.cache/translations/`; delete the corresponding translation cache directory to clear cached results. Translation caches can contain document-derived text. The backend binds to `127.0.0.1`, and the desktop app authenticates its local requests.

### Rendering performance

Pages and thumbnail DOM nodes are virtualized. The reader renders visible pages and keeps up to four rows on either side; thumbnails load near the sidebar viewport. Bitmap reuse is limited to 64 MiB and resident page canvases to 128 MiB, with distant prefetched canvases released first under memory pressure.

Each PDF is uploaded to its local backend once, then page requests use its document ID. PDF.js and layout analysis load on demand.

Window resizing and sidebar changes update page layout live, coalescing layout work per animation frame and limiting visible-page redraws to once per 100 ms. After 160 ms without a resize, buffered pages are refreshed. The desktop app records first-screen latency, scroll long tasks, sampled process memory peaks, and HTTP body bytes in `performance.json` (the latest 20 reports). Memory totals include shared processes and can double-count shared resident pages; HTTP counts exclude headers and external kernel/provider traffic.

## Architecture

PDFMathReader separates desktop coordination, page rendering, and translation processing. Each desktop window has its own renderer and local backend; the main process manages app-wide services.

```text
                         DESKTOP APP
+--------------------------------------------------------------+
| Electron main process                                        |
| Window lifecycle, native menus, file opening                  |
| Credentials, recent documents, reading preferences            |
+---------------------+----------------------------------------+
                      | IPC via sandboxed preload
                      v
+--------------------------------------------------------------+
| Per-window renderer: Vue 3 + PDF.js                           |
| PDF pages / thumbnails / paragraph overlays / reading state   |
+---------------------+----------------------------------------+
                      | Authenticated HTTP on 127.0.0.1
                      v
+--------------------------------------------------------------+
| Per-window backend: Express in an Electron utility process    |
| Document store / layout analysis / translation queues         |
|                                                              |
| Ultra fast: PDF Inspector --> paragraph translation           |
| Fast / Precise: Python worker --> app-managed math kernels    |
|                                  |                           |
|                                  v                           |
|                         Local OpenAI proxy                    |
+-----------+----------------------+---------------------------+
            |                      | HTTPS: text translation
            v                      v
+----------------------+   +----------------------+
| Local disk           |   | OpenAI API           |
| Translation caches   |   | Translation responses|
| Kernel environments  |   +----------------------+
| Temporary PDF files  |
+----------------------+
```

Rendering, layout detection, and translation run independently. Python math kernels call OpenAI through the local backend proxy; API keys stay outside the renderer. Credentials, recent-document history, and saved preferences are managed by the main process, while backend caches and kernel environments use local disk.

In browser development, a browser tab replaces the Electron renderer and `npm run dev` runs Express with Vite in a standalone Node.js process. Native menus, desktop IPC, and Keychain-backed key storage belong to the desktop app.

## Limitations

- **Platform support:** macOS is the tested platform. Windows and Linux have platform-specific styles, but native runtime validation is pending. The packaging script currently builds only for macOS arm64; no Intel build is provided.
- **Layout fidelity:** Ultra fast uses geometric paragraph grouping and text overlays. Complex tables, rotated text, unusual backgrounds, and long translations may not retain the original typography. Math-kernel output depends on upstream layout handling.
- **Scanned documents:** scanned PDFs require OCR, which this app does not implement.
- **Translation requirements:** translation needs an OpenAI API key and network access. Fast and Precise require separately installed math kernels through `uv`.
- **Scope:** this is an experimental local reader and translation app, not a complete PDF editing or export tool.
- **Validation:** automated tests cover backend and reader support logic. Mock-provider checks do not establish live OpenAI translation quality or API-key validity.

## License

PDFMathReader is licensed under the GNU Affero General Public License, version 3. See [LICENSE](LICENSE) for the full text.

PDFMathTranslate and PDFMathTranslate-next are also AGPL-3.0 projects. Their runtime installations retain upstream license files; other dependencies retain their respective licenses.
