<script setup>
import { computed } from 'vue';

const props = defineProps({
  provider: { type: [String, Object], default: '' },
  providerId: { type: String, default: '' },
  label: { type: String, default: '' },
  size: { type: [Number, String], default: 26 },
});

const sourceText = computed(() => {
  const value = props.provider;
  if (value && typeof value === 'object') return [value.id, value.label].filter(Boolean).join(' ');
  return [props.providerId, value, props.label].filter(Boolean).join(' ');
});
const normalized = computed(() => sourceText.value.toLowerCase().replace(/[\s_]+/g, '-'));
const kind = computed(() => {
  const value = normalized.value;
  if (value.includes('azure')) return 'azure';
  if (value.includes('openai') || value.includes('chatgpt')) return 'openai';
  if (value.includes('anthropic') || value.includes('claude')) return 'anthropic';
  if (value.includes('google') || value.includes('gemini')) return 'google';
  if (value.includes('deepseek')) return 'deepseek';
  if (value.includes('ollama')) return 'ollama';
  if (value.includes('siliconflow') || value.includes('silicon-flow') || value.includes('silicon'))
    return 'siliconflow';
  if (value.includes('apple') || value.includes('local')) return 'apple';
  return 'generic';
});
const initial = computed(() => {
  const value = (props.label || props.providerId || sourceText.value || '?').trim();
  return value.slice(0, 1).toUpperCase();
});
</script>

