# Fast translation performance — 2026-10-03

Measured the installed real Fast kernel (pdf2zh 1.9.12) through the reader's HTTP API on macOS arm64. The fixture has 30 pages, six text paragraphs per page and a cropped first page. Pages 1, 15 and 30 run sequentially without translation-cache hits, followed by a cache-hit request for page 1. The local simulated provider waits 200 ms per paragraph and returns deterministic French text; no external or paid requests are made. Wall time includes the translated single-page response and paragraph-layout fetch, but excludes rendering the result in the reader. These are local fixture measurements, not estimates of real-provider latency.

The original major costs were whole-document font-resource insertion and two font subsets, even though the reader consumes one translated page. The adapter now extracts the selected page with PyMuPDF before invoking the same Fast kernel, preserving MediaBox, CropBox and rotation. It retains the original page number in paragraph metadata. The unused bilingual copy skips assembly, its second font subset and serialization; the displayed translated PDF still embeds and subsets its fonts. The constructor hook targets the source-document assignment, rather than assuming document construction order.

Paragraph capture now injects one callback before the upstream paragraph output loop, replacing Python's line tracing. It checks the expected AST shape and keeps installed upstream sources unmodified. Healthy environment checks are reused for 30 seconds during translation and invalidated on installation; explicit availability checks still query the environment. Fast's page-cache schema was incremented for the adapter change.

## Measurements

| Metric (median of three uncached requests) | Baseline | Optimized |
| --- | ---: | ---: |
| Uncached page response + layout | 6205.7 ms | 3369.0 ms |
| Font resource insertion | 1341.6 ms | 49.1 ms |
| Font subset (mono + unused dual → mono only) | 2264.0 ms | 895.7 ms |
| Paragraph parse | 14.7 ms | 3.9 ms |
| Typesetting | 6.0 ms | 1.9 ms |
| Cache-hit response + layout (one request) | 70.2 ms | 4.8 ms |

Page-response latency fell 45.7% in this fixture.

Final numbers and raw samples are in [baseline](fast-performance-baseline.json) and [optimized](fast-performance-optimized.json). Stage timers inside page processing overlap with its total; they must not be added to that total. Provider aggregate duration sums parallel requests and is not wall time.

## Reproduction and ongoing diagnostics

```zsh
FAST_BENCHMARK_OUTPUT=/tmp/fast-optimized.json node server/fast-benchmark.mjs
FAST_BENCHMARK_ROTATE=1 FAST_BENCHMARK_PAGES=4 node server/fast-benchmark.mjs
node server/kernel-smoke.mjs
npm test
npm run build
```

The authenticated local `/api/kernel-performance` endpoint retains the latest 20 successful page reports in memory. Reports record page queue time, environment/options, cache lookup, input preparation, Python process duration, output/cache handling, worker stage durations, provider request counts, queue duration, aggregate duration and maximum duration. They contain no document content, file paths or credentials. Reports reset when the backend restarts. Precise has process-level and provider measurements but no Fast worker-stage fields.

Validation covers readable translated output, matching original paragraph page numbers, preserved CropBox/rotation at 0/90/180/270 degrees, two concurrent real Fast/Precise page workers with a shared provider budget, cached requests without provider calls, visible provider failures and cancellation. Remaining prominent local costs are Python imports/model setup, layout inference and the required translated-font subset. Real network/service delay can be larger than these local costs.
