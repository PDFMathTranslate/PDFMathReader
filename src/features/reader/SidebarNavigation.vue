<script setup>
import { computed, watch, ref, nextTick, onMounted, onBeforeUnmount, inject } from 'vue';
import { t, uiLanguage } from '../../i18n/index.mjs';
import { annotationSections, annotationChapters } from '../annotations/annotation-browser.mjs';
import { platform, AppSegmentedControl, AppSegment } from '../../ui/controls.mjs';
import { tocGenerationLabel } from './toc-generation-labels.mjs';
const props = defineProps({
  mode: String,
  outline: Array,
  tocGeneration: { type: Object, default: () => ({ status: 'idle' }) },
  readChapters: { type: Set, default: () => new Set() },
  annotations: Array,
  selected: String,
  reducedMotion: Boolean,
});
const emit = defineEmits([
  'update:mode',
  'page',
  'annotation',
  'annotations',
  'notice',
  'ready',
  'scroll',
  'cancel-toc',
  'dismiss-toc',
]);
const { innerWidth, innerHeight } = window;
const collapsed = ref(new Set());
const view = ref(),
  dateNow = ref(new Date());
let viewMotion, dateTimer;
async function ready() {
  await nextTick();
  viewMotion?.cancel();
  if (!props.reducedMotion && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    viewMotion = view.value?.animate(
      [
        { opacity: 0, transform: 'translateY(4px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 180, easing: 'ease' },
    );
  emit('ready');
}
watch(() => props.mode, ready, { flush: 'post' });
onMounted(() => {
  emit('ready');
  dateTimer = setInterval(() => (dateNow.value = new Date()), 60000);
});
onBeforeUnmount(() => {
  viewMotion?.cancel();
  clearInterval(dateTimer);
});
// Experimental contents generation keeps the tab available while it runs or reports.
const tocActive = computed(() => props.tocGeneration.status !== 'idle');
const tocRunning = computed(() => props.tocGeneration.status === 'running');
const tocPercent = computed(() => {
  const { done = 0, total = 0 } = props.tocGeneration;
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
});
const tocMessage = computed(() => {
  const { status, source, count } = props.tocGeneration;
  if (status === 'done')
    return tocGenerationLabel(source === 'toc-page' ? 'doneToc' : 'doneHeadings', { count });
  return tocGenerationLabel(status === 'empty' ? 'empty' : 'failed');
});
const tabs = computed(() => [
  'thumbnails',
  ...(props.outline.length || tocActive.value ? ['outline'] : []),
  ...(props.annotations.length ? ['annotations'] : []),
]);
const selectedTab = computed(() => Math.max(0, tabs.value.indexOf(props.mode)));
const hasNestedOutline = computed(() => props.outline.some((item) => item.depth > 0));
const visibleOutline = computed(() =>
  props.outline.filter(
    (item) =>
      !props.outline.some(
        (parent) => collapsed.value.has(parent.id) && item.id.startsWith(parent.id + '.'),
      ),
  ),
);
// Experimental: first sentences of body paragraphs, keyed by the outline entry
// that owns them. The optional Jev classifier can reject non-topic sentences.
const outlineTopicSentences = inject('outlineTopicSentences', null);
const topicSentenceClassifier = inject('topicSentenceClassifier', null);
const topicSentences = computed(() => {
  const sections = outlineTopicSentences?.value;
  if (!sections?.size || props.mode !== 'outline') return new Map();
  const classify = topicSentenceClassifier?.isTopicSentence;
  void topicSentenceClassifier?.revision?.value;
  if (typeof classify !== 'function') return sections;
  const kept = new Map();
  for (const [id, items] of sections) {
    const accepted = items.filter((item) => classify(item.paragraph, item.sentence) !== false);
    if (accepted.length) kept.set(id, accepted);
  }
  return kept;
});
function hasChildren(item) {
  return (
    topicSentences.value.has(item.id) ||
    props.outline.some((child) => child.id.startsWith(item.id + '.'))
  );
}
function toggleOutline(item) {
  const next = new Set(collapsed.value);
  if (next.has(item.id)) next.delete(item.id);
  else next.add(item.id);
  collapsed.value = next;
}
watch(
  () => props.outline,
  () => (collapsed.value = new Set()),
);
const query = ref(''),
  filtersOpen = ref(false),
  kind = ref(''),
  color = ref(''),
  chapter = ref(''),
  from = ref(''),
  to = ref(''),
  group = ref('none');
const chapters = computed(() => annotationChapters(props.outline));
const colors = computed(() =>
  [...new Set(props.annotations.map((a) => a.color?.toLowerCase()).filter(Boolean))].sort(),
);
const filterCount = computed(
  () => [kind.value, color.value, chapter.value, from.value, to.value].filter(Boolean).length,
);
const sections = computed(() =>
  annotationSections(
    props.annotations,
    props.outline,
    {
      query: query.value,
      kind: kind.value,
      color: color.value,
      chapter: chapter.value,
      from: from.value,
      to: to.value,
      group: group.value,
    },
    dateNow.value,
  ),
);
function resetFilters() {
  kind.value = '';
  color.value = '';
  chapter.value = '';
  from.value = '';
  to.value = '';
}
function sectionLabel(section) {
  if (section.key.startsWith('chapter:') && section.key !== 'chapter:unknown') return section.label;
  if (section.key === 'color:unknown') return t('annotationBrowser.unknownColor');
  if (section.key.startsWith('color:')) return colorLabel(section.label);
  return t('annotationBrowser.' + section.key.replace(':', '.'));
}
function colorLabel(value) {
  const names = {
    '#ffff00': 'yellow',
    '#00ff00': 'green',
    '#00ffff': 'cyan',
    '#ff0000': 'red',
    '#af52de': 'purple',
    '#fff36a': 'yellow',
  };
  return names[value] ? t('annotationBrowser.' + names[value]) : value;
}
watch(
  () => props.outline,
  () => {
    chapter.value = '';
    if (group.value === 'chapter' && !chapters.value.length) group.value = 'none';
  },
);
function annotationText(item) {
  return (item.text || '').replace(/[\r\n\u2028\u2029]+/g, '').trim();
}
const annotationMenu = ref(null);
async function annotationAction(name, id, point) {
  annotationMenu.value = null;
  const item = props.annotations.find((a) => a.id === id);
  if (!item) return;
  try {
    if (name === '删除') {
      if (
        window.previewAnnotations?.confirmDelete &&
        !(await window.previewAnnotations.confirmDelete(item.kind))
      )
        return;
      if (props.annotations.some((a) => a.id === id))
        emit(
          'annotations',
          props.annotations.filter((a) => a.id !== id),
        );
    } else if (name === '复制') {
      const text = [item.text, item.comment].filter(Boolean).join('\n\n');
      await (
        window.previewClipboard?.writeText ||
        navigator.clipboard.writeText.bind(navigator.clipboard)
      )(text);
      emit('notice', { text: '已复制', ...point });
    }
  } catch (error) {
    emit('notice', { text: '无法完成操作：' + error.message, ...point });
  }
}
async function annotationContextMenu(item, event) {
  const point = { x: event.clientX, y: event.clientY };
  if (window.previewAnnotations?.contextMenu) {
    try {
      const action = await window.previewAnnotations.contextMenu(item.kind, 'sidebar');
      if (action) await annotationAction(action, item.id, point);
    } catch (error) {
      emit('notice', { text: '无法打开菜单：' + error.message, ...point });
    }
  } else {
    annotationMenu.value = { id: item.id, ...point };
    await nextTick();
    document.querySelector('.sidebar-annotation-menu button')?.focus();
  }
}
function annotationDate(item) {
  const value = item.modifiedAt || (!item.dateUnknown && item.createdAt),
    date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(uiLanguage.value, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : t('annotationBrowser.date.unknown');
}
watch(
  () => [props.mode, props.outline.length, props.annotations.length, tocActive.value],
  () => {
    if (
      (props.mode === 'outline' && !props.outline.length && !tocActive.value) ||
      (props.mode === 'annotations' && !props.annotations.length)
    )
      emit('update:mode', 'thumbnails');
  },
  { immediate: true },
);
</script>
<template>
  <Teleport to="body">
    <div
      v-if="annotationMenu"
      class="sidebar-annotation-menu-backdrop"
      @pointerdown.self="annotationMenu = null"
      @contextmenu.prevent.self="annotationMenu = null"
      @keydown.esc.stop="annotationMenu = null"
    >
      <div
        class="sidebar-annotation-menu"
        role="menu"
        :style="{
          left: Math.min(annotationMenu.x, innerWidth - 160) + 'px',
          top: Math.min(annotationMenu.y, innerHeight - 90) + 'px',
        }"
      >
        <button
          role="menuitem"
          @click="annotationAction('复制', annotationMenu.id, annotationMenu)"
        >
          Copy
        </button>
        <button
          role="menuitem"
          @click="annotationAction('删除', annotationMenu.id, annotationMenu)"
        >
          Delete
        </button>
      </div>
    </div>
  </Teleport>
  <div ref="view" class="sidebar-view">
    <div v-show="mode === 'thumbnails'" class="sidebar-thumbnail-view"><slot></slot></div>
    <div
      v-show="mode === 'outline'"
      class="sidebar-navigation-list"
      :aria-label="t('sidebar.outline')"
      @scroll.passive="emit('scroll', $event)"
    >
      <div v-if="tocActive" class="sidebar-toc-status" role="status" aria-live="polite">
        <template v-if="tocRunning">
          <span>{{
            tocGenerationLabel('reading', { done: tocGeneration.done, total: tocGeneration.total })
          }}</span>
          <div
            class="sidebar-toc-progress"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-valuenow="tocPercent"
          >
            <span :style="{ width: tocPercent + '%' }"></span>
          </div>
          <button class="sidebar-toc-action" @click="emit('cancel-toc')">
            {{ tocGenerationLabel('cancel') }}
          </button>
        </template>
        <template v-else>
          <span>{{ tocMessage }}</span>
          <button class="sidebar-toc-action" @click="emit('dismiss-toc')">
            {{ tocGenerationLabel('dismiss') }}
          </button>
        </template>
      </div>
      <template v-for="item in visibleOutline" :key="item.id"
        ><div
          class="sidebar-outline-row"
          :style="{ paddingLeft: 6 + Math.min(item.depth, 8) * 12 + 'px' }"
        >
          <button
            v-if="hasChildren(item)"
            class="sidebar-outline-toggle"
            :aria-expanded="!collapsed.has(item.id)"
            :aria-label="
              t(collapsed.has(item.id) ? 'sidebar.expand' : 'sidebar.collapse', {
                title: item.title,
              })
            "
            @click="toggleOutline(item)"
          >
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m4 2 4 4-4 4" /></svg></button
          ><span v-else class="sidebar-outline-spacer"></span>
          <button
            class="sidebar-outline-item"
            :class="{
              'sidebar-outline-top-level': hasNestedOutline && item.depth === 0,
              'sidebar-outline-read': readChapters.has(item.id),
            }"
            :disabled="!item.page && !hasChildren(item)"
            @click="item.page && $event.detail < 2 && emit('page', item.page)"
            @dblclick="hasChildren(item) && toggleOutline(item)"
          >
            <span>{{ item.title }}</span
            ><small v-if="item.page">{{ item.page }}</small>
          </button>
        </div>
        <template v-if="!collapsed.has(item.id)">
          <button
            v-for="topic in topicSentences.get(item.id)"
            :key="topic.id"
            class="sidebar-outline-topic"
            :style="{ paddingLeft: 28 + Math.min(item.depth + 1, 8) * 12 + 'px' }"
            :title="topic.sentence"
            @click="emit('page', topic.page)"
          >
            <span>{{ topic.sentence }}</span
            ><small>{{ topic.page }}</small>
          </button>
        </template></template
      >
    </div>
    <div v-show="mode === 'annotations'" class="sidebar-annotations-view">
      <div class="annotation-browser-controls">
        <label class="annotation-browser-search"
          ><svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="m10 10 4 4" /></svg
          ><input
            v-model="query"
            type="search"
            :placeholder="t('annotationBrowser.search')"
            :aria-label="t('annotationBrowser.search')"
            @keydown.esc.stop="query = ''"
        /></label>
        <div class="annotation-browser-toolbar">
          <button
            class="annotation-browser-filter"
            :aria-expanded="filtersOpen"
            aria-controls="annotation-browser-filters"
            @click="filtersOpen = !filtersOpen"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4 8h8M6 12h4" /></svg
            >{{ t('annotationBrowser.filter') }}<span v-if="filterCount"> · {{ filterCount }}</span>
          </button>
          <label class="annotation-browser-group"
            ><select v-model="group" :aria-label="t('annotationBrowser.group')">
              <option
                v-for="value in [
                  'none',
                  'kind',
                  'date',
                  'color',
                  ...(chapters.length ? ['chapter'] : []),
                ]"
                :key="value"
                :value="value"
              >
                {{
                  t(
                    'annotationBrowser.' +
                      (['kind', 'date', 'chapter'].includes(value) ? value + 'Label' : value),
                  )
                }}
              </option>
            </select></label
          >
        </div>
        <div v-if="filtersOpen" id="annotation-browser-filters" class="annotation-browser-filters">
          <label
            >{{ t('annotationBrowser.kindLabel')
            }}<select v-model="kind">
              <option value="">{{ t('annotationBrowser.all') }}</option>
              <option value="highlight">{{ t('sidebar.highlight') }}</option>
              <option value="comment">{{ t('sidebar.comment') }}</option>
            </select></label
          >
          <label
            >{{ t('annotationBrowser.color')
            }}<select v-model="color">
              <option value="">{{ t('annotationBrowser.all') }}</option>
              <option v-for="value in colors" :key="value" :value="value">
                {{ colorLabel(value) }}
              </option>
            </select></label
          >
          <label v-if="chapters.length"
            >{{ t('annotationBrowser.chapterLabel')
            }}<select v-model="chapter">
              <option value="">{{ t('annotationBrowser.all') }}</option>
              <option v-for="item in chapters" :key="item.id" :value="item.id">
                {{ item.title }}
              </option>
            </select></label
          >
          <label
            >{{ t('annotationBrowser.from')
            }}<input v-model="from" type="date" :max="to || undefined" /></label
          ><label
            >{{ t('annotationBrowser.to')
            }}<input v-model="to" type="date" :min="from || undefined"
          /></label>
          <button v-if="filterCount" class="annotation-browser-reset" @click="resetFilters">
            {{ t('annotationBrowser.reset') }}
          </button>
        </div>
      </div>
      <div
        class="sidebar-navigation-list"
        :aria-label="t('sidebar.annotations')"
        @scroll.passive="emit('scroll', $event)"
      >
        <p v-if="!sections.length" class="annotation-browser-empty" role="status">
          {{ t('annotationBrowser.empty') }}
        </p>
        <section
          v-for="section in sections"
          :key="section.key"
          class="annotation-browser-section"
          :aria-label="group !== 'none' ? sectionLabel(section) : undefined"
        >
          <h3 v-if="group !== 'none'" class="annotation-browser-heading">
            <i
              v-if="group === 'color' && section.key !== 'color:unknown'"
              :style="{ background: section.label }"
            ></i
            >{{ sectionLabel(section) }}<span>{{ section.items.length }}</span>
          </h3>
          <button
            v-for="item in section.items"
            :key="item.id"
            class="sidebar-annotation-item"
            :class="{ selected: selected === item.id }"
            @click="emit('annotation', item)"
            @contextmenu.prevent.stop="annotationContextMenu(item, $event)"
          >
            <span class="sidebar-annotation-meta"
              ><i :style="{ background: item.kind === 'comment' ? '#8e8e93' : item.color }"></i
              >{{ t(item.origin === 'translation' ? 'sidebar.translation' : 'sidebar.source') }} ·
              {{ t('sidebar.page', { page: item.page }) }} ·
              <time>{{ annotationDate(item) }}</time></span
            >
            <span v-if="annotationText(item)" class="sidebar-annotation-text">{{
              annotationText(item)
            }}</span
            ><span v-if="item.comment" class="sidebar-annotation-comment">{{ item.comment }}</span>
            <span v-if="!annotationText(item) && !item.comment">{{
              t(item.kind === 'comment' ? 'sidebar.comment' : 'sidebar.highlight')
            }}</span>
          </button>
        </section>
      </div>
    </div>
  </div>
  <AppSegmentedControl
    v-if="platform === 'win32' && (outline.length || annotations.length)"
    class="sidebar-navigation-switch fluent-sidebar-switch"
    :model-value="mode"
    :aria-label="t('sidebar.view')"
    @update:model-value="emit('update:mode', $event)"
  >
    <AppSegment v-for="tab in tabs" :key="tab" :value="tab">{{ t('sidebar.' + tab) }}</AppSegment>
  </AppSegmentedControl>
  <div
    v-else-if="outline.length || annotations.length"
    class="sidebar-navigation-switch"
    role="group"
    :aria-label="t('sidebar.view')"
  >
    <span
      class="sidebar-tab-indicator"
      :style="{
        width: `calc((100% - 4px - ${(tabs.length - 1) * 2}px) / ${tabs.length})`,
        transform: `translateX(calc(${selectedTab * 100}% + ${selectedTab * 2}px))`,
      }"
      aria-hidden="true"
    ></span>
    <button
      v-for="tab in tabs"
      :key="tab"
      :aria-pressed="mode === tab"
      @click="emit('update:mode', tab)"
    >
      {{ t('sidebar.' + tab) }}
    </button>
  </div>
