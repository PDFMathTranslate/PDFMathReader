import { nextTick, ref, watch } from 'vue';

export function useAnnotationEditor({
  getAnnotations,
  getSelection,
  selection,
  focused,
  toolbar,
  persist,
}) {
  const editor = ref(null);
  const draft = ref('');
  let loadingComment = false;

  async function comment(a) {
    loadingComment = true;
    editor.value = a
      ? { ...a }
      : {
          ...getSelection(),
          id: crypto.randomUUID(),
          kind: 'comment',
          color: '#fff36a',
          comment: '',
          createdAt: new Date().toISOString(),
        };
    draft.value = a?.comment || '';
    toolbar.value = false;
    await nextTick();
    loadingComment = false;
    document.querySelector('.annotation-editor textarea')?.focus();
  }

  function saveComment() {
    if (!editor.value || loadingComment || !draft.value.trim()) return;
    const a = { ...editor.value, comment: draft.value, modifiedAt: new Date().toISOString() };
    persist([...getAnnotations().filter((b) => b.id !== a.id), a]);
  }

  watch(draft, saveComment);

  function commit() {
    if (!draft.value.trim()) return;
    saveComment();
    focused.value = editor.value;
    editor.value = null;
    selection.value = null;
    window.getSelection()?.removeAllRanges();
  }

  return { editor, draft, comment, saveComment, commit };
}
