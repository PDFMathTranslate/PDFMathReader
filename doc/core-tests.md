# Core regression tests

The default `npm test` suite retains exactly 30 tests, reduced from 158. Selection prioritizes document or annotation loss, credential exposure, incorrect translation routing, core PDF extraction, restart persistence, and unbounded resource use. Existing assertions remain intact; small UI-policy checks and redundant helper-level variants were removed.

Run `npm run build` before `npm test`: the production-stage check consumes the built frontend. Provider requests use mocks; these tests do not establish live translation quality or visual rendering correctness. Electron smoke scripts remain available for focused desktop validation outside this 30-test suite. Historical performance reports retain their original counts.

| # | Test file | Retained behavior |
|---|---|---|
| 1 | server/annotation-display.test.mjs | whole-page translation loaded while viewing original does not hide source highlights |
| 2 | server/annotation-display.test.mjs | paragraph annotations follow their own rendered overlay, not another translated paragraph |
| 3 | server/annotations.test.mjs | annotation store round-trips metadata, embeds standard annotations, rewrites only managed entries, and preserves external entries |
| 4 | server/annotations.test.mjs | fingerprint-only documents persist sidecar metadata and serialize concurrent saves |
| 5 | server/annotations.test.mjs | native comments and highlights import, migrate, recover from copied PDF, and delete without affecting other entries |
| 6 | server/bitmap-cache.test.mjs | touches entries on get and evicts the oldest entry |
| 7 | server/bitmap-cache.test.mjs | rejects an oversized canvas without changing it or evicting entries |
| 8 | server/credentials.test.mjs | credential override, reload, clearing and secure-storage failure |
| 9 | server/credentials.test.mjs | Windows keys use system encryption, survive replacement and reload, and never save plaintext |
| 10 | server/desktop.test.mjs | desktop backend has private origin, authenticates API, and releases its port |
| 11 | server/document-search.test.mjs | PDF search spans text runs, ignores layout whitespace, and keeps matching coordinates |
| 12 | server/document-session.test.mjs | session persists multiple documents and positions; closing all restores only the last closed document |
| 13 | server/documents.test.mjs | OS PDF delivery validates files and exposes bytes without filesystem paths |
| 14 | server/documents.test.mjs | document store rejects capacity without evicting active documents and invalidates deletes |
| 15 | server/documents.test.mjs | authenticated registration supports multiple JSON layouts for one stored document |
| 16 | server/engines.test.mjs | fresh kernel assets have valid targets and reuse existing shared models |
| 17 | server/engines.test.mjs | global translation budget holds across simultaneous page workers and releases after failures |
| 18 | server/layout-extraction.test.mjs | coalesces same-entry requests, sorts and deduplicates pages, and splits by one-indexed page |
| 19 | server/layout-extraction.test.mjs | cleanup cancels pending and in-flight waiters and ignores late native results |
| 20 | server/layout-extraction.test.mjs | limits cache by exact JSON bytes and page count with LRU eviction |
| 21 | server/layout.test.mjs | flips visible page coordinates and joins lines without merging columns |
| 22 | server/pdf-extractor.test.mjs | portable extraction preserves selected pages, display-frame positions and font sizes |
| 23 | server/preferences.test.mjs | partial saves keep every current setting and unknown key |
| 24 | server/production-stage.test.mjs | production bundle serves and extracts PDFs without an external Express installation |
| 25 | server/reader-layout.test.mjs | mixed-size row geometry preserves column widths, gaps and four buffered rows |
| 26 | server/render-resolution.test.mjs | large pages remain bounded by backing store memory and canvas dimensions |
| 27 | server/translation-cache.test.mjs | compatible cache survives restart for custom models and strict mode stays isolated |
| 28 | server/translation-cache.test.mjs | paragraph API reuses legacy translations by default, strict mode invokes current provider |
| 29 | server/translation-provider.test.mjs | configured key routes only to OpenAI and aborted fallback sends no translation |
| 30 | server/translation-provider.test.mjs | backend fallback headers survive cache and failure, with independent launch sessions and provider caches |
