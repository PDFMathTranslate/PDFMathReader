export function createSidebarInteraction({ motion, shell, view, actions }) {
  function sidebarReady() {
    if (shell.sidebarMode.value === 'thumbnails') {
      actions.thumbnails.updateThumbnailViewport();
      actions.thumbnails.observeThumbnails();
      actions.thumbnails.scrollThumbnailTo(view.active.value);
    }
  }

  function resizeSidebarStart(event) {
    if (event.button !== 0) return;
    const host = event.currentTarget;
    motion.sidebarDrag = {
      id: event.pointerId,
      host,
      x: event.clientX,
      width: host.parentElement.getBoundingClientRect().width,
    };
    host.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function resizeSidebarMove(event) {
    if (!motion.sidebarDrag || event.pointerId !== motion.sidebarDrag.id) return;
    setSidebarWidth(motion.sidebarDrag.width + event.clientX - motion.sidebarDrag.x);
  }

  function resizeSidebarEnd(event) {
    if (!motion.sidebarDrag || event.pointerId !== motion.sidebarDrag.id) return;
    motion.sidebarDrag = null;
  }

  function setSidebarWidth(width) {
    motion.sidebarWidth.value = Math.max(200, Math.min(640, window.innerWidth * 0.5, width));
  }

  function resizeSidebarKey(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const width = event.currentTarget.parentElement.getBoundingClientRect().width;
    setSidebarWidth(
      event.key === 'Home'
        ? 200
        : event.key === 'End'
          ? 640
          : width + (event.key === 'ArrowRight' ? 20 : -20),
    );
  }
  return {
    sidebarReady,
    resizeSidebarStart,
    resizeSidebarMove,
    resizeSidebarEnd,
    setSidebarWidth,
    resizeSidebarKey,
  };
}
