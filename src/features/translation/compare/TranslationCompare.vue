<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { AppButton, AppPopUpButton, AppPopUpButtonItem } from '../../../ui/controls.mjs';
import { t, uiLanguage } from '../../../i18n/index.mjs';
import { compareLabel } from './compare-labels.mjs';
import ComparePage from './ComparePage.vue';
import CompareSideControls from './CompareSideControls.vue';

const props = defineProps({
  compare: { type: Object, required: true },
  pages: { type: Array, required: true },
  kernelOptions: { type: Array, required: true },
  initialPage: { type: Number, default: 1 },
});

const PADDING = 24;
const GAP = 16;
const ROW_GAP = 18;
const MAX_COLUMN = 920;

const scroller = ref(null);
const viewportWidth = ref(0);
// Classic (non-overlay) scrollbars narrow the pages; the header matches them.
const scrollbarWidth = ref(0);
const visiblePages = ref(new Set());
const label = (key, params) => compareLabel(key, params, uiLanguage.value);

const left = computed(() => props.compare.compareLeft.value);
const right = computed(() => props.compare.compareRight.value);
const catalog = props.compare.compareKernels;

const columnWidth = computed(() =>
  Math.max(120, Math.min(MAX_COLUMN, Math.floor((viewportWidth.value - PADDING * 2 - GAP) / 2))),
);
const rows = computed(() => {
  let top = PADDING;
  return props.pages.map((page) => {
    const height = Math.round((page.height / page.width) * columnWidth.value);
    const row = {
      number: page.number,
      width: page.width,
      height: page.height,
      top,
      rowHeight: height,
    };
    top += height + ROW_GAP;
    return row;
  });
});

function kernelLabel(id) {
  const option = props.kernelOptions.find((item) => item.id === id);
  return option ? t(option.labelKey) : id;
}
function kernelItemLabel(id) {
  const status = catalog[id]?.status;
  return status === 'missing' ? `${kernelLabel(id)} — ${label('notInstalled')}` : kernelLabel(id);
}

// Each side's pickers draft a kernel and service. Once that side is comparing,
// changes apply immediately; the empty right side starts only after Translate.
function sideDraft(side) {
  const compare = props.compare;
  const selection = computed(() => compare.compareSelections[side].value);
  const draft = reactive({
    selection,
    kernel: '',
    service: '',
    services: computed(() => compare.compareServiceOptions(draft.kernel)),
    ready: computed(() => catalog[draft.kernel]?.status === 'ready' && !!draft.service),
    changeKernel(id) {
      draft.kernel = id;
      if (selection.value && catalog[id]?.status === 'ready')
        compare.chooseCompare(side, id, compare.compareDefaultService(id));
    },
    changeService(id) {
      draft.service = id;
      if (selection.value) compare.chooseCompare(side, draft.kernel, id);
    },
    start() {
      if (draft.ready) compare.chooseCompare(side, draft.kernel, draft.service);
    },
  });
  watch(
    selection,
    (value) => {
      if (!value) return;
      draft.kernel = value.kernel;
      draft.service = value.service;
    },
    { immediate: true },
  );
  watch(
    () => [draft.kernel, draft.services.map((item) => item.value).join('\n')],
    () => {
      if (selection.value?.kernel === draft.kernel) return;
      if (!draft.services.some((item) => item.value === draft.service))
        draft.service = compare.compareDefaultService(draft.kernel);
    },
    { immediate: true },
  );
  // A kernel picked while its catalog was loading applies once it is ready.
  watch(
    () => catalog[draft.kernel]?.status,
    (status) => {
      if (status === 'ready' && selection.value && selection.value.kernel !== draft.kernel)
        compare.chooseCompare(side, draft.kernel, compare.compareDefaultService(draft.kernel));
    },
  );
  return draft;
}
const leftDraft = sideDraft('left');
const rightDraft = sideDraft('right');

// Suggest a kernel other than the left one for the empty right side.
function suggestedKernel() {
  const current = leftDraft.kernel;
  const ids = props.compare.compareKernelIds;
  return (
    ids.find((id) => id !== current && catalog[id].status !== 'missing') ||
    ids.find((id) => catalog[id].status !== 'missing') ||
    current ||
    ids[0]
  );
}
watch(
  () => props.compare.compareKernelIds.map((id) => catalog[id].status).join(),
  () => {
    if (rightDraft.selection) return;
    if (!rightDraft.kernel || catalog[rightDraft.kernel]?.status === 'missing')
      rightDraft.kernel = suggestedKernel();
  },
  { immediate: true },
);

let observer;
let resizeObserver;
let reportFrame = 0;
const intersecting = new Set();

function report() {
  cancelAnimationFrame(reportFrame);
  reportFrame = requestAnimationFrame(() => {
    const numbers = [...intersecting].sort((a, b) => a - b);
    visiblePages.value = new Set(numbers);
    const element = scroller.value;
    let focus = numbers[0];
    if (element) {
      // Pages scroll beneath the header, so the reading centre sits below it.
      const inset = parseFloat(getComputedStyle(element).paddingTop) || 0;
      const center = element.scrollTop + (element.clientHeight - inset) / 2;
      let best = Infinity;
      for (const number of numbers) {
        const row = rows.value[number - 1];
        const distance = Math.abs(row.top + row.rowHeight / 2 - center);
        if (distance < best) {
          best = distance;
          focus = number;
        }
      }
    }
    props.compare.showComparePages(numbers, focus);
  });
}

function observeRow(element) {
  if (!element || !observer || element.dataset.observed) return;
  element.dataset.observed = '1';
  observer.observe(element);
}

