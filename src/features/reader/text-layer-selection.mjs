// PDF text runs are absolutely positioned, so their container needs a selection
// boundary in the empty space between lines (as in PDF.js's TextLayerBuilder).
const layers = new Map();
const textRuns = new Map();
const selectionOverlays = new Map();
let listeners;

function drawSelection(document) {
  const selection = document.getSelection();
  for (const [host, overlay] of selectionOverlays) {
    const boxes = [];
    if (selection?.rangeCount && !selection.isCollapsed) {
      const selected = selection.getRangeAt(0);
      const bounds = host.getBoundingClientRect(),
        scale = host.pdfTextScale || 1;
      for (const span of textRuns.get(host)()) {
        if (!host.contains(span) || !selected.intersectsNode(span)) continue;
        const range = document.createRange();
        range.selectNodeContents(span);
        if (span.contains(selected.startContainer))
          range.setStart(selected.startContainer, selected.startOffset);
        if (span.contains(selected.endContainer))
          range.setEnd(selected.endContainer, selected.endOffset);
        for (const rect of range.getClientRects()) {
          if (!rect.width || !rect.height) continue;
          const box = document.createElement('div');
          Object.assign(box.style, {
            left: `${(rect.left - bounds.left) / scale}px`,
            top: `${(rect.top - bounds.top) / scale}px`,
            width: `${rect.width / scale}px`,
            height: `${rect.height / scale}px`,
          });
          boxes.push(box);
        }
      }
    }
    overlay.replaceChildren(...boxes);
  }
}

export function preserveTextLayerSelection(spans) {
  const document = spans[0]?.ownerDocument;
  const selection = document?.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return () => {};
  function endpoint(node, offset) {
    const span = spans.find((item) => item.contains(node));
    if (!span) return { node, offset };
    const range = document.createRange();
    range.selectNodeContents(span);
    range.setEnd(node, offset);
    return { span, node, offset: range.toString().length };
  }
  const anchor = endpoint(selection.anchorNode, selection.anchorOffset);
  const focus = endpoint(selection.focusNode, selection.focusOffset);
  function resolve(point) {
    if (!point.span) return point;
    const walker = document.createTreeWalker(point.span, NodeFilter.SHOW_TEXT);
    let offset = point.offset;
    let node;
    while ((node = walker.nextNode())) {
      if (offset <= node.length) return { node, offset };
      offset -= node.length;
    }
    return null;
  }
  return () => {
    if (anchor.node.isConnected && focus.node.isConnected) return;
    const start = resolve(anchor);
    const end = resolve(focus);
    if (start?.node.isConnected && end?.node.isConnected)
      selection.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
  };
}

function reset(end, host) {
  host.append(end);
  end.style.width = '';
  end.style.height = '';
  end.style.userSelect = '';
  host.classList.remove('selecting');
}

// Shared document listeners live outside bindTextLayerSelection so their
// closures cannot retain the first layer's host (and its detached page).
function installSharedListeners(document) {
  listeners = new AbortController();
  const options = { signal: listeners.signal };
  const resetAll = () => layers.forEach(reset);
  document.addEventListener('pointerup', resetAll, options);
  document.addEventListener('pointercancel', resetAll, options);
  document.defaultView.addEventListener('blur', resetAll, options);
  let previousRange;
  const version = /\bChrome\/(\d+)\b/.exec(navigator.userAgent)?.[1];
  const needsBoundaryFix = !!version && Number(version) < 148;
  document.addEventListener(
    'selectionchange',
    () => {
      drawSelection(document);
      const selection = document.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) {
        resetAll();
        previousRange = undefined;
        return;
      }
      const range = selection.getRangeAt(0);
      for (const [layer, boundary] of layers) {
        if (range.intersectsNode(layer)) layer.classList.add('selecting');
        else reset(boundary, layer);
      }
      // Older Chromium otherwise jumps to the end of the page when the
      // pointer crosses a gap. Keep the empty boundary next to the endpoint.
      if (needsBoundaryFix) {
        const atStart =
          previousRange &&
          (range.compareBoundaryPoints(Range.END_TO_END, previousRange) === 0 ||
            range.compareBoundaryPoints(Range.START_TO_END, previousRange) === 0);
        let anchor = atStart ? range.startContainer : range.endContainer;
        if (anchor.nodeType === Node.TEXT_NODE) anchor = anchor.parentElement;
        const layer = anchor?.closest?.('.reading-text-layer');
        const boundary = layers.get(layer);
        if (boundary && anchor !== boundary) {
          while (anchor.parentElement !== layer) anchor = anchor.parentElement;
          boundary.style.width = layer.style.width;
          boundary.style.height = layer.style.height;
          boundary.style.userSelect = 'text';
          layer.insertBefore(boundary, atStart ? anchor : anchor.nextSibling);
        }
        previousRange = range.cloneRange();
      }
    },
    options,
  );
}

