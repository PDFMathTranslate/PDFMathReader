import { computed, nextTick, ref, watch } from 'vue';

export function useAnnotationSelection({
  getAnnotations,
  getPageNumber,
  getSelectedAnnotation,
  menu,
  onRemove,
  isClickSuppressed,
}) {
  const popupFromNote = ref(false);
  const selection = ref(null);
  const toolbar = ref(false);
  const opened = ref(null);
  const focused = ref(null);
  const deleteArmed = ref(false);
  let timer = null;

  const toolbarComment = computed(
    () =>
      getAnnotations()
        .find((a) => a.id === selection.value?.id)
        ?.comment?.trim() || '',
  );

  watch([toolbar, () => selection.value?.id], () => {
    deleteArmed.value = false;
  });

  function touch() {
    clearTimeout(timer);
    timer = setTimeout(() => (toolbar.value = false), 3000);
  }

  function activate(a) {
    if (!getAnnotations().some((b) => b.id === a.id)) return;
    popupFromNote.value = false;
    toolbar.value = false;
    selection.value = null;
    focused.value = a;
    opened.value = null;
    menu.value = null;
    if (a.kind === 'highlight') {
      selection.value = a;
      toolbar.value = true;
      touch();
    } else opened.value = a;
  }

  function clickAnnotation(a, event, note = false) {
    if (isClickSuppressed()) {
      event.preventDefault();
      return;
    }
    activate(a);
    if (note && getAnnotations().some((b) => b.id === a.id)) {
      popupFromNote.value = true;
      if (a.kind !== 'highlight' || !a.comment?.trim()) {
        toolbar.value = false;
        opened.value = a;
      }
    }
  }

  function armToolbarDelete() {
    deleteArmed.value = true;
    touch();
  }

  function deleteFromToolbar() {
    const a = getAnnotations().find((item) => item.id === selection.value?.id);
    if (a) {
      onRemove(a);
      toolbar.value = false;
      selection.value = null;
    }
  }

  watch(
    getSelectedAnnotation,
    async (id) => {
      if (!id) return;
      await nextTick();
      if (getSelectedAnnotation() !== id) return;
      const a = getAnnotations().find((item) => item.id === id && item.page === getPageNumber());
      if (a) activate(a);
      else {
        toolbar.value = false;
        opened.value = null;
        focused.value = null;
        menu.value = null;
      }
    },
    { immediate: true },
  );

  function cleanup() {
    clearTimeout(timer);
    timer = null;
  }

  return {
    popupFromNote,
    selection,
    toolbar,
    opened,
    focused,
    deleteArmed,
    toolbarComment,
    touch,
    activate,
    clickAnnotation,
    armToolbarDelete,
    deleteFromToolbar,
    cleanup,
  };
}
