// Shared-element motion between a sidebar thumbnail, a gallery tile, and a reader page.
// A detached copy of the source bitmap flies above the window so neither scroll container
// clips it, while the real destination stays hidden until the copy lands.
export const GALLERY_EASE = 'cubic-bezier(0.2, 0.85, 0.25, 1)';

function snapshot(source) {
  if (source instanceof HTMLCanvasElement && source.width && source.height) {
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    copy.getContext('2d').drawImage(source, 0, 0);
    return copy;
  }
  return document.createElement('div');
}

export async function flyPage(source, from, to, { duration = 420, signal } = {}) {
  if (!from?.width || !to?.width || signal?.aborted) return;
  const clone = snapshot(source);
  clone.className = 'page-gallery-flight';
  Object.assign(clone.style, {
    left: to.left + 'px',
    top: to.top + 'px',
    width: to.width + 'px',
    height: to.height + 'px',
  });
  document.body.append(clone);
  // The copy lifts off the sheet mid-flight and settles onto the gallery's resting shadow.
  const style = getComputedStyle(clone);
  const resting = style.getPropertyValue('--page-gallery-shadow').trim() || 'none';
  const lifted = style.getPropertyValue('--page-gallery-shadow-lifted').trim() || resting;
  const dx = from.left - to.left,
    dy = from.top - to.top,
    sx = from.width / to.width,
    sy = from.height / to.height;
  const flight = clone.animate(
    [
      {
        transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
        boxShadow: resting,
      },
      { offset: 0.55, boxShadow: lifted },
      { transform: 'none', boxShadow: resting },
    ],
    { duration, easing: GALLERY_EASE, fill: 'forwards' },
  );
  const abort = () => flight.cancel();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await flight.finished;
  } catch {
    // Cancelled flights simply end.
  } finally {
    signal?.removeEventListener('abort', abort);
  }
  return clone;
}

export async function fadeOut(element, duration = 140) {
  if (!element?.isConnected) return;
  try {
    await element.animate([{ opacity: 1 }, { opacity: 0 }], { duration, fill: 'forwards' })
      .finished;
  } catch {
    // Removal below still applies.
  }
  element.remove();
}

// Tiles ripple outwards from the focal page: nearer tiles move first.
export function rippleTiles(tiles, focus, columns, { entering, duration = 320 } = {}) {
  const animations = [];
  for (const tile of tiles) {
    const number = Number(tile.dataset.galleryPage);
    if (number === focus) continue;
    const row = Math.abs(Math.ceil(number / columns) - Math.ceil(focus / columns)),
      column = Math.abs(((number - 1) % columns) - ((focus - 1) % columns)),
      delay = Math.min(220, Math.hypot(row, column) * 28);
    const away = { opacity: 0, transform: 'scale(0.9) translateY(10px)' },
      home = { opacity: 1, transform: 'none' };
    animations.push(
      tile.animate(entering ? [away, home] : [home, away], {
        duration,
        delay: entering ? delay : Math.max(0, 120 - delay / 2),
        easing: GALLERY_EASE,
        fill: entering ? 'backwards' : 'forwards',
      }),
    );
  }
  return animations;
}
