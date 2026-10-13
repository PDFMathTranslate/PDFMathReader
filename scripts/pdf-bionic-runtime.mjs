// The upstream public API has no per-glyph paint hook. Extend this exact runtime
// at bundle time, and fail the build if its implementation changes.
export function extendPDFRuntime(source) {
  if (!source.includes('const version = "6.3.289";'))
    throw new Error('Unsupported pdf.js version: bionic glyph hook needs review');
  function replace(before, after) {
    if (source.split(before).length !== 2)
      throw new Error('Unsupported pdf.js runtime: bionic glyph hook needs review');
    source = source.replace(before, after);
  }
  replace(
    '    recordOperations = false,\n    operationsFilter = null',
    '    recordOperations = false,\n    bionicGlyphs = null,\n    operationsFilter = null',
  );
  replace(
    '        transform,\n        background\n      },\n      objs: this.objs,',
    '        transform,\n        background,\n        bionicGlyphs\n      },\n      objs: this.objs,',
  );
  replace(
    '    this.gfx.beginDrawing({',
    '    this.gfx.bionicGlyphs = this.params.bionicGlyphs;\n    this.gfx.beginDrawing({',
  );
  replace(
    '    const simpleFillText = current.textRenderingMode === TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;',
    '    const bionic = this.bionicGlyphs?.get(opIdx);\n    const simpleFillText = !bionic && current.textRenderingMode === TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;',
  );
  replace(
    '      if (this.contentVisible && (glyph.isInFont || font.missingFile)) {',
    `      const bionicPaint = bionic?.has(i) &&
        (current.textRenderingMode & TextRenderingMode.FILL_STROKE_MASK) === TextRenderingMode.FILL &&
        !current.patternFill;
      const originalTextMode = current.textRenderingMode;
      if (bionicPaint) {
        ctx.save();
        current.textRenderingMode |= TextRenderingMode.FILL_STROKE;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = fontSize / fontSizeScale * 0.035;
        ctx.lineJoin = "round";
        ctx.setLineDash([]);
      }
      if (this.contentVisible && (glyph.isInFont || font.missingFile)) {`,
  );
  replace(
    '      const charWidth = vertical ? width * widthAdvanceScale - spacing * fontDirection : width * widthAdvanceScale + spacing * fontDirection;',
    `      if (bionicPaint) {
        current.textRenderingMode = originalTextMode;
        ctx.restore();
      }
      const charWidth = vertical ? width * widthAdvanceScale - spacing * fontDirection : width * widthAdvanceScale + spacing * fontDirection;`,
  );
  return source;
}

export function pdfBionicRuntimePlugin() {
  return {
    name: 'pdf-bionic-glyphs',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/pdfjs-dist/build/pdf.mjs')) return null;
      return { code: extendPDFRuntime(source), map: null };
    },
  };
}
