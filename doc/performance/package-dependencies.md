# Build and runtime dependencies

Frontend libraries (`vue`, `@macvue/core`, `@fluentui/tokens`, and
`@fluentui/web-components`) are devDependencies because Vite emits their code
into `dist`. Express, pdf-lib, PDF Inspector, PDF.js, and DOMMatrix remain
runtime dependencies for direct Node/Electron execution and portable extraction.

The default `bundle` stage incorporates Express and pdf-lib into the server/main
bundles. A Node `createRequire` banner supports bundled CommonJS dependencies.
Both bundles retain incorporated packages' licenses. Staged `node_modules`
contains external runtime modules only; PDF.js and DOMMatrix are retained when
the target has no native Inspector binding. Test packages additionally include
pdf-lib for their fixtures.

## Local validation (2026-10-04, macOS arm64)

Using identical freshly built `dist` contents:

| Production staged content |      Bytes |   MiB |
| ------------------------- | ---------: | ----: |
| Before Express bundling   | 18,325,719 | 17.48 |
| After Express bundling    | 17,002,252 | 16.21 |
| Saved                     |  1,323,467 |  1.26 |

This is a 7.22% reduction of application content, excluding Electron itself.
It is not a measurement of the compressed distribution ZIP.

- `npm run build`: passed.
- `npm test`: 155 tests passed, including staged backend HTTP authentication,
  PDF upload/text extraction, and portable target dependency checks.
- `node electron/package.mjs --test --unsigned`: generated an ASAR macOS arm64
  test app with Electron 44.5.1. Test fixtures make this larger than production.
- Desktop startup invocation exited with status 1 after a macOS
  `sandbox_extension_issue_file_to_process` permission error; GUI startup remains
  unverified.
