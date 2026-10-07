<script setup>
import { ref, watch, onBeforeUnmount } from 'vue';
import { t } from '../../i18n/index.mjs';
const props = defineProps({ document: Object, pageNumber: Number, zoom: Number, active: Boolean });
const emit = defineEmits(['navigate']),
  links = ref([]);
let generation = 0;
watch(
  () => [props.document, props.pageNumber, props.zoom, props.active],
  async () => {
    const token = ++generation;
    links.value = [];
    if (!props.active || !props.document) return;
    try {
      const page = await props.document.getPage(props.pageNumber),
        annotations = await page.getAnnotations({ intent: 'display' });
      if (token !== generation) return;
      const viewport = page.getViewport({ scale: props.zoom });
      links.value = annotations
        .filter((a) => a.subtype === 'Link' && a.dest && a.rect)
        .flatMap((a) => {
          const regions = [];
          if (a.quadPoints?.length)
            for (let i = 0; i + 7 < a.quadPoints.length; i += 8)
              regions.push(Array.from(a.quadPoints.slice(i, i + 8)));
          if (!regions.length) regions.push([a.rect[0], a.rect[1], a.rect[2], a.rect[3]]);
          return regions.map((region, index) => {
            const points = [];
            for (let i = 0; i < region.length; i += 2)
              points.push(viewport.convertToViewportPoint(region[i], region[i + 1]));
            const xs = points.map((p) => p[0]),
              ys = points.map((p) => p[1]),
              left = Math.min(...xs),
              top = Math.min(...ys);
            return {
              id: a.id + ':' + index,
              dest: a.dest,
              style: {
                left: left + 'px',
                top: top + 'px',
                width: Math.max(...xs) - left + 'px',
                height: Math.max(...ys) - top + 'px',
              },
            };
          });
        });
    } catch (e) {
      if (token === generation) console.error('PDF links failed', e);
    }
  },
  { immediate: true },
);
onBeforeUnmount(() => generation++);
</script>
<template>
  <div class="reading-links">
    <a
      v-for="link in links"
      :key="link.id"
      href="#"
      :style="link.style"
      :aria-label="t('navigator.followReference')"
      :title="t('navigator.followReference')"
      @click.prevent.stop="emit('navigate', link.dest)"
    ></a>
  </div>
</template>
<style>
.reading-links {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}
.reading-links a {
  position: absolute;
  pointer-events: auto;
  cursor: pointer;
  background: transparent;
}
.reading-links a:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.reading-links a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
