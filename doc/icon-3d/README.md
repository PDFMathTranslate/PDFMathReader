# Blender icon source

This directory is the canonical workspace for all future icon changes. Edit `PDFMathReader-icon.blend` here, keep `render.py` consistent with scene changes, and export the updated render to the application icon resources. Continue with this existing project rather than creating a separate icon project elsewhere.

`PDFMathReader-icon.blend` contains the editable icon scene. `render.py` reconstructs it in Blender 5.2.1, using a separate scene without deleting existing work. All geometry is modeled locally; no external model assets are used.

The icon retains A, two text lines, and 文 from the original. A closed biconvex lens uses transmission 1, IOR 1.52, and roughness 0.012. Smooth ink clouds fill the colored document. Cycles renders 1024 × 1024 RGBA at 160 samples with denoising.

Render the saved scene:

```zsh
/Applications/Blender.app/Contents/MacOS/Blender -b doc/icon-3d/PDFMathReader-icon.blend -f 1
cp doc/icon-3d/equal-margins-icon0001.png doc/icon.png
node electron/generate-icon.mjs
sips -z 128 128 doc/icon.png --out doc/icon-small.png
```

The current appearance follows the supplied Preview icon reference: luminous cyan/blue, pink/lilac, and warm yellow ink clouds with smooth irregular color transitions. This is a visual interpretation, not a claim about Apple's production technique. `ink-cloud.py` applies this final color treatment; `watercolor.py` retains the typography layout. `magnifying-glass.py` models a closed biconvex optical lens with IOR 1.52; 文 sits on the document beneath it, so Cycles computes its magnified optical image. The final render uses 160 samples and is `equal-margins-icon0001.png`. `render.py` calls the treatment scripts in order to reproduce the current scene. Earlier `.blend` backups preserve the intermediate designs.

`previous-icon.png` preserves the original source. Font sources are macOS Arial Bold and Arial Unicode. Updating these repository assets does not update the installed application bundle.

`equal-margins.py` centers the 5.4-unit document within the 7.8-unit base, with identical 1.2-unit insets (133.565 px at 1024). It moves the document glyphs and lens by the same offset. `layout-metrics.json` records the verified four-side geometry measurements.