</template>
<style>
.fluent-sidebar-switch {
  display: flex;
  width: 100%;
}
.fluent-sidebar-switch > fluent-tab {
  flex: 1;
  min-width: 0;
}
.fluent-sidebar-switch > fluent-tab {
  padding: 6px 4px;
  font-size: 11px;
}
.sidebar-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sidebar-thumbnail-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.sidebar-navigation-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 6px;
  scrollbar-width: thin;
}
.sidebar-toc-status {
  display: grid;
  gap: 6px;
  margin: 0 2px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text) 5%, transparent);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
}
.sidebar-toc-progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.sidebar-toc-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 160ms ease;
}
.sidebar-toc-action {
  justify-self: start;
  border: 0;
  background: transparent;
  padding: 0;
  color: var(--accent);
  font: inherit;
  cursor: pointer;
}
.sidebar-outline-item,
.sidebar-annotation-item {
  display: flex;
  width: 100%;
  text-align: left;
  border: 0;
  background: transparent;
  border-radius: 6px;
  padding: 9px 8px;
  color: var(--text);
  gap: 8px;
  cursor: pointer;
}
.sidebar-outline-row {
  display: flex;
  align-items: flex-start;
  border-radius: 6px;
}
.sidebar-outline-item {
  flex: 1;
  min-width: 0;
  padding-left: 2px;
  font-size: 13px;
  line-height: 1.4;
}
.sidebar-outline-spacer,
.sidebar-outline-toggle {
  flex: 0 0 20px;
  width: 20px;
  height: 18.2px;
  margin-top: 9px;
}
.sidebar-outline-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}
.sidebar-outline-toggle svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  transition: transform 0.18s ease;
}
.sidebar-outline-toggle[aria-expanded='true'] svg {
  transform: rotate(90deg);
}
.sidebar-outline-item span {
  flex: 1;
  overflow-wrap: anywhere;
}
.sidebar-outline-item small {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.sidebar-outline-top-level span {
  font-weight: 700;
}
.sidebar-outline-topic {
  display: flex;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 4px 8px;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.sidebar-outline-topic span {
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow-wrap: anywhere;
}
.sidebar-outline-topic small {
  flex-shrink: 0;
}
.sidebar-outline-topic:hover {
  background: var(--chrome-pressed);
  color: var(--text);
}
.sidebar-outline-item.sidebar-outline-read {
  color: var(--text-secondary);
}
.sidebar-outline-item:disabled {
  cursor: default;
  color: var(--text-secondary);
}
.sidebar-annotation-item {
  flex-direction: column;
  gap: 5px;
  border-bottom: 1px solid var(--chrome-border);
}
.sidebar-outline-row:has(.sidebar-outline-item:not(:disabled)):hover,
.sidebar-annotation-item:hover,
.sidebar-annotation-item.selected {
  background: var(--chrome-pressed);
}
.sidebar-annotation-meta {
  font-size: 10px;
  line-height: 1;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}
.sidebar-annotation-meta i {
  width: 1em;
  height: 1em;
  box-sizing: border-box;
  border-radius: 50%;
  corner-shape: round;
  flex-shrink: 0;
  border: 1px solid #0002;
}
.sidebar-annotation-text,
.sidebar-annotation-comment {
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sidebar-annotation-comment {
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.sidebar-navigation-switch {
  position: relative;
  display: flex;
  flex: 0 0 auto;
  margin: 8px;
  padding: 2px;
  gap: 2px;
  background: var(--chrome-pressed);
  border: 1px solid var(--chrome-border);
  border-radius: 7px;
}
.sidebar-navigation-switch button {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 5px;
  padding: 5px 2px;
  font-size: 11px;
  background: transparent;
  cursor: pointer;
}
.sidebar-tab-indicator {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 2px;
  border-radius: 5px;
  background: var(--chrome);
  box-shadow: 0 1px 3px #0002;
  transition:
    transform 0.2s cubic-bezier(0.22, 0.75, 0.2, 1),
    width 0.2s ease;
  pointer-events: none;
}
[data-reduce-motion='true'] :is(.sidebar-tab-indicator, .sidebar-outline-toggle svg) {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .sidebar-tab-indicator,
  .sidebar-outline-toggle svg,
  .sidebar-view-motion-enter-active,
  .sidebar-view-motion-leave-active {
    transition: none;
  }
}
.sidebar-navigation-switch button:focus-visible,
.sidebar-navigation-list button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.sidebar:has(.sidebar-navigation-switch),
.sidebar:has(.sidebar-navigation-list) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar .thumbnail-list {
  flex: 1;
  min-height: 0;
}

/* Inset macOS rows: selection is a soft surface, rather than a bordered card. */
/* Use visible circular arcs for sidebar surfaces beside native window corners. */
.app[data-platform='darwin'] .sidebar {
  --sidebar-edge-inset: 10px;
  --sidebar-edge-radius: 14px;
}
.app[data-platform='darwin'] .sidebar-navigation-list {
  padding: 10px var(--sidebar-edge-inset);
}
.app[data-platform='darwin'] .sidebar-annotation-item {
  border: 0;
  border-radius: var(--sidebar-edge-radius);
  corner-shape: round;
  padding: 10px;
  margin-bottom: 4px;
  box-shadow: none;
  transition: background-color 120ms ease;
}
.app[data-platform='darwin'] .sidebar-annotation-item:hover {
  background: color-mix(in srgb, var(--text) 5%, transparent);
}
.app[data-platform='darwin'] .sidebar-annotation-item.selected {
  background: color-mix(in srgb, var(--text) 10%, transparent);
}
.app[data-platform='darwin'] .sidebar-outline-row,
.app[data-platform='darwin'] .sidebar-outline-item {
  border-radius: var(--sidebar-edge-radius);
  corner-shape: round;
}
.app[data-platform='darwin'] .sidebar-navigation-switch {
  --sidebar-switch-radius: var(--sidebar-edge-radius);
  --sidebar-switch-inset: 2px;
  margin: 8px var(--sidebar-edge-inset) var(--sidebar-edge-inset);
  padding: var(--sidebar-switch-inset);
  border: 0;
  border-radius: var(--sidebar-switch-radius);
  corner-shape: round;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 6%, transparent);
}
.app[data-platform='darwin'] .sidebar-navigation-switch button,
.app[data-platform='darwin'] .sidebar-tab-indicator {
  border-radius: calc(var(--sidebar-switch-radius) - var(--sidebar-switch-inset));
  corner-shape: round;
}
.app[data-platform='darwin'] .sidebar-tab-indicator {
  box-shadow:
    0 1px 3px #00000014,
    inset 0 0 0 1px #ffffff18;
}
@media (prefers-reduced-motion: reduce) {
  .app[data-platform='darwin'] .sidebar-annotation-item {
    transition: none;
  }
}
[data-reduce-motion='true'] .app[data-platform='darwin'] .sidebar-annotation-item {
  transition: none;
}
</style>

<style>
.sidebar-annotations-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.annotation-browser-controls {
  flex: none;
  padding: 10px 10px 4px;
  color: var(--text-secondary);
  font-size: 11px;
}
.annotation-browser-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 14px;
  corner-shape: round;
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--chrome-border);
}
.annotation-browser-controls svg {
  width: 14px;
  height: 14px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}
.annotation-browser-search input {
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  outline: none;
}
.annotation-browser-search:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.annotation-browser-search input::placeholder {
  color: var(--text-secondary);
}
.annotation-browser-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 7px;
  flex-wrap: wrap;
}
.annotation-browser-filter {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 14px;
  corner-shape: round;
  min-height: 28px;
  padding: 4px 7px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: default;
}
.annotation-browser-filter:hover,
.annotation-browser-filter[aria-expanded='true'] {
  background: var(--chrome-pressed);
}
.annotation-browser-group {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.annotation-browser-controls select,
.annotation-browser-filters input {
  box-sizing: border-box;
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--chrome-border);
  border-radius: 14px;
  corner-shape: round;
  min-height: 28px;
  padding: 4px 8px;
  background: transparent;
  color: var(--text-secondary);
  font: inherit;
  color-scheme: inherit;
}
.annotation-browser-group select {
  max-width: 110px;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 25px;
  background: transparent;
}
.annotation-browser-group {
  position: relative;
}
.annotation-browser-group:after {
  content: '';
  position: absolute;
  right: 10px;
  top: calc(50% - 4px);
  width: 5px;
  height: 5px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg);
  pointer-events: none;
}
.annotation-browser-filters {
  max-height: 240px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 9px;
  padding-bottom: 5px;
}
.annotation-browser-filters label {
  display: grid;
  grid-template-columns: 65px minmax(0, 1fr);
  align-items: center;
  gap: 5px;
}
.annotation-browser-reset {
  align-self: flex-end;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 3px;
  cursor: default;
  text-decoration: underline;
}
.annotation-browser-controls :is(button, select, input[type='date']):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.annotation-browser-heading {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 8px 4px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.annotation-browser-heading span {
  margin-left: auto;
  font-weight: 400;
}
.annotation-browser-heading i {
  width: 9px;
  height: 9px;
  border: 1px solid #8884;
  border-radius: 50%;
  flex: none;
}
.annotation-browser-empty {
  padding: 20px 8px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
}
</style>

<style>
.sidebar-annotation-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
}
.sidebar-annotation-menu {
  position: absolute;
  width: 150px;
  padding: 4px;
  border-radius: 8px;
  background: var(--chrome);
  color: var(--text);
  box-shadow: 0 4px 20px #0004;
}
.sidebar-annotation-menu button {
  display: block;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.sidebar-annotation-menu button:hover,
.sidebar-annotation-menu button:focus-visible {
  background: var(--chrome-pressed);
}
</style>
