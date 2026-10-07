import { ref, onBeforeUnmount } from 'vue';

export function useAnnotationPersistence(notifyCopy) {
  const annotations = ref([]),
    annotationKey = ref(''),
    annotationNativeRefs = ref([]),
    annotationToast = ref(null);
  let annotationToastTimer,
    annotationWrites = Promise.resolve();
  const annotationSaved = new Set();
  function annotationNotice(value) {
    clearTimeout(annotationToastTimer);
    annotationToast.value = value;
    annotationToastTimer = setTimeout(() => (annotationToast.value = null), 3000);
  }
  function saveAnnotations(value) {
    annotations.value = value;
    const key = annotationKey.value,
      nativeRefs = [...annotationNativeRefs.value],
      snapshot = JSON.parse(JSON.stringify(value)).map((a) => {
        delete a.animateUntil;
        return a;
      });
    annotationWrites = annotationWrites
      .catch(() => {})
      .then(async () => {
        try {
          if (window.previewAnnotations)
            await window.previewAnnotations.save({ key, annotations: snapshot, nativeRefs });
          else localStorage.setItem('annotations:' + key, JSON.stringify(snapshot));
          if (!annotationSaved.has(key)) {
            annotationSaved.add(key);
            notifyCopy(window.previewAnnotations ? '批注已自动保存' : '批注已自动保存到此浏览器');
          }
        } catch (e) {
          notifyCopy('批注保存失败：' + e.message, 5000);
        }
      });
  }

  onBeforeUnmount(() => clearTimeout(annotationToastTimer));
  return {
    annotations,
    annotationKey,
    annotationNativeRefs,
    annotationToast,
    annotationNotice,
    saveAnnotations,
    flushAnnotations: () => annotationWrites,
  };
}
