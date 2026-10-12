import { watch } from 'vue';
import { buildModel, scanOperatorList, watermarkOperations } from './watermark-analysis.mjs';

// Pages read to learn what repeats across the document.
const SAMPLE_PAGES = 10;
// Layers whose names say what they hold.
const WATERMARK_LAYER = /water\s*mark|水印|浮水印/i;

function samplePages(count) {
  if (count <= SAMPLE_PAGES) return Array.from({ length: count }, (_, i) => i + 1);
  return [
    ...new Set(
      Array.from({ length: SAMPLE_PAGES }, (_, i) =>
        Math.round(1 + (i * (count - 1)) / (SAMPLE_PAGES - 1)),
      ),
    ),
  ];
}

// Removes watermarks while a page is drawn: the page's operators are left as they are and
// the ones that paint a watermark are skipped by pdf.js. The file is never changed.
export function createWatermarkRemoval({ session, preferences, loadRuntime, onToggle }) {
  const scans = new WeakMap();
  const models = new WeakMap();
  const options = new WeakMap();
  const enabled = () => !!preferences.watermarkRemovalEnabled?.value;

  function scan(page, OPS) {
    if (!scans.has(page))
      scans.set(
        page,
        page.getOperatorList().then((list) => scanOperatorList(list, OPS, page.view)),
      );
    return scans.get(page);
  }

  // The document's own pages teach what recurs; a page of any other document (a
  // translated copy) is judged on its own.
  async function modelFor(page, own, OPS) {
    if (!own) return buildModel([await scan(page, OPS)]);
    if (!models.has(own))
      models.set(
        own,
        Promise.all(
          samplePages(own.numPages).map(async (n) => scan(await own.getPage(n), OPS)),
        ).then(buildModel),
      );
    return models.get(own);
  }

  async function hiddenLayers(own) {
    if (!own) return null;
    const config = await own.getOptionalContentConfig({ intent: 'display' });
    let hidden = 0;
    for (const [id, group] of config)
      if (WATERMARK_LAYER.test(group.name || '')) {
        config.setVisibility(id, false);
        hidden++;
      }
    return hidden ? config : null;
  }

  async function compute(page) {
    const { OPS } = await loadRuntime();
    const document = session.pdf,
      own = document && (await document.getPage(page.pageNumber)) === page ? document : null;
    const [model, current, layers] = await Promise.all([
      modelFor(page, own, OPS),
      scan(page, OPS),
      hiddenLayers(own),
    ]);
    const skip = watermarkOperations(current, model);
    if (!skip.size && !layers) return null;
    return {
      key: `wm${skip.size}${layers ? 'L' : ''}`,
      render: {
        ...(skip.size ? { operationsFilter: (index) => !skip.has(index) } : {}),
        ...(layers ? { optionalContentConfigPromise: Promise.resolve(layers) } : {}),
      },
    };
  }

  // Render options for a page, or null when it has nothing to remove or cannot be read.
  function renderOptions(page) {
    if (!enabled()) return Promise.resolve(null);
    if (!options.has(page))
      options.set(
        page,
        compute(page).catch(() => null),
      );
    return options.get(page);
  }

  if (onToggle) watch(enabled, () => onToggle());
  return { enabled, renderOptions };
}
