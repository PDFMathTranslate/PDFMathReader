import { ref, shallowRef } from 'vue';

export function createMotionState() {
  const pinching = ref(false);
  const navigatorVisible = ref(false);
  const sidebarWidth = ref(null);
  const sidebarLeaving = ref(false);
  const referenceReturn = shallowRef(null);
  const referenceNavigation = 0;
  const referenceJumping = false;
  const sidebarDrag = null;
  const pageScrollMotion = null;
  const pageJumping = false;
  const pageJumpGeneration = 0;
  const layoutMotion = null;
  const layoutMotionGeneration = 0;
  const fitAdjusting = false;
  const fitFrame = 0;
  const fitResizeTimer = undefined;
  const fitResizing = false;
  const resizeRenderTimer = undefined;
  const resizeDrawing = false;
  const lastResizeDraw = 0;
  const zoomRequest = null;
  const zoomAnimation = null;
  const zoomRenderTimer = 0;
  const zoomRenderGeneration = 0;
  const zoomMotionGeneration = 0;
  const zoomTargetPending = false;
  const pinchFrame = 0;
  const pinchTimer = undefined;
  const pinchDelta = 0;
  const pinchPoint = undefined;
  const navigatorTimer = undefined;
  const scrubbers = new Map();
  return {
    pinching,
    navigatorVisible,
    sidebarWidth,
    sidebarLeaving,
    referenceReturn,
    referenceNavigation,
    referenceJumping,
    sidebarDrag,
    pageScrollMotion,
    pageJumping,
    pageJumpGeneration,
    layoutMotion,
    layoutMotionGeneration,
    fitAdjusting,
    fitFrame,
    fitResizeTimer,
    fitResizing,
    resizeRenderTimer,
    resizeDrawing,
    lastResizeDraw,
    zoomRequest,
    zoomAnimation,
    zoomRenderTimer,
    zoomRenderGeneration,
    zoomMotionGeneration,
    zoomTargetPending,
    pinchFrame,
    pinchTimer,
    pinchDelta,
    pinchPoint,
    navigatorTimer,
    scrubbers,
  };
}
