# Startup, open, and close baseline — 2026-10-07

This report records a clean production-source baseline at `03998b9`. The
baseline was extracted with `git archive` into `/tmp/pdfmathreader-head.huiOpG`;
its `node_modules` directory was a symlink to the existing workspace install,
and `bun run build` was run inside the extracted tree. The generated `dist/`
and Electron main files therefore came from `03998b9`, not from the dirty
working tree.

At the time of the baseline, the working tree already contained parent changes
for startup and window lifecycle work. Those files were not used to build the
baseline. The temporary clean tree received only a copy of the new operation
verifier and a test-only dispatcher branch so that the HEAD production source
could execute it. The workspace dispatcher remains parent-owned.

The machine was macOS Darwin arm64. Runs used the normal visible window. Each
smoke profile created its own temporary Electron `userData` directory through
the existing `--smoke-test` path.

## Commands

The clean source and build setup was:

```zsh
BASELINE_DIR=$(mktemp -d /tmp/pdfmathreader-head.XXXXXX)
git archive 03998b9 | tar -x -C "$BASELINE_DIR"
ln -s /Users/rongxin/Developer/oss/PDFMathReader/node_modules "$BASELINE_DIR/node_modules"
(cd "$BASELINE_DIR" && bun run build)
```

The existing startup smoke was run three times, sequentially:

```zsh
(cd "$BASELINE_DIR" && node_modules/.bin/electron . --smoke-test=startup)
```

The new verifier is exported as:

```js
verifyOperationPerformance(window, windows, createWindow);
```

The parent dispatcher can invoke it with:

```js
await (
  await import('./operation-performance-smoke.mjs')
).verifyOperationPerformance(window, windows, createWindow);
```

The clean HEAD operation run used two cycles, automatic translation disabled,
and an isolated output file:

```zsh
(cd "$BASELINE_DIR" && \
  PDF_OPERATION_PERFORMANCE_OUTPUT=/tmp/pdfmathreader-head-operation-performance-2026-10-07.json \
  node_modules/.bin/electron . --smoke-test=operation-performance)
```

The existing large-document smoke was run once:

```zsh
(cd "$BASELINE_DIR" && node_modules/.bin/electron . --smoke-test=large-open)
```

## Cold startup

`startup-smoke.mjs` reports process uptime and renderer `performance.now()` at
the point where its `previewReady` wait completes. `sampleFirstPageMs` is the
renderer interval from that observation to the first rendered sample page. It
does not expose Chromium paint entries.

| Run    | Process uptime at ready | Renderer ready time | Sample first page |
| ------ | ----------------------: | ------------------: | ----------------: |
| 1      |                  688 ms |              294 ms |            117 ms |
| 2      |                  697 ms |              306 ms |            122 ms |
| 3      |                  961 ms |              342 ms |            114 ms |
| Median |                  697 ms |              306 ms |            117 ms |

The process-uptime sample has a wider spread than the page sample. These are
raw observations, not a regression threshold or a claim about OS launch time.

The user-provided current working-tree smoke was separate from this baseline:

```text
Startup smoke passed {"processReadyMs":1078,"rendererReadyMs":416,"sampleFirstPageMs":181}
```

It was run after a build of the dirty working tree and is retained only as a
current reference. It must not be compared with the HEAD numbers as an
optimized result until the final source and `dist/` are built together.

## Initial paint and ready boundary

The operation verifier captures `performance.getEntriesByType('paint')` before
opening the sample document. It also captures the renderer's current
`performance.now()` and the main process's `process.uptime()` at the same
observed start-page boundary. These timestamps separate browser paint from the
later `previewReady` observation; they are observation points rather than
instrumented event marks.

The clean HEAD operation run reported:

| Measurement                       |                                 Value |
| --------------------------------- | ------------------------------------: |
| Initial window visible            |                                `true` |
| Background render smoke           |                               `false` |
| Chromium `first-paint`            | 212 ms from renderer navigation start |
| Chromium `first-contentful-paint` |               unavailable in this run |
| `previewReady` observed at        | 443 ms from renderer navigation start |
| Main uptime at that observation   |                           1,138.51 ms |

The renderer exposed only `first-paint`; `first-contentful-paint` was `null`.
The paint entry is retained as browser evidence and should not be treated as a
substitute for the reader's first nonblank PDF canvas.

## Two-page open and close loop

The verifier saves the full current preference snapshot with `automatic:false`,
asserts that the saved value is false, and sends that snapshot through the
existing `preferences:changed` channel before clicking the sample button. This
prevents the smoke from starting automatic translation or contacting a live
provider. Open timing is measured with monotonic main-process
`performance.now()` from sample click to the first nonblank page canvas. The
renderer `firstPageMs` and `firstScreenMs` values are recorded independently.

