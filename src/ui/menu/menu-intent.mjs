// Retain the current branch while the pointer crosses toward its child menu.
export function towardSubmenu(previous, current, bounds) {
  const right = bounds.left >= previous.x,
    edge = right ? bounds.left : bounds.right;
  if (
    (right ? current.x <= previous.x : current.x >= previous.x) ||
    Math.abs(edge - current.x) > Math.abs(edge - previous.x)
  )
    return false;
  const a = previous,
    b = { x: edge, y: bounds.top - 8 },
    c = { x: edge, y: bounds.bottom + 8 };
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const signs = [cross(a, b, current), cross(b, c, current), cross(c, a, current)];
  return !signs.some((value) => value < 0) || !signs.some((value) => value > 0);
}
