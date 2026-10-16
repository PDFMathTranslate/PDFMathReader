// The upstream public API has no per-glyph paint hook. Extend this exact runtime
// at bundle time, and fail the build if its implementation changes. Two hooks
// share it: bionic glyph strokes and local font substitution.
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
    '    recordOperations = false,\n    bionicGlyphs = null,\n    fontSubstitution = null,\n    operationsFilter = null',
  );
  replace(
    '        transform,\n        background\n      },\n      objs: this.objs,',
    '        transform,\n        background,\n        bionicGlyphs,\n        fontSubstitution\n      },\n      objs: this.objs,',
  );
  replace(
    '    this.gfx.beginDrawing({',
    '    this.gfx.bionicGlyphs = this.params.bionicGlyphs;\n    this.gfx.fontSubstitution = this.params.fontSubstitution;\n    this.gfx.beginDrawing({',
  );
  replace(
    '    const simpleFillText = current.textRenderingMode === TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;',
    '    const bionic = this.bionicGlyphs?.get(opIdx);\n    const simpleFillText = !bionic && current.textRenderingMode === TextRenderingMode.FILL && !font.disableFontFace && !current.patternFill;',
  );
  replace(
    '      if (this.contentVisible && (glyph.isInFont || font.missingFile)) {',
    `      const bionicStrength = bionic?.get(i) || 0;
      const bionicPaint = bionicStrength > 0 &&
        (current.textRenderingMode & TextRenderingMode.FILL_STROKE_MASK) === TextRenderingMode.FILL &&
        !current.patternFill;
      const originalTextMode = current.textRenderingMode;
      if (bionicPaint) {
        ctx.save();
        current.textRenderingMode |= TextRenderingMode.FILL_STROKE;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = fontSize / fontSizeScale * 0.035 * bionicStrength;
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
  // Font substitution: setFont records the local face a PDF font maps to, and
  // showText draws that face's glyph for the text's Unicode at the original
  // glyph's position, fitted to its width the way pdf.js fits missing fonts.
  replace(
    '    this.current.font = fontObj;\n    this.current.fontSize = size;',
    '    this.current.font = fontObj;\n    this.current.fontSize = size;\n    this.current.substituteFonts = null;',
  );
  replace(
    '    this.ctx.font = `${italic} ${bold} ${browserFontSize}px ${typeface}`;\n  }',
    `    this.ctx.font = \`\${italic} \${bold} \${browserFontSize}px \${typeface}\`;
    const substitute = this.fontSubstitution?.face(fontObj);
    if (substitute) {
      const css = (family) => family ? \`\${substitute.style} \${substitute.weight} \${browserFontSize}px \${family}\` : null;
      this.current.substituteFonts = { text: css(substitute.text), cjk: css(substitute.cjk) };
    }
  }`,
  );
  replace(
    '    let x = 0,\n      i;\n    for (i = 0; i < glyphsLength; ++i) {',
    `    const substituteFonts = !vertical && !font.disableFontFace && !current.patternFill && !current.patternStroke &&
      !(current.textRenderingMode & TextRenderingMode.ADD_TO_PATH_FLAG) &&
      fillStrokeMode !== TextRenderingMode.INVISIBLE ? current.substituteFonts : null;
    const originalFont = ctx.font;
    let activeFont = originalFont;
    let x = 0,
      i;
    for (i = 0; i < glyphsLength; ++i) {`,
  );
  replace(
    '      const character = glyph.fontChar;\n      const accent = glyph.accent;',
    `      const accent = glyph.accent;
      const substituteFont = substituteFonts && !accent && glyph.unicode ? substituteFonts[this.fontSubstitution.kind(glyph.unicode)] : null;
      const substituted = !!substituteFont;
      const character = substituted ? glyph.unicode : glyph.fontChar;
      const glyphFont = substituted ? substituteFont : originalFont;
      if (glyphFont !== activeFont) {
        ctx.font = activeFont = glyphFont;
      }`,
  );
  replace(
    '      if (font.remeasure && width > 0) {',
    '      if ((font.remeasure || substituted) && width > 0) {',
  );
  replace(
    '        if (width < measuredWidth && this.isFontSubpixelAAEnabled) {',
    '        if (width < measuredWidth && (this.isFontSubpixelAAEnabled || substituted)) {',
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