| Cycle | Click to first canvas | Renderer `firstPageMs` | Renderer `firstScreenMs` | Close to empty | Close action to settled |
| ----: | --------------------: | ---------------------: | -----------------------: | -------------: | ----------------------: |
|     1 |             232.27 ms |              170.30 ms |                225.80 ms |       64.84 ms |               385.30 ms |
|     2 |             104.75 ms |               52.40 ms |                 95.00 ms |       55.41 ms |               364.40 ms |

`Close to empty` waits for zero pages, zero mounted pages, and zero mounted
thumbnails. `Close action to settled` includes the close-to-empty interval and
the remaining document transition. The verifier also records the post-empty
probe duration separately (`320.32 ms` and `308.97 ms` in these cycles).

The native blank-window cycle reported:

| Measurement                                   |               Value |
| --------------------------------------------- | ------------------: |
| `createWindow()` returned                     |           335.19 ms |
| Renderer `previewReady` observed after create |           456.87 ms |
| Close request to `hide` event                 | unavailable on HEAD |
| Close request to `closed` / registry removal  |           114.66 ms |

The hidden timing is nullable because the HEAD close path did not emit a hide
event before destruction. The verifier registers both `hide` and `closed`, so
the current lifecycle implementation can report its immediate-hide timing
separately when the parent runs the final smoke.

## Lifecycle transition outlier

An earlier normal-visible three-cycle exploratory run on the same clean HEAD
tree recorded close-to-settled values of `371.63 ms`, `328.55 ms`, and
`17,591.98 ms`; close-to-empty remained `62.57 ms`, `70.96 ms`, and `54.02 ms`.
The invocation did not include `--background` or `--smoke-background-render`,
although that older JSON did not persist the visibility field. The 17.6 second
tail is retained as a raw lifecycle observation, not folded into a percentage
improvement claim. A later paint-enabled three-cycle run reached the same
transition tail and timed out its third open at the 30 second liveness limit.

The verifier therefore defaults to two cycles. Set
`PDF_OPERATION_SMOKE_RUNS=3` for an explicit stress run. Settling is a bounded
observation: when the transition remains active after
`PDF_OPERATION_SETTLED_PROBE_MS` (20 seconds by default), the result records
`closeToSettledMs: null`, the probe duration, and
`closeSettledWithinProbe: false`; the core close-to-empty and main document
state checks still have to complete.

## Large-document baseline

The existing `large-open` smoke generated its own 1,000-page alternating
portrait/landscape fixture with a 16 MiB registered stream. It passed on clean
HEAD with:

```text
fileBytes: 17,216,144
clickToReadyMs: 394 ms
firstScreenMs: 343.60 ms
stages:
  fileRead: 88.70 ms
  upload: 160.30 ms
  pdfReady: 174.60 ms
  pageGeometry: 215.30 ms
  recentHistory: 231.00 ms
  restoreView: 258.40 ms
```

This fixture is more representative of page-count and layout pressure than the
built-in two-page sample. It is still generated content and does not stand in
for a real user PDF with arbitrary fonts, annotations, or embedded resources.

## Limitations and verification state

- No timing threshold is asserted. The smoke asserts readiness and cleanup
  state, records raw values, and uses timeouts only for liveness.
- Renderer paint entries, `previewReady`, `firstPageMs`, `firstScreenMs`, and
  main-process wall times use different clocks and scopes. They must not be
  added together.
- The current working-tree optimized operation and large-open runs were not
  executed here because the parent and Pascal worker still had unbuilt changes.
  Run the same commands after the final coordinated build, preserving the raw
  JSON and visibility/profile flags.
- Hidden-profile attempts were excluded from the baseline: a fully hidden
  `--smoke-background-render` startup produced an exit-time performance-save
  rejection, while `--background` throttled page rendering and timed out. The
  reported startup and operation baselines are normal visible runs.
- The clean baseline used the existing workspace dependency install through a
  symlink. Production source and generated `dist/` were clean HEAD, but the
  dependency directory was not independently reinstalled.

Changed paths owned by this task:

- `tests/desktop/operation-performance-smoke.mjs`
- `doc/performance/startup-open-close-2026-10-07.md`

No parent lifecycle or document-import implementation file was edited here,
and no commit, version, or push was created.

## Final optimized verification and local installation

Final production source is `03998b9` plus this uncommitted performance patch;
the application version remains `0.1.1`. After packaging finished, three
sequential visible startup runs with isolated profiles reported:

