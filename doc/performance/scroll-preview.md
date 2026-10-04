# Large-document scrolling preview — 2026-10-04

Previously, scrolling prevented renderPages from drawing and PDF.js onContinue postponed all render work until the 180 ms idle debounce elapsed. Newly visible pages could therefore remain blank throughout sustained scrolling.

Scrolling now paints only visible pages with a preview ratio capped at 1 and a nominal 4 MiB per-frame pixel budget. Pixel rounding can add a small amount above the nominal budget. Existing sharper displayed frames are retained. PDF.js can continue visible-page work while scrolling; offscreen and thumbnail work is cancelled/deferred. Idle restores the normal render ratio, neighboring-page prefetch, and thumbnails. Translation scheduling, document geometry, canvas cache and resident budgets are unchanged.

Build and 129 unit tests passed. The existing 120/1000-page performance smoke passed layout, scrolling, thumbnail, pause/resume, memory-bound and document-close checks. Logs: /tmp/pdf-scroll-build.log, /tmp/pdf-scroll-tests.log and /tmp/pdf-scroll-performance.log.

A synthetic test validates software behavior; real scanned PDFs and physical trackpad responsiveness remain to be evaluated. The modified source has not replaced /Applications/PDFMathReader.app.

The sustained-scroll regression holds scroll events every 40 ms on a previously unrendered page 500 in a 1000-page document. It passed with the preview visible after 100 ms while previewScrolling remained true (DPR 1, 2,733,520 canvas bytes); DPR returned to 2 after the scroll hold was removed (235 ms wait including idle debounce). Center pixels, memory budgets, and document-close release passed. Final smoke log: /tmp/pdf-scroll-performance-final.log. These timings are a single synthetic run, not a real-document latency guarantee.
