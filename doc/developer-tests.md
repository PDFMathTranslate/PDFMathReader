# Developer quick tests

Open the developer console from Settings → Developer mode. The quick-test panel uses the selected reader window's settings at the moment a test starts: kernel, source and target languages, concurrency, advanced options, active translation provider, saved profiles, and securely stored credentials.

- **Test kernel communication** creates a disposable one-page sample PDF. Ultra fast extracts and groups its text; Fast and Precise run their real PDF workers with a local simulated translation response. This checks PDF/kernel communication without sending a request to an external translation provider.
- **Test current provider** sends a small example using the active provider. Fast and Precise native providers are exercised through their real kernel. A test always requests a fresh response rather than accepting a translation cache hit.
- **Batch test providers** tests the configured profiles for the selected kernel sequentially. Incomplete profiles appear as skipped. A failed provider does not stop the remaining providers.

Provider tests make real translation requests and may use the provider's quota. They translate only the generated sample, not the open document. Results include status, elapsed time, errors, and available sample output. Cancel stops the active request and pending batch items; closing the console also cancels the run. Provider selection and saved settings are not changed.

The developer bridge exposes provider labels and readiness, never credentials. Tests are opt-in, require an authorized developer window, and the backend refuses them while developer collection is disabled. Missing kernels are reported rather than automatically installed.

Validation:

```zsh
npm run build
node --test server/developer-test-runner.test.mjs server/developer-tests.test.mjs
node_modules/.bin/electron electron/developer-quick-tests-smoke.mjs
```

The standalone Electron smoke uses isolated settings, a temporary cache, and simulated provider responses; it does not contact a real translation provider.

## Recent debug logs

Advanced settings shows a Recent debug logs section when the selected kernel's Debug option or Developer mode is enabled. It lists the latest 200 redacted events for the selected kernel in gray, selectable text. Log collection for the Debug option works without opening the developer console.

The regex filter accepts a pattern such as `error|timeout` (case insensitive) or an explicit literal such as `/timeout/i`. Invalid or excessively slow expressions display a message and show all recent logs. Matching runs in a worker, which is stopped if it takes more than one second. Polling stops when the section is inactive or the window is hidden.
