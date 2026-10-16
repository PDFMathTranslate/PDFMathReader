import { ref, onBeforeUnmount } from 'vue';

export function useAnnotationPersistence(notifyCopy) {
  const annotations = ref([]),
    annotationKey = ref(''),
    annotationNativeRefs = ref([]),
    annotationToast = ref(null);
  let annotationToastTimer,
    annotationWrites = Promise.resolve(),
    latestAnnotationWrite,
    latestAnnotationSnapshot,
    annotationFlush;
  const annotationSaved = new Set();
  function annotationNotice(value) {
    clearTimeout(annotationToastTimer);
    annotationToast.value = value;
    annotationToastTimer = setTimeout(() => (annotationToast.value = null), 3000);
  }
  async function persistAnnotations({ key, annotations, nativeRefs }) {
    if (window.previewAnnotations)
      await window.previewAnnotations.save({ key, annotations, nativeRefs });
    else localStorage.setItem('annotations:' + key, JSON.stringify(annotations));
    if (!annotationSaved.has(key)) {
      annotationSaved.add(key);
      notifyCopy(window.previewAnnotations ? '批注已自动保存' : '批注已自动保存到此浏览器');
    }
  }
  function enqueueAnnotationWrite(snapshot) {
    const write = annotationWrites.then(() => persistAnnotations(snapshot));
    annotationWrites = write.catch(() => {});
    return write;
  }
  function reportAnnotationFailure(error) {
    notifyCopy('批注保存失败：' + error.message, 5000);
  }
  function saveAnnotations(value) {
    annotations.value = value;
    const snapshot = {
      key: annotationKey.value,
      nativeRefs: [...annotationNativeRefs.value],
      annotations: JSON.parse(JSON.stringify(value)).map((a) => {
        delete a.animateUntil;
        return a;
      }),
    };
    const write = enqueueAnnotationWrite(snapshot);
    latestAnnotationSnapshot = snapshot;
    latestAnnotationWrite = write;
    void write.catch(reportAnnotationFailure);
  }
  async function flushLatestAnnotations() {
    while (latestAnnotationWrite) {
      const write = latestAnnotationWrite,
        snapshot = latestAnnotationSnapshot;
      try {
        await write;
      } catch {
        if (latestAnnotationWrite !== write) continue;
        const retry = enqueueAnnotationWrite(snapshot);
        latestAnnotationWrite = retry;
        void retry.catch(reportAnnotationFailure);
        try {
          await retry;
        } catch (retryError) {
          if (latestAnnotationWrite !== retry) continue;
          throw retryError;
        }
        if (latestAnnotationWrite !== retry) continue;
      }
      if (latestAnnotationWrite === write) return;
    }
  }
  function flushAnnotations() {
    if (!annotationFlush)
      annotationFlush = flushLatestAnnotations().finally(() => (annotationFlush = null));
    return annotationFlush;
  }

  onBeforeUnmount(() => clearTimeout(annotationToastTimer));
  return {
    annotations,
    annotationKey,
    annotationNativeRefs,
    annotationToast,
    annotationNotice,
    saveAnnotations,
    flushAnnotations,
  };
}
