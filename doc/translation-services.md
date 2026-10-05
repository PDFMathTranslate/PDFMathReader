# Custom translation services

The Translation section selects a service independently for Inspector, Legacy and Next. The fields come from each installed Python kernel's translator definitions and CLI parser; updating or reinstalling that kernel invalidates its cached schema. Schema discovery is lazy and shared between concurrent requests, with an on-disk cache keyed by app and kernel version. The settings panel also caches loaded schemas.

Automatic retains the existing OpenAI key / SiliconFlow free fallback. Explicit Python services run using their own upstream service selector and environment parameters. Inspector offers an OpenAI compatible endpoint with API key, base URL and model. Each service remembers its own inputs. Desktop secret fields are encrypted with Electron safeStorage and stored separately from ordinary reader preferences.

On macOS 26 and later, Apple Translation is available without an API key or base URL. It translates on device using Apple's Translation framework. Both language models must already be installed. Missing models produce an actionable error and do not fall back to a cloud provider. Legacy and Next send raw text through an app-owned adapter; Next uses its text translation path and disables automatic LLM glossary extraction for this service. LLM prompts do not apply to Apple Translation.

Validation:

```sh
npm test
npm run build
node_modules/.bin/electron electron/service-credentials-smoke.mjs
node server/translation-services-smoke.mjs
APPLE_NATIVE_SMOKE=1 node server/translation-services-smoke.mjs
```

The integration smoke requires the installed Legacy and Next environments under the usual macOS application-support directory. It uses a loopback provider, synthetic credentials and a generated PDF, then verifies the key, base URL and model received from each real kernel and the translated paragraph layout. The default run verifies the native adapter with a deterministic local implementation; `APPLE_NATIVE_SMOKE=1` also calls the real Apple API and requires the English and French models. Neither run makes paid provider requests.
