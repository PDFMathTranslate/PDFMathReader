[English](README.md) · [简体中文](doc/README.zh-CN.md) · [日本語](doc/README.ja.md)

# <img src="doc/icon.png" alt="PDFMathReader app icon" style="height: 1em; width: auto;"> PDFMathReader (experimental)

Read scientific documents in any language, with realtime translation, on any platform. Powered by PDFMathTranslate.

<img src="doc/demo.gif" alt="Demo" width="100%">

## Quick start

### Run the desktop app


<table>
  <tr>
    <th>macOS</th>
    <th>Windows</th>
    <th>Linux</th>
  </tr>
  <tr>
    <td><img src="doc/preview.png" alt="PDFMathReader reader" height="240"></td>
    <td><img src="doc/preview.png" alt="PDFMathReader reader" height="240"></td>
    <td><img src="doc/preview.png" alt="PDFMathReader reader" height="240"></td>
  </tr>
</table>

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

- Open PDFs up to 50 MiB in independent windows, with drag-and-drop and macOS Finder/Dock support.
- Navigate with thumbnails, zoom, fit-to-page controls, vertical or horizontal scrolling, and one-, two-, or four-page layouts.
- Resume recent documents with their reading position and display settings restored.
- Choose full-document or nearby-page translation, and click detected paragraphs to toggle original text and translation.
- Configure translation language, concurrency, and kernel-specific options in Settings. Interface language is configured separately.

## Technical Details

PDFMathReader uses Vue 3 and PDF.js for the reader, Electron for the desktop app, and Express for the local backend. Vite supports frontend development and builds; pdf-lib handles PDF manipulation.

Each desktop window has its own renderer and backend running in an Electron utility process. The main process manages windows, menus, credentials, recent documents, and preferences. A sandboxed preload provides desktop IPC; backend requests use authenticated HTTP on `127.0.0.1`.

Rendering, layout analysis, and translation run independently. Pages and thumbnails are virtualized, PDF.js and layout analysis load on demand, and rendering caches have bounded memory use. Each document is uploaded to its local backend once; subsequent requests use its document ID. Outdated translation work is cancelled when the document, language, or kernel changes.

| Setting | Engine | Output |
| --- | --- | --- |
| Ultra fast | PDF Inspector | Paragraph overlays on the original PDF |
| Fast | PDFMathTranslate | Translated PDF pages with formula preservation |
| Precise | PDFMathTranslate-next | Translated PDF pages with more detailed typesetting |

PDF rendering and layout analysis stay local. Translation sends document text to OpenAI and may incur API charges. Fast and Precise run in separate app-managed Python environments installed with `uv`, and access OpenAI through the backend proxy. API keys remain outside the renderer.

Saved desktop keys are encrypted with Electron `safeStorage` and macOS Keychain protection. A saved key overrides `OPENAI_API_KEY`; clearing it restores the environment fallback. Saving is disabled when secure storage is unavailable.

Desktop data is stored in the app directory under `~/Library/Application Support/`: credentials, recent documents, translation/layout caches, and kernel environments. Browser-development caches use `.cache/translations/`. Caches and temporary PDFs can contain document content; **Clear** on the start page removes recent-document history only.

In browser development, Express and Vite run in a standalone Node.js process. Native menus, desktop IPC, and secure desktop key storage are available only in the desktop app.

## Limitations

- **Platform support:** macOS is the tested platform. Windows and Linux have platform-specific styles, but native runtime validation is pending. Packaging commands target macOS arm64 and Windows x64.
- **Layout fidelity:** Ultra fast uses geometric paragraph grouping and text overlays. Complex tables, rotated text, unusual backgrounds, and long translations may not retain the original typography. Math-kernel output depends on upstream layout handling.
- **Scanned documents:** scanned PDFs require OCR, which this app does not implement.
- **Translation requirements:** translation needs an OpenAI API key and network access. Fast and Precise require separately installed math kernels through `uv`.
- **Scope:** this is an experimental local reader and translation app, not a complete PDF editing or export tool.
- **Validation:** automated tests cover backend and reader support logic. Mock-provider checks do not establish live OpenAI translation quality or API-key validity.

## License

PDFMathReader is licensed under the GNU Affero General Public License, version 3. See [LICENSE](LICENSE) for the full text.

PDFMathTranslate and PDFMathTranslate-next are also AGPL-3.0 projects. Their runtime installations retain upstream license files; other dependencies retain their respective licenses.