export function bindTextLayerSelection(host, getSpans) {
  const document = host.ownerDocument;
  const view = document.defaultView;
  let gesture;
  let scrollFrame, pointer;
  const scroller = host.closest('.reader');
  function autoScroll() {
    scrollFrame = 0;
    if (!gesture || !pointer || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const edge = 48;
    const speed =
      pointer.y < bounds.top + edge
        ? -Math.min(24, (bounds.top + edge - pointer.y) / 3)
        : pointer.y > bounds.bottom - edge
          ? Math.min(24, (pointer.y - bounds.bottom + edge) / 3)
          : 0;
    if (!speed) return;
    scroller.scrollTop += speed;
    extend({ clientX: pointer.x, clientY: pointer.y, preventDefault() {} }, false);
    scrollFrame = view.requestAnimationFrame(autoScroll);
  }
  // A caret in PDF whitespace must follow the nearest visual run rather than
  // jump to a later DOM node in another column.
  function caret(x, y) {
    let nearest;
    let distance = Infinity;
    for (const [container, runs] of textRuns)
      for (const span of runs()) {
        if (!container.contains(span) || !span.textContent) continue;
        const rect = span.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        // PDF font boxes may overlap adjacent lines. Their centers identify
        // the intended baseline more reliably than the box edges.
        const dy = 2 * Math.abs((rect.top + rect.bottom) / 2 - y);
        const score = dx * dx + dy * dy;
        if (score < distance) {
          distance = score;
          nearest = { span, rect };
        }
      }
    if (!nearest) return null;
    const { span, rect } = nearest;
    // Chromium's hit testing can snap transformed PDF runs to their edges.
    // Resolve the caret from actual glyph rectangles instead, including text
    // nested inside emphasis markup.
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let node;
    let last;
    while ((node = walker.nextNode())) {
      last = node;
      const range = document.createRange();
      range.selectNodeContents(node);
      const bounds = range.getBoundingClientRect();
      if (x <= bounds.left) return { node, offset: 0 };
      if (x >= bounds.right) continue;
      let low = 0;
      let high = node.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        range.setStart(node, middle);
        range.setEnd(node, middle + 1);
        const glyph = range.getBoundingClientRect();
        if (x > (glyph.left + glyph.right) / 2) low = middle + 1;
        else high = middle;
      }
      return { node, offset: low };
    }
    return last ? { node: last, offset: last.length } : null;
  }
  function begin(event) {
    if (event.button !== 0 || event.detail > 1 || event.shiftKey || event.metaKey || event.ctrlKey)
      return;
    const anchor = caret(event.clientX, event.clientY);
    if (!anchor) return;
    gesture = anchor;
    event.preventDefault();
    document
      .getSelection()
      ?.setBaseAndExtent(anchor.node, anchor.offset, anchor.node, anchor.offset);
  }
  function extend(event, scheduleScroll = true) {
    if (!gesture) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (scheduleScroll && !scrollFrame) scrollFrame = view.requestAnimationFrame(autoScroll);
    const focus = caret(event.clientX, event.clientY);
    if (!focus || !gesture.node.isConnected) return;
    event.preventDefault();
    document
      .getSelection()
      ?.setBaseAndExtent(gesture.node, gesture.offset, focus.node, focus.offset);
  }
  const finish = () => {
    gesture = null;
    pointer = null;
    view.cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  };
  host.addEventListener('mousedown', begin, true);
  textRuns.set(host, getSpans);
  document.addEventListener('mousemove', extend);
  document.addEventListener('mouseup', finish);
  view.addEventListener('blur', finish);
  const end = host.ownerDocument.createElement('div');
  end.className = 'endOfContent';
  end.setAttribute('aria-hidden', 'true');
  host.append(end);
  const overlay = document.createElement('div');
  overlay.className = 'text-selection-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  host.append(overlay);
  selectionOverlays.set(host, overlay);
  const redraw = () => drawSelection(document);
  const resizeObserver = new ResizeObserver(redraw);
  resizeObserver.observe(host);
  const start = () => host.classList.add('selecting');
  host.addEventListener('mousedown', start);
  layers.set(host, end);
  if (!listeners) installSharedListeners(document);
  return () => {
    finish();
    host.removeEventListener('mousedown', begin, true);
    document.removeEventListener('mousemove', extend);
    document.removeEventListener('mouseup', finish);
    view.removeEventListener('blur', finish);
    host.removeEventListener('mousedown', start);
    layers.delete(host);
    textRuns.delete(host);
    selectionOverlays.delete(host);
    resizeObserver.disconnect();
    overlay.remove();
    end.remove();
    host.classList.remove('selecting');
    if (!layers.size) {
      listeners.abort();
      listeners = undefined;
    }
  };
}
