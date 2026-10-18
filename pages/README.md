# GitHub Pages reader demo

Build the current application renderer with `bunx vite build --config pages/vite.config.mjs`.
The output is in `dist-pages/`; deploy `pages/reader.html` as `reader.html`, changing
its `../assets/` references to `./assets/`. Copy the output assets and public
resources alongside the existing landing pages on `gh-pages`.

`reader-main.js` installs a prepared-data transport before importing the real
`src/main.js`. It uses the same Vue components, platform controls, settings,
PDF.js renderer, and styles as the application. The website build hides kernel
switching in the toolbar, General settings, legacy settings, and Appearance.
The desktop build is unaffected. Build-time marker assertions catch source drift.

`data/sample.json` stores paragraph geometry and prepared translations for
`public/sample.pdf`. Update both when the source PDF changes. Translation and
layout requests resolve in the browser from this data; there is no live kernel,
translation provider, API credential, or backend. Unsupported document operations
remain desktop-only. The app UI defaults to English; a locale query chooses the
site language. The English demo initially shows a Chinese translation so the
paragraph toggle demonstrates the difference from the English original.
