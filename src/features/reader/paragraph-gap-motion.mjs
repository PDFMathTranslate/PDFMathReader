import { mapCompactY } from './paragraph-compaction.mjs';
import { reducedMotion } from '../../ui/motion/text-reveal.mjs';

// Move retained PDF bands as pixels, preserving formulas and native typography.
export function animateParagraphGaps(canvas, previous, current, scale, geometry) {
  if (reducedMotion() || !canvas.animate || !previous || previous.scale !== scale) return;
  const before = previous.cuts || [],
    after = current.cuts || [];
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const host = canvas.parentElement;
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'visible',
    pointerEvents: 'none',
    background: 'white',
    zIndex: '1',
  });
  layer.setAttribute('aria-hidden', 'true');
  const edges = [
    ...new Set([
      0,
      current.height,
      ...before.flatMap((c) => [c.start, c.end]),
      ...after.flatMap((c) => [c.start, c.end]),
    ]),
  ].sort((a, b) => a - b);
  const animations = [];
  const copies = [];
  const ratio = canvas.height / geometry.height;
  for (let i = 0; i < edges.length - 1; i++) {
    const start = edges[i],
      end = edges[i + 1];
    const top = mapCompactY(start, after) * scale;
    const bottom = mapCompactY(end, after) * scale;
    const visibleTop = Math.max(top, geometry.y);
    const visibleBottom = Math.min(bottom, geometry.y + geometry.height);
    if (visibleBottom <= visibleTop) continue;
    const strip = document.createElement('canvas');
    strip.width = canvas.width;
    strip.height = Math.max(1, Math.ceil((visibleBottom - visibleTop) * ratio));
    strip
      .getContext('2d')
      .drawImage(
        canvas,
        0,
        (visibleTop - geometry.y) * ratio,
        canvas.width,
        (visibleBottom - visibleTop) * ratio,
        0,
        0,
        strip.width,
        strip.height,
      );
    Object.assign(strip.style, {
      position: 'absolute',
      left: geometry.x + 'px',
      top: visibleTop + 'px',
      width: geometry.width + 'px',
      height: visibleBottom - visibleTop + 'px',
    });
    layer.append(strip);
    copies.push(strip);
    const delta = (mapCompactY(start, before) - mapCompactY(start, after)) * scale;
    animations.push(
      strip.animate([{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }], {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      }),
    );
  }
  if (!copies.length) return;
  host.append(layer);
  // Coordinate-aligned overlays follow the same mapping as the PDF strips.
  for (const element of host.querySelectorAll(
    '.reading-paragraph, .annotation-mark, .search-highlight, .paragraph-quick-link',
  )) {
    if (!element.style.top.endsWith('px')) continue;
    const y = parseFloat(element.style.top) / scale;
    const original = mapCompactY(y, after, true);
    const delta = (mapCompactY(original, before) - y) * scale;
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) continue;
    animations.push(
      element.animate([{ translate: `0 ${delta}px` }, { translate: '0 0' }], {
        duration: 300,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      }),
    );
  }
  let timer;
  const cleanup = () => {
    clearTimeout(timer);
    animations.forEach((a) => a.cancel());
    copies.forEach((c) => {
      c.width = c.height = 0;
    });
    layer.remove();
    if (canvas.paragraphGapCleanup === cleanup) canvas.paragraphGapCleanup = null;
  };
  canvas.paragraphGapCleanup = cleanup;
  timer = setTimeout(cleanup, 400);
  void Promise.allSettled(animations.map((a) => a.finished)).then(cleanup);
}
