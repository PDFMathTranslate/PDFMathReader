# Memory audit — 2026-10-04

Live sampling of the existing /Applications installation (not the modified build):

| Process         | PID   | Physical footprint |
| --------------- | ----- | ------------------ |
| GPU Helper      | 61340 | 850.0 MiB          |
| Reader Renderer | 61344 | 766.7 MiB          |
| Node utility    | 61343 | 69.3 MiB           |

GPU IOSurface allocations accounted for 748.7 MiB. vmmap could not inspect Electron's PartitionAlloc malloc zone; this establishes the graphics-heavy footprint, not complete object-level attribution. RSS from ps is not comparable to Activity Monitor physical footprint. Do not add these numbers as a deduplicated whole-system memory total.

Changes:

- MathRegion releases the completed render task and zeroes its temporary canvas in finally, including cancellation and stale-generation paths.
- History thumbnail rendering zeroes the scratch canvas in finally.
- Reading mode skips unused outgoing full-page snapshots.
- Comparison animation consumes the existing snapshot instead of allocating another copy. Callers release snapshots after completion, cancellation, and skipped animations.
- A render that completes after foreground deactivation cannot present/cache its frame.

Resolution, 64 MiB bitmap cache, 128 MiB resident page budget, prefetch window, translation concurrency and document isolation are unchanged.

Verification:

- npm run build passed.
- npm test passed 124 tests at the time of the audit.
- Electron performance smoke passed 120-page and 1000-page scenarios, layouts, scrolling, thumbnails, foreground/background transitions and document close. Close leaves cache bytes and registered PDF bytes at zero. The minimize assertion now captures its baseline after foreground=false is acknowledged: macOS can continue normal rendering during its minimize animation.
- An isolated Electron renderer mounted twenty actual MathRegion Vue components with identical deterministic render input before and after the change. Retained scratch canvas backing dimensions dropped from 12,800,000 bytes to zero, while displayed canvas dimensions remained 12,800,000 bytes and sampled RGBA stayed [18,52,86,255]. See memory-region-result.json. This is canvas backing storage accounting, not measured GPU physical-footprint savings. The harness and bundles are in .cache/memory-audit/.

Logs: /tmp/pdf-memory-before.log, /tmp/pdf-memory-after.log, /tmp/pdf-memory-tests.log, /tmp/pdf-memory-component.log. vmmap summaries: /tmp/pdf-memory-{gpu,renderer,backend}-vmmap.txt.

Limits: no before/after whole-app measurement on the user's actual PDF and no installed-app replacement. The large live GPU/renderer numbers are from the existing installation. Native extraction bursts can raise backend peak memory; limiting them could affect throughput, so concurrency was preserved. Whole-app savings and latency equivalence on real image-heavy/translated PDFs remain unquantified. Concurrent annotation-related working-tree edits were preserved and are outside this audit's scope.
