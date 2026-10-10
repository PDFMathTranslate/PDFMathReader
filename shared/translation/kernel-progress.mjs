const PREFIX = 'PDFMATH_PROGRESS:';
const MAX_LINE_LENGTH = 8 * 1024;
const MAX_STAGE_LENGTH = 256;

function boundedNumber(value, minimum, maximum) {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function validProgress(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { stage, completed, total, percent } = value;
  if (typeof stage !== 'string' || !stage.trim() || stage.length > MAX_STAGE_LENGTH) return null;
  if (!boundedNumber(total, Number.MIN_VALUE, Number.MAX_SAFE_INTEGER)) return null;
  if (!boundedNumber(completed, 0, total) || (percent !== null && !boundedNumber(percent, 0, 100)))
    return null;
  return { stage, completed, total, percent };
}

export function createKernelProgressParser(onProgress) {
  let pending = '';

  return function consume(chunk) {
    if (chunk === undefined || chunk === null) return;
    pending += String(chunk);
    let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      let line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith(PREFIX) || line.length > MAX_LINE_LENGTH) continue;
      let progress;
      try {
        progress = validProgress(JSON.parse(line.slice(PREFIX.length)));
      } catch {
        progress = null;
      }
      if (progress && typeof onProgress === 'function') onProgress(progress);
    }
    if (pending.length > MAX_LINE_LENGTH) pending = pending.slice(-MAX_LINE_LENGTH);
  };
}
