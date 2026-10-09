import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
let runtime;
export function loadPDFRuntime() {
  return (runtime ??= import('pdfjs-dist')
    .then((pdf) => {
      pdf.GlobalWorkerOptions.workerSrc = workerUrl;
      // CID fonts without ToUnicode need Adobe CMaps, even with embedded
      // glyphs and Identity-H encoding. Scans also need external decoders.
      const assetUrl = (kind) =>
        new URL(`${import.meta.env.BASE_URL}assets/pdfjs/${kind}/`, window.location.href).href;
      const options = {
        wasmUrl: assetUrl('wasm'),
        cMapUrl: assetUrl('cmaps'),
        cMapPacked: true,
        standardFontDataUrl: assetUrl('standard_fonts'),
      };
      return { ...pdf, getDocument: (source) => pdf.getDocument({ ...options, ...source }) };
    })
    .catch((error) => {
      runtime = undefined;
      throw error;
    }));
}
