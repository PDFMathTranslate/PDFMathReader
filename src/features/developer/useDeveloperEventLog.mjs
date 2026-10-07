import { computed, nextTick, ref, watch } from 'vue';

export function useDeveloperEventLog({ snapshotData, stateKey }) {
  const autoScroll = ref(true);
  const activeTab = ref('console');
  const kernelFilter = ref('all');
  const searchQuery = ref('');
  const consoleViewport = ref(null);
  const clearedEventIds = ref(new Set());
  const clearedCommandIds = ref(new Set());

  const processRows = computed(() =>
    [...(snapshotData.value?.processes || [])].sort(
      (a, b) =>
        b.cpuPercent - a.cpuPercent || String(a.pid || '').localeCompare(String(b.pid || '')),
    ),
  );
  const kernelOptions = computed(() => {
    const values = new Set();
    for (const process of snapshotData.value?.processes || [])
      if (process.kernel) values.add(process.kernel);
    for (const event of snapshotData.value?.events || [])
      if (event.kernel) values.add(event.kernel);
    for (const task of snapshotData.value?.tasks || []) if (task.kernel) values.add(task.kernel);
    for (const command of snapshotData.value?.commands || [])
      if (command.kernel) values.add(command.kernel);
    return [...values].sort((a, b) => a.localeCompare(b));
  });
  const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

  function matchesFilter(item) {
    if (kernelFilter.value !== 'all' && item.kernel !== kernelFilter.value) return false;
    if (!normalizedQuery.value) return true;
    const haystack = [
      item.kind,
      item.kernel,
      item.message,
      item.command,
      item.result,
      item.backend,
      item.id,
      item.status,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery.value);
  }

  const visibleEvents = computed(() =>
    [...(snapshotData.value?.events || [])]
      .filter((event) => !clearedEventIds.value.has(event.key) && matchesFilter(event))
      .sort((a, b) => (a.time || 0) - (b.time || 0)),
  );
  const visibleCommands = computed(() =>
    [...(snapshotData.value?.commands || [])]
      .filter((command) => !clearedCommandIds.value.has(command.rowKey) && matchesFilter(command))
      .sort((a, b) => (a.time || 0) - (b.time || 0)),
  );
  const visibleTasks = computed(() => [...(snapshotData.value?.tasks || [])].filter(matchesFilter));

  const visibleEventCount = computed(() => visibleEvents.value.length);
  const visibleCommandCount = computed(() => visibleCommands.value.length);
  const hasEvents = computed(() => (snapshotData.value?.events?.length || 0) > 0);
  const hasTasks = computed(() => (snapshotData.value?.tasks?.length || 0) > 0);
  const hasCommands = computed(() => (snapshotData.value?.commands?.length || 0) > 0);
  const taskCounts = computed(() => {
    const counts = { queued: 0, running: 0, completed: 0, failed: 0, other: 0 };
    for (const task of snapshotData.value?.tasks || []) {
      const state = stateKey(task.status);
      if (state in counts) counts[state]++;
      else counts.other++;
    }
    return counts;
  });

  watch(
    () => [snapshotData.value?.events || [], snapshotData.value?.commands || []],
    ([events, commands]) => {
      const eventKeys = new Set(events.map((event) => event.key));
      const commandKeys = new Set(commands.map((command) => command.rowKey));
      clearedEventIds.value = new Set(
        [...clearedEventIds.value].filter((key) => eventKeys.has(key)),
      );
      clearedCommandIds.value = new Set(
        [...clearedCommandIds.value].filter((key) => commandKeys.has(key)),
      );
    },
    { immediate: true },
  );

  function scrollConsoleToEnd() {
    if (!autoScroll.value || activeTab.value !== 'console') return;
    nextTick(() => {
      if (consoleViewport.value)
        consoleViewport.value.scrollTop = consoleViewport.value.scrollHeight;
    });
  }

  watch(
    () => [visibleEvents.value.at(-1)?.key, activeTab.value, autoScroll.value],
    scrollConsoleToEnd,
  );

  function clearView() {
    if (activeTab.value === 'console') {
      const next = new Set(clearedEventIds.value);
      for (const event of visibleEvents.value) next.add(event.key);
      clearedEventIds.value = next;
    } else {
      const commands = new Set(clearedCommandIds.value);
      for (const command of visibleCommands.value) commands.add(command.rowKey);
      clearedCommandIds.value = commands;
    }
  }

  return {
    activeTab,
    autoScroll,
    clearView,
    consoleViewport,
    hasCommands,
    hasEvents,
    hasTasks,
    kernelFilter,
    kernelOptions,
    processRows,
    searchQuery,
    taskCounts,
    visibleCommandCount,
    visibleCommands,
    visibleEventCount,
    visibleEvents,
    visibleTasks,
  };
}
