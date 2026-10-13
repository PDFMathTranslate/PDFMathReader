import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

// Each tab is a separate reader window; the main process reports the group this
// window belongs to. An empty list means the window stands alone.
export function useWindowTabs() {
  const bridge = typeof window === 'undefined' ? null : window.previewTabs;
  const tabs = ref([]);
  const visible = computed(() => tabs.value.length > 1);
  const apply = (value) => {
    tabs.value = Array.isArray(value?.tabs) ? value.tabs : Array.isArray(value) ? value : [];
  };
  let stop = null;
  onMounted(() => {
    if (!bridge) return;
    stop = bridge.onChanged(apply);
    void bridge
      .list()
      .then(apply)
      .catch(() => {});
  });
  onBeforeUnmount(() => stop?.());
  const call = (action, ...args) => bridge?.[action](...args).catch(() => {});
  return {
    tabs,
    visible,
    select: (id) => call('select', id),
    close: (id) => call('close', id),
    create: () => call('new'),
    contextMenu: (id) => call('contextMenu', id),
    move: (id, index) => {
      // Reorder locally so the dropped tab stays put until the group broadcasts.
      const next = tabs.value.filter((tab) => tab.id !== id);
      const moved = tabs.value.find((tab) => tab.id === id);
      if (!moved) return;
      next.splice(index, 0, moved);
      tabs.value = next;
      return call('move', id, index);
    },
  };
}