onMounted(async () => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const number = Number(entry.target.dataset.page);
        if (entry.isIntersecting) intersecting.add(number);
        else intersecting.delete(number);
      }
      report();
    },
    { root: scroller.value, rootMargin: '25% 0px' },
  );
  resizeObserver = new ResizeObserver(() => {
    const element = scroller.value;
    viewportWidth.value = element?.clientWidth || 0;
    scrollbarWidth.value = element ? element.offsetWidth - element.clientWidth : 0;
  });
  resizeObserver.observe(scroller.value);
  viewportWidth.value = scroller.value.clientWidth;
  scrollbarWidth.value = scroller.value.offsetWidth - scroller.value.clientWidth;
  await nextTick();
  for (const element of scroller.value.querySelectorAll('[data-page]')) observeRow(element);
  const row = rows.value[props.initialPage - 1];
  if (row) scroller.value.scrollTop = Math.max(0, row.top - PADDING);
  scroller.value.focus({ preventScroll: true });
});
// Keep the focused page in place when the column width changes.
watch(columnWidth, (next, previous) => {
  const element = scroller.value;
  if (!element || !previous) return;
  const ratio = next / previous;
  nextTick(() => (element.scrollTop *= ratio));
});
onBeforeUnmount(() => {
  cancelAnimationFrame(reportFrame);
  observer?.disconnect();
  resizeObserver?.disconnect();
});
</script>

<template>
  <section
    class="translation-compare"
    role="dialog"
    :aria-label="label('title')"
    :style="{
      '--compare-column': columnWidth + 'px',
      '--compare-gap': GAP + 'px',
      '--compare-scrollbar': scrollbarWidth + 'px',
    }"
  >
    <div ref="scroller" class="compare-scroller" tabindex="0">
      <div
        class="compare-track"
        :style="{
          height: (rows.at(-1)?.top || 0) + (rows.at(-1)?.rowHeight || 0) + PADDING + 'px',
        }"
      >
        <div
          v-for="row in rows"
          :key="row.number"
          :ref="observeRow"
          class="compare-row"
          :data-page="row.number"
          :style="{ top: row.top + 'px', height: row.rowHeight + 'px' }"
        >
          <ComparePage
            :number="row.number"
            :page-width="row.width"
            :page-height="row.height"
            :width="columnWidth"
            :lane="left"
            :visible="visiblePages.has(row.number)"
            :original-page="compare.compareOriginalPage"
          />
          <ComparePage
            :number="row.number"
            :page-width="row.width"
            :page-height="row.height"
            :width="columnWidth"
            :lane="right"
            :blank="!right"
            :visible="visiblePages.has(row.number)"
            :original-page="compare.compareOriginalPage"
          />
          <span class="compare-page-number" aria-hidden="true">{{ row.number }}</span>
        </div>
      </div>
    </div>
    <!-- Each half of the header sits exactly over its page column. -->
    <header class="compare-header">
      <div class="compare-side compare-side-left">
        <CompareSideControls
          :draft="leftDraft"
          :kernel-ids="compare.compareKernelIds"
          :catalog="catalog"
          :item-label="kernelItemLabel"
          :kernel-label="label('kernel')"
          :service-label="label('service')"
        />
      </div>
      <div class="compare-side compare-side-right">
        <CompareSideControls
          v-if="rightDraft.selection"
          :draft="rightDraft"
          :kernel-ids="compare.compareKernelIds"
          :catalog="catalog"
          :item-label="kernelItemLabel"
          :kernel-label="label('kernel')"
          :service-label="label('service')"
        />
        <span v-else class="compare-eyebrow">{{ label('choose') }}</span>
        <AppButton
          class="icon-button compare-close"
          :aria-label="label('close')"
          :title="label('close') + ' (Esc)'"
          @click="compare.closeCompare()"
          ><span
            class="system-icon"
            aria-hidden="true"
            data-symbol="xmark"
            style="--symbol: url('/symbols/xmark.png')"
          ></span
        ></AppButton>
      </div>
    </header>
    <div v-if="!rightDraft.selection" class="compare-picker-host">
      <div class="compare-picker" role="group" :aria-label="label('choose')">
        <h2>{{ label('choose') }}</h2>
        <p class="muted">{{ label('chooseHint') }}</p>
        <label class="compare-field">
          <span>{{ label('kernel') }}</span>
          <AppPopUpButton
            :model-value="rightDraft.kernel"
            :aria-label="label('kernel')"
            teleport-to="body"
            @update:model-value="rightDraft.kernel = $event"
          >
            <AppPopUpButtonItem
              v-for="id in compare.compareKernelIds"
              :key="id"
              :value="id"
              :disabled="catalog[id].status === 'missing'"
              >{{ kernelItemLabel(id) }}</AppPopUpButtonItem
            >
          </AppPopUpButton>
        </label>
        <label class="compare-field">
          <span>{{ label('service') }}</span>
          <AppPopUpButton
            v-if="rightDraft.services.length"
            :model-value="rightDraft.service"
            :aria-label="label('service')"
            teleport-to="body"
            @update:model-value="rightDraft.service = $event"
          >
            <AppPopUpButtonItem
              v-for="option in rightDraft.services"
              :key="option.value"
              :value="option.value"
              >{{ option.label }}</AppPopUpButtonItem
            >
          </AppPopUpButton>
          <span v-else class="muted">{{
            catalog[rightDraft.kernel]?.status === 'ready'
              ? label('noServices')
              : catalog[rightDraft.kernel]?.status === 'missing'
                ? label('notInstalled')
                : catalog[rightDraft.kernel]?.status === 'error'
                  ? catalog[rightDraft.kernel].message
                  : label('loading')
          }}</span>
        </label>
        <AppButton variant="prominent" :disabled="!rightDraft.ready" @click="rightDraft.start()">{{
          label('start')
        }}</AppButton>
      </div>
    </div>
  </section>
</template>
