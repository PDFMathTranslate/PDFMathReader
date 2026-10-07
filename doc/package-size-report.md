# Package size reduction

Measured on macOS arm64, Electron 44.5.1. File-byte totals count each physical file once and exclude symbolic-link aliases; Finder/`du` allocation sizes may differ slightly.

## Results

The previous installed app contained 407.5 MiB of files. The reduced production build contains approximately 303.6 MiB: **103.9 MiB smaller, a 25.5% reduction**. Electron's frameworks remain approximately 285.8 MiB. The complete application payload staged for packaging is approximately 16.1 MiB; installed Resources decreased from 121.7 MiB to 17.8 MiB. The signed ZIP distribution is approximately 129.0 MiB.

Each reduction was measured separately. This table measures unarchived staging files, excluding the shared Electron runtime and the package icon/archive headers.

| Stage                                                          | Application staging payload | Change                                                                               |
| -------------------------------------------------------------- | --------------------------: | ------------------------------------------------------------------------------------ |
| Runtime file whitelist with existing production dependencies   |                   112.7 MiB | Excludes project documents, build scripts, smoke tests and Vite cache                |
| Remove duplicate PDF.js distribution and unused pdf-lib builds |                    62.9 MiB | Keeps PDF.js and its worker in the frontend build; keeps pdf-lib's Node entry        |
| Remove optional Node Canvas / Skia                             |                    36.2 MiB | Removes approximately 26.8 MiB; browser rendering uses Chromium Canvas               |
| Copy only the actual Node runtime dependency graph             |                    19.9 MiB | Removes Vue and frontend compiler dependencies; preserves nested dependency versions |
| Bundle main process and backend, including used pdf-lib code   |                    16.1 MiB | Keeps Express and native PDF Inspector external; preserves original resource paths   |

Third-party license notices for browser libraries and inlined backend dependencies are retained. PDF Inspector's arm64 native binary remains unpacked. The Python translation environments and models remain installed separately, as before; these measurements concern the `.app`, not those environments.

## Implementation

`electron/build/production-stage.mjs` builds a fresh temporary staging directory. It copies runtime assets and dependency versions explicitly, then bundles `electron/main.mjs` and `server/index.mjs` with esbuild. The utility-process launcher and preload remain separate. Development source and installed dependencies are left intact.

`electron/build/package.mjs` packages that staging directory and writes `package-size.json` beside the output app. The default stage is `bundle`; the intermediate stages are available through `--stage=whitelist`, `--stage=pdf`, `--stage=skia`, and `--stage=dependencies` for diagnosis. Test packages include their mock-provider smoke scripts and fixture-generation dependencies; their total size is therefore larger than production.

## Validation

All 56 unit tests passed. Staged backend checks verified static asset serving, sample PDF delivery, native text extraction and inspector version lookup without PDF.js's Node dependency or Skia. Packaged checks cover Ultra fast paragraph coverage and original restoration, Fast/Precise translation and paragraph toggling, and 120/1,000-page virtualization, horizontal and 1/2/4-column layouts, lazy thumbnails, bounded bitmap caches and background pause. Screenshot-based resize, symmetric margins and fullscreen checks also passed, with zero blank frames across 1,362 observations. Provider responses in translation tests are mocked.

The long-document check also exposed a rendering race: visible rows were calculated using new zoom geometry before the DOM committed that geometry. Waiting for the DOM update before viewport calculation fixes the blank horizontal jump; the complete long-document check then passed.

## Build and test

```zsh
npm run package:mac
node electron/build/package.mjs --test
'/tmp/pdfmathreader-slim-test-build/PDFMathReader Tests-darwin-arm64/PDFMathReader Tests.app/Contents/MacOS/PDFMathReader Tests' --smoke-test=performance
```

The reduced app was ad-hoc signed, passed deep/strict signature verification, and was installed and launched from `/Applications/PDFMathReader.app`. Runtime bundles and frontend assets match the isolated package used for verification. When upgrading, replace the entire app bundle rather than merging directories, so retired unpacked native binaries are removed.

The stock Electron arm64 runtime remains the largest part. ASAR archives are uncompressed; a compressed distribution archive can reduce download size without reducing installed size. Runtime binaries, native helpers and translation features were retained.
