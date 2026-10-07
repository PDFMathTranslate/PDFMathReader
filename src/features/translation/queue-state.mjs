import { ref, shallowRef } from 'vue';

export function createTranslationQueueState() {
  const translationDeferred = ref(false);
  const readingDirection = 1;
  const translationMoving = false;
  const lastTranslationScroll = null;
  const translationRequests = new Map();
  const pageQueue = [];
  const queue = [];
  const running = 0;
  const pageRunning = 0;
  const controllers = new Set();
  const forceRetranslation = false;
  const timer = undefined;
  return {
    translationDeferred,
    readingDirection,
    translationMoving,
    lastTranslationScroll,
    translationRequests,
    pageQueue,
    queue,
    running,
    pageRunning,
    controllers,
    forceRetranslation,
    timer,
  };
}
