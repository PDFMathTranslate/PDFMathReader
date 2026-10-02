# Performance verification — 2026-10-02

The final macOS arm64 application was measured with a deterministic 1,000-page, 3,100,238-byte PDF containing dense text and alternating portrait/landscape sizes. Three opens ran in one isolated app session: one cold open followed by two opens reusing its PDF worker. Each run included 120 scrolling frames, two sidebar toggles, and a 20-step window resize burst. These are local automated measurements, not a promise for every PDF.

| Metric | Baseline | Optimized |
| --- | ---: | ---: |
| First visible screen, median | 190.8 ms | 143.4 ms |
| Native layout extraction time per run, median | 2284.4 ms | 623.9 ms |
| Scroll long tasks over 50 ms | 0 | 0 |
| Scroll frame interval, p95 | 9.3 ms | 9.3 ms |
| Real layout commits during a 20-step resize | Not instrumented | 1 |

First-screen latency fell by 24.8%. The measured bottlenecks led to bounded parallel page-size reads, one reusable PDF.js worker per window, PDF runtime loading overlapped with file upload, coalesced native extraction, and a bounded extraction cache. Reflow during window resizing is replaced with a decoded screenshot texture; real page fitting happens once when resizing settles. Sidebar movement animates its screenshot before committing the final page fit. Reduced motion skips the animation.

The optimized renderer/backend sampled RSS peaks were 512.8, 600.1, 637.6 MiB (median 600.1 MiB). These estimates can count shared resident pages twice. The shared main/GPU processes are reported separately; generating the large fixture in the test main process increases its memory, so it is not included in these scoped totals. Peaks are sampled, not exact instantaneous maxima.

HTTP request/response body traffic was 4.67, 3.02, 3.04 MiB per run. Every run uploaded the PDF exactly once (3,100,238 bytes). The cold run also loaded the PDF runtime and worker. Counts include measurement requests, but exclude headers, Electron IPC, and external kernel/provider traffic. Native extraction timing is cumulative in the API and was differenced between opens for this table.

The desktop app saves the latest 20 content-free reports in `~/Library/Application Support/PDFMathReader/performance.json`. Reports contain file size, page count, stage timings, scroll tasks, scoped/shared process memory and local HTTP bytes. They contain no PDF text, paths or API keys. Snapshot textures are limited to approximately 16 MiB of decoded pixels and 10 MiB of encoded data; page/thumbnail caches retain their existing limits.

[Baseline data](performance-baseline.json) · [Optimized data](performance-optimized.json)

Reproduce after building:

```zsh
npm test
npm run build
PDF_READER_BENCHMARK_LABEL=optimized node_modules/.bin/electron . --smoke-test=benchmark
```

The benchmark uses generated test content and isolated app data. Native checks also cover 1,000-page virtualization/cache limits, background pause, restored reading positions, symmetric margins, manual zoom, fullscreen and both math kernels. OpenAI responses in kernel checks are mocked.
