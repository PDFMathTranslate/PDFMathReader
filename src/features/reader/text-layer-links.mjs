import { detectDoiRanges } from '../../../shared/reader/link-detection.mjs';

export function linkifyDoiText(spans) {
  for (const span of spans) {
    for (const anchor of span.querySelectorAll('a.pdf-doi-link'))
      anchor.replaceWith(...anchor.childNodes);
    span.normalize();
  }
  const text = spans.map((span) => span.textContent).join('\n');
  const links = detectDoiRanges(text);
  let offset = 0;
  for (const span of spans) {
    const document = span.ownerDocument;
    const walker = document.createTreeWalker(span, 4 /* SHOW_TEXT */);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) if (node.length) nodes.push(node);
    for (const node of nodes) {
      const start = offset;
      offset += node.length;
      // Reverse order keeps the original node's earlier offsets valid.
      for (const link of links
        .filter((link) => link.start < offset && link.end > start)
        .reverse()) {
        const range = document.createRange();
        range.setStart(node, Math.max(0, link.start - start));
        range.setEnd(node, Math.min(node.length, link.end - start));
        const anchor = document.createElement('a');
        anchor.className = 'pdf-doi-link';
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.draggable = false;
        anchor.title = link.url;
        range.surroundContents(anchor);
      }
    }
    offset++;
  }
}
