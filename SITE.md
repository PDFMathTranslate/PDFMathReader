# GitHub Pages showcase

This branch publishes directly from its root through GitHub Pages. The landing
page is maintained as readable static source in `index.html`, `site.css`, and
`site.js`; no build step is required. Keep all asset URLs relative so the site
works under `/PDFMathReader/`.

`media/` contains screenshots from `main:doc/preview*.png` and 256-pixel exports
of `main:electron/app-icons/*.png`. Refresh these from the application when its
appearance changes. Release downloads use GitHub's `releases/latest` URL; update
the version-specific release note link when refreshing the page.

The bundled `reader.html` and hashed assets retain the earlier standalone Vue
reader demonstration with prepared translations. They do not provide live
translation or represent the latest app UI. This is stated beside the demo.
`assets/symbols/` supplies the relative icon paths expected by that bundle.
Do not remove shared hashed assets without rebuilding the demonstration.

Preview from this branch with `python3 -m http.server 4173`. Check desktop and
mobile layouts, platform screenshot switching, all nine icon choices, the demo
replay button, the requirements disclosure, and asset requests before pushing.
