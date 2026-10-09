# Custom translation services

The Translation Services page selects a service independently for Inspector, Legacy and Next. The fields come from each installed Python kernel's translator definitions and CLI parser; updating or reinstalling that kernel invalidates its cached schema. Schema discovery is lazy and shared between concurrent requests, with an on-disk cache keyed by app and kernel version. The settings panel also caches loaded schemas.

Automatic retains the existing OpenAI key / SiliconFlow free fallback. Explicit Python services run using their own upstream service selector and environment parameters. Inspector offers an OpenAI compatible endpoint with API key, base URL and model. Each service remembers its own inputs. Desktop secret fields are encrypted with Electron safeStorage and stored separately from ordinary reader preferences.

The provider list is divided into Configured, Not configured and Errors. Configuration checks use the kernel's required fields, saved non-secret values and separately encrypted credentials. Only recorded service failures appear under Errors; request validation, PDF processing, cancellation and cache reads do not mark a service as failed. A later real successful call clears the error status. History stores only the last outcome and timestamp per kernel and service, without error messages or credentials.

On macOS 26 and later, Apple Translation is available without an API key or base URL. It translates on device using Apple's Translation framework. Both language models must already be installed. Missing models produce an actionable error and do not fall back to a cloud provider. Legacy and Next send raw text through an app-owned adapter; Next uses its text translation path and disables automatic LLM glossary extraction for this service. LLM prompts do not apply to Apple Translation.

Validation:

```sh
bun run test
bun run build
node_modules/.bin/electron tests/desktop/service-credentials-smoke.mjs
node server/translation-services-smoke.mjs
APPLE_NATIVE_SMOKE=1 node server/translation-services-smoke.mjs
```

The integration smoke requires the installed Legacy and Next environments under the usual macOS application-support directory. It uses a loopback provider, synthetic credentials and a generated PDF, then verifies the key, base URL and model received from each real kernel and the translated paragraph layout. The default run verifies the native adapter with a deterministic local implementation; `APPLE_NATIVE_SMOKE=1` also calls the real Apple API and requires the English and French models. Neither run makes paid provider requests.

## Experimental document language check

Enable **Document language check** in Settings → Experimental to ask Jev whether
an opened PDF matches the configured **source language**. A confident match skips
automatic translation; manual page translation and force retranslation remain
available. The feature is off by default.

The check sends only the first 100 Unicode characters of extracted text from each
of the first three pages to TypeSafe. Image-only PDFs without extractable text do
not trigger OCR for this check. Missing credentials, uncertain answers, network
errors, and timeouts preserve the usual automatic translation behavior.

A custom **Jev API Token** in these settings takes priority over the backend
process's `TYPESAFE_API_KEY` environment variable. Leave the custom field empty to
use the environment variable. The application must inherit that variable when it
starts; setting it in a terminal does not update an already running app.

The integration uses the [TypeSafe System One API](https://docs.typesafe.ai/introduction/quickstart)
with `jev-latest` and a Choice judgment. The experimental skip threshold is 0.9;
it is a conservative application policy, not a guarantee of language detection
accuracy.
