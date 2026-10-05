# PDFMathReader website

The website is a Vite multi-page build. `pages/index.html` is the website entry
and `pages/reader.html` mounts the real Vue reader application from `src/`.
The reader uses prepared local demonstration data, so the Pages site does not
require an API key or a running backend.

## Local preview

Install the repository dependencies once, then start the Pages development
server from the repository root:

```sh
bun install --frozen-lockfile
node node_modules/vite/bin/vite.js --config pages/vite.config.mjs --host 127.0.0.1 --port 4173
```

Open <http://127.0.0.1:4173/> for the website or
<http://127.0.0.1:4173/reader.html> for the reader. The settings-window view
uses the same reader entry with `?settingsWindow=1`.

## Production build

From the repository root:

```sh
bun run vite build --config pages/vite.config.mjs
```

The build writes `dist-pages/`. The Vite config uses relative asset paths and
copies `public/`, including the reader's sample PDF and symbol assets, into the
same output so project-site URLs work without a custom domain.

## Playground

The sample document and Chinese/Japanese translations are authored demonstration
content, not live machine translation. During the Vite build, layout paragraphs
and `data/translations.json` are validated and compiled into a bundled translation
cache (including English originals). Missing translations fail the build.

The real reader consumes these entries as cache hits, without translation latency
or network requests to a translation backend. Unsupported languages and paragraphs
never fall back to a live provider. Clearing the demonstration cache keeps the
bundled entries available. Settings synchronize preferences across both frames.
Download buttons lead to the latest published GitHub release.

## Deployment

`.github/workflows/pages.yml` installs the root Bun lockfile, builds with the
Pages Vite config, uploads `dist-pages/` as a GitHub Pages artifact, and deploys
changes to `pages/**` after they reach `main`. In the repository's
**Settings → Pages**, select **GitHub Actions** as the publishing source.