| Metric                                     | Clean HEAD baseline median | Final quiet-run median |
| ------------------------------------------ | -------------------------: | ---------------------: |
| Process ready                              |                     697 ms |                 732 ms |
| Renderer ready                             |                     306 ms |                 323 ms |
| Sample click to first page (startup smoke) |                     117 ms |                 178 ms |

Final raw startup tuples (process ready, renderer ready, sample first page):
`778/333/174`, `726/305/189`, `732/323/178` milliseconds. These observations
**do not establish a cold-start speedup**. The bounded paint opportunity before
PDF import intentionally makes the loading state visible first; it may cost a
frame. Startup stores and IPC reads now overlap, but that structural change is
not a substitute for a measured improvement. Earlier runs concurrent with
packaging are excluded from this comparison.

The final three-cycle operation smoke completed without the transition tail:

- Click to first canvas: `174.62`, `104.31`, `51.34` ms (rounded console output:
  `175`, `104`, `51` ms).
- Close to empty: approximately `58`, `69`, `56` ms.
- Close to logical readiness: approximately `58`, `69`, `57` ms, compared with
  the clean baseline's approximately `385` and `364` ms. Decorative snapshots
  may still animate after logical readiness; these values measure availability
  for the next document, not the completion of every visual animation.
- New-window destruction: `18.75` ms after close request, versus `114.66` ms
  in the clean two-cycle baseline. Hide-event timing was unavailable in both
  runs, so this report makes no numeric claim about that event.
- Initial renderer first paint: `164` ms versus `212` ms in the single clean
  operation run. This is a single observation, not a stable cold-start median.

The final thousand-page smoke waited for the asynchronous first-screen metric
before taking its report. It recorded `338.50` ms first screen and `396` ms
click to ready, versus baseline `343.60` ms and `394` ms. This difference is
small and does not establish a stable large-document throughput improvement.
Page dimensions and restored reading positions remain exact; first paint was
not accelerated by using approximate page geometry.

Verification passed: 44 unit tests including deferred-frame and recorder race
coverage, full ESLint, changed-file Prettier, build, startup smoke, operation
smoke (three cycles), thousand-page smoke, session restoration/focus smoke,
multi-window smoke, motion-memory smoke, and packaged CI visible/ready launch.
Session smoke reported a missing preview fixture after its assertions passed
because the temporary PDF was removed while an optional recent preview was
still scheduled; it is retained as teardown noise rather than a clean-log claim.

The macOS arm64 production bundle was signed with the existing pinned identity,
installed to `/Applications/PDFMathReader.app`, and verified with
`codesign --verify --deep --strict`. Its `app.asar` SHA-256 is
`f236d7652512cea56468c1136204682fd807b44813e1c231e207b3407e225988`.
The previous bundle is backed up under
`/Users/rongxin/Library/Application Support/PDFMathReader/backups/20261007-175731-before-perf/PDFMathReader.app`.
The installed app was not opened with the normal personal profile; packaged
launch verification used an isolated CI profile. No commit or push was made.

## Follow-up: Start Page startup cache gate

The real user cache was approximately 1.2 GB. Startup previously awaited
`cacheManager.start()`, including an initial sweep and cache statistics disk
traversals before the HTTP listener was available. The listener now starts after
cache directory setup, with maintenance running in the background. `ready`
exposes maintenance completion and close awaits it, preserving maintenance errors.
Default standalone cache-manager `start()` behavior remains unchanged.

A read-only run against the existing cache (`cacheLimitMB: null`) measured HTTP
readiness at 21 ms and cache scan completion at 827 ms, measured from `startServer`
invocation after module import. This demonstrates removal of the cache scan gate;
it is not a whole-application launch timing or a before/after cold-start benchmark.
The worker additionally checked 12,000 cache files: listener 22 ms, config response
29 ms, maintenance completion 229 ms.

PDF editing imports are deferred in main annotations, developer test generation,
and kernel translation output handling. Production packaging externalizes and
copies pdf-lib so it is not parsed as part of the main/server bundles. Native
window construction overlaps backend process startup. Startup import checks no
longer load PDF editing, PDF.js or the native inspector before use.

Validation: 44 unit/integration tests, cache/integration/production-stage checks,
ESLint, changed-file Prettier, session restore/focus smoke and signed packaged
isolated launch passed. Session teardown logged a missing temporary recent-preview
fixture; packaged launch logged a helper sandbox-extension warning. Both checks
reported their success markers. Version remains 0.1.1. The signed release is
reinstalled into /Applications with a backup of the previous bundle.