<template>
  <span
    class="provider-icon"
    :data-provider-kind="kind"
    :style="{ '--provider-icon-size': `${size}px` }"
    aria-hidden="true"
  >
    <svg v-if="kind === 'openai'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M12.3 2.4a4.2 4.2 0 0 1 4 2.9 4.2 4.2 0 0 1 4.2 3.7 4.2 4.2 0 0 1-1.4 3.7 4.2 4.2 0 0 1-1.2 5 4.2 4.2 0 0 1-4.1.6 4.2 4.2 0 0 1-4.4 2.5 4.2 4.2 0 0 1-3.4-2.6 4.2 4.2 0 0 1-3.4-4 4.2 4.2 0 0 1 1.8-3.7 4.2 4.2 0 0 1 1.4-4.9 4.2 4.2 0 0 1 5-.1 4.2 4.2 0 0 1 1.5-2.1Zm-.3 2.1a2.2 2.2 0 0 0-1.1 2.8l.2.6-4.5 2.6a2.2 2.2 0 0 0-.8 3 2.2 2.2 0 0 0 3 .8l4.5-2.6.5.4v5.2a2.2 2.2 0 0 0 4.4.1 2.2 2.2 0 0 0-1.1-1.9l-4.5-2.6v-.6l4.5-2.6a2.2 2.2 0 0 0-2.2-3.8l-4.5 2.6-.6-.2a2.2 2.2 0 0 0-2.3-1.8Zm-3 11.2a2.2 2.2 0 0 0-1.3 2.7 2.2 2.2 0 0 0 2.7 1.3 2.2 2.2 0 0 0 1.3-2.7 2.2 2.2 0 0 0-2.7-1.3Z"
        fill="currentColor"
        fill-rule="evenodd"
      />
    </svg>
    <svg v-else-if="kind === 'anthropic'" viewBox="0 0 24 24" focusable="false">
      <path
        d="m12 2.2 1.65 5.4 5.2-2.3-2.3 5.2 5.4 1.65-5.4 1.65 2.3 5.2-5.2-2.3L12 22.1l-1.65-5.4-5.2 2.3 2.3-5.2-5.4-1.65 5.4-1.65-2.3-5.2 5.2 2.3L12 2.2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="2.1" fill="var(--chrome-raised,#fff)" />
    </svg>
    <svg v-else-if="kind === 'google'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.4 3-7.3Z"
        fill="currentColor"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3.1v2.6A10 10 0 0 0 12 22Z"
        fill="currentColor"
      />
      <path d="M6.4 13.8a6 6 0 0 1 0-3.6V7.6H3.1a10 10 0 0 0 0 8.8l3.3-2.6Z" fill="currentColor" />
      <path
        d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2a10 10 0 0 0-8.9 5.6l3.3 2.6C7.2 7.8 9.4 6 12 6Z"
        fill="currentColor"
      />
    </svg>
    <svg v-else-if="kind === 'deepseek'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M4 14.3c1.2-4.8 5.1-7.4 9.3-6.7 2.8.5 4.9 2.1 6.7 4.2-1.4-.6-2.7-.7-3.8-.3 1.4.5 2.5 1.4 3.3 2.7-2.8-.5-4.7.2-6.4 1.9-1.8 1.8-4.4 2.5-6.8 1.2-1.2-.7-2-1.7-2.3-3Z"
        fill="currentColor"
      />
      <path
        d="M6.4 12.1c1.7.5 3.1.3 4.3-.7-1.1-.1-2.1-.5-3-1.2"
        fill="none"
        stroke="var(--chrome-raised,#fff)"
        stroke-width="1.1"
        stroke-linecap="round"
      />
      <circle cx="15.7" cy="11.7" r=".9" fill="var(--chrome-raised,#fff)" />
    </svg>
    <svg v-else-if="kind === 'azure'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M4 19.7 10.5 4h3.2L20 19.7h-3.5l-1.3-3.4H9l-1.3 3.4H4Zm6.2-6.1h4l-2-5.3-2 5.3Z"
        fill="currentColor"
      />
      <path d="m15.8 16.3 1.8 3.4h-4.2l-1.3-3.4h3.7Z" fill="currentColor" opacity=".55" />
    </svg>
    <svg v-else-if="kind === 'ollama'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M7.1 8.4c.1-2.8 2-4.8 4.9-4.8s4.8 2 4.9 4.8c1.3.9 2.1 2.4 2.1 4.1 0 3.2-2.8 5.6-7 5.6s-7-2.4-7-5.6c0-1.7.8-3.2 2.1-4.1Z"
        fill="currentColor"
      />
      <path
        d="M8.4 8.1 6.7 5.4m8.9 2.7 1.7-2.7M9.2 13h.1m5.4 0h.1"
        fill="none"
        stroke="var(--chrome-raised,#fff)"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <path
        d="M10.1 15.8c1.2.8 2.6.8 3.8 0"
        fill="none"
        stroke="var(--chrome-raised,#fff)"
        stroke-width="1.1"
        stroke-linecap="round"
      />
    </svg>
    <svg v-else-if="kind === 'siliconflow'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M18.8 5.2a8.8 8.8 0 0 0-5.6-2.1C8.2 3.1 4.2 6.8 4.2 11c0 3.4 2.6 5.2 6.1 5.2h2.5c1.6 0 2.3.5 2.3 1.3 0 1.1-1.4 1.8-3.3 1.8-2.3 0-4.1-.8-5.8-2.1l-1.8 2.3c2 1.7 4.5 2.5 7.3 2.5 4.5 0 7.9-2.2 7.9-5.9 0-3.3-2.7-5.1-6.1-5.1h-2.7c-1.4 0-2.1-.5-2.1-1.3 0-.9 1.1-1.6 2.8-1.6 1.6 0 3.2.5 4.6 1.5l1.1-3.3Z"
        fill="currentColor"
      />
    </svg>
    <svg v-else-if="kind === 'apple'" viewBox="0 0 24 24" focusable="false">
      <path
        d="M16.9 12.6c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.7.8-3.4 2.1-1.5 2.6-.4 6.4 1.1 8.5.7 1 1.6 2.1 2.7 2.1 1.1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7 1.2 0 1.9-1 2.6-2 .8-1.1 1.2-2.2 1.2-2.2s-2.3-.9-2.3-3.4Zm-2.2-6.5c.6-.8 1-1.9.9-3-1 .1-2.1.7-2.7 1.5-.6.7-1.1 1.8-.9 2.9 1 .1 2.1-.5 2.7-1.4Z"
        fill="currentColor"
      />
    </svg>
    <svg v-else viewBox="0 0 24 24" focusable="false">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="currentColor" opacity=".16" />
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.4"
      />
      <text
        x="12"
        y="16"
        text-anchor="middle"
        fill="currentColor"
        font-size="10"
        font-weight="700"
        font-family="-apple-system,BlinkMacSystemFont,sans-serif"
      >
        {{ initial }}
      </text>
    </svg>
  </span>
</template>

<style scoped>
.provider-icon {
  display: inline-grid;
  place-items: center;
  width: var(--provider-icon-size);
  height: var(--provider-icon-size);
  flex: 0 0 var(--provider-icon-size);
  color: var(--text-secondary, #68686d);
  line-height: 0;
}
.provider-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
