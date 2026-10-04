# Core regression tests

The repository retains 29 automated Node tests, reduced from 77 during the October 5, 2026 review. `npm test` runs every remaining `server/*.test.mjs` test; there is no hidden extended suite or skipped-test filter. The unused Electron recents unit suite was also removed.

Selection ranks original PDF and annotation integrity first, credential protection and authenticated document access next, then translation routing, cancellation, cache persistence and document isolation. Extraction, session recovery, settings preservation, production packaging and bounded rendering complete the suite. Existing retained assertions remain intact.

Removed lower-priority checks cover annotation browser filters, topic/keyword emphasis, translation spacing, outline tracking, quick links, pins, navigation helpers and row layout. Helper-level page-edit variants are replaced in the retained coverage by the existing save integration test, which checks disk contents, annotation geometry, rotation and rejection without modifying the PDF. Redundant cache variants were removed; the generic custom-model cache unit case was replaced by the topic-sentence regression below, while kernel upgrade/restart and paragraph API cache coverage remain. These areas have less automatic regression coverage; additions should replace a lower-priority case to keep the suite below 30.

Run `npm run build` before `npm test`: the production-stage check consumes the built frontend. Provider requests use mocks; passing tests do not establish live translation quality or visual rendering correctness. Electron smoke scripts remain available for targeted desktop checks outside this Node suite. Historical performance reports retain their original counts.

The topic-sentence regression checks the reported indented Chinese paragraph, math-kernel source/translation geometry, column isolation, page continuations, small numbered footnotes and unchanged length rules.

| # | Test file | Retained behavior |
|---|---|---|
| 1 | server/annotations.test.mjs | annotation store round-trips metadata, embeds standard annotations, rewrites only managed entries, and preserves external entries |
| 2 | server/annotations.test.mjs | fingerprint-only documents persist sidecar metadata and serialize concurrent saves |
| 3 | server/annotations.test.mjs | native comments and highlights import, migrate, recover from copied PDF, and delete without affecting other entries |
| 4 | server/annotations.test.mjs | opening an unannotated or link-only PDF preserves its exact bytes |
| 5 | server/annotations.test.mjs | prepared PDF removes imported native and managed annotations while preserving unrelated links |
| 6 | server/credentials.test.mjs | credential override, reload, clearing and secure-storage failure |
| 7 | server/credentials.test.mjs | Windows keys use system encryption, survive replacement and reload, and never save plaintext |
| 8 | server/desktop.test.mjs | desktop backend has private origin, authenticates API, and releases its port |
| 9 | server/document-search.test.mjs | PDF search spans text runs, ignores layout whitespace, and keeps matching coordinates |
| 10 | server/document-session.test.mjs | session persists multiple documents and positions; closing all restores only the last closed document |
| 11 | server/documents.test.mjs | OS PDF delivery validates files and exposes bytes without filesystem paths |
| 12 | server/documents.test.mjs | document store rejects capacity without evicting active documents and invalidates deletes |
| 13 | server/documents.test.mjs | authenticated registration supports multiple JSON layouts for one stored document |
| 14 | server/engines.test.mjs | global translation budget holds across simultaneous page workers and releases after failures |
| 15 | server/engines.test.mjs | cancelled queued translations release immediately without running or waiting for a slot |
| 16 | server/engines.test.mjs | Fast and Precise retain compatible pre-update translated PDFs and layouts across app versions |
| 17 | server/layout-extraction.test.mjs | cleanup cancels pending and in-flight waiters and ignores late native results |
| 18 | server/page-edit-save.test.mjs | page edits persist to the original PDF and annotation metadata before resolving |
| 19 | server/pdf-extractor.test.mjs | portable extraction preserves selected pages, display-frame positions and font sizes |
| 20 | server/preferences.test.mjs | partial saves keep every current setting and unknown key |
| 21 | server/production-stage.test.mjs | production bundle serves and extracts PDFs without an external Express installation |
| 22 | server/render-resolution.test.mjs | large pages remain bounded by backing store memory and canvas dimensions |
| 23 | server/topic-sentences.test.mjs | topic sentences start on indented first lines and use original or translated paragraph boundaries |
| 24 | server/translation-cache.test.mjs | paragraph API reuses legacy translations by default, strict mode invokes current provider |
| 25 | server/translation-provider.test.mjs | configured key routes only to OpenAI and aborted fallback sends no translation |
| 26 | server/translation-provider.test.mjs | backend fallback headers survive cache and failure, with independent launch sessions and provider caches |
| 27 | server/translation-text-cache.test.mjs | deduplicates concurrent requests and keeps the shared request alive for a remaining waiter |
| 28 | server/translation-text-cache.test.mjs | does not cache failed or empty OpenAI responses |
| 29 | server/translation-text-cache.test.mjs | document cache invalidation bypasses shared text results without changing another document |
