<script setup>
import { AppPopUpButton, AppPopUpButtonItem } from '../../../ui/controls.mjs';

// Kernel and service pickers for one side of the comparison header.
defineProps({
  draft: { type: Object, required: true },
  kernelIds: { type: Array, required: true },
  catalog: { type: Object, required: true },
  itemLabel: { type: Function, required: true },
  kernelLabel: { type: String, required: true },
  serviceLabel: { type: String, required: true },
});
</script>

<template>
  <div class="compare-controls">
    <div class="compare-control" data-popover-trigger>
      <AppPopUpButton
        size="small"
        :model-value="draft.kernel"
        :aria-label="kernelLabel"
        teleport-to="body"
        @update:model-value="draft.changeKernel"
      >
        <AppPopUpButtonItem
          v-for="id in kernelIds"
          :key="id"
          :value="id"
          :disabled="catalog[id].status === 'missing'"
          >{{ itemLabel(id) }}</AppPopUpButtonItem
        >
      </AppPopUpButton>
    </div>
    <div class="compare-control" data-popover-trigger>
      <AppPopUpButton
        size="small"
        :model-value="draft.service"
        :disabled="!draft.services.length"
        :aria-label="serviceLabel"
        teleport-to="body"
        @update:model-value="draft.changeService"
      >
        <AppPopUpButtonItem
          v-for="option in draft.services"
          :key="option.value"
          :value="option.value"
          >{{ option.label }}</AppPopUpButtonItem
        >
      </AppPopUpButton>
    </div>
  </div>
</template>
