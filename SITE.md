# GitHub Pages showcase

This branch publishes directly from its root through GitHub Pages. The landing
page is maintained as readable static source in `index.html`, `site.css`, and
`site.js`; no build step is required. English is the default at `index.html`.
Localized pages use `index.<locale>.html` for `zh-CN`, `ja`, `ko`, `fr`,
`es`, `hi`, and `bn`. The language selector preserves the current section;
it never automatically redirects based on browser language. Keep page structure,
assets, links, and the two localized body templates synchronized across locales. Keep all asset URLs relative so the site
works under `/PDFMathReader/`.

`media/` contains screenshots from `main:doc/preview*.png` and 256-pixel exports
of `main:electron/app-icons/*.png`. Refresh these from the application when its
appearance changes. Release downloads use GitHub's `releases/latest` URL; update
the version-specific release note link when refreshing the page.

The static demo is maintained in `reader.html`, `reader.css`, and `reader.js`.
It renders `sample.pdf` (copied byte-for-byte from `main:public/sample.pdf`)
with the locally vendored PDF.js runtime in `assets/demo-pdfjs/`.
`demo/sample.json` contains prepared translations and PDF-coordinate text boxes
for the sample. Update both PDF and JSON when the source sample changes.
No application backend, kernel, credential, or translation API is used.
Legacy hashed application assets are retained for existing direct asset URLs.

Preview from this branch with `python3 -m http.server 4173`. Check desktop and
mobile layouts, platform screenshot switching, all nine icon choices, the demo
replay button, the requirements disclosure, and asset requests before pushing.
