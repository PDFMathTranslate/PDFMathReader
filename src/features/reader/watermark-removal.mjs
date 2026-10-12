import { ref, watch } from 'vue';
import {
  buildModel,
  hiddenTextMatcher,
  scanOperatorList,
  watermarkItems,
} from './watermark-analysis.mjs';

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
  const analyses = new WeakMap();
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
  // translated copy) is judged on its own. A sampled page is read only for its operators;
  // pdf.js keeps its decoded images (a page-sized watermark is tens of megabytes) until the
  // page is cleaned up, so they are released unless that page is the one about to be drawn.
  async function modelFor(page, own, OPS) {
    if (!own) return buildModel([await scan(page, OPS)]);
    if (!models.has(own))
      models.set(
        own,
        Promise.all(
          samplePages(own.numPages).map(async (n) => {
            const sample = await own.getPage(n),
              found = await scan(sample, OPS);
            if (sample !== page) sample.cleanup?.();
            return found;
          }),
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

  // What this page holds that reads as a watermark: the operators to skip, the layers to
  // hide and a matcher for the text of the removed runs.
  async function analyze(page) {
    const { OPS } = await loadRuntime();
    const document = session.pdf,
      own = document && (await document.getPage(page.pageNumber)) === page ? document : null;
    const [model, current, layers] = await Promise.all([
      modelFor(page, own, OPS),
      scan(page, OPS),
      hiddenLayers(own),
    ]);
    const items = watermarkItems(current, model);
    return {
      skip: new Set(items.flatMap((item) => item.ops)),
      layers,
      hidden: hiddenTextMatcher(items),
    };
  }

  function analysis(page) {
    if (!enabled()) return Promise.resolve(null);
    if (!analyses.has(page))
      analyses.set(
        page,
        analyze(page).catch(() => null),
      );
    return analyses.get(page);
  }

  // Render options for a page, or null when it has nothing to remove or cannot be read.
  async function renderOptions(page) {
    const found = await analysis(page);
    if (!found || (!found.skip.size && !found.layers)) return null;
    const { skip, layers } = found;
    return {
      key: `wm${skip.size}${layers ? 'L' : ''}`,
      render: {
        ...(skip.size ? { operationsFilter: (index) => !skip.has(index) } : {}),
        ...(layers ? { optionalContentConfigPromise: Promise.resolve(layers) } : {}),
      },
    };
  }

  // Matcher for the text of the watermarks removed from a page, or null when there is none.
  async function hiddenText(page) {
    const found = await analysis(page);
    return found?.hidden.length ? found.hidden : null;
  }

  // Changes whenever the setting does, so text built from the page can be redone.
  const version = ref(0);
  watch(enabled, () => {
    version.value++;
    onToggle?.();
  });
  return { enabled, version, renderOptions, hiddenText };
}
