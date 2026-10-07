# Core regression tests

The repository retains 40 automated Node tests. `bun run test` discovers every `tests/server/**/*.test.mjs` file recursively and runs them through Node's built-in `node:test` runtime; there is no hidden extended suite or skipped-test filter. The unused Electron recents unit suite was also removed.

Selection ranks original PDF and annotation integrity first, credential protection and authenticated document access next, then translation routing, cancellation, cache persistence and document isolation. Extraction, session recovery, settings preservation, production packaging and bounded rendering complete the suite. Existing retained assertions remain intact.

Removed lower-priority checks cover annotation browser filters, topic/keyword emphasis, translation spacing, outline tracking, quick links, pins, navigation helpers and row layout. Helper-level page-edit variants are replaced in the retained coverage by the existing save integration test, which checks disk contents, annotation geometry, rotation and rejection without modifying the PDF. Redundant cache variants were removed; the generic custom-model cache unit case was replaced by the topic-sentence regression below, while kernel upgrade/restart and paragraph API cache coverage remain. These areas have less automatic regression coverage; additions should focus on behavior or lifecycle gaps rather than mirror extracted functions.

Run `bun run build` before `bun run test`: the production-stage check consumes the built frontend. Provider requests use mocks; passing tests do not establish live translation quality or visual rendering correctness. Electron smoke scripts remain available for targeted desktop checks outside this Node suite. Historical performance reports retain their original counts.

The topic-sentence regression checks the reported indented Chinese paragraph, math-kernel source/translation geometry, column isolation, page continuations, small numbered footnotes and unchanged length rules.

| #   | Test file                                                | Retained behavior                                                                                                                 |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | tests/server/documents/annotations.test.mjs              | annotation store round-trips metadata, embeds standard annotations, rewrites only managed entries, and preserves external entries |
| 2   | tests/server/documents/annotations.test.mjs              | fingerprint-only documents persist sidecar metadata and serialize concurrent saves                                                |
| 3   | tests/server/documents/annotations.test.mjs              | native comments and highlights import, migrate, recover from copied PDF, and delete without affecting other entries               |
| 4   | tests/server/documents/annotations.test.mjs              | opening an unannotated or link-only PDF preserves its exact bytes                                                                 |
| 5   | tests/server/documents/annotations.test.mjs              | prepared PDF removes imported native and managed annotations while preserving unrelated links                                     |
| 6   | tests/server/platform/credentials.test.mjs               | credential override, reload, clearing and secure-storage failure                                                                  |
| 7   | tests/server/platform/credentials.test.mjs               | Windows keys use system encryption, survive replacement and reload, and never save plaintext                                      |
| 8   | tests/server/integration/desktop.test.mjs                | desktop backend has private origin, authenticates API, and releases its port                                                      |
| 9   | server/document-search.test.mjs                          | PDF search spans text runs, ignores layout whitespace, and keeps matching coordinates                                             |
| 10  | tests/server/platform/document-session.test.mjs          | session persists multiple documents and positions; closing all restores only the last closed document                             |
| 11  | tests/server/documents/documents.test.mjs                | OS PDF delivery validates files and exposes bytes without filesystem paths                                                        |
| 12  | tests/server/documents/documents.test.mjs                | document store rejects capacity without evicting active documents and invalidates deletes                                         |
| 13  | tests/server/documents/documents.test.mjs                | authenticated registration supports multiple JSON layouts for one stored document                                                 |
| 14  | tests/server/kernels/engines.test.mjs                    | global translation budget holds across simultaneous page workers and releases after failures                                      |
| 15  | tests/server/kernels/engines.test.mjs                    | cancelled queued translations release immediately without running or waiting for a slot                                           |
| 16  | tests/server/kernels/engines.test.mjs                    | Fast and Precise retain compatible pre-update translated PDFs and layouts across app versions                                     |
| 17  | server/layout-extraction.test.mjs                        | cleanup cancels pending and in-flight waiters and ignores late native results                                                     |
| 18  | tests/server/documents/page-edit-save.test.mjs           | page edits persist to the original PDF and annotation metadata before resolving                                                   |
| 19  | tests/server/documents/pdf-extractor.test.mjs            | portable extraction preserves selected pages, display-frame positions and font sizes                                              |
| 20  | tests/server/platform/preferences.test.mjs               | partial saves keep every current setting and unknown key                                                                          |
| 21  | tests/server/production-stage.test.mjs                   | production bundle serves and extracts PDFs without an external Express installation                                               |
| 22  | server/render-resolution.test.mjs                        | large pages remain bounded by backing store memory and canvas dimensions                                                          |
| 23  | server/topic-sentences.test.mjs                          | topic sentences start on indented first lines and use original or translated paragraph boundaries                                 |
| 24  | server/translation-cache.test.mjs                        | paragraph API reuses legacy translations by default, strict mode invokes current provider                                         |
| 25  | tests/server/translation/translation-provider.test.mjs   | configured key routes only to OpenAI and aborted fallback sends no translation                                                    |
| 26  | tests/server/translation/translation-provider.test.mjs   | backend fallback headers survive cache and failure, with independent launch sessions and provider caches                          |
| 27  | tests/server/translation/translation-text-cache.test.mjs | deduplicates concurrent requests and keeps the shared request alive for a remaining waiter                                        |
| 28  | tests/server/translation/translation-text-cache.test.mjs | does not cache failed or empty OpenAI responses                                                                                   |
| 29  | tests/server/translation/translation-text-cache.test.mjs | document cache invalidation bypasses shared text results without changing another document                                        |
