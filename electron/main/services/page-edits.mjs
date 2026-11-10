import { degrees, PDFDocument } from 'pdf-lib';

const BOXES = [
  ['MediaBox', 'getMediaBox', 'setMediaBox'],
  ['CropBox', 'getCropBox', 'setCropBox'],
  ['BleedBox', 'getBleedBox', 'setBleedBox'],
  ['TrimBox', 'getTrimBox', 'setTrimBox'],
  ['ArtBox', 'getArtBox', 'setArtBox'],
];

function normalizedRotation(page) {
  const angle = Number(page.getRotation()?.angle) || 0;
  return ((angle % 360) + 360) % 360;
}

function displayedGeometry(page) {
  const crop = page.getCropBox();
  const rotation = normalizedRotation(page);
  const sideways = rotation === 90 || rotation === 270;
  return {
    width: sideways ? crop.height : crop.width,
    height: sideways ? crop.width : crop.height,
    rotation,
  };
}

function bucket(value) {
  return Number((Math.round((value + Number.EPSILON) * 10) / 10).toFixed(1));
}

function hasExplicitBox(page, name) {
  return page.node[name]?.() !== undefined;
}

function scalePage(page, scale) {
  if (Math.abs(scale - 1) <= 1e-12) return;
  const boxes = BOXES.map(([name, getter, setter]) => ({
    name,
    getter,
    setter,
    value: page[getter](),
    explicit: name === 'MediaBox' || hasExplicitBox(page, name),
  }));
  page.scale(scale, scale);
  for (const box of boxes) {
    if (!box.explicit) continue;
    const { x, y, width, height } = box.value;
    page[box.setter](x * scale, y * scale, width * scale, height * scale);
  }
}

function selectModal(records, key) {
  const counts = new Map();
  for (const record of records) {
    const value = bucket(record[key]);
    record.bucket = value;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  let selected = records[0]?.bucket;
  let bestCount = selected === undefined ? 0 : counts.get(selected);
  for (const record of records) {
    const count = counts.get(record.bucket);
    if (count > bestCount) {
      selected = record.bucket;
      bestCount = count;
    }
  }
  return records.find((record) => record.bucket === selected)?.[key];
}

function validateAction(action) {
  if (!['rotate', 'align-width', 'align-height', 'arrange'].includes(action))
    throw Error('Invalid page edit action.');
}

function validatePageNumber(page, count) {
  if (!Number.isSafeInteger(page) || page < 1 || page > count)
    throw Error('Invalid page edit page.');
}

export const MAX_ARRANGED_PAGES = 10000;

// `order` lists the source page numbers in their new sequence. A page may repeat (a pasted
// copy) but none may be dropped, so arranging never deletes content.
export function validatePageOrder(order, count) {
  if (!Array.isArray(order) || order.length < count || order.length > MAX_ARRANGED_PAGES)
    throw Error('Invalid page order.');
  const seen = new Set();
  for (const page of order) {
    validatePageNumber(page, count);
    seen.add(page);
  }
  if (seen.size !== count) throw Error('Invalid page order.');
  return order;
}

// Original pages keep their objects, so outline entries and links still find them; only
// repeated pages are copied.
async function arrangePages(pdf, order) {
  const pages = pdf.getPages();
  validatePageOrder(order, pages.length);
  const seen = new Set();
  const repeated = order.map((page) => {
    if (seen.has(page)) return true;
    seen.add(page);
    return false;
  });
  const copies = await pdf.copyPages(
    pdf,
    order.filter((_, index) => repeated[index]).map((page) => page - 1),
  );
  let copy = 0;
  const sequence = order.map((page, index) => (repeated[index] ? copies[copy++] : pages[page - 1]));
  for (let index = pages.length - 1; index >= 0; index--) pdf.removePage(index);
  for (const page of sequence) pdf.addPage(page);
}

export async function editPDFPages(bytes, { action, page, order } = {}) {
  validateAction(action);
  if (!(bytes instanceof Uint8Array)) throw TypeError('PDF bytes must be a Uint8Array.');
  const pdf = await PDFDocument.load(new Uint8Array(bytes), { updateMetadata: false });
  if (action === 'arrange') {
    await arrangePages(pdf, order);
    return { bytes: new Uint8Array(await pdf.save()), transforms: [] };
  }
  const pages = pdf.getPages();
  const before = pages.map(displayedGeometry);
  const transforms = before.map((geometry, index) => ({
    page: index + 1,
    scale: 1,
    rotate: 0,
    width: geometry.width,
    height: geometry.height,
  }));

  if (action === 'rotate') {
    validatePageNumber(page, pages.length);
    const target = pages[page - 1];
    const rotation = (normalizedRotation(target) + 90) % 360;
    target.setRotation(degrees(rotation));
    transforms[page - 1].rotate = 90;
  } else if (pages.length) {
    const key = action === 'align-width' ? 'width' : 'height';
    const target = selectModal(
      before.map((geometry) => ({ ...geometry })),
      key,
    );
    for (const [index, geometry] of before.entries()) {
      const scale = target / geometry[key];
      transforms[index].scale = scale;
      scalePage(pages[index], scale);
    }
  }

  return { bytes: new Uint8Array(await pdf.save()), transforms };
}
