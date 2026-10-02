const DEFAULT_MAX_BYTES = 128 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 128;

function bitmapBytes(canvas) {
 return canvas.width * canvas.height * 4;
}

function zeroCanvas(canvas) {
 canvas.width = 0;
 canvas.height = 0;
}

export class BitmapCache {
 #entries = new Map();
 #bytes = 0;
 #maxBytes;
 #maxEntries;

 constructor({maxBytes=DEFAULT_MAX_BYTES,maxEntries=DEFAULT_MAX_ENTRIES}={}) {
  this.#maxBytes = maxBytes;
  this.#maxEntries = maxEntries;
 }

 get(key) {
  const entry = this.#entries.get(key);
  if (!entry) return undefined;
  this.#entries.delete(key);
  this.#entries.set(key,entry);
  return entry.canvas;
 }

 set(key,canvas) {
  const bytes = bitmapBytes(canvas);
  if (bytes > this.#maxBytes || this.#maxEntries <= 0) return false;

  const existing = this.#entries.get(key);
  if (existing) {
   this.#entries.delete(key);
   this.#bytes -= existing.bytes;
   if (existing.canvas !== canvas) this.#release(existing.canvas);
  }

  while (this.#entries.size >= this.#maxEntries || this.#bytes + bytes > this.#maxBytes) {
   const [oldestKey,oldest] = this.#entries.entries().next().value;
   this.#entries.delete(oldestKey);
   this.#bytes -= oldest.bytes;
   this.#release(oldest.canvas,canvas);
  }

  this.#entries.set(key,{canvas,bytes});
  this.#bytes += bytes;
  return true;
 }

 delete(key) {
  const entry = this.#entries.get(key);
  if (!entry) return false;
  this.#entries.delete(key);
  this.#bytes -= entry.bytes;
  this.#release(entry.canvas);
  return true;
 }

 clear() {
  const canvases = new Set();
  for (const entry of this.#entries.values()) canvases.add(entry.canvas);
  this.#entries.clear();
  this.#bytes = 0;
  for (const canvas of canvases) zeroCanvas(canvas);
 }

 stats() {
  return {bytes:this.#bytes,entries:this.#entries.size,maxBytes:this.#maxBytes,maxEntries:this.#maxEntries};
 }

 #release(canvas,protectedCanvas) {
  if (canvas === protectedCanvas) return;
  for (const entry of this.#entries.values()) {
   if (entry.canvas === canvas) return;
  }
  zeroCanvas(canvas);
 }
}
