// Measure pointer travel in screen pixels independently of the annotation's tether.
const threshold = 12;
export function createAnnotationShake(x, y) {
  return {
    x: { extreme: x, direction: 0, turns: 0 },
    y: { extreme: y, direction: 0, turns: 0 },
    recognized: false,
  };
}
export function updateAnnotationShake(state, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return state.recognized;
  for (const [axis, value] of [
    ['x', x],
    ['y', y],
  ]) {
    const track = state[axis],
      delta = value - track.extreme;
    if (!track.direction) {
      if (Math.abs(delta) >= threshold) {
        track.direction = Math.sign(delta);
        track.extreme = value;
      }
    } else if (delta * track.direction > 0) {
      track.extreme = value;
    } else if (Math.abs(delta) >= threshold) {
      track.direction = -track.direction;
      track.extreme = value;
      track.turns++;
      // Four alternating legs make two back-and-forth shakes.
      if (track.turns >= 3) state.recognized = true;
    }
  }
  return state.recognized;
}
