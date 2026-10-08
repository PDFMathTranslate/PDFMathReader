import { settleAnimation } from '../../features/reader/document-motion.mjs';

export const refocusDuration = 520;
export const refocusFrames = [
  { filter: 'blur(7px) contrast(1.12)', opacity: 0.45, offset: 0 },
  { filter: 'blur(3px) contrast(1.06)', opacity: 0.85, offset: 0.4 },
  { filter: 'blur(0px) contrast(1)', opacity: 1, offset: 1 },
];

// Missing or unusable paragraph geometry falls back to one complete page.
export function refocusRegions(boxes, width, height) {
  const regions = (boxes || [])
    .filter((b) => [b?.x, b?.y, b?.width, b?.height].every(Number.isFinite))
    .map((b) => {
      const x = Math.max(0, b.x),
        y = Math.max(0, b.y);
      return {
        x,
        y,
        width: Math.min(width, b.x + b.width) - x,
        height: Math.min(height, b.y + b.height) - y,
      };
    })
    .filter((b) => b.width > 0 && b.height > 0);
  return regions.length ? regions : [{ x: 0, y: 0, width, height }];
}

export async function refocusPDF({
  canvas,
  page,
  scale,
  host,
  boxes,
  previous,
  signal,
  origin = { x: 0, y: 0 },
}) {
  if (
    !canvas?.width ||
    !host?.isConnected ||
    signal?.aborted ||
    document.hidden ||
    window.previewActivityActive === false ||
    document.documentElement.dataset.reduceMotion === 'true' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
    return;
  const view = page.getViewport({ scale });
  const layer = document.createElement('div');
  layer.className = 'digital-refocus-layer';
  layer.setAttribute('aria-hidden', 'true');
  const animations = [],
    textures = [];
  const crop = (source, box, holder) => {
    const texture = document.createElement('canvas');
    const ratio = Math.min(2, source.width / view.width);
    texture.width = Math.max(1, Math.ceil(box.width * ratio));
    texture.height = Math.max(1, Math.ceil(box.height * ratio));
    texture.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    texture
      .getContext('2d')
      .drawImage(
        source,
        (box.x * source.width) / view.width,
        (box.y * source.height) / view.height,
        (box.width * source.width) / view.width,
        (box.height * source.height) / view.height,
        0,
        0,
        texture.width,
        texture.height,
      );
    textures.push(texture);
    holder.append(texture);
    return texture;
  };
  const abort = () => animations.forEach((a) => a.cancel());
  try {
    for (const box of refocusRegions(boxes, view.width, view.height)) {
      const region = document.createElement('div');
      region.className = 'digital-refocus-region';
      Object.assign(region.style, {
        left: box.x - origin.x + 'px',
        top: box.y - origin.y + 'px',
        width: box.width + 'px',
        height: box.height + 'px',
      });
      layer.append(region);
      const current = crop(canvas, box, region);
      animations.push(
        current.animate(refocusFrames, {
          duration: refocusDuration,
          easing: 'cubic-bezier(.22,.75,.2,1)',
          fill: 'both',
        }),
      );
      if (previous?.width) {
        const old = crop(previous, box, region);
        animations.push(
          old.animate(
            [
              { filter: 'blur(0px)', opacity: 1 },
              { filter: 'blur(9px)', opacity: 0 },
            ],
            { duration: 260, easing: 'ease-out', fill: 'both' },
          ),
        );
      }
    }
    host.append(layer);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    await Promise.all(animations.map((a) => settleAnimation(a, refocusDuration + 100)));
  } finally {
    signal?.removeEventListener('abort', abort);
    abort();
    layer.remove();
    textures.forEach((c) => {
      c.width = c.height = 0;
    });
  }
}
